# API Spec – Cloudflare Worker (REST)

This document defines the HTTP API contract between the frontend and the Cloudflare Worker.
Every endpoint starts with `/api/...` and is deployed on Cloudflare Workers.

**Since 2026-07-06 the API requires a real sign-in** (Google Sign-In or email one-time code, see "Authentication" below); it is no longer a shared single-user tool. Only one allowlisted email passes the access check after sign-in. Anyone else gets, from the relevant verification endpoint, the same 404 as for a route that does not exist. Since 2026-10 a scoped, read-mostly **reviewer demo session** also exists (see `POST /api/auth/demo`).

---

## Authentication

### `POST /api/auth/google`

Purpose: after the frontend gets an ID token issued by Google Identity Services, exchange it for this site's own session token. **No `Authorization` header is needed** (this is the sign-in endpoint itself).

Request body:

```json
{
  "idToken": "<ID token JWT issued by Google>"
}
```

Response (200 OK, email is on the allowlist):

```json
{
  "token": "<session token issued by this site>",
  "email": "you@example.com"
}
```

Response (**404**, the email passed Google verification but is not in the `ALLOWED_EMAIL` allowlist):

```json
{
  "error": {
    "code": "not_found",
    "message": "No route for POST /api/auth/google"
  }
}
```

The message is deliberately identical to the 404 for a nonexistent route. A 403 would leak that a permission gate exists. On this specific 404 the frontend renders `NotFoundPage` (a plain 404 page that never mentions sign-in, email, or payment), not the error message used for an ordinary failed API call.

Response (400 / 401, token missing or rejected by Google): the standard error shape, with the status depending on the case.

### `POST /api/auth/email/start`

Purpose: step one of email sign-in. Given an email, send a 6-digit code to that inbox. **No `Authorization` header.** Rate limited by source IP (5 per 60 seconds, 429 above that) so it cannot be used to spam strangers' inboxes.

Request body:

```json
{ "email": "you@example.com" }
```

Response (200 OK, meaning the code was sent; it does not reveal whether the email has an account, to prevent account enumeration):

```json
{ "sent": true }
```

Response (400, malformed email) / (502, Resend failed to send): the standard error shape.

### `POST /api/auth/email/verify`

Purpose: step two of email sign-in. Given an email and the code received, exchange them for a session token. Also IP rate limited. **The account is only created or signed in when the code is correct**; knowing an email is not enough. The first successful verification is effectively "create account" and later ones are "sign in", the same path with no sign-up / sign-in distinction.

Request body:

```json
{ "email": "you@example.com", "code": "123456" }
```

Response (200 OK, email on the allowlist): the same shape as the `POST /api/auth/google` success response (`{ "token": "...", "email": "..." }`).

Response (**404**, correct code but the email is not on the allowlist): identical in behavior to the `POST /api/auth/google` 404, with the message `"No route for POST /api/auth/email/verify"`; no session is issued.

Response (401, wrong or expired code): the standard error shape. After 5 wrong attempts the code is voided and `/start` must be called again for a new one.

### `POST /api/auth/demo` (2026-10)

Purpose: sign in to the scoped reviewer demo account. **No `Authorization` header.** Rate limited by IP (10 per 60 seconds).

Request body:

```json
{ "username": "<demo username>", "password": "<demo password>" }
```

The Worker compares the SHA-256 hash of the password with the `DEMO_PASSWORD_HASH` secret; the password itself is not stored anywhere. Response (200 OK): `{ "token": "...", "email": "demo-viewer@preppilot.local" }`, where the token carries `role: "demo"`. A wrong username or password returns a generic 401.

A demo session is **fail-closed**: right after session verification, any route that is not in the Worker's `DEMO_ALLOWED_ROUTES` allowlist returns `403 demo_forbidden`. Currently allowed:

| Route | Notes |
|---|---|
| `GET /api/questions` | Read the question bank |
| `POST /api/feedback` | `single_question` mode only (`resume_coach` mode returns 403). Capped at **3 AI gradings per day**; the 4th returns `429 demo_daily_limit`. Results are stored under the demo user's own `users` row |
| `GET /api/attempts` | Scoped by session email like every other session, so it only ever shows the demo account's own history (empty at first) |
| `POST /api/salary-positioning` | The example tool below; **once per company per rolling 10 days**, otherwise `429 salary_tool_limit` |

Everything else (Resume Coach, the Story Bank, the real Interview Rounds, and so on) is unreachable for a demo session.

