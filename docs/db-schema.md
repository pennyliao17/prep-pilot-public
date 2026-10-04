# DB Schema – Neon Postgres

This document describes the tables and columns the project uses. The goals are to support:
- Question bank management (multiple question types and categories)
- User answer records
- AI scoring and feedback
- Some room for future expansion (sessions, more companies)

There is a single Neon project and a single DB, with all tables in the same schema (default `public`).

---

## 1. users (in real use since 2026-07-06: Google sign-in)

Purpose: after a sign-in, every successfully signed-in email is upserted here (`upsertUser` in `worker/src/db.ts`), whether or not it finally passes the `ALLOWED_EMAIL` allowlist check. The allowlist check lives in the Worker layer, not the database layer.

Columns (in use, see `worker/migrations/0001_init.sql`; no new migration was needed, the existing columns were enough):

- `id` – `uuid`, PK, default `gen_random_uuid()`
- `email` – `text`, unique (`on conflict (email) do update` relies on this unique constraint)
- `created_at` – `timestamptz`, default `now()`
- `updated_at` – `timestamptz`, set to `now()` by hand in the upsert statement on every sign-in (there is no database-level trigger)

The reviewer demo account (since 2026-10) is just another row here (`demo-viewer@preppilot.local`), created on its first graded answer. Its attempts are tied to its own `user_id`, so they can never mix with the owner's data.

**Columns deliberately not added yet** (see the to-dos in `docs/tasks.md`): `plan` / `tier` / trial-count columns for a paid or trial model. Only one allowlisted email can use the app right now, so the paid / trial architecture decision is postponed; `attempts.user_id` is already filled with the real user, so if it is built later it can just query `attempts` with no schema change.

---

## 2. questions

Purpose: stores every practice question (Product / Analytical / LP / Strategy / Estimation / System Design / AI PM). **Multiple target companies have been supported since 2026-08-14**; the `company` column is the multi-company extension point that was reserved from the start.

Columns:

- `id` – `uuid`, PK
- `company` – `text`, **no CHECK constraint** (the application-layer list of known companies is `SUPPORTED_COMPANIES` in `worker/src/index.ts`, currently `'amazon'` / `'make'` / `'meta'`)
  - `'amazon'`: the original bank (`worker/migrations/0002` / `0004` / `0005`), PM role, rubric in `docs/rubrics-amazon.json`
  - `'make'` (since 2026-08-14, `worker/migrations/0011_seed_make_questions.sql`): make.com (formerly Integromat, acquired by Celonis in 2020, renamed Make in 2022); PM role, a starter batch of 21 questions (3 per type), rubric in `docs/rubrics-make.json`
  - `'meta'` (since 2026-10-02, `worker/migrations/0015_remove_rtbhouse_add_meta.sql`): Meta (the Facebook family of apps); PM role, a starter batch of 21 questions (3 per type), rubric in `docs/rubrics-meta.json`. **The same migration also removed a company that had been supported from 2026-08-26 to 2026-10-02**, which prepared for a Technical Account Manager role with a completely different set of 5 question types. Its questions were deleted, and the `questions_type_check` allowed values that had been widened for it were taken back.
  - `GET /api/questions` takes a `company` query param (with a default); when omitted it defaults to `'amazon'` (see `docs/api-spec.md`). Without this filter, the same question type would mix several companies' questions together.
- `type` – `text`
  - CHECK constraint `questions_type_check`, allowed values (matching `rubrics-amazon.json` / `rubrics-make.json` / `rubrics-meta.json`; the three files share the same 7 keys because all three companies currently prepare for a PM role, and the types are generic interview archetypes, not company-specific frameworks):
    - `product_sense`
    - `analytical_execution`
    - `leadership_principles_behavioral`
    - `strategy_business`
    - `estimation`
    - `system_design`
    - `ai_pm`
- `title` – `text` — the question title (a short sentence)
- `description` – `text` — the full question text (may be multi-line)
- `metadata` – `jsonb` (nullable)
  - Can hold:
    - `difficulty` (for example `"mid"`, `"senior"`)
    - `tags` (for example `["Ownership", "Dive Deep"]` for LP questions)
    - `source` (for example `"derived_from_exponent"`)
