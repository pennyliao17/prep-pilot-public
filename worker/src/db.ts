import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

export function getSqlClient(databaseUrl: string): Sql {
	return neon(databaseUrl);
}

export interface QuestionRow {
	id: string;
	company: string;
	type: string;
	title: string;
	description: string;
	metadata: unknown;
}

// Ordered randomly, not by created_at: the practice page pulls a small limit
// per visit, and a deterministic order meant the same (oldest) question came
// back every single time — with 18 seeded questions, users effectively only
// ever saw one per type. random() is fine at this table size (tens of rows).
//
// company is required (not optional) as of the Make company addition
// (2026-08-14) — without a company filter, a "type" query would randomly mix
// Amazon- and Make-specific questions together, which was never correct even
// back when "amazon" was the only company (it just happened to be invisible
// with a single company in the table).
export async function getQuestions(sql: Sql, type: string | null, company: string, limit: number): Promise<QuestionRow[]> {
	if (type) {
		return (await sql`
			select id, company, type, title, description, metadata
			from questions
			where type = ${type} and company = ${company}
			order by random()
			limit ${limit}
		`) as QuestionRow[];
	}
	return (await sql`
		select id, company, type, title, description, metadata
		from questions
		where company = ${company}
		order by random()
		limit ${limit}
	`) as QuestionRow[];
}

export async function getQuestionById(sql: Sql, id: string): Promise<QuestionRow | null> {
	const rows = (await sql`
		select id, company, type, title, description, metadata
		from questions
		where id = ${id}
	`) as QuestionRow[];
	return rows[0] ?? null;
}

export interface CreateAttemptInput {
	questionId: string | null;
	userId: string | null;
	company: string;
	type: string;
	mode: string;
	answerText: string;
	rawInput: unknown;
	// Only set for mode = "resume_coach": which Story Bank entry this
	// generation was for. Null for single_question attempts.
	storyId?: string | null;
}

export async function createAttempt(sql: Sql, input: CreateAttemptInput): Promise<{ id: string; createdAt: string }> {
	const rows = (await sql`
		insert into attempts (question_id, user_id, company, type, mode, answer_text, raw_input, story_id)
		values (${input.questionId}, ${input.userId}, ${input.company}, ${input.type}, ${input.mode}, ${input.answerText}, ${JSON.stringify(input.rawInput ?? null)}::jsonb, ${input.storyId ?? null})
		returning id, created_at
	`) as { id: string; created_at: string }[];
	return { id: rows[0].id, createdAt: rows[0].created_at };
}

export interface UserRow {
	id: string;
	email: string;
	createdAt: string;
}

// Called once per successful Google sign-in. Reserves the door for a future
// per-user trial/paywall (attempts.user_id is now populated on every attempt)
// without adding any trial-count/plan columns yet — see docs/tasks.md.
export async function upsertUser(sql: Sql, email: string): Promise<UserRow> {
	const rows = (await sql`
		insert into users (email)
		values (${email})
		on conflict (email) do update set updated_at = now()
		returning id, email, created_at
	`) as { id: string; email: string; created_at: string }[];
	return { id: rows[0].id, email: rows[0].email, createdAt: rows[0].created_at };
}

export interface AttemptHistoryRow {
	id: string;
	type: string;
	mode: string;
	questionTitle: string | null;
	answerText: string;
	scores: Record<string, number> | null;
	strengths: Record<string, string[]> | null;
	improvements: Record<string, string[]> | null;
	overallFeedback: string | null;
	exampleAnswer: string | null;
	extra: unknown;
	createdAt: string;
	// Only set for mode = "resume_coach" attempts made against a Story Bank
	// entry; null for everything else (and for stories since deleted).
	storyId: string | null;
	storyTitle: string | null;
	storyCompany: string | null;
}

// Capped at a fixed window rather than "all history": this is a single-user
// personal tool (see docs/ai-rules.md's ALLOWED_EMAIL gate), so a few hundred
// rows is already more practice sessions than realistically happen before
// this gets revisited — no pagination/date-range params needed yet.
const ATTEMPT_HISTORY_WINDOW = 200;