### All other endpoints (except `GET /api/health`)

**Must carry an `Authorization: Bearer <session token>` header**, the token returned by one of the sign-in endpoints. If it is missing, malformed, has a bad signature, is expired, or (for an owner session) the session's email no longer equals `ALLOWED_EMAIL`, the response is always:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Missing or invalid session. Please sign in again."
  }
}
```

with status 401. See `docs/ai-rules.md` §1.3 for the full explanation (how the Google token is verified, how sessions are issued, and why the old `x-app-key` was removed).

---

## Conventions

- Base URL (development): `http://localhost:8787/api`
- Base URL (production, deployed): `https://preppilot-worker.preppilot.workers.dev/api`
  (the frontend calls this workers.dev address directly; no `/api/*` reverse-proxy route is configured)
- Every successful JSON response is `application/json; charset=utf-8`.
- **`POST /api/feedback` is additionally rate limited by source IP** (20 per 60 seconds, see `docs/ai-rules.md` §1.3). Above the limit:
  ```json
  {
    "error": {
      "code": "rate_limited",
      "message": "Too many requests. Please slow down and try again shortly."
    }
  }
  ```
  with status 429, returned **before** Workers AI is called.
- **CORS: `access-control-allow-origin` only reflects allowlisted origins** (`https://preppilot.pages.dev`, `http://localhost:5173`); any other origin gets the default (the production origin) instead of being reflected. CORS is not the primary protection (it does not stop curl or bots), only a guard against a malicious third-party site reading responses through a visitor's browser.
- Any other error uses this shape:
  ```json
  {
    "error": {
      "code": "string_error_code",
      "message": "Human readable message"
    }
  }
  ```

---

## 1. Health check

`GET /api/health`

Purpose: check that the Worker is alive and that basic dependencies (Neon / Workers AI) are healthy.

Request: no parameters.

Response (200 OK example):

```json
{
  "status": "ok",
  "timestamp": "2026-07-02T15:00:00.000Z",
  "dependencies": {
    "neon": "ok",
    "workers_ai": "ok"
  }
}
```

---

## 2. Question bank

### `GET /api/questions`

Purpose: list questions, filterable by type and company. **Multiple companies have been supported since 2026-08-14**: currently `amazon`, `make`, and `meta` (since 2026-10-02 `meta` replaced a previously supported company; see `questions.company` in `docs/db-schema.md`). The three companies share the same 7 PM `type` values (`product_sense` and so on, see `docs/db-schema.md` §2). The client (`QUESTION_TYPES_BY_COMPANY` in `frontend/src/types.ts`) still filters the offered `type` options by the selected `company`, to leave room for a future company with a non-PM role; today no company receives an empty list.

Query parameters:

- `type` (optional, string)
  - Allowed values: `product_sense`, `analytical_execution`, `leadership_principles_behavioral`, `strategy_business`, `estimation`, `system_design`, `ai_pm`
- `company` (optional, string, added 2026-08-14): defaults to `'amazon'` when omitted (backward compatible with the earlier behavior). **Before this parameter existed, the `type` filter mixed several companies' questions together.** That latent problem existed before multi-company support, but it was invisible with a single-company bank. The Practice page's company dropdown (`frontend/src/App.tsx`) always sends this parameter explicitly.
- `limit` (optional, number): default 10

Example request: `GET /api/questions?type=strategy_business&company=make&limit=5`

Response (200 OK example):

```json
[
  {
    "id": "e0a8a4b5-1234-5678-9abc-001122334455",
    "company": "amazon",
    "type": "product_sense",
    "title": "Design a new feature to improve the Amazon product detail page.",
    "description": "You are a PM on the Amazon Retail team. How would you design a new feature to help customers make better purchase decisions on the PDP?",
    "metadata": {
      "difficulty": "mid",
      "tags": ["customer_obsession", "conversion"]
    }
  }
]
```

### `GET /api/questions/:id`

**⚠️ Not implemented yet** (`worker/src/index.ts` currently has only `GET /api/questions`, with no path-param version; calling this falls through to a 404). The spec below keeps the original plan for future implementation.

Purpose: get the full information of a single question.

Path parameter: `id` – the question `uuid`

Response (200 OK example):

```json
{
  "id": "e0a8a4b5-1234-5678-9abc-001122334455",
  "company": "amazon",
  "type": "product_sense",
  "title": "Design a new feature to improve the Amazon product detail page.",
  "description": "You are a PM on the Amazon Retail team. ...",
  "metadata": {
    "difficulty": "mid",
    "tags": ["customer_obsession", "conversion"]
  }
}
```

