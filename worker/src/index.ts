/**
 * PrepPilot — Cloudflare Worker API.
 *
 * Phase 2 (see docs/implementation-plan.md): /api/questions reads from Neon,
 * and /api/feedback calls Cloudflare Workers AI — mode = "single_question"
 * uses the rubric-driven prompt in docs/prompts/feedback-system-prompt.md,
 * mode = "resume_coach" uses docs/prompts/resume-coach-system-prompt.md —
 * writing the attempt + feedback to Neon either way.
 *
 * Auth: POST /api/auth/google verifies a Google Identity Services ID token
 * and issues our own signed session (see docs/ai-rules.md §1.3) — this
 * replaced the old shared x-app-key model entirely.
 */

import {
	getSqlClient,
	getQuestionById,
	getQuestions,
	createAttempt,
	createFeedback,
	getUserByEmail,
	upsertUser,
	getUserAttemptHistory,
	getResumeCoachProfile,
	upsertResumeCoachProfile,
	listStories,
	getStoryById,
	createStory,
	updateStory,
	updateStoryLatestExtra,
	softDeleteStory,
	restoreStory,
	purgeStory,
	listDeletedStories,
	deleteExpiredResumeCoachRecords,
	deleteExpiredSoftDeletedStories,
	listInterviewRounds,
	createInterviewRound,
	updateInterviewRound,
	deleteInterviewRound,
	type AttemptHistoryRow,
	type QaItem,
	type InterviewRoundInput,
} from "./db";
import {
	buildFeedbackSystemPrompt,
	buildFeedbackUserMessage,
	parseFeedbackResponse,
	buildResumeCoachSystemPrompt,
	buildResumeCoachUserMessage,
	parseResumeCoachResponse,
	getAnswerFrameworkSteps,
	buildSalaryPositioningSystemPrompt,
	SALARY_BANDS,
	SALARY_REGIONS,
	type SalaryRegion,
	buildSalaryPositioningUserMessage,
	parseSalaryPositioningResponse,
} from "./prompts";
import { verifyGoogleIdToken } from "./googleAuth";
import { startEmailSignIn, verifyEmailCode } from "./emailAuth";
import { issueSession, verifySession, type SessionPayload } from "./session";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEEDBACK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
// Generous enough for a full resume or a long structured answer, but bounds
// how much a single request can inflate the Workers AI prompt — see the
// cost-safety note at the answerText length check below.
const MAX_ANSWER_TEXT_LENGTH = 8000;
// Companies this app supports practicing for (2026-08-14, adding Make
// alongside Amazon) — used to validate PUT /api/resume-coach/profile's
// targetCompany. questions.company itself has no DB-level CHECK constraint
// (see docs/db-schema.md), so this list is the actual source of truth for
// "known" companies at the application layer.
const SUPPORTED_COMPANIES = ["amazon", "make", "meta"];
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
// Bounds on Interview Rounds fields — generous enough for a full prep essay
// per Q&A answer (this content is often a multi-paragraph scripted answer,
// not a short label), but not unbounded.
const MAX_INTERVIEW_ROUND_TITLE_LENGTH = 300;
const MAX_INTERVIEW_ROUND_TEXT_LENGTH = 4000;
const MAX_QA_ITEMS = 100;
// Some scripted answers run long (a full multi-paragraph negotiation script,
// not a short label) — generous enough for that, still bounded.
const MAX_QA_TEXT_LENGTH = 12000;

const CORS_HEADERS = {
	// PUT/DELETE added for the Resume Coach Story Bank routes
	// (PUT/DELETE /api/resume-coach/stories/:id) — missed initially, which
	// blocked story edit/delete in the browser with a CORS preflight error.
	"access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
	"access-control-allow-headers": "content-type,authorization",
};

// Access-Control-Allow-Origin is deliberately reflected from an allow-list
// rather than "*": CORS doesn't stop curl/bots (the session check is the real
// gate), but a wildcard does let a malicious third-party page use a visitor's
// browser to read this API cross-site. This closes that off as defense-in-depth.
const ALLOWED_ORIGINS = new Set(["https://preppilot.pages.dev", "http://localhost:5173"]);

function resolveCorsOrigin(request: Request): string {
	const origin = request.headers.get("origin");
	return origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://preppilot.pages.dev";
}

function json(data: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(data), {
		...init,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...CORS_HEADERS,
			...init.headers,
		},
	});
}

function errorResponse(status: number, code: string, message: string): Response {
	return json({ error: { code, message } }, { status });
}

// Everything except /api/health and the /api/auth/* routes requires a valid
// signed session (issued after a real Google or email sign-in — see
// finalizeSignIn below — or after a demo sign-in, see /api/auth/demo). The
// email check here is defense-in-depth: owner sessions are only ever issued
// for env.ALLOWED_EMAIL in the first place, but this keeps that invariant
// true even if that ever changes. See docs/ai-rules.md §1.3. A demo-role
// session skips that check (it was never issued for ALLOWED_EMAIL) — its
// access is instead restricted below, at the per-route DEMO_ALLOWED_ROUTES
// allowlist, not by this function.
async function getAuthorizedSession(request: Request, env: Env): Promise<SessionPayload | null> {
	const authHeader = request.headers.get("authorization");
	if (!authHeader?.startsWith("Bearer ")) return null;
	const token = authHeader.slice("Bearer ".length);
	const session = await verifySession(token, env.SESSION_SECRET);
	if (!session) return null;
	if (session.role === "demo") return session;
	if (session.email.toLowerCase() !== env.ALLOWED_EMAIL.toLowerCase()) return null;
	return session;
}

const DEMO_EMAIL = "demo-viewer@preppilot.local";
const DEMO_DAILY_LIMIT = 3;

