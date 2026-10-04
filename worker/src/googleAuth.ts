/**
 * Verifies a Google Identity Services ID token via Google's tokeninfo endpoint
 * (https://oauth2.googleapis.com/tokeninfo) rather than hand-rolled JWKS/RS256
 * verification. This app has near-zero login volume (a single allowed user), so
 * the extra network hop is a non-issue, and it avoids maintaining our own
 * signature-verification crypto code. See docs/ai-rules.md §1.3 for the reasoning.
 */

export interface GooglePayload {
	email: string;
}

interface TokenInfoResponse {
	aud?: string;
	email?: string;
	email_verified?: string | boolean;
	exp?: string;
	error?: string;
	error_description?: string;
}

export async function verifyGoogleIdToken(idToken: string, expectedAudience: string): Promise<GooglePayload> {
	const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
	const body = (await response.json().catch(() => null)) as TokenInfoResponse | null;

	if (!response.ok || !body || body.error) {
		throw new Error(body?.error_description ?? "Google rejected this token.");
	}
	if (body.aud !== expectedAudience) {
		throw new Error("Token audience does not match this app's Google client ID.");
	}
	if (body.email_verified !== true && body.email_verified !== "true") {
		throw new Error("Google account email is not verified.");
	}
	if (!body.email) {
		throw new Error("Token did not include an email address.");
	}
	const exp = Number(body.exp);
	if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
		throw new Error("Token has expired.");
	}

	return { email: body.email };
}