- `created_at` – `timestamptz`, default `now()`
- `updated_at` – `timestamptz`, default `now()`

Suggested indexes:

- `idx_questions_company_type` on (`company`, `type`)
- If tags / difficulty filters become common, add a GIN index on `metadata`

---

## 3. attempts

Purpose: records each time a user answers a question. It could also record anonymously without a sign-in if needed (matching by a cookie / local id).

Columns:

- `id` – `uuid`, PK
- `user_id` – `uuid`, FK → `users.id` (since 2026-07-06 every attempt after sign-in is filled with the real `users.id`; it can still be null in theory, but every request is signed in today)
- `question_id` – `uuid`, FK → `questions.id`, **nullable** (with `mode = 'resume_coach'` there is no matching question, see `worker/migrations/0003_attempts_question_id_nullable.sql`)
- `company` – `text` — stored redundantly for easier queries; expected to match questions.company. With `mode = 'resume_coach'` there is no matching question, so it is filled from `resume_coach_profile.target_company` (see §4.5 below)
- `type` – `text` — stored redundantly for easier queries; expected to match questions.type
- `mode` – `text`
  - Normal practice: `"single_question"`
  - Resume coach: `"resume_coach"`
  - If a whole-session mode is added later, something like `"session"`
- `answer_text` – `text` — the user's original answer (long text); with `mode = 'resume_coach'` it holds a snapshot of the story content used for that generation
- `raw_input` – `jsonb` (nullable)
  - Extra fields can go here (for example the target LP the user picked, or several parts of an uploaded resume)
- `story_id` – `uuid`, FK → `story_bank.id`, **nullable** (since 2026-07-16, see `worker/migrations/0006_resume_coach_story_bank.sql`). Only `mode = 'resume_coach'` attempts fill it, recording which Story Bank entry the generation was for; every other mode leaves it null. It is **`on delete set null`** (migration `0007`, which fixed a real bug: the foreign key originally had no `on delete` behavior, so the default `no action` made deleting a story that had already been used for a generation fail on the foreign-key constraint, and `DELETE /api/resume-coach/stories/:id` always returned 500, so the story could not be deleted at all).
- `created_at` – `timestamptz`, default `now()`

Suggested indexes:

- `idx_attempts_user_created_at` on (`user_id`, `created_at`)
- `idx_attempts_type_created_at` on (`type`, `created_at`)

---

## 4. feedback

Purpose: stores each AI scoring result and feedback for an attempt, fully JSON-structured, matching the `rubrics-*.json` files and the prompts.

Columns:

- `id` – `uuid`, PK
- `attempt_id` – `uuid`, FK → `attempts.id` (one-to-one; normally one attempt has one feedback)
- `company` – `text` (redundant)
- `type` – `text` (same as questions.type / attempts.type)
- `scores` – `jsonb`
  ```json
  {
    "clarity_and_structure": 3,
    "customer_obsession_and_motivation": 4
  }
  ```
- `strengths` – `jsonb`
  ```json
  {
    "clarity_and_structure": [
      "You stated a rough plan up front, which helped structure the answer."
    ]
  }
  ```
- `improvements` – `jsonb` — same structure as strengths
- `example_answer` – `text` — a summary of a high-scoring answer (may be multi-line text)
- `overall_feedback` – `text` — the overall feedback
- `extra` – `jsonb` (nullable)
  - For special modes such as the Resume Coach: `suggested_lps`, `rewritten_star_answer`, `resume_rewrite_suggestions`
- `model_name` – `text` — records which Workers AI model was used, for example `"@cf/meta/llama-3.3-70b-instruct-fp8-fast"`
- `created_at` – `timestamptz`, default `now()`

Suggested indexes:

- `idx_feedback_attempt_id` on (`attempt_id`)
- `idx_feedback_type_created_at` on (`type`, `created_at`)

---

