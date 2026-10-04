/**
 * Email sign-in via a one-time code (the "passwordless magic code" pattern) —
 * an alternative to Google sign-in. Codes are stored in OTP_KV; KV's native
 * per-key TTL maps directly onto "expires in 1 day," no cleanup job needed.
 * Delivered through Resend's HTTP API (https://resend.com) — chosen for its
 * simple REST interface and generous free tier. See docs/ai-rules.md §1.3.
 *
 * The same flow serves both first-time and returning users: entering an
 * email always sends a fresh code, and a correct code either creates the
 * account (first time) or logs into the existing one (upsertUser in db.ts
 * handles both transparently) — an email alone never grants access, only a
 * verified code does.
 */

const OTP_TTL_SECONDS = 24 * 60 * 60;
const MAX_VERIFY_ATTEMPTS = 5;

function otpKey(email: string): string {
	return `otp:${email}`;
}

function attemptsKey(email: string): string {
	return `otp-attempts:${email}`;
}

function generateOtpCode(): string {
	const bytes = new Uint32Array(1);
	crypto.getRandomValues(bytes);
	return String(bytes[0] % 1_000_000).padStart(6, "0");
}

// Only the hash is ever stored in KV — a KV read (dashboard access, a future
// bug that logs values, etc.) can't leak an active, usable code. The code
// itself is short-lived (24h) and rate-limited/lockout-protected, so a plain
// SHA-256 digest (no per-user salt needed) is sufficient here.
async function hashCode(code: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function sendOtpEmail(env: Env, email: string, code: string): Promise<void> {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.RESEND_API_KEY}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			from: "PM Interview Practice <onboarding@resend.dev>",
			to: [email],
			subject: `${code} is your verification code`,
			text: `Enter this code to sign in: ${code}\n\nThis code expires in 24 hours. If you didn't request this, you can safely ignore this email.`,
		}),
	});
	if (!response.ok) {
		throw new Error("Failed to send the verification email.");
	}
}

export async function startEmailSignIn(env: Env, email: string): Promise<void> {
	const code = generateOtpCode();
	await env.OTP_KV.put(otpKey(email), await hashCode(code), { expirationTtl: OTP_TTL_SECONDS });
	// A fresh code resets the attempt budget below.
	await env.OTP_KV.delete(attemptsKey(email));
	await sendOtpEmail(env, email, code);
}

export async function verifyEmailCode(env: Env, email: string, code: string): Promise<boolean> {
	const storedHash = await env.OTP_KV.get(otpKey(email));
	if (!storedHash) return false;

	const attempts = Number((await env.OTP_KV.get(attemptsKey(email))) ?? "0");
	if (attempts >= MAX_VERIFY_ATTEMPTS) {
		// Burn the code on too many wrong guesses — a brute-forcer has to get a
		// fresh email delivery (and start their attempt budget over) rather
		// than grinding the same 6-digit code indefinitely.
		await env.OTP_KV.delete(otpKey(email));
		return false;
	}

	if (storedHash !== (await hashCode(code))) {
		await env.OTP_KV.put(attemptsKey(email), String(attempts + 1), { expirationTtl: OTP_TTL_SECONDS });
		return false;
	}

	await env.OTP_KV.delete(otpKey(email));
	await env.OTP_KV.delete(attemptsKey(email));
	return true;
}
