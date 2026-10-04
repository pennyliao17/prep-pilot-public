import { env, createExecutionContext, waitOnExecutionContext, createScheduledController } from "cloudflare:test";
import { describe, it, expect, vi, afterEach, afterAll, beforeEach } from "vitest";
import worker from "../src/index";
import { issueSession } from "../src/session";
import { getSqlClient, upsertUser } from "../src/db";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// These tests hit the real production Neon database on purpose, so every row
// they write is briefly real, user-visible data until cleanup runs — the
// owner opened their Dashboard mid-run and saw a "A test answer." attempt.
// Cleanup alone can't fix that window, so the whole file runs as a dedicated
// test identity instead of the owner's real account: ALLOWED_EMAIL is
// overridden for this file's env, which makes every authed() request, every
// attempts/stories/profile/interview-rounds write, and the afterAll sweep
// below operate on the test user's rows. The owner's Dashboard, Story Bank,
// and resume/JD profile are never touched, not even temporarily.
const TEST_OWNER_EMAIL = "test-runner@preppilot.local";
env.ALLOWED_EMAIL = TEST_OWNER_EMAIL;
await upsertUser(getSqlClient(env.DATABASE_URL), TEST_OWNER_EMAIL);

// A real, validly-signed session for the (test) allowed email, computed once and
// reused — this test runtime is itself the Workers runtime (via
// @cloudflare/vitest-pool-workers), so the same crypto.subtle-based session
// module used in production works identically here.
const validSessionToken = await issueSession({ email: env.ALLOWED_EMAIL }, env.SESSION_SECRET, 3600);

function authed(input: RequestInfo, init: RequestInit = {}): Request {
	return new IncomingRequest(input, {
		...init,
		headers: { ...init.headers, authorization: `Bearer ${validSessionToken}` },
	});
}

const DEMO_SESSION_EMAIL = "demo-viewer@preppilot.local";

async function demoSessionToken(): Promise<string> {
	return issueSession({ email: DEMO_SESSION_EMAIL, role: "demo" }, env.SESSION_SECRET, 3600);
}

function demoAuthed(input: RequestInfo, init: RequestInit = {}, token?: string): Request {
	return new IncomingRequest(input, {
		...init,
		headers: { ...init.headers, authorization: `Bearer ${token}` },
	});
}

// These tests hit real Neon on purpose (see the project-wide convention noted
// throughout this file), which means anything they create in story_bank,
// resume_coach_profile, or attempts/feedback is real, user-visible data
// unless it's cleaned up — this has bitten the actual user twice now: once
// via leftover "Deployment pipeline fix" / "History test story" test stories
// in production, and again when a mid-suite "Network connection lost" error
// (a real, observed failure mode of this test runner's remote Neon/AI
// connections — see the comment on withStubbedAi below) interrupted a test
// run before its per-test cleanup could execute, permanently overwriting the
// user's real resume_coach_profile with test marker text and leaving 47 test
// attempts/feedback rows visible on their real Dashboard. Per-test cleanup
// alone isn't reliable against that failure mode — a crashed test never
// reaches its own afterEach. retryable() plus the file-level sweep below are
// the response: retry a cleanup write a few times before giving up (a
// transient disconnect shouldn't permanently defeat it), and independently
// sweep away anything the real user's attempts table gained during this test
// file's run, regardless of which individual test created it or whether that
// test's own cleanup succeeded.
async function retryable<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
	let lastError: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
		}
	}
	throw lastError;
}

// Every test below that creates a story must delete it via this helper
// before the test ends. Deliberately a hard SQL delete rather than the real
// DELETE route's soft-delete: a test story going through the app's normal
// 3-day undo window would still show up in the user's real "Recently
// deleted" list, which is exactly the same class of leakage this helper
// exists to prevent.
async function deleteStoryViaApi(id: string): Promise<void> {
	await retryable(async () => {
		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		await sql`delete from story_bank where id = ${id}`;
	});
}

// File-level safety net for attempts/feedback: independent of any single
// test's own cleanup, delete anything the real user's attempts table gained
// since this test file started running. Scoped by created_at rather than by
// matching known fixture strings — a new test introducing new fixture text
// shouldn't require remembering to add it to a matcher list anywhere, and a
// crashed test (no chance to run its own cleanup at all) is still caught by
// this sweep as long as the suite reaches its own afterAll.
//
// Covers both the test-owner identity and the demo-viewer identity:
// demo feedback now persists real attempts/feedback rows under
// DEMO_SESSION_EMAIL (so the demo account's own Dashboard can show its own
// history), which means tests exercising that path leave real rows behind
// under that identity too unless this sweep also covers it.
const testRunStartedAt = new Date().toISOString();

afterAll(async () => {
	await retryable(async () => {
		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const toDelete = await sql`
			select a.id from attempts a
			join users u on u.id = a.user_id
			where u.email = ANY(${[env.ALLOWED_EMAIL, DEMO_SESSION_EMAIL]}) and a.created_at >= ${testRunStartedAt}
		`;
		const ids = toDelete.map((r: { id: string }) => r.id);
		if (ids.length === 0) return;
		await sql`delete from feedback where attempt_id = ANY(${ids})`;
		await sql`delete from attempts where id = ANY(${ids})`;
	});
});

// Stubs only the Google tokeninfo call — everything else (notably Neon's own
// fetch-based queries) passes through to the real fetch, so upsertUser etc.
// still hit the real dev database.
function stubGoogleTokenInfo(response: unknown, ok = true) {
	const realFetch = globalThis.fetch;
	vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		if (url.includes("oauth2.googleapis.com/tokeninfo")) {
			return new Response(JSON.stringify(response), { status: ok ? 200 : 400 });
		}
		return realFetch(input, init);
	});
}