// Constant-time-ish via a digest comparison, not a short-circuiting ===: the
// password itself never gets compared directly, only its SHA-256 hex digest
// against the one stored as the DEMO_PASSWORD_HASH secret.
async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// Routes a demo-role session may call — everything else below the session
// gate 403s for it. Fail-closed on purpose: a new route added later is
// automatically off-limits to the demo account unless explicitly listed
// here, rather than needing every future route to remember to check role.
const DEMO_ALLOWED_ROUTES: { method: string; pathname: string }[] = [
	{ method: "GET", pathname: "/api/questions" },
	{ method: "POST", pathname: "/api/feedback" },
	// GET /api/attempts already scopes by the calling session's own email
	// (getUserByEmail(sql, session.email)), so this naturally shows only the
	// demo account's own history — never the real user's — and reads as
	// empty until the demo account has actually submitted something.
	{ method: "GET", pathname: "/api/attempts" },
	{ method: "POST", pathname: "/api/salary-positioning" },
];

// Shared by both sign-in methods (Google and email-code) once a real identity
// has been verified: upserts the users row, then gates on the allowlist.
async function finalizeSignIn(env: Env, email: string, notFoundRoute: string): Promise<Response> {
	if (email !== env.ALLOWED_EMAIL.toLowerCase()) {
		// Deliberately identical in shape to the catch-all 404 below: no session
		// is issued, and nothing distinguishes "you're not allowed" from "this
		// route doesn't exist." The frontend renders its own generic 404 page
		// for this response. See docs/ai-rules.md §1.3.
		return errorResponse(404, "not_found", `No route for ${notFoundRoute}`);
	}
	const sql = getSqlClient(env.DATABASE_URL);
	await upsertUser(sql, email);
	const token = await issueSession({ email }, env.SESSION_SECRET, SESSION_TTL_SECONDS);
	return json({ token, email });
}

async function runFeedbackModel(env: Env, systemPrompt: string, userMessage: string): Promise<string> {
	const result = await env.AI.run(FEEDBACK_MODEL, {
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userMessage },
		],
		// Bumped from 2600: the exampleAnswer is now a full 180-320 word
		// structured walkthrough (clarify -> confirm goal -> body -> recommend),
		// so the combined JSON is longer and was occasionally getting truncated.
		max_tokens: 3200,
	});
	// Different Workers AI model families wrap the completion differently.
	// The 8B model used here previously returns Cloudflare's own
	// `{ response: "..." }` envelope. Larger/newer models (e.g.
	// llama-3.3-70b-instruct-fp8-fast) return an OpenAI-chat-style envelope
	// instead — and Cloudflare's own best-effort `.response` convenience
	// field on that shape was observed truncated mid-string in testing, so
	// the real `choices[0].message.content` must be read first, not as a
	// fallback.
	if (typeof result === "object" && result !== null) {
		const chatContent = (result as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content;
		if (typeof chatContent === "string") return chatContent;
		if ("response" in result) return String((result as { response: unknown }).response);
	}
	return String(result);
}