---

## 3. Attempts and feedback

### `POST /api/attempts`

Purpose: receive the user's answer to a question and create an attempt record. In practice this is usually merged with `/api/feedback`: create the attempt first, then grade it.

Request body (JSON):

```json
{
  "questionId": "e0a8a4b5-1234-5678-9abc-001122334455",
  "type": "product_sense",
  "mode": "single_question",
  "answerText": "Here is my structured answer...",
  "rawInput": {
    "targetLps": ["Ownership", "Customer Obsession"]
  }
}
```

Fields:

- `questionId` – required, maps to `questions.id`
- `type` – required, the question type
- `mode` – optional, default `"single_question"`; `"resume_coach"` for the resume coach
- `answerText` – required, the user's full answer
- `rawInput` – optional, extra context to keep (for example the principles the user picked)

Response (201 Created example):

```json
{
  "id": "b7d91b62-aaaa-bbbb-cccc-112233445566",
  "questionId": "e0a8a4b5-1234-5678-9abc-001122334455",
  "type": "product_sense",
  "mode": "single_question",
  "createdAt": "2026-07-02T15:05:00.000Z"
}
```

### `GET /api/attempts`

**Implemented (2026-07-10 for the Phase 4 Dashboard; expanded with full content on 2026-07-16).** Purpose: return the user's own answer history (with computed scores, the full answer text, and the full AI feedback) plus the average score and trend per question type, for the frontend Dashboard.

Query parameters (optional):

- `limit` – number of history rows to return, default 20, clamped to 1–100 (raised from 50 on 2026-07-16 because the frontend now groups by date and needs enough rows not to cut a day off midway)

Implementation notes (`getUserAttemptHistory` in `worker/src/db.ts`, `buildTypeSummary` in `worker/src/index.ts`):

- Returns only the signed-in user's own records (the `users.id` for `session.email`), always ordered by `created_at desc`. A reviewer demo session therefore sees only the demo account's own history.
- `summary` is computed from the latest 200 records (`ATTEMPT_HISTORY_WINDOW`), not all history. This is a single-user tool and 200 is far above what accumulates in the short term, so pagination and date-range parameters are not implemented yet.
- `overallScore` = the average of all subdimension scores in that attempt's `feedback.scores`, rounded to one decimal; always `null` for `resume_coach` mode or an attempt with no feedback yet.
- `summary` only counts records with `mode = "single_question"` that have scores, grouped by `type`.
- `trend` = the average score of the type's most recent records minus the average of earlier ones (rounded to one decimal); `null` when there are fewer than 4 scored records (too little data for a trend to mean anything).
- `answerFramework` (added 2026-08-19): see the "answerFramework" note below.

Example request: `GET /api/attempts?limit=20`

Response (200 OK example):

```json
{
  "attempts": [
    {
      "id": "b7d91b62-aaaa-bbbb-cccc-112233445566",
      "type": "product_sense",
      "mode": "single_question",
      "questionTitle": "Design an Amazon feature for a country Amazon is newly entering.",
      "answerText": "First, I would clarify the target market and card penetration assumptions...",
      "overallScore": 3.5,
      "scores": { "clarity_and_structure": 4, "customer_obsession_and_motivation": 3 },
      "strengths": { "clarity_and_structure": ["You stated a rough plan at the beginning."] },
      "improvements": { "customer_obsession_and_motivation": ["Add a more concrete customer scenario."] },
      "overallFeedback": "Solid structure, could go deeper on the customer angle.",
      "exampleAnswer": "A stronger answer would start by naming the specific customer segment...",
      "answerFramework": [
        "1) Ask a couple of clarifying questions to pin down scope, platform, and any constraints.",
        "2) Confirm who the customer is and restate the goal — tie it back to the company mission / product goal.",
        "..."
      ],
      "extra": null,
      "createdAt": "2026-07-10T08:55:00.000Z"
    },
    {
      "id": "1a06eeae-6855-4f0e-97b3-c16b066b28be",
      "type": "leadership_principles_behavioral",
      "mode": "resume_coach",
      "questionTitle": null,
      "answerText": "Led a cross-functional project to migrate our legacy monolith...",
      "overallScore": null,
      "scores": null,
      "strengths": null,
      "improvements": null,
      "overallFeedback": null,
      "exampleAnswer": null,
      "answerFramework": null,
      "extra": { "suggested_lps": ["Ownership"], "hype_script": "..." },
      "createdAt": "2026-07-10T08:48:00.000Z"
    }
  ],
  "summary": [
    { "type": "product_sense", "attemptCount": 30, "averageScore": 3.0, "trend": 0.6 },
    { "type": "system_design", "attemptCount": 3, "averageScore": 3.0, "trend": null }
  ]
}
```