export async function getUserAttemptHistory(sql: Sql, userId: string): Promise<AttemptHistoryRow[]> {
	const rows = (await sql`
		select a.id, a.type, a.mode, q.title as question_title, a.answer_text,
		       f.scores, f.strengths, f.improvements, f.overall_feedback, f.example_answer, f.extra,
		       a.created_at, a.story_id, sb.title as story_title, sb.company as story_company
		from attempts a
		left join questions q on q.id = a.question_id
		left join feedback f on f.attempt_id = a.id
		left join story_bank sb on sb.id = a.story_id
		where a.user_id = ${userId}
		order by a.created_at desc
		limit ${ATTEMPT_HISTORY_WINDOW}
	`) as {
		id: string;
		type: string;
		mode: string;
		question_title: string | null;
		answer_text: string;
		scores: Record<string, number> | null;
		strengths: Record<string, string[]> | null;
		improvements: Record<string, string[]> | null;
		overall_feedback: string | null;
		example_answer: string | null;
		extra: unknown;
		created_at: string | Date;
		story_id: string | null;
		story_title: string | null;
		story_company: string | null;
	}[];
	return rows.map((r) => ({
		id: r.id,
		type: r.type,
		mode: r.mode,
		questionTitle: r.question_title,
		answerText: r.answer_text,
		scores: r.scores,
		strengths: r.strengths,
		improvements: r.improvements,
		overallFeedback: r.overall_feedback,
		exampleAnswer: r.example_answer,
		extra: r.extra,
		// Normalized to an ISO string here rather than left as whatever the
		// driver returns (a Date object in practice): buildTypeSummary in
		// index.ts sorts/compares these as strings, and every other createdAt
		// in this API is already a plain ISO string on the wire.
		createdAt: new Date(r.created_at).toISOString(),
		storyId: r.story_id,
		storyTitle: r.story_title,
		storyCompany: r.story_company,
	}));
}

export async function getUserByEmail(sql: Sql, email: string): Promise<UserRow | null> {
	const rows = (await sql`
		select id, email, created_at from users where email = ${email}
	`) as { id: string; email: string; created_at: string }[];
	const row = rows[0];
	return row ? { id: row.id, email: row.email, createdAt: row.created_at } : null;
}

export interface CreateFeedbackInput {
	attemptId: string;
	company: string;
	type: string;
	// null for resume_coach mode: there's no rubric scoring, just generative
	// rewriting (see docs/prompts/resume-coach-system-prompt.md).
	scores: Record<string, number> | null;
	strengths: Record<string, string[]> | null;
	improvements: Record<string, string[]> | null;
	overallFeedback: string | null;
	exampleAnswer: string | null;
	extra: unknown;
	modelName: string;
}

export async function createFeedback(sql: Sql, input: CreateFeedbackInput): Promise<{ id: string; createdAt: string }> {
	const rows = (await sql`
		insert into feedback (attempt_id, company, type, scores, strengths, improvements, overall_feedback, example_answer, extra, model_name)
		values (
			${input.attemptId}, ${input.company}, ${input.type},
			${input.scores !== null ? JSON.stringify(input.scores) : null}::jsonb,
			${input.strengths !== null ? JSON.stringify(input.strengths) : null}::jsonb,
			${input.improvements !== null ? JSON.stringify(input.improvements) : null}::jsonb,
			${input.overallFeedback}, ${input.exampleAnswer},
			${JSON.stringify(input.extra ?? null)}::jsonb,
			${input.modelName}
		)
		returning id, created_at
	`) as { id: string; created_at: string }[];
	return { id: rows[0].id, createdAt: rows[0].created_at };
}

export interface ResumeCoachProfile {
	resumeText: string | null;
	jobDescription: string | null;
	// Which company's values framework to write the LP/values story toward
	// (migration 0010) — always a real value, never null, since the column
	// has a not-null default of 'amazon'. Distinct from story_bank.company
	// (which company the *experience* happened at, not which company the
	// user is applying to).
	targetCompany: string;
	updatedAt: string;
}

export async function getResumeCoachProfile(sql: Sql, userId: string): Promise<ResumeCoachProfile | null> {
	const rows = (await sql`
		select resume_text, job_description, target_company, updated_at
		from resume_coach_profile
		where user_id = ${userId}
	`) as { resume_text: string | null; job_description: string | null; target_company: string; updated_at: string }[];
	const row = rows[0];
	return row
		? {
				resumeText: row.resume_text,
				jobDescription: row.job_description,
				targetCompany: row.target_company,
				updatedAt: new Date(row.updated_at).toISOString(),
			}
		: null;
}

