import type {
	AttemptHistoryResponse,
	FeedbackResponse,
	Question,
	ResumeCoachResponse,
	ResumeCoachProfile,
	Story,
	DeletedStory,
	ResumeCoachHistoryResponse,
	Company,
	InterviewRound,
	QaItem,
	SalaryPositioningResult,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

let sessionToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

// Called by AuthContext whenever the session changes (sign-in, sign-out, or
// loading a stored token on startup) — api.ts has no React context access of
// its own, so this is the plain module-level accessor that bridges the two.
export function setSessionToken(token: string | null) {
	sessionToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
	onUnauthorized = handler;
}

interface ApiError {
	error: { code: string; message: string };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: {
			"content-type": "application/json",
			...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
			...init.headers,
		},
	});
	if (response.status === 401) {
		onUnauthorized?.();
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error?.message ?? `Request failed with status ${response.status}`);
	}
	return response.json() as Promise<T>;
}

// limit=2 on purpose: the Worker returns questions in random order, and having
// a second candidate lets the practice page guarantee "Next question" never
// serves the same question twice in a row (it picks whichever id differs).
export function getQuestions(type: string, company: Company) {
	return request<Question[]>(`/api/questions?type=${type}&company=${company}&limit=2`, { method: "GET" });
}

export function postFeedback(body: { questionId: string; type: string; answerText: string }) {
	return request<FeedbackResponse>("/api/feedback", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

// limit=100 (the API's max) rather than the old 20: the Dashboard now groups
// attempts by calendar day, so a low limit would cut a day's history off
// mid-group on anyone who's practiced more than a handful of times.
export function getAttemptHistory() {
	return request<AttemptHistoryResponse>("/api/attempts?limit=100", { method: "GET" });
}

export function postResumeCoach(body: { type: string; storyId: string; targetLps?: string[] }) {
	return request<ResumeCoachResponse>("/api/feedback", {
		method: "POST",
		body: JSON.stringify({
			type: body.type,
			mode: "resume_coach",
			storyId: body.storyId,
			rawInput: body.targetLps && body.targetLps.length > 0 ? { targetLps: body.targetLps } : undefined,
		}),
	});
}

export function getResumeCoachProfile() {
	return request<ResumeCoachProfile>("/api/resume-coach/profile", { method: "GET" });
}

export function putResumeCoachProfile(fields: { resumeText?: string; jobDescription?: string; targetCompany?: Company }) {
	return request<ResumeCoachProfile>("/api/resume-coach/profile", {
		method: "PUT",
		body: JSON.stringify(fields),
	});
}

export function getStories() {
	return request<Story[]>("/api/resume-coach/stories", { method: "GET" });
}

export function createStory(title: string, content: string, company: string) {
	return request<Story>("/api/resume-coach/stories", {
		method: "POST",
		body: JSON.stringify({ title, content, company }),
	});
}

export function updateStory(id: string, title: string, content: string, company: string) {
	return request<Story>(`/api/resume-coach/stories/${id}`, {
		method: "PUT",
		body: JSON.stringify({ title, content, company }),
	});
}

// Soft delete server-side (see docs/db-schema.md) — the story is hidden
// immediately but stays restorable for 3 days. Bypasses request(): a 204 has
// no body, and request()'s unconditional response.json() would throw trying
// to parse an empty string.
export async function deleteStory(id: string): Promise<void> {
	const response = await fetch(`${BASE_URL}/api/resume-coach/stories/${id}`, {
		method: "DELETE",
		headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : {},
	});
	if (response.status === 401) {
		onUnauthorized?.();
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error?.message ?? `Request failed with status ${response.status}`);
	}
}

export function getDeletedStories() {
	return request<DeletedStory[]>("/api/resume-coach/stories/deleted", { method: "GET" });
}

export function restoreStory(id: string) {
	return request<Story>(`/api/resume-coach/stories/${id}/restore`, { method: "POST" });
}

// Permanently deletes a soft-deleted story right away instead of waiting out
// the undo grace period. Bypasses request() for the same reason deleteStory
// does: a 204 has no body.
export async function purgeStory(id: string): Promise<void> {
	const response = await fetch(`${BASE_URL}/api/resume-coach/stories/${id}/purge`, {
		method: "DELETE",
		headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : {},
	});
	if (response.status === 401) {
		onUnauthorized?.();
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error?.message ?? `Request failed with status ${response.status}`);
	}
}