The frontend (`frontend/src/Dashboard.tsx`) uses `summary` to draw the "average score and trend per type" cards (each with a "Review this topic →" link that opens the `TopicReviewPanel.tsx` slide-in panel, which filters the same `attempts` data by `type` to show every `single_question` record for that type: the question, an always-expanded example answer, and a collapsible full answer and AI feedback). It groups `attempts` by date for the "Recent attempts" list; each row expands to the full `answerText` and full AI feedback: in `mode = "single_question"` it reuses `FeedbackDisplay` with `scores` / `strengths` / `improvements` / `overallFeedback` / `exampleAnswer`, and in `mode = "resume_coach"` it reuses `ResumeCoachResultDisplay` with `extra` (the `ResumeCoachExtra` shape). When `questionTitle` is `null` it shows "Resume Coach", and when `overallScore` is `null` it shows "—".

`GET /api/attempts/:id` (single-record detail, an `includeFeedback` parameter) is not implemented: `GET /api/attempts` already carries `overallFeedback`, so the v1 Dashboard does not need a detail endpoint. Revisit it if the full `exampleAnswer` / `strengths` / `improvements` of a single record is ever needed separately.

### `POST /api/feedback`

Purpose: grade an answer and return AI feedback. Two `mode` values are supported: `single_question` (ordinary question grading) and `resume_coach` (the resume coach, implemented as `handleResumeCoachFeedback` in `worker/src/index.ts`). Any other `mode` returns `400 unsupported_mode`.

`answerText` is capped at 8000 characters (`MAX_ANSWER_TEXT_LENGTH` in `worker/src/index.ts`); longer input returns `400 invalid_body`, rejected **before** Workers AI is called (even with real sign-in, a single request still needs a reasonable cap so an accident or a stolen session cannot inflate one Workers AI call).

The frontend only uses `POST /api/feedback`, as recommended.

**`mode = "single_question"` (default):** `type`, `answerText`, and `questionId` are required and go directly in the body. The backend verifies that `questionId` matches a real question → creates an attempt → calls Workers AI → writes the feedback → returns the feedback structure. There is **no** path that takes an existing `attemptId` and reads the answer from the backend; only a directly supplied `answerText` is accepted. **Since 2026-08-14 the rubric used for grading is determined by the `question.company` of that `questionId`** (`worker/src/index.ts` first calls `getQuestionById` to get `question.company`, then calls `buildFeedbackSystemPrompt(type, question.company)`; it is not supplied by the client, so a company claimed by the frontend is never trusted). `amazon` uses `docs/rubrics-amazon.json`, `make` uses `docs/rubrics-make.json`, and `meta` uses `docs/rubrics-meta.json` (see `worker/src/rubrics.ts`). The `company` column of the created `attempts` / `feedback` rows is also set to this value instead of being hardcoded to `'amazon'`. `getTypeLabel` (display-only type names) searches all three rubric files in order; today the 7 PM types overlap across all three, and the design mainly leaves room for a future company that introduces its own types (see `docs/ai-rules.md` §5.1).

Request body (JSON example 1: ordinary question):

```json
{
  "questionId": "e0a8a4b5-1234-5678-9abc-001122334455",
  "type": "product_sense",
  "mode": "single_question",
  "answerText": "Here is my structured answer..."
}
```

**`mode = "resume_coach"` (fully reworked 2026-07-16):** there is no `questionId` (`attempts.question_id` is null for this mode, see `worker/migrations/0003_attempts_question_id_nullable.sql`). **`answerText` is no longer accepted.** Instead `storyId` (the id of a Story Bank story) is required. The backend reads that story's `content`, merges the user's `resume_coach_profile` (full resume + target job description + `target_company`, which may be null / default `'amazon'`) and the matching company's values framework, and sends all four sources into one Workers AI call (see `buildResumeCoachUserMessage` / `buildResumeCoachSystemPrompt` in `worker/src/prompts.ts`). A `storyId` that matches no story (or someone else's story) returns `404 not_found`. `rawInput.targetLps` (optional) is an array of principle / value names the user wants to focus on; without it the model picks the best 1–2 itself. `type` is currently always `leadership_principles_behavioral` (hardcoded in the frontend's `ResumeCoach.tsx`, since the coach's output is essentially a behavioral story, and that type key is generic, not company-specific):