// Partial update: any field can be omitted (undefined) to leave the existing
// stored value untouched — e.g. re-saving just the JD shouldn't wipe out a
// previously uploaded resume or reset the chosen target company.
export async function upsertResumeCoachProfile(
	sql: Sql,
	userId: string,
	fields: { resumeText?: string | null; jobDescription?: string | null; targetCompany?: string },
): Promise<ResumeCoachProfile> {
	const rows = (await sql`
		insert into resume_coach_profile (user_id, resume_text, job_description, target_company)
		values (${userId}, ${fields.resumeText ?? null}, ${fields.jobDescription ?? null}, ${fields.targetCompany ?? "amazon"})
		on conflict (user_id) do update set
			resume_text = coalesce(${fields.resumeText ?? null}, resume_coach_profile.resume_text),
			job_description = coalesce(${fields.jobDescription ?? null}, resume_coach_profile.job_description),
			target_company = coalesce(${fields.targetCompany ?? null}, resume_coach_profile.target_company),
			updated_at = now()
		returning resume_text, job_description, target_company, updated_at
	`) as { resume_text: string | null; job_description: string | null; target_company: string; updated_at: string }[];
	const row = rows[0];
	return {
		resumeText: row.resume_text,
		jobDescription: row.job_description,
		targetCompany: row.target_company,
		updatedAt: new Date(row.updated_at).toISOString(),
	};
}

export interface StoryRow {
	id: string;
	title: string;
	content: string;
	// Which company this experience is from (2026-07-18) — lets the Story
	// Bank (the history view, not this list) be browsed/filtered by company.
	// Nullable only because the two pre-existing stories predate this field;
	// every story created after migration 0009 has one (validated in index.ts).
	company: string | null;
	createdAt: string;
	updatedAt: string;
	// The most recent AI generation for this story, denormalized onto the row
	// (migration 0008) rather than read from the auto-expiring attempts/
	// feedback history: the Story Bank list needs a stable place to read LP
	// tags from for filtering, which a 5-day-expiring join can't provide.
	latestExtra: unknown;
	latestGeneratedAt: string | null;
}

type StoryRowRaw = {
	id: string;
	title: string;
	content: string;
	company: string | null;
	created_at: string;
	updated_at: string;
	latest_extra: unknown;
	latest_generated_at: string | Date | null;
};

function mapStoryRow(row: StoryRowRaw): StoryRow {
	return {
		id: row.id,
		title: row.title,
		content: row.content,
		company: row.company,
		createdAt: new Date(row.created_at).toISOString(),
		updatedAt: new Date(row.updated_at).toISOString(),
		latestExtra: row.latest_extra,
		latestGeneratedAt: row.latest_generated_at ? new Date(row.latest_generated_at).toISOString() : null,
	};
}

const STORY_COLUMNS = "id, title, content, company, created_at, updated_at, latest_extra, latest_generated_at";

export async function listStories(sql: Sql, userId: string): Promise<StoryRow[]> {
	const rows = (await sql`
		select ${sql.unsafe(STORY_COLUMNS)}
		from story_bank
		where user_id = ${userId} and deleted_at is null
		order by updated_at desc
	`) as StoryRowRaw[];
	return rows.map(mapStoryRow);
}

// Excludes soft-deleted stories — a story pending permanent deletion
// shouldn't be usable as generation input (see handleResumeCoachFeedback).
export async function getStoryById(sql: Sql, userId: string, id: string): Promise<StoryRow | null> {
	const rows = (await sql`
		select ${sql.unsafe(STORY_COLUMNS)}
		from story_bank
		where id = ${id} and user_id = ${userId} and deleted_at is null
	`) as StoryRowRaw[];
	const row = rows[0];
	return row ? mapStoryRow(row) : null;
}

export interface DeletedStoryRow {
	id: string;
	title: string;
	content: string;
	company: string | null;
	deletedAt: string;
}

// Any row with deleted_at set is, by definition, still within its grace
// period — deleteExpiredSoftDeletedStories permanently removes anything
// older than the grace window, so there's nothing further to filter here.
export async function listDeletedStories(sql: Sql, userId: string): Promise<DeletedStoryRow[]> {
	const rows = (await sql`
		select id, title, content, company, deleted_at
		from story_bank
		where user_id = ${userId} and deleted_at is not null
		order by deleted_at desc
	`) as { id: string; title: string; content: string; company: string | null; deleted_at: string }[];
	return rows.map((r) => ({ id: r.id, title: r.title, content: r.content, company: r.company, deletedAt: new Date(r.deleted_at).toISOString() }));
}