## 4.5 resume_coach_profile / story_bank (since 2026-07-16, the full Resume Coach rework)

Purpose: after the rework the Resume Coach no longer takes a one-off pasted text; it persists three input sources that every AI generation uses together (see the Resume Coach section of `docs/api-spec.md` and `buildResumeCoachUserMessage` in `worker/src/prompts.ts`).

### resume_coach_profile

One row per user (the PK is `user_id` itself), holding the resume text the user uploaded / pasted and the target job description:

- `user_id` – `uuid`, PK, FK → `users.id`
- `resume_text` – `text` (nullable)
- `job_description` – `text` (nullable)
- `target_company` – `text`, **not null**, default `'amazon'` (since 2026-08-14, `worker/migrations/0010_resume_coach_target_company.sql`). Decides which company's values framework a Resume Coach generation uses (Amazon's 16 Leadership Principles, Make's product / culture themes, or Meta's culture themes; see `AMAZON_LPS` / `MAKE_VALUES` / `META_VALUES` in `worker/src/prompts.ts`). It is a single persisted setting rather than a per-generation parameter, handled the same way as `resume_text` / `job_description`. **It is a different concept from `story_bank.company`**: `story_bank.company` is "which company did this experience happen at", while `target_company` is "which company's interview am I preparing for now".
- `updated_at` – `timestamptz`, set to `now()` on every PUT

`PUT /api/resume-coach/profile` supports partial updates (sending only one or two fields leaves the rest unchanged, see `upsertResumeCoachProfile` in `worker/src/db.ts`). `target_company` only accepts values from `SUPPORTED_COMPANIES` in `worker/src/index.ts`; any other value returns `400`.

### story_bank

Several stories the user wrote. **They are never cleared automatically with time**: they disappear only when the user deletes them, and deletion itself is a "soft delete plus a 3-day undo grace period" (since 2026-07-18, see "Delete and restore" below):

- `id` – `uuid`, PK
- `user_id` – `uuid`, FK → `users.id`
- `title` – `text`
- `content` – `text`
- `company` – `text`, **nullable** (since 2026-07-18, migration `0009`). Which company this experience was at; like title / content it is required when adding a story (see the validation in `worker/src/index.ts`), and only the two older stories that existed before the migration are null. Purpose: lets the Story Bank (the list of earlier generation results) be filtered by company, to find the experience stories told for one company quickly.
- `created_at` / `updated_at` – `timestamptz`, default `now()`
- `deleted_at` – `timestamptz`, **nullable** (since 2026-07-18, migration `0008`). Null means the story is currently "active" and shows in the "Add a new story" block's list; non-null means the user pressed delete, recording the moment of the soft delete, used to compute how much of the 3-day grace period remains.
- `latest_extra` – `jsonb`, **nullable** (migration `0008`). The full content of this story's **most recent** generation result (same shape as `feedback.extra`); null means the story has never been generated. A copy of "the latest result" is kept on the story itself, rather than always querying `attempts` / `feedback`, because those records auto-expire after 5 days (see below), yet the story list must keep showing the principle tags of each story reliably, and the result must not vanish after 5 days.
- `latest_generated_at` – `timestamptz`, **nullable**. The last time `latest_extra` was updated; the UI uses it to show "Last generated ...".

Indexes: `idx_story_bank_user` on (`user_id`), `idx_story_bank_deleted_at` on (`deleted_at`).

After every generation, `attempts.story_id` is used to update the matching story's `latest_extra` / `latest_generated_at` (`updateStoryLatestExtra` in `worker/src/db.ts`, done inside `handleResumeCoachFeedback` in the same request that creates the attempt / feedback). Editing the story content (`PUT /api/resume-coach/stories/:id`) does **not** touch `latest_extra`: after a successful edit the frontend automatically sends another generation request so `latest_extra` catches up to the new content. The two are deliberately separate steps, which is semantically clearer.

### Delete and restore (soft delete plus a 3-day grace period, since 2026-07-18)