describe("GET /api/health", () => {
	it("responds with status ok and reports Neon connectivity, no auth required", async () => {
		const request = new IncomingRequest("http://example.com/api/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const body = await response.json<{ status: string; dependencies: { neon: string } }>();
		expect(body.status).toBe("ok");
		expect(body.dependencies.neon).toBe("ok");
	});
});

describe("OPTIONS (CORS preflight)", () => {
	it("returns 204 with no body and the expected CORS headers, without needing a session", async () => {
		const request = new IncomingRequest("http://example.com/api/questions", { method: "OPTIONS" });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(204);
		expect(await response.text()).toBe("");
		expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
	});

	// Regression test: PUT/DELETE (used by the Story Bank edit/delete routes)
	// were added to the router without updating this header, so the browser's
	// preflight check silently rejected those requests with a CORS error —
	// the backend itself never even saw them. Found live via the browser
	// console, not by any test, which is exactly why this needs one now.
	it("allows PUT and DELETE (used by the Story Bank edit/delete routes)", async () => {
		const request = new IncomingRequest("http://example.com/api/resume-coach/stories/some-id", { method: "OPTIONS" });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const allowedMethods = response.headers.get("access-control-allow-methods") ?? "";
		expect(allowedMethods).toContain("PUT");
		expect(allowedMethods).toContain("DELETE");
	});
});

describe("POST /api/auth/google", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("issues a session and upserts a users row for the allowed email", async () => {
		stubGoogleTokenInfo({
			aud: env.GOOGLE_CLIENT_ID,
			email: env.ALLOWED_EMAIL,
			email_verified: "true",
			exp: String(Math.floor(Date.now() / 1000) + 3600),
		});
		const request = new IncomingRequest("http://example.com/api/auth/google", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ idToken: "fake-token" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<{ token: string; email: string }>();
		expect(body.email).toBe(env.ALLOWED_EMAIL);
		expect(body.token).toBeTruthy();

		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const rows = (await sql`select email from users where email = ${env.ALLOWED_EMAIL}`) as { email: string }[];
		expect(rows.length).toBe(1);
	});

	// Deliberately a 404, not a 403: a not-allowed sign-in should be
	// indistinguishable from an unmatched route, not leak that a gate exists.
	// See docs/ai-rules.md §1.3.
	it("returns a route-shaped 404 (not a session) for a verified but non-allowed email", async () => {
		stubGoogleTokenInfo({
			aud: env.GOOGLE_CLIENT_ID,
			email: "someone.else@gmail.com",
			email_verified: "true",
			exp: String(Math.floor(Date.now() / 1000) + 3600),
		});
		const request = new IncomingRequest("http://example.com/api/auth/google", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ idToken: "fake-token" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
		const body = await response.json<{ error: { code: string; message: string } }>();
		expect(body.error.code).toBe("not_found");
		expect(body.error.message).toBe("No route for POST /api/auth/google");
	});

	it("rejects a token Google itself rejects", async () => {
		stubGoogleTokenInfo({ error: "invalid_token" }, false);
		const request = new IncomingRequest("http://example.com/api/auth/google", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ idToken: "garbage" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
	});

	it("rejects a missing idToken", async () => {
		const request = new IncomingRequest("http://example.com/api/auth/google", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});
});

describe("POST /api/auth/email/start + /api/auth/email/verify", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// Stubs only the Resend call — Neon's own fetch-based queries (upsertUser)
	// pass through to the real fetch, same pattern as stubGoogleTokenInfo above.
	// Wrapped in vi.fn so extractSentCode can inspect .mock.calls.
	function stubResend() {
		const realFetch = globalThis.fetch;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
				if (url.includes("api.resend.com")) {
					return new Response(JSON.stringify({ id: "test" }), { status: 200 });
				}
				return realFetch(input, init);
			})
		);
	}

	function extractSentCode(): string {
		const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
		const resendCall = fetchMock.mock.calls.find(([input]: [unknown]) => String(input).includes("api.resend.com"));
		const init = resendCall?.[1] as RequestInit;
		const body = JSON.parse(init.body as string) as { text: string };
		const code = body.text.match(/\d{6}/)?.[0];
		if (!code) throw new Error("Test setup error: no 6-digit code found in the stubbed email body.");
		return code;
	}

	// Each functional test below uses its own synthetic cf-connecting-ip so
	// none of them share a rate-limit bucket with each other (or with the
	// dedicated rate-limit test) — same isolation reasoning as the
	// /api/feedback rate-limit test elsewhere in this file.
	it("sends a code, then completes sign-in for the allowed email", async () => {
		stubResend();
		const startRequest = new IncomingRequest("http://example.com/api/auth/email/start", {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
			body: JSON.stringify({ email: env.ALLOWED_EMAIL }),
		});
		const startCtx = createExecutionContext();
		const startResponse = await worker.fetch(startRequest, env, startCtx);
		await waitOnExecutionContext(startCtx);
		expect(startResponse.status).toBe(200);

		const code = extractSentCode();
		const verifyRequest = new IncomingRequest("http://example.com/api/auth/email/verify", {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.10" },
			body: JSON.stringify({ email: env.ALLOWED_EMAIL, code }),
		});
		const verifyCtx = createExecutionContext();
		const verifyResponse = await worker.fetch(verifyRequest, env, verifyCtx);
		await waitOnExecutionContext(verifyCtx);
		expect(verifyResponse.status).toBe(200);
		const body = await verifyResponse.json<{ token: string; email: string }>();
		expect(body.email).toBe(env.ALLOWED_EMAIL);
		expect(body.token).toBeTruthy();
	});

	it("returns a route-shaped 404 for a correct code but non-allowed email", async () => {
		stubResend();
		const email = "someone.else@example.com";
		const startRequest = new IncomingRequest("http://example.com/api/auth/email/start", {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.11" },
			body: JSON.stringify({ email }),
		});
		const startCtx = createExecutionContext();
		await worker.fetch(startRequest, env, startCtx);
		await waitOnExecutionContext(startCtx);

		const code = extractSentCode();
		const verifyRequest = new IncomingRequest("http://example.com/api/auth/email/verify", {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.11" },
			body: JSON.stringify({ email, code }),
		});
		const verifyCtx = createExecutionContext();
		const verifyResponse = await worker.fetch(verifyRequest, env, verifyCtx);
		await waitOnExecutionContext(verifyCtx);
		expect(verifyResponse.status).toBe(404);
		const body = await verifyResponse.json<{ error: { code: string; message: string } }>();
		expect(body.error.message).toBe("No route for POST /api/auth/email/verify");
	});

	it("rejects a wrong code", async () => {
		stubResend();
		const startRequest = new IncomingRequest("http://example.com/api/auth/email/start", {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.12" },
			body: JSON.stringify({ email: env.ALLOWED_EMAIL }),
		});
		const startCtx = createExecutionContext();
		await worker.fetch(startRequest, env, startCtx);
		await waitOnExecutionContext(startCtx);

		const verifyRequest = new IncomingRequest("http://example.com/api/auth/email/verify", {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.12" },
			body: JSON.stringify({ email: env.ALLOWED_EMAIL, code: "000000" }),
		});
		const verifyCtx = createExecutionContext();
		const verifyResponse = await worker.fetch(verifyRequest, env, verifyCtx);
		await waitOnExecutionContext(verifyCtx);
		expect(verifyResponse.status).toBe(401);
	});

	it("rejects a malformed email before sending anything", async () => {
		const request = new IncomingRequest("http://example.com/api/auth/email/start", {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.13" },
			body: JSON.stringify({ email: "not-an-email" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("rejects a start request if Resend fails to send", async () => {
		const realFetch = globalThis.fetch;
		vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			if (url.includes("api.resend.com")) return new Response("error", { status: 500 });
			return realFetch(input, init);
		});
		const request = new IncomingRequest("http://example.com/api/auth/email/start", {
			method: "POST",
			headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.14" },
			body: JSON.stringify({ email: "someone-else@example.com" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(502);
	});

	// Uses its own synthetic IP for the same reason the /api/feedback rate
	// limit test does — isolates this from every other test's shared bucket.
	it("rate limits /api/auth/email/start per IP (5/60s)", async () => {
		const ip = "203.0.113.77";
		const statuses: number[] = [];
		for (let i = 0; i < 6; i++) {
			const request = new IncomingRequest("http://example.com/api/auth/email/start", {
				method: "POST",
				headers: { "content-type": "application/json", "cf-connecting-ip": ip },
				// Invalid email on purpose: fails validation right after the
				// rate-limit check, so this never actually calls Resend.
				body: JSON.stringify({ email: "not-an-email" }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			statuses.push(response.status);
		}
		expect(statuses).toContain(429);
	});
});

describe("POST /api/auth/demo", () => {
	// Uses its own synthetic password hashed on the fly, rather than the real
	// production demo password — keeps the actual credential out of the repo
	// and git history entirely, same reasoning as never printing a secret
	// value anywhere else in this codebase.
	async function sha256Hex(input: string): Promise<string> {
		const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
		return Array.from(new Uint8Array(digest))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	it("issues a demo-role session for the correct username/password", async () => {
		const testPasswordHash = await sha256Hex("test-only-password-not-the-real-one");
		const stubbedEnv = { ...env, DEMO_PASSWORD_HASH: testPasswordHash };
		const request = new IncomingRequest("http://example.com/api/auth/demo", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ username: env.DEMO_USERNAME, password: "test-only-password-not-the-real-one" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, stubbedEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<{ token: string; email: string; role: string }>();
		expect(body.role).toBe("demo");
		expect(body.token).toBeTruthy();
	});

	it("rejects an incorrect password", async () => {
		const request = new IncomingRequest("http://example.com/api/auth/demo", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ username: env.DEMO_USERNAME, password: "wrong-password" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
	});

	it("rejects a missing username or password", async () => {
		const request = new IncomingRequest("http://example.com/api/auth/demo", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ username: env.DEMO_USERNAME }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});
});

describe("demo session access restrictions", () => {
	it("allows a demo session to read the question bank", async () => {
		const token = await demoSessionToken();
		const request = demoAuthed("http://example.com/api/questions?type=product_sense&limit=1", {}, token);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
	});

	// GET /api/attempts is intentionally allowed for demo sessions — it's
	// what lets the demo account's own Dashboard show its own accumulating
	// history. It's already scoped by session.email at the handler level
	// (the same code path real sessions use), so no demo-specific filtering
	// is needed here — just confirm demo access isn't blocked by the
	// fail-closed allowlist.
	it("allows a demo session to read its own attempt history via GET /api/attempts", async () => {
		const token = await demoSessionToken();
		const request = demoAuthed("http://example.com/api/attempts?limit=100", {}, token);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
	});

	// Fail-closed is the whole point of DEMO_ALLOWED_ROUTES — spot-check a
	// handful of routes that carry real personal data, not an exhaustive list.
	it.each([
		["GET", "/api/resume-coach/history"],
		["GET", "/api/resume-coach/stories/deleted"],
		["GET", "/api/interview-rounds"],
	])("blocks a demo session from %s %s", async (method, path) => {
		const token = await demoSessionToken();
		const request = demoAuthed(`http://example.com${path}`, { method }, token);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(403);
		const body = await response.json<{ error: { code: string } }>();
		expect(body.error.code).toBe("demo_forbidden");
	});

	it("blocks a demo session from resume_coach-mode feedback even though POST /api/feedback is otherwise allowed", async () => {
		const token = await demoSessionToken();
		const request = demoAuthed(
			"http://example.com/api/feedback",
			{
				method: "POST",
				// Own synthetic IP, same reasoning as every other /api/feedback
				// test in this file: it shares FEEDBACK_RATE_LIMITER's bucket
				// with the rest of the suite otherwise (keyed by cf-connecting-ip,
				// which defaults to "unknown" for every request that omits it).
				headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.20" },
				body: JSON.stringify({ mode: "resume_coach", type: "leadership_principles_behavioral", storyId: "irrelevant" }),
			},
			token
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(403);
	});
});

describe("POST /api/salary-positioning validation", () => {
	const valid = {
		company: "meta",
		region: "us",
		currentSalary: 60000,
		currentSalaryCurrency: "USD",
		monthlyRent: 1200,
		monthlyLivingExpenses: 1500,
		currentSavingsRate: "20%",
	};

	// The per-IP limiter is shared with /api/feedback and counted across the
	// whole file, so these tests use a no-op one rather than eat its budget.
	const unlimitedEnv = { ...env, FEEDBACK_RATE_LIMITER: { limit: async () => ({ success: true }) } } as typeof env;

	async function post(body: Record<string, unknown>): Promise<Response> {
		const request = authed("http://example.com/api/salary-positioning", { method: "POST", body: JSON.stringify(body) });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, unlimitedEnv, ctx);
		await waitOnExecutionContext(ctx);
		return response;
	}

	it("rejects a missing company", async () => {
		const { company: _company, ...rest } = valid;
		expect((await post(rest)).status).toBe(400);
	});

	it("rejects an unsupported company", async () => {
		expect((await post({ ...valid, company: "acme" })).status).toBe(400);
	});

	it("limits a demo session to one use per company per 10 days, shared across regions", async () => {
		const keys = ["make", "amazon"].map((c) => `salary-positioning-last-used:${c}`);
		const stubbedEnv = {
			...unlimitedEnv,
			AI: {
				run: async () => ({
					response: JSON.stringify({
						estimatedEquivalentCost: 1,
						positionWithinBand: "mid_band",
						target: 2,
						anchor: 3,
						reasoning: "Stubbed.",
						numbeoCaveat: "Stubbed.",
					}),
				}),
			},
		} as typeof env;
		const token = await demoSessionToken();
		async function demoPost(company: string, region: string): Promise<Response> {
			const request = demoAuthed(
				"http://example.com/api/salary-positioning",
				{ method: "POST", body: JSON.stringify({ ...valid, company, region }) },
				token
			);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, stubbedEnv, ctx);
			await waitOnExecutionContext(ctx);
			return response;
		}
		try {
			await Promise.all(keys.map((k) => env.OTP_KV.delete(k)));
			expect((await demoPost("make", "europe")).status).toBe(200);
			expect((await demoPost("make", "us")).status).toBe(429);
			expect((await demoPost("amazon", "us")).status).toBe(200);
			expect((await demoPost("amazon", "europe")).status).toBe(429);
		} finally {
			await Promise.all(keys.map((k) => env.OTP_KV.delete(k)));
		}
	});

	it("rejects a missing or unsupported region", async () => {
		const { region: _region, ...rest } = valid;
		expect((await post(rest)).status).toBe(400);
		expect((await post({ ...valid, region: "asia" })).status).toBe(400);
	});
});

describe("session auth on protected routes", () => {
	it("rejects /api/questions without a session", async () => {
		const request = new IncomingRequest("http://example.com/api/questions");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
	});

	it("rejects /api/questions with a garbage bearer token", async () => {
		const request = new IncomingRequest("http://example.com/api/questions", {
			headers: { authorization: "Bearer not-a-real-token" },
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
	});

	it("rejects an expired session", async () => {
		const expiredToken = await issueSession({ email: env.ALLOWED_EMAIL }, env.SESSION_SECRET, -10);
		const request = new IncomingRequest("http://example.com/api/questions", {
			headers: { authorization: `Bearer ${expiredToken}` },
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
	});

	// Defense-in-depth: sessions are only ever issued for env.ALLOWED_EMAIL in
	// the first place, but this proves getAuthorizedSession's own check holds
	// even for a validly-signed session bearing a different email.
	it("rejects a validly-signed session for a non-allowed email", async () => {
		const otherToken = await issueSession({ email: "someone.else@gmail.com" }, env.SESSION_SECRET, 3600);
		const request = new IncomingRequest("http://example.com/api/questions", {
			headers: { authorization: `Bearer ${otherToken}` },
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
	});
});

describe("GET /api/questions", () => {
	it("returns seeded questions from Neon", async () => {
		const request = authed("http://example.com/api/questions");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const body = await response.json<unknown[]>();
		expect(Array.isArray(body)).toBe(true);
		expect(body.length).toBeGreaterThan(0);
	});

	it("filters by type", async () => {
		const request = authed("http://example.com/api/questions?type=product_sense");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const body = await response.json<{ type: string }[]>();
		expect(body.every((q) => q.type === "product_sense")).toBe(true);
	});

	it("clamps an out-of-range limit instead of passing it through raw", async () => {
		const request = authed("http://example.com/api/questions?limit=99999999");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const body = await response.json<unknown[]>();
		expect(body.length).toBeLessThanOrEqual(50);
	});

	it("falls back to the default limit for a non-numeric value", async () => {
		const request = authed("http://example.com/api/questions?limit=not-a-number");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<unknown[]>();
		expect(body.length).toBeLessThanOrEqual(10);
	});

	it("defaults to amazon questions when no company is given", async () => {
		const request = authed("http://example.com/api/questions?limit=50");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const body = await response.json<{ company: string }[]>();
		expect(body.length).toBeGreaterThan(0);
		expect(body.every((q) => q.company === "amazon")).toBe(true);
	});

	it("filters by company=make and never mixes in amazon questions of the same type", async () => {
		const request = authed("http://example.com/api/questions?company=make&type=product_sense&limit=50");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const body = await response.json<{ company: string; type: string }[]>();
		expect(body.length).toBeGreaterThan(0);
		expect(body.every((q) => q.company === "make" && q.type === "product_sense")).toBe(true);
	});
});

describe("POST /api/attempts", () => {
	// Asserts on more than response shape on purpose: the previous implementation
	// was a stub that fabricated a plausible-looking response (random UUID,
	// echoed fields) without ever writing to Neon. A shape-only test would not
	// have caught that. This queries Neon directly to prove the row is real.
	it("actually persists the attempt row to Neon, not just a fake response", async () => {
		const questionsRequest = authed("http://example.com/api/questions?type=product_sense&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string }[]>();

		const request = authed("http://example.com/api/attempts", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ questionId: question.id, type: "product_sense", answerText: "A test answer." }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(201);
		const body = await response.json<{ id: string; questionId: string }>();

		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const rows = (await sql`select id, question_id, user_id, answer_text from attempts where id = ${body.id}`) as {
			id: string;
			question_id: string;
			user_id: string | null;
			answer_text: string;
		}[];
		expect(rows.length).toBe(1);
		expect(rows[0].question_id).toBe(question.id);
		expect(rows[0].answer_text).toBe("A test answer.");
		// Reserved-for-later paywall architecture (see docs/tasks.md): every
		// attempt from a signed-in user should now be tied to a real users row.
		expect(rows[0].user_id).not.toBeNull();
	});

	it("rejects a body without answerText", async () => {
		const request = authed("http://example.com/api/attempts", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ questionId: "x" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});
});

describe("GET /api/attempts", () => {
	// Stubs env.AI.run rather than calling the real model — see the identical
	// rationale on withStubbedAi below in the POST /api/feedback describe
	// block (the real remote AI binding is unreliably slow in this sandboxed
	// test runner). Creates a real attempt + feedback row via /api/feedback so
	// there's a genuine scored row to find — this proves the join against
	// questions/feedback actually works, not just our own aggregation math.
	it("returns the caller's attempt history with a computed overall score and a per-type summary", async () => {
		const questionsRequest = authed("http://example.com/api/questions?type=product_sense&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string; title: string }[]>();

		const stubbedFeedback = {
			scores: { clarity_and_structure: 4, customer_obsession_and_motivation: 3 },
			strengths: { clarity_and_structure: ["Clear opening structure."] },
			improvements: { customer_obsession_and_motivation: ["Needs a more concrete customer scenario."] },
			overallFeedback: "Solid structure, could go deeper on the customer angle.",
			exampleAnswer: "A stronger answer would start by naming the specific customer segment...",
		};
		const stubbedEnv = { ...env, AI: { run: async () => ({ response: JSON.stringify(stubbedFeedback) }) } } as typeof env;

		const feedbackRequest = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ questionId: question.id, type: "product_sense", answerText: "A test answer for the dashboard." }),
		});
		const feedbackCtx = createExecutionContext();
		const feedbackResponse = await worker.fetch(feedbackRequest, stubbedEnv, feedbackCtx);
		await waitOnExecutionContext(feedbackCtx);
		expect(feedbackResponse.status).toBe(200);
		const { attemptId } = await feedbackResponse.json<{ attemptId: string }>();

		const request = authed("http://example.com/api/attempts?limit=50");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<{
			attempts: {
				id: string;
				type: string;
				questionTitle: string | null;
				answerText: string;
				overallScore: number | null;
				scores: Record<string, number> | null;
				strengths: Record<string, string[]> | null;
				improvements: Record<string, string[]> | null;
				overallFeedback: string | null;
				exampleAnswer: string | null;
				answerFramework: string[] | null;
			}[];
			summary: { type: string; attemptCount: number; averageScore: number; trend: number | null }[];
		}>();

		const created = body.attempts.find((a) => a.id === attemptId);
		expect(created).toBeDefined();
		expect(created?.type).toBe("product_sense");
		expect(created?.questionTitle).toBe(question.title);
		expect(created?.overallScore).toBe(3.5); // average of 4 and 3
		// The full answer + full feedback must round-trip through this endpoint
		// too, not just the summary fields — the Dashboard needs these to show
		// "your answer" and the complete AI feedback per attempt, not just a score.
		expect(created?.answerText).toBe("A test answer for the dashboard.");
		expect(created?.scores).toEqual(stubbedFeedback.scores);
		expect(created?.strengths).toEqual(stubbedFeedback.strengths);
		expect(created?.improvements).toEqual(stubbedFeedback.improvements);
		expect(created?.overallFeedback).toBe(stubbedFeedback.overallFeedback);
		expect(created?.exampleAnswer).toBe(stubbedFeedback.exampleAnswer);
		// Derived from the attempt's own type, not stored — proves this works
		// retroactively for history, not just the immediate /api/feedback response.
		expect(created?.answerFramework).toHaveLength(6);

		const productSenseSummary = body.summary.find((s) => s.type === "product_sense");
		expect(productSenseSummary).toBeDefined();
		expect(productSenseSummary!.attemptCount).toBeGreaterThan(0);
		expect(typeof productSenseSummary!.averageScore).toBe("number");
	});

	it("clamps an out-of-range limit rather than erroring", async () => {
		const request = authed("http://example.com/api/attempts?limit=99999");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<{ attempts: unknown[] }>();
		expect(body.attempts.length).toBeLessThanOrEqual(100);
	});
});

describe("POST /api/feedback", () => {
	// env.AI.run is stubbed here rather than calling the real model: the
	// vitest-pool-workers sandbox's connection to the remote AI binding is
	// unreliable for calls that take 15-20s+ (real timing observed via
	// `wrangler dev`), timing out even at 45s in this test runner even though
	// the same request completes fine against the actual dev/production
	// runtime. Real-model output (scoring, JSON shape, Neon persistence) was
	// manually verified with `wrangler dev` + curl before this was written.
	// This test instead verifies our own parsing/persistence logic end to end.
	function withStubbedAi(response: string) {
		return { ...env, AI: { run: async () => ({ response }) } } as typeof env;
	}

	it("parses the model response and persists attempt + feedback to Neon", async () => {
		const questionsRequest = authed("http://example.com/api/questions?type=product_sense&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string }[]>();
		expect(question).toBeDefined();

		const stubbedFeedback = {
			scores: { clarity_and_structure: 4, customer_obsession_and_motivation: 3 },
			strengths: { clarity_and_structure: ["Clear opening structure."] },
			improvements: { customer_obsession_and_motivation: ["Needs a more concrete customer scenario."] },
			overallFeedback: "Solid structure, could go deeper on the customer angle.",
			exampleAnswer: "A stronger answer would start by naming the specific customer segment...",
		};
		const stubbedEnv = withStubbedAi(JSON.stringify(stubbedFeedback));

		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				questionId: question.id,
				type: "product_sense",
				answerText: "I would segment customers into first-time vs. repeat buyers.",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, stubbedEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<{
			attemptId: string;
			feedback: { scores: Record<string, number>; overallFeedback: string; exampleAnswer: string; modelName: string; answerFramework: string[] };
		}>();
		expect(body.attemptId).toBeTruthy();
		expect(body.feedback.scores).toEqual(stubbedFeedback.scores);
		expect(body.feedback.overallFeedback).toBe(stubbedFeedback.overallFeedback);
		expect(body.feedback.modelName).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
		// Static per-type outline, not AI-generated — proves the right
		// framework was attached for this question's type.
		expect(body.feedback.answerFramework).toHaveLength(6);
		expect(body.feedback.answerFramework[0]).toMatch(/clarifying questions/i);
	});

	it("grades a Make question against the Make rubric and persists company='make'", async () => {
		// strategy_business is the type where Amazon and Make use genuinely
		// different subdimension keys (amazon_ecosystem_and_flywheel_fit vs.
		// make_ecosystem_and_platform_fit — see docs/rubrics-make.json) — the
		// clearest possible proof the right rubric was actually selected.
		const questionsRequest = authed("http://example.com/api/questions?company=make&type=strategy_business&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string; company: string }[]>();
		expect(question).toBeDefined();
		expect(question.company).toBe("make");

		const stubbedFeedback = {
			scores: { structured_market_and_customer_analysis: 4, make_ecosystem_and_platform_fit: 3, prioritization_and_roadmapping: 4 },
			strengths: { structured_market_and_customer_analysis: ["Named the right competitors."] },
			improvements: { make_ecosystem_and_platform_fit: ["Didn't mention the Celonis relationship."] },
			overallFeedback: "Solid competitive analysis, could tie back to Make's own platform position more.",
			exampleAnswer: "A stronger answer would open by scoping the iPaaS market...",
		};
		const stubbedEnv = withStubbedAi(JSON.stringify(stubbedFeedback));

		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				questionId: question.id,
				type: "strategy_business",
				answerText: "Make should lean into its EU-native infrastructure and Celonis relationship.",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, stubbedEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<{ attemptId: string; feedback: { scores: Record<string, number> } }>();
		expect(body.feedback.scores).toEqual(stubbedFeedback.scores);

		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const rows = (await sql`select company from attempts where id = ${body.attemptId}`) as { company: string }[];
		expect(rows[0]?.company).toBe("make");
	});

	it("grades a Meta question against Meta's own rubric, using a subdimension key that doesn't exist for any other company", async () => {
		// meta_ecosystem_and_network_effects_fit only exists in
		// docs/rubrics-meta.json — Amazon/Make use the same strategy_business
		// type but a differently-named company-specific subdimension
		// (amazon_ecosystem_and_flywheel_fit / make_ecosystem_and_platform_fit),
		// so a stubbed score using this exact key only makes sense if Meta's
		// own rubric file was actually loaded, not a fallback to Amazon's.
		const questionsRequest = authed("http://example.com/api/questions?company=meta&type=strategy_business&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string; company: string }[]>();
		expect(question).toBeDefined();
		expect(question.company).toBe("meta");

		const stubbedFeedback = {
			scores: { structured_market_and_customer_analysis: 4, meta_ecosystem_and_network_effects_fit: 3, prioritization_and_roadmapping: 4 },
			strengths: { structured_market_and_customer_analysis: ["Clearly scoped the competitive set."] },
			improvements: { meta_ecosystem_and_network_effects_fit: ["Didn't address the advertiser side at all."] },
			overallFeedback: "Solid market framing, needs to connect the strategy back to Meta's own ecosystem.",
			exampleAnswer: "A stronger answer would first clarify the time horizon and the specific product in scope...",
		};
		const stubbedEnv = withStubbedAi(JSON.stringify(stubbedFeedback));

		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				questionId: question.id,
				type: "strategy_business",
				answerText: "I would first clarify the time horizon and which product this strategy is scoped to.",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, stubbedEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<{ attemptId: string; feedback: { scores: Record<string, number> } }>();
		expect(body.feedback.scores).toEqual(stubbedFeedback.scores);

		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const rows = (await sql`select company from attempts where id = ${body.attemptId}`) as { company: string }[];
		expect(rows[0]?.company).toBe("meta");
	});

	it("retries once then 502s if the model never returns parseable JSON", async () => {
		const questionsRequest = authed("http://example.com/api/questions?type=product_sense&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string }[]>();

		const stubbedEnv = withStubbedAi("not json at all");
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ questionId: question.id, type: "product_sense", answerText: "My answer" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, stubbedEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(502);
	});

	it("rejects a body without answerText", async () => {
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("rejects answerText over the length cap before calling Workers AI", async () => {
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				type: "product_sense",
				mode: "single_question",
				answerText: "x".repeat(8001),
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("rejects a type with no rubric", async () => {
		// Needs a real questionId, or it would 400 for missing questionId instead
		// of testing the unsupported-type path this test is actually named for.
		const questionsRequest = authed("http://example.com/api/questions?type=product_sense&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string }[]>();

		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ questionId: question.id, type: "not_a_real_type", answerText: "My answer" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("rejects a request with no questionId before calling Workers AI", async () => {
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type: "product_sense", answerText: "My answer" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("rejects a questionId that doesn't exist", async () => {
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				questionId: "00000000-0000-0000-0000-000000000000",
				type: "product_sense",
				answerText: "My answer",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("returns a clean 500 (not an uncaught exception) for a malformed questionId", async () => {
		// A non-UUID string throws inside the Neon query (Postgres type-cast
		// error). Without the top-level try/catch, this fell through to
		// Cloudflare's generic edge error page — a plain-text 500 with no JSON
		// body — instead of our own error format. Confirmed live against
		// production during /check before this fix existed.
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ questionId: "not-a-valid-uuid", type: "product_sense", answerText: "My answer" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(500);
		const body = await response.json<{ error: { code: string } }>();
		expect(body.error.code).toBe("internal_error");
	});

	it("rejects an unsupported mode other than single_question / resume_coach", async () => {
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type: "leadership_principles_behavioral", mode: "some_other_mode", answerText: "My answer" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
		const body = await response.json<{ error: { code: string } }>();
		expect(body.error.code).toBe("unsupported_mode");
	});

	it("grades for a demo session and persists the attempt/feedback under the demo account's own identity, never the real user's", async () => {
		const demoToken = await demoSessionToken();
		const questionsRequest = authed("http://example.com/api/questions?type=product_sense&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string }[]>();
		expect(question).toBeDefined();

		// This request does increment the real daily counter by one (same key
		// the handler itself computes from today's date) — snapshot and restore
		// it, same self-cleaning requirement as every other test here that
		// touches real backing state.
		const usageKey = `demo-feedback-count:${new Date().toISOString().slice(0, 10)}`;
		const originalValue = await env.OTP_KV.get(usageKey);
		const stubbedEnv = withStubbedAi(
			JSON.stringify({
				scores: { clarity_and_structure: 5 },
				strengths: {},
				improvements: {},
				overallFeedback: "Looks good.",
				exampleAnswer: "A stronger answer would...",
			})
		);

		let attemptId: string | null = null;
		try {
			const request = demoAuthed(
				"http://example.com/api/feedback",
				{
					method: "POST",
					headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.21" },
					body: JSON.stringify({ questionId: question.id, type: "product_sense", answerText: "A demo answer." }),
				},
				demoToken
			);
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, stubbedEnv, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const body = await response.json<{ attemptId: string | null; feedback: { id: string } }>();
			expect(body.attemptId).toBeTruthy();
			attemptId = body.attemptId;

			// Persisted under the demo account's own user row — confirmed by
			// joining through to users.email — and never under the real
			// ALLOWED_EMAIL user, which is the exact pollution this account's
			// persistence design must never cause.
			const { neon } = await import("@neondatabase/serverless");
			const sql = neon(env.DATABASE_URL);
			const [owner] = await sql`select u.email from attempts a join users u on u.id = a.user_id where a.id = ${attemptId}`;
			expect(owner.email).toBe(DEMO_SESSION_EMAIL);
			expect(owner.email).not.toBe(env.ALLOWED_EMAIL);
		} finally {
			if (originalValue === null) await env.OTP_KV.delete(usageKey);
			else await env.OTP_KV.put(usageKey, originalValue, { expirationTtl: 60 * 60 * 25 });
			// Per-test cleanup on top of the file-level afterAll sweep — belt and
			// suspenders, same convention as deleteStoryViaApi.
			if (attemptId) {
				await retryable(async () => {
					const { neon } = await import("@neondatabase/serverless");
					const sql = neon(env.DATABASE_URL);
					await sql`delete from feedback where attempt_id = ${attemptId}`;
					await sql`delete from attempts where id = ${attemptId}`;
				});
			}
		}
	});

	it("enforces the demo account's 3-per-day cap, leaving the real counter exactly as it found it", async () => {
		const demoToken = await demoSessionToken();
		const questionsRequest = authed("http://example.com/api/questions?type=product_sense&limit=1");
		const questionsCtx = createExecutionContext();
		const questionsResponse = await worker.fetch(questionsRequest, env, questionsCtx);
		await waitOnExecutionContext(questionsCtx);
		const [question] = await questionsResponse.json<{ id: string }[]>();
		expect(question).toBeDefined();

		const usageKey = `demo-feedback-count:${new Date().toISOString().slice(0, 10)}`;
		const originalValue = await env.OTP_KV.get(usageKey);
		const stubbedEnv = withStubbedAi(
			JSON.stringify({ scores: { clarity_and_structure: 5 }, strengths: {}, improvements: {}, overallFeedback: "ok", exampleAnswer: "ok" })
		);

		try {
			// Pretend 2 of today's 3 are already used, regardless of what the real
			// counter currently holds — makes this test deterministic instead of
			// depending on how many real demo requests already happened today.
			await env.OTP_KV.put(usageKey, "2", { expirationTtl: 60 * 60 * 25 });

			const makeRequest = () =>
				demoAuthed(
					"http://example.com/api/feedback",
					{
						method: "POST",
						headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.22" },
						body: JSON.stringify({ questionId: question.id, type: "product_sense", answerText: "A demo answer." }),
					},
					demoToken
				);

			const thirdCtx = createExecutionContext();
			const thirdResponse = await worker.fetch(makeRequest(), stubbedEnv, thirdCtx);
			await waitOnExecutionContext(thirdCtx);
			expect(thirdResponse.status).toBe(200);
			// The third (within-cap) request now persists a real row under the
			// demo identity — clean it up, same as every other test that touches
			// real backing state.
			const thirdBody = await thirdResponse.json<{ attemptId: string | null }>();

			const fourthCtx = createExecutionContext();
			const fourthResponse = await worker.fetch(makeRequest(), stubbedEnv, fourthCtx);
			await waitOnExecutionContext(fourthCtx);
			expect(fourthResponse.status).toBe(429);
			const fourthBody = await fourthResponse.json<{ error: { code: string } }>();
			expect(fourthBody.error.code).toBe("demo_daily_limit");

			if (thirdBody.attemptId) {
				await retryable(async () => {
					const { neon } = await import("@neondatabase/serverless");
					const sql = neon(env.DATABASE_URL);
					await sql`delete from feedback where attempt_id = ${thirdBody.attemptId}`;
					await sql`delete from attempts where id = ${thirdBody.attemptId}`;
				});
			}
		} finally {
			if (originalValue === null) await env.OTP_KV.delete(usageKey);
			else await env.OTP_KV.put(usageKey, originalValue, { expirationTtl: 60 * 60 * 25 });
		}
	});
});

describe("POST /api/feedback (mode = resume_coach)", () => {
	function withStubbedAi(response: string) {
		return { ...env, AI: { run: async () => ({ response }) } } as typeof env;
	}

	const stubbedResumeCoach = {
		suggested_lps: ["Ownership", "Dive Deep"],
		behavioral_question_types: ["Tell me about a time you took ownership of a problem outside your immediate scope."],
		rewritten_star_answer: {
			situation: "The team's deployment pipeline was flaky and blocking releases.",
			task: "I was asked to stabilize it within a sprint.",
			actions: "I audited every failure over two weeks and rewrote the retry logic.",
			results: "Deployment failures dropped from 30% to under 2%.",
			reflection: "I'd instrument the pipeline with better logging from day one next time.",
		},
		resume_rewrite_suggestions: [
			"Original: Improved deployment pipeline reliability.",
			"Suggested: Reduced deployment failure rate from 30% to under 2% by auditing and rewriting retry logic.",
		],
		hype_script:
			"I took a flaky deployment pipeline that was blocking releases and drove failures down from 30% to under 2% in a single sprint. I don't just fix what's broken — I own it end to end.",
	};

	const createdStoryIds: string[] = [];
	afterEach(async () => {
		await Promise.all(createdStoryIds.map(deleteStoryViaApi));
		createdStoryIds.length = 0;
	});

	// A story to generate against — resume_coach mode now reads its content
	// from a Story Bank entry (storyId) rather than a freeform answerText.
	async function createTestStory(content: string): Promise<string> {
		const request = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Deployment pipeline fix", content, company: "TestCo" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const body = await response.json<{ id: string }>();
		createdStoryIds.push(body.id);
		return body.id;
	}

	// Same rationale as the single_question stubbed test above: the real Workers
	// AI binding is unreliable in this sandbox for slow calls, so this verifies
	// our own parsing/persistence logic and relies on manual wrangler dev
	// verification for real model output.
	it("persists a resume_coach attempt against a story with a null question_id and returns the extra payload", async () => {
		const storyId = await createTestStory("Led a project to fix our flaky deployment pipeline.");
		const stubbedEnv = withStubbedAi(JSON.stringify(stubbedResumeCoach));
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				type: "leadership_principles_behavioral",
				mode: "resume_coach",
				storyId,
				rawInput: { targetLps: ["Ownership"] },
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, stubbedEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const body = await response.json<{
			attemptId: string;
			feedback: { scores: null; extra: typeof stubbedResumeCoach; modelName: string };
		}>();
		expect(body.feedback.scores).toBeNull();
		expect(body.feedback.extra.suggested_lps).toEqual(stubbedResumeCoach.suggested_lps);
		expect(body.feedback.extra.rewritten_star_answer.situation).toBe(stubbedResumeCoach.rewritten_star_answer.situation);
		expect(body.feedback.extra.hype_script).toBe(stubbedResumeCoach.hype_script);

		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const rows = (await sql`select question_id, user_id, mode, answer_text, story_id from attempts where id = ${body.attemptId}`) as {
			question_id: string | null;
			user_id: string | null;
			mode: string;
			answer_text: string;
			story_id: string | null;
		}[];
		expect(rows.length).toBe(1);
		expect(rows[0].question_id).toBeNull();
		expect(rows[0].user_id).not.toBeNull();
		expect(rows[0].mode).toBe("resume_coach");
		expect(rows[0].answer_text).toBe("Led a project to fix our flaky deployment pipeline.");
		expect(rows[0].story_id).toBe(storyId);

		// The story's own latest_extra/latest_generated_at should be updated
		// too — that's what lets the Story Bank list show LP tags for
		// filtering without depending on the 5-day-expiring attempt history.
		const storyRows = (await sql`select latest_extra, latest_generated_at from story_bank where id = ${storyId}`) as {
			latest_extra: typeof stubbedResumeCoach;
			latest_generated_at: string | null;
		}[];
		expect(storyRows[0].latest_extra.suggested_lps).toEqual(stubbedResumeCoach.suggested_lps);
		expect(storyRows[0].latest_generated_at).not.toBeNull();

		// resume_coach rows show their own STAR+ breakdown (already
		// structured/labeled), not FeedbackDisplay's exampleAnswer — so
		// answerFramework should be null here, not the LP behavioral outline.
		const attemptsRequest = authed("http://example.com/api/attempts?limit=100");
		const attemptsCtx = createExecutionContext();
		const attemptsResponse = await worker.fetch(attemptsRequest, env, attemptsCtx);
		await waitOnExecutionContext(attemptsCtx);
		const attemptsBody = await attemptsResponse.json<{ attempts: { id: string; answerFramework: string[] | null }[] }>();
		const historyRow = attemptsBody.attempts.find((a) => a.id === body.attemptId);
		expect(historyRow?.answerFramework).toBeNull();

		await sql`delete from feedback where attempt_id = ${body.attemptId}`;
		await sql`delete from attempts where id = ${body.attemptId}`;
	});

	it("generates against the profile's targetCompany, not a hardcoded default", async () => {
		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const originalTargetCompanyRows = (await sql`
			select rp.target_company from resume_coach_profile rp join users u on u.id = rp.user_id where u.email = ${env.ALLOWED_EMAIL}
		`) as { target_company: string }[];
		const originalTargetCompany = originalTargetCompanyRows[0]?.target_company ?? "amazon";

		try {
			const putResponse = await worker.fetch(
				authed("http://example.com/api/resume-coach/profile", {
					method: "PUT",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ targetCompany: "make" }),
				}),
				env,
				createExecutionContext()
			);
			expect(putResponse.status).toBe(200);

			const storyId = await createTestStory("Simplified a confusing multi-step scenario builder flow for non-technical users.");
			const stubbedEnv = withStubbedAi(JSON.stringify(stubbedResumeCoach));
			const request = authed("http://example.com/api/feedback", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ type: "leadership_principles_behavioral", mode: "resume_coach", storyId }),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, stubbedEnv, ctx);
			await waitOnExecutionContext(ctx);
			expect(response.status).toBe(200);
			const body = await response.json<{ attemptId: string }>();

			const rows = (await sql`select company from attempts where id = ${body.attemptId}`) as { company: string }[];
			expect(rows[0]?.company).toBe("make");

			await sql`delete from feedback where attempt_id = ${body.attemptId}`;
			await sql`delete from attempts where id = ${body.attemptId}`;
		} finally {
			await sql`
				update resume_coach_profile set target_company = ${originalTargetCompany}
				where user_id = (select id from users where email = ${env.ALLOWED_EMAIL})
			`;
		}
	});

	it("rejects a missing storyId before calling Workers AI", async () => {
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type: "leadership_principles_behavioral", mode: "resume_coach" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("404s for a storyId that doesn't exist", async () => {
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				type: "leadership_principles_behavioral",
				mode: "resume_coach",
				storyId: "00000000-0000-0000-0000-000000000000",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
	});

	it("retries once then 502s if the model never returns parseable JSON", async () => {
		const storyId = await createTestStory("My story content.");
		const stubbedEnv = withStubbedAi("not json at all");
		const request = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type: "leadership_principles_behavioral", mode: "resume_coach", storyId }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, stubbedEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(502);
	});
});

describe("resume-coach profile (GET/PUT /api/resume-coach/profile)", () => {
	// resume_coach_profile is a single row per user (upsert semantics) — a
	// test PUT doesn't add a throwaway row to clean up later, it overwrites
	// whatever real content the user has saved. Snapshot and restore it
	// around every test in this block via a raw SQL write (the PUT API has
	// no way to explicitly clear a field back to null, so the API alone
	// can't do this restore).
	let originalProfile: { resume_text: string | null; job_description: string | null; target_company: string } | null = null;

	beforeEach(async () => {
		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const rows = (await sql`
			select rp.resume_text, rp.job_description, rp.target_company
			from resume_coach_profile rp
			join users u on u.id = rp.user_id
			where u.email = ${env.ALLOWED_EMAIL}
		`) as { resume_text: string | null; job_description: string | null; target_company: string }[];
		originalProfile = rows[0] ?? null;
	});

	afterEach(async () => {
		// Wrapped in retryable(): this exact write is what failed to run to
		// completion during the "Network connection lost" incident that
		// overwrote the real user's resume/JD with test marker text — see the
		// comment above deleteStoryViaApi. A transient disconnect retrying a
		// few times is strictly safer than leaving test data in place.
		await retryable(async () => {
			const { neon } = await import("@neondatabase/serverless");
			const sql = neon(env.DATABASE_URL);
			await sql`
				update resume_coach_profile
				set resume_text = ${originalProfile?.resume_text ?? null},
					job_description = ${originalProfile?.job_description ?? null},
					target_company = ${originalProfile?.target_company ?? "amazon"}
				where user_id = (select id from users where email = ${env.ALLOWED_EMAIL})
			`;
		});
	});

	it("returns nulls before anything has been saved, then round-trips a partial update", async () => {
		// A fresh, never-used-before value for jobDescription so this test can't
		// collide with leftover data from a previous run touching the same user.
		const marker = `JD marker ${crypto.randomUUID()}`;

		const putRequest = authed("http://example.com/api/resume-coach/profile", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jobDescription: marker }),
		});
		const ctx1 = createExecutionContext();
		const putResponse = await worker.fetch(putRequest, env, ctx1);
		await waitOnExecutionContext(ctx1);
		expect(putResponse.status).toBe(200);
		const putBody = await putResponse.json<{ resumeText: string | null; jobDescription: string | null }>();
		expect(putBody.jobDescription).toBe(marker);

		const getRequest = authed("http://example.com/api/resume-coach/profile");
		const ctx2 = createExecutionContext();
		const getResponse = await worker.fetch(getRequest, env, ctx2);
		await waitOnExecutionContext(ctx2);
		expect(getResponse.status).toBe(200);
		const getBody = await getResponse.json<{ jobDescription: string | null }>();
		expect(getBody.jobDescription).toBe(marker);
	});

	it("a partial update leaves the other field untouched", async () => {
		const resumeMarker = `Resume marker ${crypto.randomUUID()}`;
		const jdMarker = `JD marker ${crypto.randomUUID()}`;

		await worker.fetch(
			authed("http://example.com/api/resume-coach/profile", {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ resumeText: resumeMarker, jobDescription: jdMarker }),
			}),
			env,
			createExecutionContext()
		);

		const request = authed("http://example.com/api/resume-coach/profile", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jobDescription: `${jdMarker}-updated` }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const body = await response.json<{ resumeText: string | null; jobDescription: string | null }>();
		expect(body.resumeText).toBe(resumeMarker);
		expect(body.jobDescription).toBe(`${jdMarker}-updated`);
	});

	it("rejects requests without a valid session", async () => {
		const request = new IncomingRequest("http://example.com/api/resume-coach/profile");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
	});

	it("defaults targetCompany to 'amazon' and round-trips a switch to 'make'", async () => {
		const getRequest = authed("http://example.com/api/resume-coach/profile");
		const getCtx = createExecutionContext();
		const getResponse = await worker.fetch(getRequest, env, getCtx);
		await waitOnExecutionContext(getCtx);
		const getBody = await getResponse.json<{ targetCompany: string }>();
		expect(getBody.targetCompany).toBe(originalProfile?.target_company ?? "amazon");

		const putRequest = authed("http://example.com/api/resume-coach/profile", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ targetCompany: "make" }),
		});
		const putCtx = createExecutionContext();
		const putResponse = await worker.fetch(putRequest, env, putCtx);
		await waitOnExecutionContext(putCtx);
		expect(putResponse.status).toBe(200);
		const putBody = await putResponse.json<{ targetCompany: string }>();
		expect(putBody.targetCompany).toBe("make");
	});

	it("rejects an unknown targetCompany", async () => {
		const request = authed("http://example.com/api/resume-coach/profile", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ targetCompany: "not_a_real_company" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});
});

describe("resume-coach Story Bank CRUD", () => {
	it("creates, lists, updates, and deletes a story", async () => {
		const createRequest = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Original title", content: "Original content.", company: "Acme" }),
		});
		const createCtx = createExecutionContext();
		const createResponse = await worker.fetch(createRequest, env, createCtx);
		await waitOnExecutionContext(createCtx);
		expect(createResponse.status).toBe(201);
		const created = await createResponse.json<{ id: string; title: string; content: string; company: string }>();
		expect(created.title).toBe("Original title");
		expect(created.company).toBe("Acme");

		const listRequest = authed("http://example.com/api/resume-coach/stories");
		const listCtx = createExecutionContext();
		const listResponse = await worker.fetch(listRequest, env, listCtx);
		await waitOnExecutionContext(listCtx);
		const list = await listResponse.json<{ id: string }[]>();
		expect(list.some((s) => s.id === created.id)).toBe(true);

		const updateRequest = authed(`http://example.com/api/resume-coach/stories/${created.id}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Updated title", content: "Updated content.", company: "Acme Corp" }),
		});
		const updateCtx = createExecutionContext();
		const updateResponse = await worker.fetch(updateRequest, env, updateCtx);
		await waitOnExecutionContext(updateCtx);
		expect(updateResponse.status).toBe(200);
		const updated = await updateResponse.json<{ title: string; content: string; company: string }>();
		expect(updated.title).toBe("Updated title");
		expect(updated.content).toBe("Updated content.");
		expect(updated.company).toBe("Acme Corp");

		// DELETE is a soft delete (see db.ts's softDeleteStory): the story
		// disappears from the active list and rejects further edits, but
		// survives (restorable) until the cron job's grace period passes.
		const deleteRequest = authed(`http://example.com/api/resume-coach/stories/${created.id}`, { method: "DELETE" });
		const deleteCtx = createExecutionContext();
		const deleteResponse = await worker.fetch(deleteRequest, env, deleteCtx);
		await waitOnExecutionContext(deleteCtx);
		expect(deleteResponse.status).toBe(204);

		const getAfterDeleteRequest = authed(`http://example.com/api/resume-coach/stories/${created.id}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "should 404", content: "should 404", company: "should 404" }),
		});
		const getAfterDeleteCtx = createExecutionContext();
		const getAfterDeleteResponse = await worker.fetch(getAfterDeleteRequest, env, getAfterDeleteCtx);
		await waitOnExecutionContext(getAfterDeleteCtx);
		expect(getAfterDeleteResponse.status).toBe(404);

		const listAfterDeleteRequest = authed("http://example.com/api/resume-coach/stories");
		const listAfterDeleteCtx = createExecutionContext();
		const listAfterDeleteResponse = await worker.fetch(listAfterDeleteRequest, env, listAfterDeleteCtx);
		await waitOnExecutionContext(listAfterDeleteCtx);
		const listAfterDelete = await listAfterDeleteResponse.json<{ id: string }[]>();
		expect(listAfterDelete.some((s) => s.id === created.id)).toBe(false);

		const deletedListRequest = authed("http://example.com/api/resume-coach/stories/deleted");
		const deletedListCtx = createExecutionContext();
		const deletedListResponse = await worker.fetch(deletedListRequest, env, deletedListCtx);
		await waitOnExecutionContext(deletedListCtx);
		expect(deletedListResponse.status).toBe(200);
		const deletedList = await deletedListResponse.json<{ id: string; title: string }[]>();
		expect(deletedList.some((s) => s.id === created.id && s.title === "Updated title")).toBe(true);

		const restoreRequest = authed(`http://example.com/api/resume-coach/stories/${created.id}/restore`, { method: "POST" });
		const restoreCtx = createExecutionContext();
		const restoreResponse = await worker.fetch(restoreRequest, env, restoreCtx);
		await waitOnExecutionContext(restoreCtx);
		expect(restoreResponse.status).toBe(200);
		const restored = await restoreResponse.json<{ id: string; title: string }>();
		expect(restored.title).toBe("Updated title");

		const listAfterRestoreRequest = authed("http://example.com/api/resume-coach/stories");
		const listAfterRestoreCtx = createExecutionContext();
		const listAfterRestoreResponse = await worker.fetch(listAfterRestoreRequest, env, listAfterRestoreCtx);
		await waitOnExecutionContext(listAfterRestoreCtx);
		const listAfterRestore = await listAfterRestoreResponse.json<{ id: string }[]>();
		expect(listAfterRestore.some((s) => s.id === created.id)).toBe(true);

		await deleteStoryViaApi(created.id);
	});

	it("404s restoring a story that isn't actually deleted, or doesn't exist", async () => {
		const request = authed("http://example.com/api/resume-coach/stories/00000000-0000-0000-0000-000000000000/restore", {
			method: "POST",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
	});

	it("purges a soft-deleted story immediately, bypassing the undo grace period", async () => {
		const createRequest = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Purge test story", content: "Content.", company: "PurgeCo" }),
		});
		const createCtx = createExecutionContext();
		const createResponse = await worker.fetch(createRequest, env, createCtx);
		await waitOnExecutionContext(createCtx);
		const created = await createResponse.json<{ id: string }>();

		const deleteRequest = authed(`http://example.com/api/resume-coach/stories/${created.id}`, { method: "DELETE" });
		const deleteCtx = createExecutionContext();
		await worker.fetch(deleteRequest, env, deleteCtx);
		await waitOnExecutionContext(deleteCtx);

		const purgeRequest = authed(`http://example.com/api/resume-coach/stories/${created.id}/purge`, { method: "DELETE" });
		const purgeCtx = createExecutionContext();
		const purgeResponse = await worker.fetch(purgeRequest, env, purgeCtx);
		await waitOnExecutionContext(purgeCtx);
		expect(purgeResponse.status).toBe(204);

		const deletedListRequest = authed("http://example.com/api/resume-coach/stories/deleted");
		const deletedListCtx = createExecutionContext();
		const deletedListResponse = await worker.fetch(deletedListRequest, env, deletedListCtx);
		await waitOnExecutionContext(deletedListCtx);
		const deletedList = await deletedListResponse.json<{ id: string }[]>();
		expect(deletedList.some((s) => s.id === created.id)).toBe(false);

		// The row is gone entirely now, not just hidden — restoring it should
		// 404 the same way it would for any other nonexistent id.
		const restoreRequest = authed(`http://example.com/api/resume-coach/stories/${created.id}/restore`, { method: "POST" });
		const restoreCtx = createExecutionContext();
		const restoreResponse = await worker.fetch(restoreRequest, env, restoreCtx);
		await waitOnExecutionContext(restoreCtx);
		expect(restoreResponse.status).toBe(404);
		// No deleteStoryViaApi cleanup needed: purge already hard-deleted the row.
	});

	it("404s purging a story that's still active (not soft-deleted), or doesn't exist", async () => {
		const purgeMissingRequest = authed("http://example.com/api/resume-coach/stories/00000000-0000-0000-0000-000000000000/purge", {
			method: "DELETE",
		});
		const purgeMissingCtx = createExecutionContext();
		const purgeMissingResponse = await worker.fetch(purgeMissingRequest, env, purgeMissingCtx);
		await waitOnExecutionContext(purgeMissingCtx);
		expect(purgeMissingResponse.status).toBe(404);

		const createRequest = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Still active story", content: "Content.", company: "ActiveCo" }),
		});
		const createCtx = createExecutionContext();
		const createResponse = await worker.fetch(createRequest, env, createCtx);
		await waitOnExecutionContext(createCtx);
		const created = await createResponse.json<{ id: string }>();

		const purgeActiveRequest = authed(`http://example.com/api/resume-coach/stories/${created.id}/purge`, { method: "DELETE" });
		const purgeActiveCtx = createExecutionContext();
		const purgeActiveResponse = await worker.fetch(purgeActiveRequest, env, purgeActiveCtx);
		await waitOnExecutionContext(purgeActiveCtx);
		expect(purgeActiveResponse.status).toBe(404);

		await deleteStoryViaApi(created.id);
	});

	it("rejects an empty title, content, or company", async () => {
		const request = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "", content: "", company: "" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("rejects a missing company even when title/content are valid", async () => {
		const request = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Valid title", content: "Valid content." }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
	});

	it("404s updating/deleting a story id that doesn't exist", async () => {
		const updateRequest = authed("http://example.com/api/resume-coach/stories/00000000-0000-0000-0000-000000000000", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "x", content: "y", company: "z" }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(updateRequest, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
	});
});

describe("Interview Rounds CRUD (/api/interview-rounds)", () => {
	// Unlike story_bank there's no soft-delete here, so the DELETE route
	// itself is the cleanup helper — no separate hard-delete-via-SQL needed.
	async function deleteRound(id: string): Promise<void> {
		const request = authed(`http://example.com/api/interview-rounds/${id}`, { method: "DELETE" });
		const ctx = createExecutionContext();
		await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
	}

	it("creates, lists (scoped by company), updates, and deletes a round", async () => {
		const createRequest = authed("http://example.com/api/interview-rounds", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				company: "TestCo",
				order: 1,
				title: "Round 1 — HR Screen",
				whatItTests: "Motivation and feasibility.",
				prepFocus: "Relocation story, salary band.",
				qaItems: [{ question: "Tell me about yourself", answer: "I have been a PM for..." }],
			}),
		});
		const createCtx = createExecutionContext();
		const createResponse = await worker.fetch(createRequest, env, createCtx);
		await waitOnExecutionContext(createCtx);
		expect(createResponse.status).toBe(201);
		const created = await createResponse.json<{ id: string; company: string; order: number; title: string; qaItems: { question: string; answer: string }[] }>();
		expect(created.company).toBe("TestCo");
		expect(created.order).toBe(1);
		expect(created.qaItems).toHaveLength(1);

		// A round for a different company must not show up when listing TestCo.
		const otherCompanyRequest = authed("http://example.com/api/interview-rounds", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ company: "OtherCo", order: 1, title: "Unrelated round", qaItems: [] }),
		});
		const otherCompanyCtx = createExecutionContext();
		const otherCompanyResponse = await worker.fetch(otherCompanyRequest, env, otherCompanyCtx);
		await waitOnExecutionContext(otherCompanyCtx);
		const otherCompanyRound = await otherCompanyResponse.json<{ id: string }>();

		const listRequest = authed("http://example.com/api/interview-rounds?company=TestCo");
		const listCtx = createExecutionContext();
		const listResponse = await worker.fetch(listRequest, env, listCtx);
		await waitOnExecutionContext(listCtx);
		const list = await listResponse.json<{ id: string }[]>();
		expect(list.some((r) => r.id === created.id)).toBe(true);
		expect(list.some((r) => r.id === otherCompanyRound.id)).toBe(false);

		const updateRequest = authed(`http://example.com/api/interview-rounds/${created.id}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				company: "TestCo",
				order: 2,
				title: "Round 1 — HR Screen (updated)",
				qaItems: [
					{ question: "Tell me about yourself", answer: "Updated answer." },
					{ question: "Why this role?", answer: "Because..." },
				],
			}),
		});
		const updateCtx = createExecutionContext();
		const updateResponse = await worker.fetch(updateRequest, env, updateCtx);
		await waitOnExecutionContext(updateCtx);
		expect(updateResponse.status).toBe(200);
		const updated = await updateResponse.json<{ order: number; title: string; qaItems: unknown[]; whatItTests: string | null }>();
		expect(updated.order).toBe(2);
		expect(updated.title).toBe("Round 1 — HR Screen (updated)");
		expect(updated.qaItems).toHaveLength(2);
		// whatItTests/prepFocus were omitted from the update body — should clear, not retain the old value.
		expect(updated.whatItTests).toBeNull();

		const deleteRequest = authed(`http://example.com/api/interview-rounds/${created.id}`, { method: "DELETE" });
		const deleteCtx = createExecutionContext();
		const deleteResponse = await worker.fetch(deleteRequest, env, deleteCtx);
		await waitOnExecutionContext(deleteCtx);
		expect(deleteResponse.status).toBe(204);

		const listAfterDeleteRequest = authed("http://example.com/api/interview-rounds?company=TestCo");
		const listAfterDeleteCtx = createExecutionContext();
		const listAfterDeleteResponse = await worker.fetch(listAfterDeleteRequest, env, listAfterDeleteCtx);
		await waitOnExecutionContext(listAfterDeleteCtx);
		const listAfterDelete = await listAfterDeleteResponse.json<{ id: string }[]>();
		expect(listAfterDelete.some((r) => r.id === created.id)).toBe(false);

		await deleteRound(otherCompanyRound.id);
	});

	it("rejects a missing company or title, and rejects a malformed qaItems entry", async () => {
		const missingCompany = authed("http://example.com/api/interview-rounds", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "x", qaItems: [] }),
		});
		const missingCompanyCtx = createExecutionContext();
		const missingCompanyResponse = await worker.fetch(missingCompany, env, missingCompanyCtx);
		await waitOnExecutionContext(missingCompanyCtx);
		expect(missingCompanyResponse.status).toBe(400);

		const missingTitle = authed("http://example.com/api/interview-rounds", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ company: "TestCo", qaItems: [] }),
		});
		const missingTitleCtx = createExecutionContext();
		const missingTitleResponse = await worker.fetch(missingTitle, env, missingTitleCtx);
		await waitOnExecutionContext(missingTitleCtx);
		expect(missingTitleResponse.status).toBe(400);

		const malformedQa = authed("http://example.com/api/interview-rounds", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ company: "TestCo", title: "x", qaItems: [{ question: "no answer field" }] }),
		});
		const malformedQaCtx = createExecutionContext();
		const malformedQaResponse = await worker.fetch(malformedQa, env, malformedQaCtx);
		await waitOnExecutionContext(malformedQaCtx);
		expect(malformedQaResponse.status).toBe(400);
	});

	it("requires a company query param on GET, and 404s updating/deleting an id that doesn't exist", async () => {
		const missingQueryRequest = authed("http://example.com/api/interview-rounds");
		const missingQueryCtx = createExecutionContext();
		const missingQueryResponse = await worker.fetch(missingQueryRequest, env, missingQueryCtx);
		await waitOnExecutionContext(missingQueryCtx);
		expect(missingQueryResponse.status).toBe(400);

		const updateMissingRequest = authed("http://example.com/api/interview-rounds/00000000-0000-0000-0000-000000000000", {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ company: "TestCo", title: "x", qaItems: [] }),
		});
		const updateMissingCtx = createExecutionContext();
		const updateMissingResponse = await worker.fetch(updateMissingRequest, env, updateMissingCtx);
		await waitOnExecutionContext(updateMissingCtx);
		expect(updateMissingResponse.status).toBe(404);

		const deleteMissingRequest = authed("http://example.com/api/interview-rounds/00000000-0000-0000-0000-000000000000", { method: "DELETE" });
		const deleteMissingCtx = createExecutionContext();
		const deleteMissingResponse = await worker.fetch(deleteMissingRequest, env, deleteMissingCtx);
		await waitOnExecutionContext(deleteMissingCtx);
		expect(deleteMissingResponse.status).toBe(404);
	});
});

describe("GET /api/resume-coach/history", () => {
	it("only returns resume_coach-mode attempts, each with its story info", async () => {
		const storyRequest = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "History test story", content: "Some story content for history test.", company: "HistoryCo" }),
		});
		const storyCtx = createExecutionContext();
		const storyResponse = await worker.fetch(storyRequest, env, storyCtx);
		await waitOnExecutionContext(storyCtx);
		const story = await storyResponse.json<{ id: string }>();

		const stubbedEnv = {
			...env,
			AI: {
				run: async () =>
					({
						response: JSON.stringify({
							suggested_lps: ["Ownership"],
							behavioral_question_types: [],
							rewritten_star_answer: { situation: "s", task: "t", actions: "a", results: "r", reflection: "ref" },
							resume_rewrite_suggestions: [],
							hype_script: "hype",
						}),
					}) as unknown,
			},
		} as typeof env;
		const feedbackRequest = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type: "leadership_principles_behavioral", mode: "resume_coach", storyId: story.id }),
		});
		const feedbackCtx = createExecutionContext();
		await worker.fetch(feedbackRequest, stubbedEnv, feedbackCtx);
		await waitOnExecutionContext(feedbackCtx);

		const historyRequest = authed("http://example.com/api/resume-coach/history");
		const historyCtx = createExecutionContext();
		const historyResponse = await worker.fetch(historyRequest, env, historyCtx);
		await waitOnExecutionContext(historyCtx);
		expect(historyResponse.status).toBe(200);
		const body = await historyResponse.json<{ attempts: { storyId: string; storyTitle: string; storyCompany: string; mode?: string }[] }>();
		const match = body.attempts.find((a) => a.storyId === story.id);
		expect(match).toBeTruthy();
		expect(match?.storyTitle).toBe("History test story");
		expect(match?.storyCompany).toBe("HistoryCo");

		await deleteStoryViaApi(story.id);
	});
});

describe("rate limiting on /api/feedback", () => {
	// A valid session can't itself be hammered arbitrarily fast, since the
	// session token no longer ships in the public bundle the way x-app-key did
	// — but a leaked/stolen session or a buggy client retry loop still could.
	// Uses its own synthetic cf-connecting-ip so it doesn't share a rate-limit
	// bucket with every other test above that calls /api/feedback without
	// setting that header.
	it("returns 429 once the per-IP limit (20/60s) is exceeded", async () => {
		const ip = "203.0.113.55";
		const statuses: number[] = [];
		for (let i = 0; i < 21; i++) {
			const request = authed("http://example.com/api/feedback", {
				method: "POST",
				headers: { "content-type": "application/json", "cf-connecting-ip": ip },
				// Invalid body on purpose: fails validation right after the rate-limit
				// check, so this never triggers a real Workers AI call.
				body: JSON.stringify({}),
			});
			const ctx = createExecutionContext();
			const response = await worker.fetch(request, env, ctx);
			await waitOnExecutionContext(ctx);
			statuses.push(response.status);
		}
		expect(statuses).toContain(429);
		expect(statuses[statuses.length - 1]).toBe(429);
	});
});

describe("unknown route", () => {
	it("returns 404 when authorized", async () => {
		const request = authed("http://example.com/api/nope");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
	});
});

describe("scheduled() cron cleanup", () => {
	it("deletes an old resume_coach attempt/feedback pair but leaves its story_bank row alone", async () => {
		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);

		const storyRequest = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Cron cleanup test story", content: "Content for cron cleanup test.", company: "CronCo" }),
		});
		const storyCtx = createExecutionContext();
		const storyResponse = await worker.fetch(storyRequest, env, storyCtx);
		await waitOnExecutionContext(storyCtx);
		const story = await storyResponse.json<{ id: string }>();

		const stubbedEnv = {
			...env,
			AI: {
				run: async () =>
					({
						response: JSON.stringify({
							suggested_lps: ["Ownership"],
							behavioral_question_types: [],
							rewritten_star_answer: { situation: "s", task: "t", actions: "a", results: "r", reflection: "ref" },
							resume_rewrite_suggestions: [],
							hype_script: "hype",
						}),
					}) as unknown,
			},
		} as typeof env;
		const feedbackRequest = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type: "leadership_principles_behavioral", mode: "resume_coach", storyId: story.id }),
		});
		const feedbackCtx = createExecutionContext();
		const feedbackResponse = await worker.fetch(feedbackRequest, stubbedEnv, feedbackCtx);
		await waitOnExecutionContext(feedbackCtx);
		const { attemptId } = await feedbackResponse.json<{ attemptId: string }>();

		// Backdate the attempt past the expiry window directly in Neon — the
		// cron job keys off created_at, and a freshly-created row is always "now".
		await sql`update attempts set created_at = now() - interval '10 days' where id = ${attemptId}`;

		const scheduledCtx = createExecutionContext();
		await worker.scheduled!(createScheduledController(), env, scheduledCtx);
		await waitOnExecutionContext(scheduledCtx);

		const attemptRows = (await sql`select id from attempts where id = ${attemptId}`) as { id: string }[];
		expect(attemptRows.length).toBe(0);
		const feedbackRows = (await sql`select id from feedback where attempt_id = ${attemptId}`) as { id: string }[];
		expect(feedbackRows.length).toBe(0);
		const storyRows = (await sql`select id from story_bank where id = ${story.id}`) as { id: string }[];
		expect(storyRows.length).toBe(1);

		// The story survives by design (that's the assertion above) — clean it
		// up now that it's served its purpose, so it doesn't linger in the
		// user's real Story Bank.
		await deleteStoryViaApi(story.id);
	});

	it("does not delete a recent resume_coach attempt", async () => {
		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);

		const storyRequest = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Recent story", content: "Recent content.", company: "RecentCo" }),
		});
		const storyCtx = createExecutionContext();
		const storyResponse = await worker.fetch(storyRequest, env, storyCtx);
		await waitOnExecutionContext(storyCtx);
		const story = await storyResponse.json<{ id: string }>();

		const stubbedEnv = {
			...env,
			AI: {
				run: async () =>
					({
						response: JSON.stringify({
							suggested_lps: ["Ownership"],
							behavioral_question_types: [],
							rewritten_star_answer: { situation: "s", task: "t", actions: "a", results: "r", reflection: "ref" },
							resume_rewrite_suggestions: [],
							hype_script: "hype",
						}),
					}) as unknown,
			},
		} as typeof env;
		const feedbackRequest = authed("http://example.com/api/feedback", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ type: "leadership_principles_behavioral", mode: "resume_coach", storyId: story.id }),
		});
		const feedbackCtx = createExecutionContext();
		const feedbackResponse = await worker.fetch(feedbackRequest, stubbedEnv, feedbackCtx);
		await waitOnExecutionContext(feedbackCtx);
		const { attemptId } = await feedbackResponse.json<{ attemptId: string }>();

		const scheduledCtx = createExecutionContext();
		await worker.scheduled!(createScheduledController(), env, scheduledCtx);
		await waitOnExecutionContext(scheduledCtx);

		const attemptRows = (await sql`select id from attempts where id = ${attemptId}`) as { id: string }[];
		expect(attemptRows.length).toBe(1);

		// Not touched by the cron job (that's the assertion above), so clean it
		// up explicitly: delete the feedback/attempt directly, then the story
		// via the real API.
		await sql`delete from feedback where attempt_id = ${attemptId}`;
		await sql`delete from attempts where id = ${attemptId}`;
		await deleteStoryViaApi(story.id);
	});

	it("permanently deletes a story soft-deleted past the undo grace period", async () => {
		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);

		const createRequest = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Old soft-deleted story", content: "Content.", company: "OldCo" }),
		});
		const createCtx = createExecutionContext();
		const createResponse = await worker.fetch(createRequest, env, createCtx);
		await waitOnExecutionContext(createCtx);
		const story = await createResponse.json<{ id: string }>();

		const deleteRequest = authed(`http://example.com/api/resume-coach/stories/${story.id}`, { method: "DELETE" });
		const deleteCtx = createExecutionContext();
		await worker.fetch(deleteRequest, env, deleteCtx);
		await waitOnExecutionContext(deleteCtx);

		// Backdate past the 3-day grace period — a freshly soft-deleted row is
		// always "now".
		await sql`update story_bank set deleted_at = now() - interval '10 days' where id = ${story.id}`;

		const scheduledCtx = createExecutionContext();
		await worker.scheduled!(createScheduledController(), env, scheduledCtx);
		await waitOnExecutionContext(scheduledCtx);

		const rows = (await sql`select id from story_bank where id = ${story.id}`) as { id: string }[];
		expect(rows.length).toBe(0);
	});

	it("does not delete a story soft-deleted within the grace period", async () => {
		const createRequest = authed("http://example.com/api/resume-coach/stories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ title: "Recently soft-deleted story", content: "Content.", company: "RecentlyCo" }),
		});
		const createCtx = createExecutionContext();
		const createResponse = await worker.fetch(createRequest, env, createCtx);
		await waitOnExecutionContext(createCtx);
		const story = await createResponse.json<{ id: string }>();

		const deleteRequest = authed(`http://example.com/api/resume-coach/stories/${story.id}`, { method: "DELETE" });
		const deleteCtx = createExecutionContext();
		await worker.fetch(deleteRequest, env, deleteCtx);
		await waitOnExecutionContext(deleteCtx);

		const scheduledCtx = createExecutionContext();
		await worker.scheduled!(createScheduledController(), env, scheduledCtx);
		await waitOnExecutionContext(scheduledCtx);

		const { neon } = await import("@neondatabase/serverless");
		const sql = neon(env.DATABASE_URL);
		const rows = (await sql`select id from story_bank where id = ${story.id}`) as { id: string }[];
		expect(rows.length).toBe(1);

		await deleteStoryViaApi(story.id);
	});
});