**Since 2026-08-14 the values framework is determined by `resume_coach_profile.target_company`, not by anything in this request.** `amazon` uses `AMAZON_LPS` (the 16 official Leadership Principles); `make` uses `MAKE_VALUES`; `meta` uses `META_VALUES` (since 2026-10-02: a set of themes assembled in `worker/src/prompts.ts` from how Meta publicly describes its own culture, mainly from the 2012 "The Hacker Way" IPO letter and the "Meta, Metamates, Me" value added in 2022). Like Make's, this is **not** an officially published numbered list, and the prompt tells the model so, so it will not call it an official document. The `company` column of the created `attempts` / `feedback` rows is set to this `target_company`.

```json
{
  "type": "leadership_principles_behavioral",
  "mode": "resume_coach",
  "storyId": "9c1e7e2a-1111-2222-3333-444455556666",
  "rawInput": {
    "targetLps": ["Ownership", "Dive Deep"]
  }
}
```

**Since 2026-07-18 the frontend no longer sends `rawInput.targetLps`.** The "Optional: focus generation on specific LPs" picker was removed when adding a story: `handleGenerate` in `ResumeCoach.tsx` now always calls `postResumeCoach({ type, storyId })` without `targetLps`, letting the model choose the best-fitting principles each time. The optional backend parameter itself was not removed (`buildResumeCoachSystemPrompt(targetLps)` still exists and tests still exercise that path); it is simply not sent by any caller today.

Response (200 OK example, `single_question` mode):

```json
{
  "attemptId": "b7d91b62-aaaa-bbbb-cccc-112233445566",
  "feedback": {
    "id": "f1c3de45-0000-1111-2222-334455667788",
    "scores": {
      "clarity_and_structure": 4,
      "customer_obsession_and_motivation": 3
    },
    "strengths": {
      "clarity_and_structure": [
        "You stated a rough plan at the beginning."
      ]
    },
    "improvements": {
      "customer_obsession_and_motivation": [
        "Add one or two specific customer scenarios."
      ]
    },
    "overallFeedback": "Solid structure, but you can deepen customer perspective.",
    "exampleAnswer": "A stronger answer would start by restating the customer problem...",
    "answerFramework": [
      "1) Ask a couple of clarifying questions to pin down scope, platform, and any constraints.",
      "2) Confirm who the customer is and restate the goal — tie it back to the company mission / product goal.",
      "3) Segment the users and pick one target segment, justifying the choice.",
      "4) Identify that segment's most important unmet needs / pain points.",
      "5) Propose one or two solutions, pick one, and name the key trade-offs.",
      "6) State how you would measure success."
    ],
    "extra": null,
    "modelName": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "createdAt": "2026-07-02T15:05:05.000Z"
  }
}
```

**`answerFramework` (added 2026-08-19, `single_question` mode only):** a fixed outline (six numbered short sentences) of the ideal answer structure for that question type. It is **not AI generated**: it is fixed in `EXAMPLE_ANSWER_FRAMEWORK_STEPS` in `worker/src/prompts.ts` (the framework that was already used to build the `exampleAnswer` prompt, now also returned to the frontend), looked up by `type` via `getAnswerFrameworkSteps(type)`. Purpose: `exampleAnswer` is deliberately written as one continuous paragraph of prose (modeling what a person says out loud in an interview), which is hard to skim or memorize, so this numbered outline is provided alongside it for practicing and remembering the answer structure. It is always `null` for `resume_coach` mode (the equivalent there is `extra.rewritten_star_answer`, which is already labeled Situation / Task / Action / Result / Reflection). Each history row in `GET /api/attempts` also derives this outline from its original `type`; it is not a database column but is computed at read time, so it works for old data too.

Response (200 OK example, `resume_coach` mode): `scores` / `strengths` / `improvements` / `overallFeedback` / `exampleAnswer` / `answerFramework` are always `null` (the resume coach has no rubric scoring, only generative rewriting); the real content is all in `extra`. **Since 2026-07-18 `extra` no longer includes `resume_rewrite_suggestions`** (removed on request: too little value for the extra output tokens):

