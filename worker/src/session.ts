/**
 * A minimal HMAC-signed session token — issued after a Google sign-in succeeds,
 * sent back as `Authorization: Bearer <token>` on every subsequent API call.
 * Replaces the old shared x-app-key: this is per-user and cryptographically
 * verified, not a static value that ships in the public frontend bundle.
 */

export interface SessionPayload {
	email: string;
	// Omitted (undefined) for a normal owner session — only ever "demo" for a
	// session issued by POST /api/auth/demo. Keeping this optional means
	// every session token issued before this field existed still verifies
	// and still behaves as an owner session.
	role?: "demo";
	iat: number;
	exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function importHmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function issueSession(payload: { email: string; role?: "demo" }, secret: string, ttlSeconds: number): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const fullPayload: SessionPayload = { email: payload.email, role: payload.role, iat: now, exp: now + ttlSeconds };
	const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)));
	const key = await importHmacKey(secret);
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
	const signatureB64 = base64UrlEncode(new Uint8Array(signature));
	return `${payloadB64}.${signatureB64}`;
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
	const parts = token.split(".");
	if (parts.length !== 2) return null;
	const [payloadB64, signatureB64] = parts;

	let signatureBytes: Uint8Array;
	try {
		signatureBytes = base64UrlDecode(signatureB64);
	} catch {
		return null;
	}

	const key = await importHmacKey(secret);
	// crypto.subtle.verify does a constant-time comparison internally — avoids a
	// timing side-channel that a manual `signature === expected` string check
	// would introduce.
	const signatureValid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(payloadB64));
	if (!signatureValid) return null;

	let payload: SessionPayload;
	try {
		payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
	} catch {
		return null;
	}
	if (typeof payload.email !== "string" || typeof payload.exp !== "number") return null;
	if (payload.exp * 1000 < Date.now()) return null;

	return payload;
}
