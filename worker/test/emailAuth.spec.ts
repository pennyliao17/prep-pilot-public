import { env } from "cloudflare:test";
import { describe, it, expect, vi, afterEach } from "vitest";
import { startEmailSignIn, verifyEmailCode } from "../src/emailAuth";

function stubResend() {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ id: "test" }), { status: 200 }))
	);
}

function extractSentCode(): string {
	const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
	const [, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
	const body = JSON.parse(init.body as string) as { text: string };
	const code = body.text.match(/\d{6}/)?.[0];
	if (!code) throw new Error("Test setup error: no 6-digit code found in the stubbed email body.");
	return code;
}

describe("email OTP sign-in", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("issues a code that verifies successfully exactly once", async () => {
		stubResend();
		const email = "otp-test-1@example.com";
		await startEmailSignIn(env, email);
		const code = extractSentCode();

		expect(await verifyEmailCode(env, email, code)).toBe(true);
		// Single-use: verifying again with the same code should now fail.
		expect(await verifyEmailCode(env, email, code)).toBe(false);
	});

	it("rejects a wrong code", async () => {
		stubResend();
		const email = "otp-test-2@example.com";
		await startEmailSignIn(env, email);
		expect(await verifyEmailCode(env, email, "000000")).toBe(false);
	});

	it("rejects verification for an email that never requested a code", async () => {
		expect(await verifyEmailCode(env, "never-requested@example.com", "123456")).toBe(false);
	});

	it("burns the code after too many wrong guesses", async () => {
		stubResend();
		const email = "otp-test-3@example.com";
		await startEmailSignIn(env, email);
		const code = extractSentCode();

		for (let i = 0; i < 5; i++) {
			expect(await verifyEmailCode(env, email, "000000")).toBe(false);
		}
		// The correct code no longer works — it was invalidated after the 5th miss,
		// forcing a fresh email rather than letting an attacker keep guessing.
		expect(await verifyEmailCode(env, email, code)).toBe(false);
	});

	it("throws if Resend rejects the send", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 500 })));
		await expect(startEmailSignIn(env, "otp-test-4@example.com")).rejects.toThrow();
	});

	// A KV read (dashboard, a future logging bug, etc.) should never expose an
	// active, usable code — only its SHA-256 digest should ever be at rest.
	it("stores the code as a SHA-256 hash in KV, not in plaintext", async () => {
		stubResend();
		const email = "otp-test-5@example.com";
		await startEmailSignIn(env, email);
		const code = extractSentCode();

		const stored = await env.OTP_KV.get(`otp:${email}`);
		expect(stored).not.toBeNull();
		expect(stored).not.toBe(code);
		expect(stored).toMatch(/^[0-9a-f]{64}$/); // hex-encoded SHA-256 digest

		const expectedHash = Array.from(
			new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)))
		)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		expect(stored).toBe(expectedHash);
	});
});