export async function createStory(sql: Sql, userId: string, title: string, content: string, company: string): Promise<StoryRow> {
	const rows = (await sql`
		insert into story_bank (user_id, title, content, company)
		values (${userId}, ${title}, ${content}, ${company})
		returning ${sql.unsafe(STORY_COLUMNS)}
	`) as StoryRowRaw[];
	return mapStoryRow(rows[0]);
}

// Returns null if the story doesn't exist, is soft-deleted, or belongs to a
// different user — callers should treat that as a 404, not silently succeed.
// Deliberately does NOT touch latest_extra/latest_generated_at: the caller
// (the frontend) re-generates right after a successful edit, which updates
// those via updateStoryLatestExtra — keeping that as a separate step avoids
// this function silently wiping out a still-valid previous result if the
// follow-up generation call never happens for some reason.
export async function updateStory(sql: Sql, userId: string, id: string, title: string, content: string, company: string): Promise<StoryRow | null> {
	const rows = (await sql`
		update story_bank
		set title = ${title}, content = ${content}, company = ${company}, updated_at = now()
		where id = ${id} and user_id = ${userId} and deleted_at is null
		returning ${sql.unsafe(STORY_COLUMNS)}
	`) as StoryRowRaw[];
	const row = rows[0];
	return row ? mapStoryRow(row) : null;
}

export async function updateStoryLatestExtra(sql: Sql, userId: string, id: string, extra: unknown): Promise<void> {
	await sql`
		update story_bank
		set latest_extra = ${JSON.stringify(extra)}::jsonb, latest_generated_at = now()
		where id = ${id} and user_id = ${userId}
	`;
}

// Soft delete: hides the story from listStories/getStoryById immediately,
// but the row survives until deleteExpiredSoftDeletedStories purges it
// after the grace period — giving the user a window to restoreStory it.
export async function softDeleteStory(sql: Sql, userId: string, id: string): Promise<boolean> {
	const rows = (await sql`
		update story_bank
		set deleted_at = now()
		where id = ${id} and user_id = ${userId} and deleted_at is null
		returning id
	`) as { id: string }[];
	return rows.length > 0;
}

// Returns null if the story doesn't exist, was never soft-deleted, or
// belongs to a different user.
export async function restoreStory(sql: Sql, userId: string, id: string): Promise<StoryRow | null> {
	const rows = (await sql`
		update story_bank
		set deleted_at = null
		where id = ${id} and user_id = ${userId} and deleted_at is not null
		returning ${sql.unsafe(STORY_COLUMNS)}
	`) as StoryRowRaw[];
	const row = rows[0];
	return row ? mapStoryRow(row) : null;
}

// Lets the user jump the grace period and permanently delete a soft-deleted
// story right away, instead of waiting for deleteExpiredSoftDeletedStories to
// get to it. Only touches rows that are already soft-deleted (deleted_at is
// not null) — an active story must go through softDeleteStory first.
export async function purgeStory(sql: Sql, userId: string, id: string): Promise<boolean> {
	const rows = (await sql`
		delete from story_bank
		where id = ${id} and user_id = ${userId} and deleted_at is not null
		returning id
	`) as { id: string }[];
	return rows.length > 0;
}

// Cron cleanup, part 1: deletes AI-generated resume_coach attempts/feedback
// older than `days`, never touching story_bank (stories are permanent — see
// worker/migrations/0006_resume_coach_story_bank.sql). Feedback rows are
// deleted first since they reference attempts via a foreign key.
export async function deleteExpiredResumeCoachRecords(sql: Sql, days: number): Promise<{ deletedAttempts: number }> {
	await sql`
		delete from feedback
		where attempt_id in (
			select id from attempts
			where mode = 'resume_coach' and created_at < now() - make_interval(days => ${days})
		)
	`;
	const rows = (await sql`
		delete from attempts
		where mode = 'resume_coach' and created_at < now() - make_interval(days => ${days})
		returning id
	`) as { id: string }[];
	return { deletedAttempts: rows.length };
}