// A single attempt's score is the average of its subdimension scores — each
// question type has different subdimensions (see rubrics-amazon.json), so
// this is the only comparable per-attempt number across types. Rounded to
// one decimal for display; null for resume_coach attempts (no rubric scores).
function averageScore(scores: Record<string, number> | null): number | null {
	if (!scores) return null;
	const values = Object.values(scores);
	if (values.length === 0) return null;
	return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

interface TypeSummary {
	type: string;
	attemptCount: number;
	averageScore: number;
	trend: number | null;
}

// Groups scored single_question attempts by type and computes an average
// plus a simple recency trend (average of the most recent attempts vs. the
// ones before them) — enough to show "getting better/worse" for a
// single-user dashboard without needing a charting library.
function buildTypeSummary(rows: AttemptHistoryRow[]): TypeSummary[] {
	const byType = new Map<string, { score: number; createdAt: string }[]>();
	for (const row of rows) {
		if (row.mode !== "single_question") continue;
		const avg = averageScore(row.scores);
		if (avg === null) continue;
		const list = byType.get(row.type) ?? [];
		list.push({ score: avg, createdAt: row.createdAt });
		byType.set(row.type, list);
	}

	const summary: TypeSummary[] = [];
	for (const [type, entries] of byType) {
		entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest first
		const overallAvg = entries.reduce((sum, e) => sum + e.score, 0) / entries.length;

		// Needs at least 4 data points so both halves of the comparison are
		// non-trivial; below that, "trend" would just be noise.
		let trend: number | null = null;
		if (entries.length >= 4) {
			const recentCount = Math.min(3, Math.floor(entries.length / 2));
			const recent = entries.slice(entries.length - recentCount);
			const earlier = entries.slice(0, entries.length - recentCount);
			const recentAvg = recent.reduce((sum, e) => sum + e.score, 0) / recent.length;
			const earlierAvg = earlier.reduce((sum, e) => sum + e.score, 0) / earlier.length;
			trend = Math.round((recentAvg - earlierAvg) * 10) / 10;
		}

		summary.push({ type, attemptCount: entries.length, averageScore: Math.round(overallAvg * 10) / 10, trend });
	}
	return summary.sort((a, b) => b.attemptCount - a.attemptCount);
}

function extractTargetLps(rawInput: unknown): string[] | undefined {
	if (!rawInput || typeof rawInput !== "object") return undefined;
	const targetLps = (rawInput as Record<string, unknown>).targetLps;
	if (!Array.isArray(targetLps)) return undefined;
	const strings = targetLps.filter((v): v is string => typeof v === "string" && v.length > 0);
	return strings.length > 0 ? strings : undefined;
}

// Shared by POST/PUT /api/interview-rounds — returns either the validated,
// normalized input or an error message to surface as 400 invalid_body.
function validateInterviewRoundBody(body: Record<string, unknown> | null): { input: InterviewRoundInput } | { error: string } {
	if (!body || typeof body.company !== "string" || body.company.trim().length === 0) {
		return { error: "company is required." };
	}
	if (typeof body.title !== "string" || body.title.trim().length === 0 || body.title.length > MAX_INTERVIEW_ROUND_TITLE_LENGTH) {
		return { error: `title is required and must be ${MAX_INTERVIEW_ROUND_TITLE_LENGTH} characters or fewer.` };
	}
	const order = typeof body.order === "number" && Number.isFinite(body.order) ? Math.trunc(body.order) : 0;
	const whatItTests = normalizeOptionalText(body.whatItTests, MAX_INTERVIEW_ROUND_TEXT_LENGTH);
	if (whatItTests === "too_long") return { error: `whatItTests must be ${MAX_INTERVIEW_ROUND_TEXT_LENGTH} characters or fewer.` };
	const prepFocus = normalizeOptionalText(body.prepFocus, MAX_INTERVIEW_ROUND_TEXT_LENGTH);
	if (prepFocus === "too_long") return { error: `prepFocus must be ${MAX_INTERVIEW_ROUND_TEXT_LENGTH} characters or fewer.` };

	if (body.qaItems !== undefined && !Array.isArray(body.qaItems)) {
		return { error: "qaItems must be an array." };
	}
	const rawQaItems = Array.isArray(body.qaItems) ? body.qaItems : [];
	if (rawQaItems.length > MAX_QA_ITEMS) {
		return { error: `qaItems must have ${MAX_QA_ITEMS} items or fewer.` };
	}
	const qaItems: QaItem[] = [];
	for (const item of rawQaItems) {
		if (
			!item ||
			typeof item !== "object" ||
			typeof (item as Record<string, unknown>).question !== "string" ||
			typeof (item as Record<string, unknown>).answer !== "string"
		) {
			return { error: "Each qaItems entry must have string question and answer fields." };
		}
		const question = (item as Record<string, unknown>).question as string;
		const answer = (item as Record<string, unknown>).answer as string;
		if (question.length > MAX_QA_TEXT_LENGTH || answer.length > MAX_QA_TEXT_LENGTH) {
			return { error: `Each qaItems question/answer must be ${MAX_QA_TEXT_LENGTH} characters or fewer.` };
		}
		qaItems.push({ question, answer });
	}

	return { input: { company: body.company, order, title: body.title, whatItTests, prepFocus, qaItems } };
}

// Returns the trimmed string, null (field omitted/empty), or the sentinel
// "too_long" for validateInterviewRoundBody to turn into a 400.
function normalizeOptionalText(value: unknown, maxLength: number): string | null | "too_long" {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") return "too_long"; // reused as a generic "invalid" signal
	if (value.length > maxLength) return "too_long";
	return value.length === 0 ? null : value;
}

// 5 days per the user's explicit auto-expiry request — long enough to revisit
// a result within the same job-search push, short enough to keep Neon's
// free-tier storage from filling up with generated text. Only mode =
// "resume_coach" attempts/feedback are affected; Story Bank entries are a
// separate table and are never touched by this (see db.ts).
const RESUME_COACH_EXPIRY_DAYS = 5;

// How long a soft-deleted story stays restorable before scheduled()
// permanently removes it (see db.ts's deleteExpiredSoftDeletedStories).
const STORY_DELETE_GRACE_DAYS = 3;

async function handleResumeCoachFeedback(env: Env, body: Record<string, unknown>, session: SessionPayload): Promise<Response> {
	const storyId = body.storyId as string;
	if (typeof storyId !== "string" || storyId.length === 0) {
		return errorResponse(400, "invalid_body", "storyId is required.");
	}

	const sql = getSqlClient(env.DATABASE_URL);
	const user = await getUserByEmail(sql, session.email);
	if (!user) {
		return errorResponse(401, "unauthorized", "No user found for this session.");
	}

	const story = await getStoryById(sql, user.id, storyId);
	if (!story) {
		return errorResponse(404, "not_found", `No story found for storyId "${storyId}".`);
	}

	const profile = await getResumeCoachProfile(sql, user.id);
	const targetCompany = profile?.targetCompany ?? "amazon";
	const targetLps = extractTargetLps(body.rawInput);
	const systemPrompt = buildResumeCoachSystemPrompt(targetCompany, targetLps);
	const userMessage = buildResumeCoachUserMessage({
		storyContent: story.content,
		resumeText: profile?.resumeText ?? null,
		jobDescription: profile?.jobDescription ?? null,
		targetLps,
	});

	let parsed = parseResumeCoachResponse(await runFeedbackModel(env, systemPrompt, userMessage));
	if (!parsed) {
		const retryMessage = `${userMessage}\n\n(Your previous response was not valid JSON — respond with ONLY the JSON object, nothing else.)`;
		parsed = parseResumeCoachResponse(await runFeedbackModel(env, systemPrompt, retryMessage));
	}
	if (!parsed) {
		return errorResponse(502, "model_response_invalid", "Workers AI did not return a parseable response.");
	}

	const extra = {
		suggested_lps: parsed.suggestedLps,
		behavioral_question_types: parsed.behavioralQuestionTypes,
		rewritten_star_answer: parsed.rewrittenStarAnswer,
		hype_script: parsed.hypeScript,
	};

	// Denormalized onto the story row (not just the auto-expiring attempt/
	// feedback history) so the Story Bank list can always show this story's
	// current LP tags and full result, even after 5 days — see db.ts.
	await updateStoryLatestExtra(sql, user.id, story.id, extra);

	const attempt = await createAttempt(sql, {
		questionId: null,
		userId: user.id,
		company: targetCompany,
		type: typeof body.type === "string" ? body.type : "unknown",
		mode: "resume_coach",
		answerText: story.content,
		rawInput: body.rawInput ?? null,
		storyId: story.id,
	});

	const feedback = await createFeedback(sql, {
		attemptId: attempt.id,
		company: targetCompany,
		type: typeof body.type === "string" ? body.type : "unknown",
		scores: null,
		strengths: null,
		improvements: null,
		overallFeedback: null,
		exampleAnswer: null,
		extra,
		modelName: FEEDBACK_MODEL,
	});

	return json({
		attemptId: attempt.id,
		feedback: {
			id: feedback.id,
			scores: null,
			strengths: null,
			improvements: null,
			overallFeedback: null,
			exampleAnswer: null,
			extra,
			modelName: FEEDBACK_MODEL,
			createdAt: feedback.createdAt,
		},
	});
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const { pathname } = url;

	if (request.method === "OPTIONS") {
		// No body allowed on a 204 response (Fetch spec) — don't route this through json().
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}

	if (request.method === "GET" && pathname === "/api/health") {
		let neonStatus: "ok" | "error" | "not_configured" = "not_configured";
		if (env.DATABASE_URL) {
			try {
				const sql = getSqlClient(env.DATABASE_URL);
				await sql`select 1`;
				neonStatus = "ok";
			} catch {
				neonStatus = "error";
			}
		}
		return json({
			status: "ok",
			timestamp: new Date().toISOString(),
			dependencies: { neon: neonStatus, workers_ai: env.AI ? "configured" : "not_configured" },
		});
	}

	if (request.method === "POST" && pathname === "/api/auth/google") {
		const body = await request.json<Record<string, unknown>>().catch(() => null);
		if (!body || typeof body.idToken !== "string" || body.idToken.length === 0) {
			return errorResponse(400, "invalid_body", "idToken is required.");
		}

		let googlePayload;
		try {
			googlePayload = await verifyGoogleIdToken(body.idToken, env.GOOGLE_CLIENT_ID);
		} catch (err) {
			return errorResponse(401, "unauthorized", err instanceof Error ? err.message : "Invalid Google token.");
		}

		return finalizeSignIn(env, googlePayload.email.toLowerCase(), "POST /api/auth/google");
	}

	if (request.method === "POST" && pathname === "/api/auth/email/start") {
		// Cheap to abuse otherwise: anyone could use this to spam an arbitrary
		// inbox with codes, or burn through Resend's free-tier quota.
		const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
		const { success: withinRateLimit } = await env.EMAIL_OTP_RATE_LIMITER.limit({ key: clientIp });
		if (!withinRateLimit) {
			return errorResponse(429, "rate_limited", "Too many requests. Please slow down and try again shortly.");
		}

		const body = await request.json<Record<string, unknown>>().catch(() => null);
		if (!body || typeof body.email !== "string" || !EMAIL_REGEX.test(body.email)) {
			return errorResponse(400, "invalid_body", "A valid email is required.");
		}

		try {
			await startEmailSignIn(env, body.email.toLowerCase());
		} catch {
			return errorResponse(502, "email_send_failed", "Couldn't send the verification email. Please try again.");
		}
		return json({ sent: true });
	}

	if (request.method === "POST" && pathname === "/api/auth/email/verify") {
		const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
		const { success: withinRateLimit } = await env.EMAIL_OTP_RATE_LIMITER.limit({ key: clientIp });
		if (!withinRateLimit) {
			return errorResponse(429, "rate_limited", "Too many requests. Please slow down and try again shortly.");
		}

		const body = await request.json<Record<string, unknown>>().catch(() => null);
		if (!body || typeof body.email !== "string" || typeof body.code !== "string") {
			return errorResponse(400, "invalid_body", "email and code are required.");
		}

		const email = body.email.toLowerCase();
		const isValidCode = await verifyEmailCode(env, email, body.code.trim());
		if (!isValidCode) {
			return errorResponse(401, "unauthorized", "That code is invalid or has expired.");
		}

		return finalizeSignIn(env, email, "POST /api/auth/email/verify");
	}

	if (request.method === "POST" && pathname === "/api/auth/demo") {
		// Shared read-mostly credential for one known reviewer, not a public
		// sign-up — tightly rate-limited so it can't be brute-forced, and the
		// resulting session is scoped down hard below (DEMO_ALLOWED_ROUTES),
		// not a real account on the single-user allowlist.
		const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
		const { success: withinRateLimit } = await env.DEMO_LOGIN_RATE_LIMITER.limit({ key: clientIp });
		if (!withinRateLimit) {
			return errorResponse(429, "rate_limited", "Too many attempts. Please try again shortly.");
		}

		const body = await request.json<Record<string, unknown>>().catch(() => null);
		if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
			return errorResponse(400, "invalid_body", "username and password are required.");
		}

		const passwordHash = await sha256Hex(body.password);
		if (body.username !== env.DEMO_USERNAME || passwordHash !== env.DEMO_PASSWORD_HASH) {
			return errorResponse(401, "unauthorized", "Incorrect username or password.");
		}

		const token = await issueSession({ email: DEMO_EMAIL, role: "demo" }, env.SESSION_SECRET, SESSION_TTL_SECONDS);
		return json({ token, email: DEMO_EMAIL, role: "demo" });
	}

	// Every route below this point requires a valid session.
	const session = await getAuthorizedSession(request, env);
	if (!session) {
		return errorResponse(401, "unauthorized", "Missing or invalid session. Please sign in again.");
	}

	// Fail-closed for the demo account: only routes explicitly listed in
	// DEMO_ALLOWED_ROUTES are reachable with a demo-role session. See the
	// allowlist's own comment for why this is a single gate rather than a
	// per-route check.
	if (session.role === "demo" && !DEMO_ALLOWED_ROUTES.some((r) => r.method === request.method && r.pathname === pathname)) {
		return errorResponse(403, "demo_forbidden", "This demo account doesn't have access to that.");
	}

	if (request.method === "GET" && pathname === "/api/questions") {
		const type = url.searchParams.get("type");
		// Defaults to "amazon" for backward compatibility with any client that
		// doesn't send it yet — matches questions.company's own DB default.
		const company = url.searchParams.get("company") ?? "amazon";
		// Clamped rather than passed through raw: an unvalidated limit could be
		// NaN, negative, or huge (e.g. ?limit=99999999). Low real-world impact
		// today (auth-gated, ~18 rows total) but cheap to close off. Found
		// during /check.
		const rawLimit = Number(url.searchParams.get("limit") ?? "10");
		const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 10;
		const sql = getSqlClient(env.DATABASE_URL);
		const rows = await getQuestions(sql, type, company, limit);
		return json(rows);
	}

	if (request.method === "GET" && pathname === "/api/attempts") {
		const rawLimit = Number(url.searchParams.get("limit") ?? "20");
		const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 20;
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) {
			return json({ attempts: [], summary: [] });
		}
		const history = await getUserAttemptHistory(sql, user.id);
		const attempts = history.slice(0, limit).map((row) => ({
			id: row.id,
			type: row.type,
			mode: row.mode,
			questionTitle: row.questionTitle,
			answerText: row.answerText,
			overallScore: averageScore(row.scores),
			scores: row.scores,
			strengths: row.strengths,
			improvements: row.improvements,
			overallFeedback: row.overallFeedback,
			exampleAnswer: row.exampleAnswer,
			// Only single_question attempts render exampleAnswer via
			// FeedbackDisplay (resume_coach shows its own STAR+ breakdown
			// instead, which is already structured/labeled) — null elsewhere.
			answerFramework: row.mode === "single_question" ? getAnswerFrameworkSteps(row.type) : null,
			extra: row.extra,
			createdAt: row.createdAt,
		}));
		return json({ attempts, summary: buildTypeSummary(history) });
	}

	if (request.method === "POST" && pathname === "/api/attempts") {
		const body = await request.json<Record<string, unknown>>().catch(() => null);
		if (!body || typeof body.questionId !== "string" || typeof body.answerText !== "string") {
			return errorResponse(400, "invalid_body", "questionId and answerText are required.");
		}
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		const attempt = await createAttempt(sql, {
			questionId: body.questionId,
			userId: user?.id ?? null,
			company: "amazon",
			type: typeof body.type === "string" ? body.type : "unknown",
			mode: typeof body.mode === "string" ? body.mode : "single_question",
			answerText: body.answerText,
			rawInput: body.rawInput ?? null,
		});
		return json(
			{
				id: attempt.id,
				questionId: body.questionId,
				type: body.type ?? null,
				mode: body.mode ?? "single_question",
				createdAt: attempt.createdAt,
			},
			{ status: 201 }
		);
	}

	if (pathname === "/api/resume-coach/profile") {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return errorResponse(401, "unauthorized", "No user found for this session.");

		if (request.method === "GET") {
			const profile = await getResumeCoachProfile(sql, user.id);
			return json(profile ?? { resumeText: null, jobDescription: null, targetCompany: "amazon", updatedAt: null });
		}
		if (request.method === "PUT") {
			const body = await request.json<Record<string, unknown>>().catch(() => null);
			if (!body) return errorResponse(400, "invalid_body", "A JSON body is required.");
			const resumeText = typeof body.resumeText === "string" ? body.resumeText : undefined;
			const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription : undefined;
			if (body.targetCompany !== undefined && (typeof body.targetCompany !== "string" || !SUPPORTED_COMPANIES.includes(body.targetCompany))) {
				return errorResponse(400, "invalid_body", `targetCompany must be one of: ${SUPPORTED_COMPANIES.join(", ")}.`);
			}
			const targetCompany = typeof body.targetCompany === "string" ? body.targetCompany : undefined;
			const profile = await upsertResumeCoachProfile(sql, user.id, { resumeText, jobDescription, targetCompany });
			return json(profile);
		}
	}

	if (pathname === "/api/resume-coach/stories") {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return errorResponse(401, "unauthorized", "No user found for this session.");

		if (request.method === "GET") {
			return json(await listStories(sql, user.id));
		}
		if (request.method === "POST") {
			const body = await request.json<Record<string, unknown>>().catch(() => null);
			if (
				!body ||
				typeof body.title !== "string" ||
				typeof body.content !== "string" ||
				typeof body.company !== "string" ||
				body.title.trim().length === 0 ||
				body.content.trim().length === 0 ||
				body.company.trim().length === 0
			) {
				return errorResponse(400, "invalid_body", "title, content, and company are required.");
			}
			const story = await createStory(sql, user.id, body.title, body.content, body.company);
			return json(story, { status: 201 });
		}
	}

	// Checked before the generic /:id route below — "deleted" would otherwise
	// match that route's [^/]+ capture group.
	if (request.method === "GET" && pathname === "/api/resume-coach/stories/deleted") {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return errorResponse(401, "unauthorized", "No user found for this session.");
		return json(await listDeletedStories(sql, user.id));
	}

	const storyRestoreMatch = pathname.match(/^\/api\/resume-coach\/stories\/([^/]+)\/restore$/);
	if (request.method === "POST" && storyRestoreMatch) {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return errorResponse(401, "unauthorized", "No user found for this session.");
		const story = await restoreStory(sql, user.id, storyRestoreMatch[1]);
		if (!story) return errorResponse(404, "not_found", `No deleted story found for id "${storyRestoreMatch[1]}".`);
		return json(story);
	}

	const storyPurgeMatch = pathname.match(/^\/api\/resume-coach\/stories\/([^/]+)\/purge$/);
	if (request.method === "DELETE" && storyPurgeMatch) {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return errorResponse(401, "unauthorized", "No user found for this session.");
		const purged = await purgeStory(sql, user.id, storyPurgeMatch[1]);
		if (!purged) return errorResponse(404, "not_found", `No deleted story found for id "${storyPurgeMatch[1]}".`);
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}

	const storyIdMatch = pathname.match(/^\/api\/resume-coach\/stories\/([^/]+)$/);
	if (storyIdMatch) {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return errorResponse(401, "unauthorized", "No user found for this session.");
		const storyId = storyIdMatch[1];

		if (request.method === "PUT") {
			const body = await request.json<Record<string, unknown>>().catch(() => null);
			if (
				!body ||
				typeof body.title !== "string" ||
				typeof body.content !== "string" ||
				typeof body.company !== "string" ||
				body.title.trim().length === 0 ||
				body.content.trim().length === 0 ||
				body.company.trim().length === 0
			) {
				return errorResponse(400, "invalid_body", "title, content, and company are required.");
			}
			const story = await updateStory(sql, user.id, storyId, body.title, body.content, body.company);
			if (!story) return errorResponse(404, "not_found", `No story found for id "${storyId}".`);
			return json(story);
		}
		if (request.method === "DELETE") {
			// Soft delete: the story is hidden immediately but stays
			// restorable for STORY_DELETE_GRACE_DAYS (see scheduled() below).
			const deleted = await softDeleteStory(sql, user.id, storyId);
			if (!deleted) return errorResponse(404, "not_found", `No story found for id "${storyId}".`);
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}
	}

	if (request.method === "GET" && pathname === "/api/resume-coach/history") {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return json({ attempts: [] });
		const history = await getUserAttemptHistory(sql, user.id);
		const attempts = history
			.filter((row) => row.mode === "resume_coach")
			.map((row) => ({
				id: row.id,
				type: row.type,
				storyId: row.storyId,
				storyTitle: row.storyTitle,
				storyCompany: row.storyCompany,
				extra: row.extra,
				createdAt: row.createdAt,
			}));
		return json({ attempts });
	}

	if (pathname === "/api/interview-rounds") {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return errorResponse(401, "unauthorized", "No user found for this session.");

		if (request.method === "GET") {
			const company = url.searchParams.get("company");
			if (!company || company.trim().length === 0) {
				return errorResponse(400, "invalid_query", "company is required.");
			}
			return json(await listInterviewRounds(sql, user.id, company));
		}
		if (request.method === "POST") {
			const body = await request.json<Record<string, unknown>>().catch(() => null);
			const validated = validateInterviewRoundBody(body);
			if ("error" in validated) return errorResponse(400, "invalid_body", validated.error);
			const round = await createInterviewRound(sql, user.id, validated.input);
			return json(round, { status: 201 });
		}
	}

	const interviewRoundIdMatch = pathname.match(/^\/api\/interview-rounds\/([^/]+)$/);
	if (interviewRoundIdMatch) {
		const sql = getSqlClient(env.DATABASE_URL);
		const user = await getUserByEmail(sql, session.email);
		if (!user) return errorResponse(401, "unauthorized", "No user found for this session.");
		const roundId = interviewRoundIdMatch[1];

		if (request.method === "PUT") {
			const body = await request.json<Record<string, unknown>>().catch(() => null);
			const validated = validateInterviewRoundBody(body);
			if ("error" in validated) return errorResponse(400, "invalid_body", validated.error);
			const round = await updateInterviewRound(sql, user.id, roundId, validated.input);
			if (!round) return errorResponse(404, "not_found", `No interview round found for id "${roundId}".`);
			return json(round);
		}
		if (request.method === "DELETE") {
			const deleted = await deleteInterviewRound(sql, user.id, roundId);
			if (!deleted) return errorResponse(404, "not_found", `No interview round found for id "${roundId}".`);
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}
	}

	if (request.method === "POST" && pathname === "/api/feedback") {
		// Checked before parsing the body: this is the endpoint that calls
		// Workers AI, so even a legitimately-authenticated session shouldn't be
		// able to hammer it (e.g. a leaked/stolen session token, or a buggy
		// client retry loop). Keyed by IP rather than the session, so
		// throttling an attacker doesn't also throttle the real account.
		const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
		const { success: withinRateLimit } = await env.FEEDBACK_RATE_LIMITER.limit({ key: clientIp });
		if (!withinRateLimit) {
			return errorResponse(429, "rate_limited", "Too many requests. Please slow down and try again shortly.");
		}

		const body = await request.json<Record<string, unknown>>().catch(() => null);
		if (!body || typeof body.type !== "string") {
			return errorResponse(400, "invalid_body", "type is required.");
		}
		const mode = typeof body.mode === "string" ? body.mode : "single_question";

		// resume_coach mode takes its content from a Story Bank entry (storyId)
		// rather than a freeform answerText — validated inside the handler.
		if (mode === "resume_coach") {
			// A Story Bank entry is personal content (the real resume/stories) —
			// out of scope for the demo account regardless of the daily cap.
			if (session.role === "demo") {
				return errorResponse(403, "demo_forbidden", "This demo account doesn't have access to that.");
			}
			return handleResumeCoachFeedback(env, body, session);
		}

		if (typeof body.answerText !== "string") {
			return errorResponse(400, "invalid_body", "answerText is required.");
		}
		// Bounds how much a single request can inflate the Workers AI prompt,
		// regardless of who's authenticated. Found during /check.
		if (body.answerText.length > MAX_ANSWER_TEXT_LENGTH) {
			return errorResponse(400, "invalid_body", `answerText must be ${MAX_ANSWER_TEXT_LENGTH} characters or fewer.`);
		}

		if (mode !== "single_question") {
			return errorResponse(400, "unsupported_mode", `mode "${mode}" is not implemented yet.`);
		}
		// Required for single_question mode: the whole prompt depends on a real
		// question's title/description (question_id is nullable at the DB level
		// only because resume_coach mode has none). Validating this
		// up front (before the Workers AI call) matters for cost, not just cleanliness —
		// without it, a malformed request still burns a real AI call before failing on
		// the DB insert. Found via a live curl test during /check, not code review alone.
		if (typeof body.questionId !== "string" || body.questionId.length === 0) {
			return errorResponse(400, "invalid_body", "questionId is required for single_question mode.");
		}

		// Checked before the Workers AI call, same reasoning as the questionId
		// check above: don't spend a real (budget-constrained, see
		// the private retrospective) model call on a request that's going to be
		// rejected anyway. Keyed by UTC date in the existing OTP_KV namespace —
		// no new binding needed, and the key self-expires via TTL, so there's
		// nothing to clean up.
		if (session.role === "demo") {
			const demoUsageKey = `demo-feedback-count:${new Date().toISOString().slice(0, 10)}`;
			const currentCount = Number((await env.OTP_KV.get(demoUsageKey)) ?? "0");
			if (currentCount >= DEMO_DAILY_LIMIT) {
				return errorResponse(
					429,
					"demo_daily_limit",
					`This demo account can submit ${DEMO_DAILY_LIMIT} answers per day. Please come back tomorrow.`
				);
			}
		}

		const sql = getSqlClient(env.DATABASE_URL);
		const question = await getQuestionById(sql, body.questionId);
		if (!question) {
			return errorResponse(400, "invalid_body", `No question found for questionId "${body.questionId}".`);
		}

		// Graded against the question's own company (e.g. "make"), not a
		// hardcoded default — see docs/rubrics-make.json / rubrics.ts.
		const systemPrompt = buildFeedbackSystemPrompt(body.type, question.company);
		if (!systemPrompt) {
			return errorResponse(400, "unsupported_type", `No rubric available for type "${body.type}".`);
		}

		const userMessage = buildFeedbackUserMessage(question.title, question.description, body.answerText);

		let parsed = parseFeedbackResponse(await runFeedbackModel(env, systemPrompt, userMessage));
		if (!parsed) {
			const retryMessage = `${userMessage}\n\n(Your previous response was not valid JSON — respond with ONLY the JSON object, nothing else.)`;
			parsed = parseFeedbackResponse(await runFeedbackModel(env, systemPrompt, retryMessage));
		}
		if (!parsed) {
			return errorResponse(502, "model_response_invalid", "Workers AI did not return a parseable response.");
		}

		// Demo sessions now persist normally, under their own DEMO_EMAIL user
		// row (upserted on first use here) — this is what lets the demo
		// account's own Dashboard show its own accumulating history. It's a
		// real, separate user row, so this can never mix into or overwrite
		// the real ALLOWED_EMAIL user's attempts/feedback. The daily counter
		// above is a separate, independent cap on top of this (protects AI
		// cost; this persistence is about giving the demo account a Dashboard
		// at all).
		if (session.role === "demo") {
			const demoUsageKey = `demo-feedback-count:${new Date().toISOString().slice(0, 10)}`;
			const currentCount = Number((await env.OTP_KV.get(demoUsageKey)) ?? "0");
			await env.OTP_KV.put(demoUsageKey, String(currentCount + 1), { expirationTtl: 60 * 60 * 25 });
		}

		const user = session.role === "demo" ? await upsertUser(sql, session.email) : await getUserByEmail(sql, session.email);
		const attempt = await createAttempt(sql, {
			questionId: typeof body.questionId === "string" ? body.questionId : null,
			userId: user?.id ?? null,
			company: question.company,
			type: body.type,
			mode,
			answerText: body.answerText,
			rawInput: body.rawInput ?? null,
		});

		const feedback = await createFeedback(sql, {
			attemptId: attempt.id,
			company: question.company,
			type: body.type,
			scores: parsed.scores,
			strengths: parsed.strengths,
			improvements: parsed.improvements,
			overallFeedback: parsed.overallFeedback,
			exampleAnswer: parsed.exampleAnswer,
			extra: null,
			modelName: FEEDBACK_MODEL,
		});

		return json({
			attemptId: attempt.id,
			feedback: {
				id: feedback.id,
				scores: parsed.scores,
				strengths: parsed.strengths,
				improvements: parsed.improvements,
				overallFeedback: parsed.overallFeedback,
				exampleAnswer: parsed.exampleAnswer,
				// Static per-type outline (not AI-generated) so the exampleAnswer's
				// flowing prose has a scannable structure to practice/memorize
				// alongside it — see prompts.ts's getAnswerFrameworkSteps.
				answerFramework: getAnswerFrameworkSteps(body.type),
				extra: null,
				modelName: FEEDBACK_MODEL,
				createdAt: feedback.createdAt,
			},
		});
	}

	if (request.method === "POST" && pathname === "/api/salary-positioning") {
		// Demo-only (see DEMO_ALLOWED_ROUTES) — reachable with a real owner
		// session too since nothing here is unsafe for the real account, but
		// there's no frontend entry point for it outside the demo view.
		const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
		const { success: withinRateLimit } = await env.FEEDBACK_RATE_LIMITER.limit({ key: clientIp });
		if (!withinRateLimit) {
			return errorResponse(429, "rate_limited", "Too many requests. Please slow down and try again shortly.");
		}

		const body = await request.json<Record<string, unknown>>().catch(() => null);
		if (
			!body ||
			typeof body.currentSalary !== "number" ||
			typeof body.currentSalaryCurrency !== "string" ||
			typeof body.monthlyRent !== "number" ||
			typeof body.monthlyLivingExpenses !== "number" ||
			typeof body.currentSavingsRate !== "string" ||
			typeof body.company !== "string" ||
			typeof body.region !== "string"
		) {
			return errorResponse(
				400,
				"invalid_body",
				"company, region, currentSalary, currentSalaryCurrency, monthlyRent, monthlyLivingExpenses, and currentSavingsRate are required."
			);
		}
		const salaryBand = SALARY_BANDS[body.company]?.[body.region as SalaryRegion];
		if (!salaryBand) {
			return errorResponse(
				400,
				"invalid_body",
				`company must be one of: ${SUPPORTED_COMPANIES.join(", ")}; region must be one of: ${SALARY_REGIONS.join(", ")}.`
			);
		}
		if (body.currentSalary < 0 || body.monthlyRent < 0 || body.monthlyLivingExpenses < 0) {
			return errorResponse(400, "invalid_body", "Amounts cannot be negative.");
		}
		if (body.currentSalaryCurrency.length > 10 || body.currentSavingsRate.length > 50) {
			return errorResponse(400, "invalid_body", "currentSalaryCurrency or currentSavingsRate is too long.");
		}

		// A separate, much longer-window cap from the 3/day feedback one —
		// this tool is meant to be tried once per company, not iterated on, so
		// it's throttled per company per rolling 10-day window rather than per
		// calendar day. (The region toggle shares its company's allowance.)
		const lastUsedKey = `salary-positioning-last-used:${body.company}`;
		if (session.role === "demo") {
			const lastUsedRaw = await env.OTP_KV.get(lastUsedKey);
			const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
			if (lastUsedRaw && Date.now() - Number(lastUsedRaw) < tenDaysMs) {
				const nextAvailable = new Date(Number(lastUsedRaw) + tenDaysMs);
				return errorResponse(
					429,
					"salary_tool_limit",
					`This tool can be used once every 10 days per company. For this company it'll be available again on ${nextAvailable.toISOString().slice(0, 10)}.`
				);
			}
		}

		const systemPrompt = buildSalaryPositioningSystemPrompt(body.company, body.region as SalaryRegion) as string;
		const userMessage = buildSalaryPositioningUserMessage({
			currentSalary: body.currentSalary,
			currentSalaryCurrency: body.currentSalaryCurrency,
			monthlyRent: body.monthlyRent,
			monthlyLivingExpenses: body.monthlyLivingExpenses,
			currentSavingsRate: body.currentSavingsRate,
		});

		let parsed = parseSalaryPositioningResponse(await runFeedbackModel(env, systemPrompt, userMessage), salaryBand.currency);
		if (!parsed) {
			const retryMessage = `${userMessage}\n\n(Your previous response was not valid JSON — respond with ONLY the JSON object, nothing else.)`;
			parsed = parseSalaryPositioningResponse(await runFeedbackModel(env, systemPrompt, retryMessage), salaryBand.currency);
		}
		if (!parsed) {
			return errorResponse(502, "model_response_invalid", "Workers AI did not return a parseable response.");
		}

		if (session.role === "demo") {
			await env.OTP_KV.put(lastUsedKey, String(Date.now()), { expirationTtl: 60 * 60 * 24 * 11 });
		}

		return json(parsed);
	}

	return errorResponse(404, "not_found", `No route for ${request.method} ${pathname}`);
}