```json
{
  "attemptId": "1a06eeae-6855-4f0e-97b3-c16b066b28be",
  "feedback": {
    "id": "d3259c81-bcef-4f5b-a708-be14d938f464",
    "scores": null,
    "strengths": null,
    "improvements": null,
    "overallFeedback": null,
    "exampleAnswer": null,
    "answerFramework": null,
    "extra": {
      "suggested_lps": ["Ownership", "Deliver Results"],
      "behavioral_question_types": [
        "Tell me about a time when you led a team to achieve a significant outcome."
      ],
      "rewritten_star_answer": {
        "situation": "...",
        "task": "...",
        "actions": "...",
        "results": "...",
        "reflection": "..."
      },
      "hype_script": "A ~150-word first-person pep talk, grounded only in the resume text (2026-07-13, the Pre-interview Hype feature)."
    },
    "modelName": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "createdAt": "2026-07-05T14:26:46.096Z"
  }
}
```

### `POST /api/salary-positioning` (2026-10, reviewer demo)

Purpose: a stateless example tool. The user enters their current pay and living costs; an AI coach estimates what it would take to keep the same standard of living at an example location, and positions the ask within a **per-company estimated band** for the selected company and region (Europe: Amazon and Meta in London, Make in Prague; United States: Amazon and Meta at a major tech hub, Make via its parent Celonis in New York) read off public salary sites (levels.fyi, Glassdoor) in October 2026. The band is a rough estimate, never an offer or a company's real pay scale, and the prompt says so. The reply also reminds the user to cross-check levels.fyi and Numbeo. Nothing is written to the database.

Request body:

```json
{
  "company": "meta",
  "region": "us",
  "currentSalary": 60000,
  "currentSalaryCurrency": "USD",
  "monthlyRent": 1500,
  "monthlyLivingExpenses": 1200,
  "currentSavingsRate": "20%"
}
```