export function getResumeCoachHistory() {
	return request<ResumeCoachHistoryResponse>("/api/resume-coach/history", { method: "GET" });
}

export function getInterviewRounds(company: string) {
	return request<InterviewRound[]>(`/api/interview-rounds?company=${encodeURIComponent(company)}`, { method: "GET" });
}

interface InterviewRoundFields {
	company: string;
	order: number;
	title: string;
	whatItTests: string | null;
	prepFocus: string | null;
	qaItems: QaItem[];
}

export function createInterviewRound(fields: InterviewRoundFields) {
	return request<InterviewRound>("/api/interview-rounds", {
		method: "POST",
		body: JSON.stringify(fields),
	});
}

export function updateInterviewRound(id: string, fields: InterviewRoundFields) {
	return request<InterviewRound>(`/api/interview-rounds/${id}`, {
		method: "PUT",
		body: JSON.stringify(fields),
	});
}

// Hard delete (no undo grace period here, unlike Story Bank — see
// worker/migrations/0014_interview_rounds.sql). Bypasses request(): a 204
// has no body, and request()'s unconditional response.json() would throw
// trying to parse an empty string.
export async function deleteInterviewRound(id: string): Promise<void> {
	const response = await fetch(`${BASE_URL}/api/interview-rounds/${id}`, {
		method: "DELETE",
		headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : {},
	});
	if (response.status === 401) {
		onUnauthorized?.();
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error?.message ?? `Request failed with status ${response.status}`);
	}
}

export interface SignInResult {
	token: string;
	email: string;
}

export interface SignInForbidden {
	forbidden: true;
}

// Deliberately bypasses request(): a 404 here means "not on the allowlist,"
// not a generic error, so it needs to be distinguished rather than thrown as
// an Error like every other endpoint. See docs/ai-rules.md §1.3.
export async function postGoogleSignIn(idToken: string): Promise<SignInResult | SignInForbidden> {
	const response = await fetch(`${BASE_URL}/api/auth/google`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ idToken }),
	});
	if (response.status === 404) {
		return { forbidden: true };
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error?.message ?? `Sign-in failed with status ${response.status}`);
	}
	return (await response.json()) as SignInResult;
}

export async function postEmailSignInStart(email: string): Promise<void> {
	const response = await fetch(`${BASE_URL}/api/auth/email/start`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email }),
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error?.message ?? `Couldn't send the verification email (status ${response.status}).`);
	}
}

export async function postEmailSignInVerify(email: string, code: string): Promise<SignInResult | SignInForbidden> {
	const response = await fetch(`${BASE_URL}/api/auth/email/verify`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email, code }),
	});
	if (response.status === 404) {
		return { forbidden: true };
	}
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error?.message ?? `Verification failed with status ${response.status}.`);
	}
	return (await response.json()) as SignInResult;
}

// Issues a scoped, read-mostly demo session — see worker/src/index.ts's
// DEMO_ALLOWED_ROUTES for exactly what it can reach. No "forbidden" variant
// here (unlike the two sign-ins above): a wrong username/password is just a
// generic 401, there's no allowlist concept for this login.
export async function postDemoSignIn(username: string, password: string): Promise<SignInResult> {
	const response = await fetch(`${BASE_URL}/api/auth/demo`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as ApiError | null;
		throw new Error(body?.error?.message ?? `Sign-in failed with status ${response.status}.`);
	}
	return (await response.json()) as SignInResult;
}

export function postSalaryPositioning(body: {
	company: Company;
	region: "europe" | "us";
	currentSalary: number;
	currentSalaryCurrency: string;
	monthlyRent: number;
	monthlyLivingExpenses: number;
	currentSavingsRate: string;
}) {
	return request<SalaryPositioningResult>("/api/salary-positioning", {
		method: "POST",
		body: JSON.stringify(body),
	});
}