`DELETE /api/resume-coach/stories/:id` is no longer a hard delete: it sets `deleted_at` to `now()` (`softDeleteStory` in `worker/src/db.ts`). The story disappears from `listStories` / the Story Bank list immediately, but the row stays in the database, and `POST /api/resume-coach/stories/:id/restore` can set `deleted_at` back to `null` within the grace period. The grace period is 3 days (`STORY_DELETE_GRACE_DAYS` in `worker/src/index.ts`); the permanent deletion after it runs in the cron job below.

### AI output auto-expiry (5-day TTL) plus expired soft-delete cleanup (3 days)

Postgres has no native per-row TTL, so both use the same Cloudflare Cron Trigger (`triggers.crons` in `worker/wrangler.jsonc`, once a day at 09:00 UTC; the handler is the `scheduled()` export of `worker/src/index.ts`), doing two things in order:

1. Cleanup logic (`deleteExpiredResumeCoachRecords` in `worker/src/db.ts`): deletes `attempts` / `feedback` rows with `mode = 'resume_coach'` and `created_at` older than 5 days (deleting `feedback` first and then `attempts`, because `feedback.attempt_id` is a foreign key), without touching `story_bank` at all.
2. Cleanup logic (`deleteExpiredSoftDeletedStories` in `worker/src/db.ts`): really deletes `story_bank` rows whose `deleted_at` is older than 3 days. `attempts.story_id` is `on delete set null` (migration `0007`), so any attempt / feedback still referencing the story is neither deleted along with it nor blocks the deletion; its `story_id` just becomes `null`.

---

## 4.6 interview_rounds (since 2026-09-03, the Interview Rounds tab)

Purpose: turns "an interview has several rounds, and each tests something different" into structured data. Each round (HR screen, hiring manager, product case, team fit, final round, or a reference block such as a fact sheet) is one row, grouped by `company` and ordered by `round_order`. Unlike `story_bank`, this is not raw material for AI generation; it is a reference document the user organizes and edits directly, so there is **no soft delete / undo grace period**: `DELETE` really deletes (see `worker/migrations/0014_interview_rounds.sql`).

- `id` – `uuid`, PK
- `user_id` – `uuid`, FK → `users.id`
- `company` – `text`, **not null**. Free text, not restricted to `SUPPORTED_COMPANIES`: this page is deliberately made to work for any company, even one PrepPilot has no built-in question bank for.
- `round_order` – `integer`, **not null**, default `0`. Purely controls the display order within one company; the user fills in the number in the edit form, with no automatic reordering or drag-and-drop.
- `title` – `text`, **not null**. The name of the round, for example "ROUND 1 — HR / Recruiter Screen".
- `what_it_tests` – `text`, nullable. A summary of what the round actually tests.
- `prep_focus` – `text`, nullable. Prep focus notes.
- `qa_items` – `jsonb`, **not null**, default `'[]'`. An ordered array of `{question, answer}` objects: each question and the answer prepared for it. Storing them as an array (rather than a separate child table) is deliberate: a round's Q&A list is naturally the unit edited together in one edit, and needs no separate CRUD API.

Index: `idx_interview_rounds_user_company` on (`user_id`, `company`).

`GET /api/interview-rounds` requires the `company` query parameter (see `docs/api-spec.md`) and cannot fetch everything at once the way `story_bank` can: this page's data is naturally "one set per company", and the frontend always drives the query from a company dropdown. These rows are the owner's personal data; the reviewer demo account cannot reach them and gets a separate static page instead.

---

## 5. Tables that might be added later (not implemented)

- `sessions` — to tie a set of questions together (a full mock loop) and measure a whole session.
- `question_sets` / `playlists` — different practice plans (for example "AI PM only", "LP Deep Dive").
- `companies` — if companies ever need their own attributes, they can be split into a separate table. For now a `text` column is enough.

---

## 6. Implementation advice

- The first version can create tables directly with SQL migrations; an ORM (such as Drizzle) can be introduced later if needed.
- When asking an AI to write SQL, give it this `db-schema.md` as the source of truth first, to avoid the schema drifting out of sync.