`company` must be one of `amazon`, `make`, `meta` and `region` one of `europe`, `us` (together they pick the band); `currentSalary`, `monthlyRent`, `monthlyLivingExpenses` are non-negative numbers; `currentSalaryCurrency` is at most 10 characters and `currentSavingsRate` at most 50. Any other shape returns `400 invalid_body`. It is IP rate limited with the same limiter as `/api/feedback`; a demo session may use it **once per company per rolling 10 days** (the region toggle shares its company's allowance) (`429 salary_tool_limit` with the date it becomes available again).

Response (200 OK example):

```json
{
  "estimatedEquivalentCost": 12000,
  "positionWithinBand": "mid_band",
  "target": 12500,
  "anchor": 13200,
  "reasoning": "...",
  "numbeoCaveat": "...",
  "currency": "USD"
}
```

`positionWithinBand` is one of `below_floor`, `lower_band`, `mid_band`, `upper_band`, `above_ceiling`. All amounts are per month in `currency`, the selected company's band currency (USD for the US bands, GBP for Amazon and Meta in Europe, CZK for Make in Europe).

---

### `GET` / `PUT /api/resume-coach/profile`

Purpose: read / save the user's full resume, target job description, and target company (the `resume_coach_profile` table, see `docs/db-schema.md` §4.5). One row per user, kept permanently, and not subject to the 5-day auto-expiry (that rule only clears AI output, never user input).

`GET` returns:

```json
{ "resumeText": "...", "jobDescription": "...", "targetCompany": "amazon", "updatedAt": "2026-07-16T10:00:00.000Z" }
```

If nothing was saved yet, `resumeText` / `jobDescription` / `updatedAt` are `null` and `targetCompany` is `"amazon"` (the column has a not-null default in the DB, so it is always a real value).

All three `PUT` body fields are optional (a partial update: sending one or two fields does not clear the others, see `upsertResumeCoachProfile` in `worker/src/db.ts`):

```json
{ "resumeText": "...", "jobDescription": "...", "targetCompany": "make" }
```

`targetCompany` (added 2026-08-14) only accepts values from `SUPPORTED_COMPANIES` in `worker/src/index.ts` (currently `"amazon"` / `"make"` / `"meta"`); anything else returns `400 invalid_body`. The frontend calls this as soon as the "Practicing for" dropdown on the Resume Coach page changes (unlike the resume / JD, which wait for "Save"), because choosing a company is a single discrete choice and not text that needs batching.

The response has the same shape as `GET`, returning the full updated values.

### `GET` / `POST /api/resume-coach/stories`, `PUT` / `DELETE /api/resume-coach/stories/:id`

Purpose: Story Bank CRUD (the `story_bank` table). A story is never removed automatically with time; it only disappears when the user deletes it (see "Soft delete" below). **Since 2026-07-18 the frontend merged the add / edit / delete story UI into the same block as the old "Story Bank" list, now called "Add a new story"**: submitting a new story immediately triggers a generation (no manual "Generate" press needed). Details are in the `company` note below and in the `PUT` behavior.

- `GET /api/resume-coach/stories`: returns all of the user's **active** (not deleted) stories, newest `updatedAt` first:

  ```json
  [
    {
      "id": "...", "title": "...", "content": "...", "company": "Acme Corp",
      "createdAt": "...", "updatedAt": "...",
      "latestExtra": { "suggested_lps": ["Ownership"], "...": "..." },
      "latestGeneratedAt": "2026-07-18T10:00:00.000Z"
    }
  ]
  ```

  `latestExtra` / `latestGeneratedAt` are this story's **most recent** generation result (same shape as `feedback.extra`), both `null` if it was never generated. This field is stable and not subject to the 5-day usage-history expiry (see `docs/db-schema.md` §4.5); the frontend uses it to draw the principle tags in the story list. `company` can be `null` (only for old stories that predate migration `0009`).
- `POST /api/resume-coach/stories`: the body needs `title`, `content`, and `company` (required since 2026-07-18, none may be an empty string); on success returns `201` plus the new story object (`latestExtra` / `latestGeneratedAt` are `null`). After a successful response the frontend automatically triggers a generation (`POST /api/feedback`, `mode: "resume_coach"`), so the user no longer presses "Generate" by hand.
- `PUT /api/resume-coach/stories/:id`: same body as `POST` (`title` / `content` / `company` all required); only the user's own **active** stories can be updated, and an id that does not exist, is not theirs, or is deleted returns `404 not_found`. It does **not** touch `latestExtra` (that result is now out of sync with the new content); the frontend convention is to call `POST /api/feedback` (`mode: "resume_coach"`) right after a successful edit to regenerate so `latestExtra` catches up.
- `DELETE /api/resume-coach/stories/:id` (**a soft delete since 2026-07-18**, see below): returns `204 No Content` on success; only the user's own active stories can be deleted, otherwise `404 not_found`.

### Soft delete and restore (3-day grace period, since 2026-07-18)

Deleting a story does not remove it from the database immediately. `DELETE` just marks it deleted and hides it from `GET /api/resume-coach/stories`; it can be restored for 3 days, after which the daily cron job deletes it permanently (see `docs/db-schema.md` §4.5).

- `GET /api/resume-coach/stories/deleted`: returns all of the user's stories still inside the 3-day grace period and not yet permanently deleted: `[{ "id", "title", "content", "company", "deletedAt" }, ...]`, newest `deletedAt` first.
- `POST /api/resume-coach/stories/:id/restore`: restores the story (from the deleted list back to the active list) and returns `200` plus the full restored story object (including `latestExtra`, with the earlier generation result kept untouched). An id that does not exist, is not theirs, or was never deleted returns `404 not_found`.
- `DELETE /api/resume-coach/stories/:id/purge` (since 2026-08-14): skips the 3-day grace period and permanently deletes an already soft-deleted story immediately (the "Delete permanently" button in the frontend's "Recently deleted" list, with its own inline second confirmation because this cannot be undone). Returns `204 No Content`. **It only works on stories that are already soft-deleted**: the query in `purgeStory` (`worker/src/db.ts`) requires `deleted_at is not null`, so calling it on an active story returns `404 not_found`; the story must first go through `DELETE /api/resume-coach/stories/:id`. An id that does not exist or is not theirs also returns `404`.

### `GET /api/resume-coach/history`

Purpose: the Resume Coach usage history. It returns only attempts with `mode = "resume_coach"` (`GET /api/attempts` returns every mode mixed together; this is a pre-filtered version for the Resume Coach page's own "Story Bank" block, called "Usage history" before 2026-07-18).

```json
{
  "attempts": [
    {
      "id": "...",
      "type": "leadership_principles_behavioral",
      "storyId": "9c1e7e2a-1111-2222-3333-444455556666",
      "storyTitle": "Fixed the flaky deploy pipeline",
      "storyCompany": "Acme Corp",
      "extra": { "suggested_lps": ["Ownership"], "...": "..." },
      "createdAt": "2026-07-16T10:05:00.000Z"
    }
  ]
}
```

`storyTitle` / `storyCompany` being `null` means the story was **permanently** deleted (the foreign key `attempts.story_id` is `on delete set null`, see `worker/migrations/0007_story_delete_sets_attempts_null.sql`: deleting a story only sets the referencing attempts' `story_id` back to null; the attempt / feedback rows stay, only the story title and company can no longer be looked up). During the 3-day grace period after a soft delete (see "Soft delete and restore") both are still available; they only become `null` once the cron job actually deletes the `story_bank` row. **This history itself is also deleted by the cron job 5 days after creation** (see "AI output auto-expiry" below), so it is only a temporary window, not a permanent record. The frontend uses `storyCompany` for the company filter chips of the "Story Bank" block.

### AI output auto-expiry and expired soft-delete cleanup (cron cleanup)

`worker/wrangler.jsonc` configures a daily Cron Trigger (`triggers.crons: ["0 9 * * *"]`, 09:00 UTC) that maps to the `scheduled()` handler exported from `worker/src/index.ts`. Each run does two things in order:

1. Calls `deleteExpiredResumeCoachRecords(sql, 5)`: deletes `attempts` / `feedback` rows with `mode = 'resume_coach'` and `created_at` older than 5 days. It has **no effect** on `story_bank` (a user's stories never disappear with time) or on any other mode (ordinary `single_question` practice records and the Dashboard history are untouched).
2. Calls `deleteExpiredSoftDeletedStories(sql, 3)` (since 2026-07-18): permanently deletes `story_bank` rows whose `deleted_at` is older than 3 days, meaning stories the user deleted and did not restore within the grace period.

`wrangler dev` does not trigger cron by itself; to test manually, run `curl "http://localhost:8787/cdn-cgi/handler/scheduled"`.

### `GET` / `POST /api/interview-rounds`, `PUT` / `DELETE /api/interview-rounds/:id` (since 2026-09-03)

Purpose: CRUD for the Interview Rounds tab (the `interview_rounds` table, see `docs/db-schema.md` §4.6). It splits an interview into rounds; each round stores "what this round tests", "prep focus", and a set of structured Q&A. **There is no soft delete**: `DELETE` really removes the row, with no 3-day grace period like `story_bank`. These routes are owner-only; a demo session cannot reach them.

- `GET /api/interview-rounds?company=make`: the **`company` query parameter is required**; without it the response is `400 invalid_query`. Returns all of that user's rounds for that company, ordered by `order` ascending:

  ```json
  [
    {
      "id": "...", "company": "make", "order": 2,
      "title": "ROUND 1 — HR / Recruiter Screen",
      "whatItTests": "The HR round is not a product interview...",
      "prepFocus": null,
      "qaItems": [{ "question": "Q1.1 — Tell me about yourself", "answer": "..." }],
      "createdAt": "...", "updatedAt": "..."
    }
  ]
  ```

  `company` is free text and not restricted to `SUPPORTED_COMPANIES`: this page is deliberately designed to work even for a company PrepPilot has no built-in question bank for.

- `POST /api/interview-rounds`: the body needs `company` and `title` (neither may be an empty string); `order` (a number, default `0` if omitted), `whatItTests` / `prepFocus` (may be omitted or `null`), and `qaItems` (an array of `{question, answer}` objects, treated as empty if omitted) are optional. Returns `201` plus the new round object.
- `PUT /api/interview-rounds/:id`: same body format as `POST`; **it is a full overwrite, not a partial merge**: omitting `whatItTests` / `prepFocus` / `qaItems` clears them to `null` / `[]` instead of keeping the old values. Only the user's own rounds can be updated; an id that does not exist or is not theirs returns `404 not_found`.
- `DELETE /api/interview-rounds/:id`: returns `204 No Content`; an id that does not exist or is not theirs returns `404 not_found`.

Validation limits (`worker/src/index.ts`): `title` ≤ 300 characters, `whatItTests` / `prepFocus` ≤ 4000 characters, at most 100 `qaItems`, and each item's `question` / `answer` ≤ 12000 characters (some script-style prepared answers are long on purpose, so the cap is generous).

---

## 4. Possible future APIs (not implemented)

- `/api/sessions` – create and query a full mock interview session
- `/api/stats` – average and trend of scores per question type / dimension

These stay in the spec only and are not part of the current implementation.