// Cron cleanup, part 2: permanently deletes stories that have been
// soft-deleted for longer than the undo grace period (migration 0008).
// attempts.story_id is ON DELETE SET NULL (migration 0007), so any
// attempts/feedback referencing a purged story survive with story_id = null
// rather than blocking this delete.
export async function deleteExpiredSoftDeletedStories(sql: Sql, graceDays: number): Promise<{ deletedStories: number }> {
	const rows = (await sql`
		delete from story_bank
		where deleted_at is not null and deleted_at < now() - make_interval(days => ${graceDays})
		returning id
	`) as { id: string }[];
	return { deletedStories: rows.length };
}

// ---------- Interview Rounds ----------
// A per-company, structured breakdown of each interview round (HR screen,
// hiring manager, case, team fit, final round, plus reference sections like
// a fact sheet or salary/negotiation playbook) — see
// worker/migrations/0014_interview_rounds.sql. No soft-delete/undo grace
// period here (unlike story_bank): this is reference material the user
// edits directly, not an AI-generation input worth protecting the same way.

export interface QaItem {
	question: string;
	answer: string;
}

export interface InterviewRoundRow {
	id: string;
	company: string;
	order: number;
	title: string;
	whatItTests: string | null;
	prepFocus: string | null;
	qaItems: QaItem[];
	createdAt: string;
	updatedAt: string;
}

interface InterviewRoundRowRaw {
	id: string;
	company: string;
	round_order: number;
	title: string;
	what_it_tests: string | null;
	prep_focus: string | null;
	qa_items: QaItem[];
	created_at: string;
	updated_at: string;
}

function mapInterviewRoundRow(row: InterviewRoundRowRaw): InterviewRoundRow {
	return {
		id: row.id,
		company: row.company,
		order: row.round_order,
		title: row.title,
		whatItTests: row.what_it_tests,
		prepFocus: row.prep_focus,
		qaItems: row.qa_items,
		createdAt: new Date(row.created_at).toISOString(),
		updatedAt: new Date(row.updated_at).toISOString(),
	};
}

const INTERVIEW_ROUND_COLUMNS = "id, company, round_order, title, what_it_tests, prep_focus, qa_items, created_at, updated_at";

export async function listInterviewRounds(sql: Sql, userId: string, company: string): Promise<InterviewRoundRow[]> {
	const rows = (await sql`
		select ${sql.unsafe(INTERVIEW_ROUND_COLUMNS)}
		from interview_rounds
		where user_id = ${userId} and company = ${company}
		order by round_order asc, created_at asc
	`) as InterviewRoundRowRaw[];
	return rows.map(mapInterviewRoundRow);
}

export interface InterviewRoundInput {
	company: string;
	order: number;
	title: string;
	whatItTests: string | null;
	prepFocus: string | null;
	qaItems: QaItem[];
}

export async function createInterviewRound(sql: Sql, userId: string, input: InterviewRoundInput): Promise<InterviewRoundRow> {
	const rows = (await sql`
		insert into interview_rounds (user_id, company, round_order, title, what_it_tests, prep_focus, qa_items)
		values (${userId}, ${input.company}, ${input.order}, ${input.title}, ${input.whatItTests}, ${input.prepFocus}, ${JSON.stringify(input.qaItems)}::jsonb)
		returning ${sql.unsafe(INTERVIEW_ROUND_COLUMNS)}
	`) as InterviewRoundRowRaw[];
	return mapInterviewRoundRow(rows[0]);
}

// Returns null if the round doesn't exist or belongs to a different user —
// callers should treat that as a 404, not silently succeed.
export async function updateInterviewRound(sql: Sql, userId: string, id: string, input: InterviewRoundInput): Promise<InterviewRoundRow | null> {
	const rows = (await sql`
		update interview_rounds
		set company = ${input.company}, round_order = ${input.order}, title = ${input.title},
		    what_it_tests = ${input.whatItTests}, prep_focus = ${input.prepFocus}, qa_items = ${JSON.stringify(input.qaItems)}::jsonb,
		    updated_at = now()
		where id = ${id} and user_id = ${userId}
		returning ${sql.unsafe(INTERVIEW_ROUND_COLUMNS)}
	`) as InterviewRoundRowRaw[];
	const row = rows[0];
	return row ? mapInterviewRoundRow(row) : null;
}

export async function deleteInterviewRound(sql: Sql, userId: string, id: string): Promise<boolean> {
	const rows = (await sql`
		delete from interview_rounds
		where id = ${id} and user_id = ${userId}
		returning id
	`) as { id: string }[];
	return rows.length > 0;
}
