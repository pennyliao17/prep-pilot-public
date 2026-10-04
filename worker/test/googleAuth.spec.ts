import { describe, it, expect, vi, afterEach } from "vitest";
import { verifyGoogleIdToken } from "../src/googleAuth";

const AUDIENCE = "test-client-id.apps.googleusercontent.com";

function stubTokenInfo(response: unknown, ok = true) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify(response), { status: ok ? 200 : 400 }))
	);
}

describe("verifyGoogleIdToken", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns the email for a valid, verified, matching-audience token", async () => {
		stubTokenInfo({
			aud: AUDIENCE,
			email: "owner@example.com",
			email_verified: "true",
			exp: String(Math.floor(Date.now() / 1000) + 3600),
		});
		const result = await verifyGoogleIdToken("fake-token", AUDIENCE);
		expect(result.email).toBe("owner@example.com");
	});

	it("rejects a token with the wrong audience", async () => {
		stubTokenInfo({
			aud: "someone-elses-client-id",
			email: "owner@example.com",
			email_verified: "true",
			exp: String(Math.floor(Date.now() / 1000) + 3600),
		});
		await expect(verifyGoogleIdToken("fake-token", AUDIENCE)).rejects.toThrow();
	});

	it("rejects an unverified email", async () => {
		stubTokenInfo({
			aud: AUDIENCE,
			email: "owner@example.com",
			email_verified: "false",
			exp: String(Math.floor(Date.now() / 1000) + 3600),
		});
		await expect(verifyGoogleIdToken("fake-token", AUDIENCE)).rejects.toThrow();
	});

	it("rejects an expired token", async () => {
		stubTokenInfo({
			aud: AUDIENCE,
			email: "owner@example.com",
			email_verified: "true",
			exp: String(Math.floor(Date.now() / 1000) - 3600),
		});
		await expect(verifyGoogleIdToken("fake-token", AUDIENCE)).rejects.toThrow();
	});

	it("rejects when Google itself rejects the token", async () => {
		stubTokenInfo({ error: "invalid_token", error_description: "Invalid Value" }, false);
		await expect(verifyGoogleIdToken("garbage", AUDIENCE)).rejects.toThrow();
	});
});