export default {
	async fetch(request, env): Promise<Response> {
		let response: Response;
		try {
			response = await handleRequest(request, env);
		} catch {
			// A malformed id (e.g. not a valid UUID) passed to a Neon query throws —
			// without this, that exception was uncaught and fell through to
			// Cloudflare's generic edge error page (a plain-text 500 with no JSON
			// body at all, breaking API consumers), found live during /check by
			// sending a non-UUID questionId to production. Deliberately not
			// echoing the raw error back — it could contain query fragments.
			response = errorResponse(500, "internal_error", "Something went wrong handling this request.");
		}
		// Set here, once, regardless of which branch of handleRequest produced
		// the response — so every response (including the OPTIONS preflight and
		// the top-level catch above) gets the correct per-request origin without
		// threading it through every json()/errorResponse() call site.
		const headers = new Headers(response.headers);
		headers.set("access-control-allow-origin", resolveCorsOrigin(request));
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	},

	// Cloudflare Cron Trigger (see wrangler.jsonc's triggers.crons):
	// 1. Deletes resume_coach attempts/feedback older than
	//    RESUME_COACH_EXPIRY_DAYS. Never touches story_bank — active stories
	//    persist forever per the user's explicit request.
	// 2. Permanently deletes stories that were soft-deleted (see DELETE
	//    /api/resume-coach/stories/:id) more than STORY_DELETE_GRACE_DAYS ago,
	//    giving the user a window to restore an accidental delete first.
	async scheduled(_event, env): Promise<void> {
		const sql = getSqlClient(env.DATABASE_URL);
		await deleteExpiredResumeCoachRecords(sql, RESUME_COACH_EXPIRY_DAYS);
		await deleteExpiredSoftDeletedStories(sql, STORY_DELETE_GRACE_DAYS);
	},
} satisfies ExportedHandler<Env>;
