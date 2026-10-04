import { describe, it, expect } from "vitest";
import { issueSession, verifySession } from "../src/session";

describe("session", () => {
	it("round-trips a valid session", async () => {
		const token = await issueSession({ email: "owner@example.com" }, "test-secret", 3600);
		const payload = await verifySession(token, "test-secret");
		expect(payload?.email).toBe("owner@example.com");
	});

	it("rejects a token signed with a different secret", async () => {
		const token = await issueSession({ email: "owner@example.com" }, "test-secret", 3600);
		const payload = await verifySession(token, "wrong-secret");
		expect(payload).toBeNull();
	});

	it("rejects a tampered token", async () => {
		const token = await issueSession({ email: "owner@example.com" }, "test-secret", 3600);
		const tampered = token.slice(0, -4) + "abcd";
		const payload = await verifySession(tampered, "test-secret");
		expect(payload).toBeNull();
	});

	it("rejects an expired token", async () => {
		const token = await issueSession({ email: "owner@example.com" }, "test-secret", -10);
		const payload = await verifySession(token, "test-secret");
		expect(payload).toBeNull();
	});

	it("rejects a malformed token", async () => {
		expect(await verifySession("not-a-token", "test-secret")).toBeNull();
		expect(await verifySession("", "test-secret")).toBeNull();
		expect(await verifySession("a.b.c", "test-secret")).toBeNull();
	});
});
