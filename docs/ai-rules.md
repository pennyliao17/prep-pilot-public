# AI Rules – PrepPilot (PM / AI PM Interview Practice)

This document defines every rule and preference for working with AI on this project.
Any AI (Claude / Claude Code / Cursor / Cloudflare Workers AI, etc.) should read and follow it before touching this repo.

---

## 0. Project goal and scope

- PrepPilot is a practice site for **PM / TPM / AI PM / Sr PM** interview preparation.
- Users practice several question types (Product / Analytical / Leadership Principles / Strategy / Estimation / System Design / AI PM) and get structured AI feedback.
- Several target companies are supported, each with its own question bank and rubric: currently **Amazon, Make, and Meta** (see the `company` column in `docs/db-schema.md`).
- For product background and requirements, the final references are:
  - `docs/master-plan.md`
  - `docs/implementation-plan.md`

---

## 1. Money and infrastructure rules

### 1.1 Cost constraint (critical)

- Apart from the developer's existing **Claude Pro** subscription, the project must run long-term at **$0 additional cost**.
- Forbidden:
  - Calling any billed third-party LLM API directly from code (OpenAI, the Anthropic API, etc.).
  - Introducing external SaaS that needs a paid plan to work (paid email services, paid monitoring), unless clearly marked as "not enabled / not connected".

### 1.2 Allowed stack (free infrastructure only)

- **Frontend**
  - Framework: Vite + React
  - Hosting: Cloudflare Pages free tier
- **Backend API**
  - Runtime: Cloudflare Workers free tier
  - Responsibilities:
    - REST API: `/api/questions`, `/api/attempts`, `/api/feedback`, and so on
    - Connect to Neon Postgres
    - Call Cloudflare Workers AI for live grading
    - **Cloudflare Cron Triggers** (`triggers.crons` in `wrangler.jsonc` plus the Worker's exported `scheduled()` handler): free and already part of the stack, used for scheduled cleanup so no paid scheduler is needed. Current use: Resume Coach AI output expires and is deleted after 5 days (see `docs/db-schema.md` §4.5).
- **Database**
  - Service: Neon Postgres free tier
  - Purpose: questions, attempts, scores and feedback
  - Always **one project / one DB**, within the free plan limits.
  - Postgres has no native per-row TTL. When data should not accumulate forever (for example generated AI output, as opposed to anything the user typed), delete it with the Cron Trigger above instead of adding a third-party scheduler or TTL service. **Data the user entered themselves (such as the Story Bank) is never subject to this rule**: only AI output is cleaned up, never user input.
- **Live inference**
  - Only models served by **Cloudflare Workers AI** (within its free allowance).
  - Pick a suitable text model (Llama family, etc.) and keep output length under control. The grading model is currently `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.

### 1.3 Access protection (Google sign-in plus single-account allowlist)

**Since 2026-07-06 real user sign-in is live, replacing the old shared `x-app-key` mechanism.**

- The frontend uses the **Google Identity Services (GIS)** button (`frontend/src/auth/LoginGate.tsx`). The user signs in to Google on the page and the browser receives a Google-issued ID token (JWT), with no redirect.
- The frontend POSTs that ID token to `POST /api/auth/google`. The Worker (`verifyGoogleIdToken` in `worker/src/googleAuth.ts`) calls Google's official `https://oauth2.googleapis.com/tokeninfo` to check that the token really came from Google, that `aud` equals this project's `GOOGLE_CLIENT_ID`, that `email_verified` is true, and that it has not expired.
  - Calling `tokeninfo` instead of implementing JWKS/RS256 verification ourselves is deliberate: this is a single-user personal project with almost no sign-in traffic, so one extra network request is a good price for not maintaining security-critical signature code.
- After verification, the Worker checks the email against `env.ALLOWED_EMAIL` (currently only the owner's own Google account; the value lives in a Cloudflare secret, not in the repo):
  - Match → upsert the user into the Neon `users` table (`upsertUser` in `worker/src/db.ts`), issue our own session token (HMAC-signed, `worker/src/session.ts`, 7-day lifetime) and return it.
  - No match → **return exactly the same 404 as a route that does not exist** (`No route for POST /api/auth/google`). No session is issued and nothing reveals that a gate exists. The frontend recognizes that specific 404 and shows `NotFoundPage` (a plain 404 page that never mentions sign-in, email, or payment). A 403 would leak "your request was valid, you just lack permission", which is why it is not used.
- The frontend stores the session token in `localStorage` and sends `Authorization: Bearer <token>` on every API call. `getAuthorizedSession()` in the Worker verifies the signature, the expiry, and that the email still equals `ALLOWED_EMAIL`.
- **`x-app-key` / `APP_SECRET` were removed entirely**, not kept in parallel. Once real user sessions exist, the app key adds no protection (even a stolen session would not need another app key), and keeping it would only add one more thing to rotate and one more value that could be pasted into a chat log by accident.
- Worker secrets / vars:
  - `SESSION_SECRET` (a real secret, set with `wrangler secret put`; `worker/.dev.vars` locally): signs and verifies session tokens. Rotating it invalidates every signed-in session immediately.
  - `GOOGLE_CLIENT_ID` (**not a secret**, in `vars` of `wrangler.jsonc`, safe in git): a Google client ID is shipped in the frontend bundle by design.
  - `DEMO_USERNAME` (since 2026-10 a **Cloudflare secret**, in `worker/.dev.vars` locally): the reviewer demo account's username. Not a credential on its own (the password is the secret `DEMO_PASSWORD_HASH`), but kept out of the public repo; the value is shared with reviewers out of band.
  - `ALLOWED_EMAIL` (since 2026-10 a **Cloudflare secret**, kept in `worker/.dev.vars` locally and no longer in `wrangler.jsonc`): not a password, but it is the owner's personal email address, so it should not live in source or git history of a public repo. Set it like any other secret with `wrangler secret put ALLOWED_EMAIL`; changing it never requires a code change. To move a value from a var to a secret on an already-deployed Worker, use `wrangler deploy --secrets-file <file>`: plain `secret put` fails (error code 10053) while a var with the same name still exists, and removing the var first causes an outage window.
- Room for a future trial/paid model (deliberately not implemented, see `docs/tasks.md`): `attempts.user_id` is filled with the signed-in user's `users.id`, so a "3 free practices, 1 free resume coach per person" rule only needs counting `attempts` by `user_id` / `mode` / `created_at`, with no schema change.
- **Second sign-in method: email plus one-time code (2026-07-06).** An alternative for people without or not wanting a Google account. The same `ALLOWED_EMAIL` allowlist and 404 rule apply:
  - `POST /api/auth/email/start`: given an email, the Worker generates a 6-digit code and stores it in Cloudflare **Workers KV** (`OTP_KV` binding, `worker/src/emailAuth.ts`) with a 24-hour TTL. KV supports per-key expiry natively, so no cleanup job is needed. **Only the SHA-256 hash of the code is stored, never the plaintext (2026-07-10)**, so even if KV is read (dashboard, a future logging bug) no usable code leaks. The code is sent through the **Resend** HTTP API (`https://resend.com`); Resend was chosen because its free tier is enough (3,000 emails/month, 100/day) and its REST API is easy to call with `fetch()` from a Worker, with no SMTP.
  - `POST /api/auth/email/verify`: given an email and a code, compares against KV; only on a match does it upsert the `users` row (first verification is effectively "create account", later ones are "sign in", one flow for both) and apply the same `ALLOWED_EMAIL` check and 404 behavior as Google sign-in. Entering an email alone never signs you in.
  - A code is voided after 5 wrong attempts (forcing a resend) so it cannot be brute-forced. Both endpoints also carry an IP-keyed rate limit (`EMAIL_OTP_RATE_LIMITER`, 5 per 60 seconds) so they cannot be used to spam strangers' inboxes or burn through Resend's free quota.
  - Worker secret: `RESEND_API_KEY` (`wrangler secret put`; `worker/.dev.vars` locally). The sender is Resend's shared test domain (`onboarding@resend.dev`); no custom domain has been verified. If mail starts landing in spam, verify a custom domain in Resend.
- **Third sign-in method: scoped reviewer demo login (2026-10).** For people reviewing the project, with no access to personal data:
  - `POST /api/auth/demo` checks a username and the SHA-256 hash of a password (`DEMO_PASSWORD_HASH`, a Worker secret; the password itself is never stored anywhere) and issues a session with `role: "demo"`. It is rate limited (`DEMO_LOGIN_RATE_LIMITER`, 10 per 60 seconds).
  - A demo session is **fail-closed**: right after session verification, any route not listed in `DEMO_ALLOWED_ROUTES` (`worker/src/index.ts`) returns 403, so a route added later is off-limits to the demo account by default. Hiding tabs in the frontend is only UX; the allowlist is the real boundary.
  - Demo AI grading is capped at 3 per day (a counter in `OTP_KV` with a self-expiring key). Demo attempts are stored under a separate `users` row, so they can never mix with the owner's data. The "Salary Positioning" example tool is capped at once per 10 days.
  - Resume Coach, the Story Bank, and the real Interview Rounds are never reachable by a demo session; the demo account gets a separate, hand-written, generic Interview Prep Guide instead.
- After deploying, confirm in the Cloudflare dashboard that the account is on the **Workers Free** plan (not Workers Paid / pay-as-you-go), so that exhausting the free allowance means "requests start failing" rather than "billing starts". Confirmed Workers Free on 2026-07-05.
- **`POST /api/feedback` keeps two further protections** (a real sign-in does not mean unlimited calls):
  - `answerText` is capped at 8000 characters (`MAX_ANSWER_TEXT_LENGTH` in `worker/src/index.ts`); anything longer returns 400 before Workers AI is called.
  - An IP-keyed rate limit (`FEEDBACK_RATE_LIMITER` in `worker/wrangler.jsonc`, 20 per 60 seconds) returns 429, also before Workers AI is called. IP rather than session is the key so a stolen session cannot throttle the legitimate user.
  - `access-control-allow-origin` is reflected from an allowlist (`https://preppilot.pages.dev`, `http://localhost:5173`), never `*`. CORS does not stop curl or bots (session verification is the real gate), but it stops a malicious third-party site from reading this API's responses through a visitor's browser.
- Cloudflare Access (Zero Trust) was evaluated; building our own Google sign-in won because it allows a custom 404 behavior inside the app, avoids signing in separately on two domains (frontend and API), and makes later trial/paid logic easier (Access can only allow or deny and cannot track per-person usage).

### 1.4 What Claude Pro may be used for

- Allowed:
  - Writing and maintaining documents (master-plan / implementation-plan / ai-rules / rubrics / design-guidelines / tasks)
  - Helping write and modify code during local development
  - Designing and tuning prompts and rubrics
- Not allowed:
  - Production online APIs (grading and answers while users visit the site)
  - Anything that creates extra Claude API cost for end-user requests

---

## 2. Code and architecture rules

### 2.1 Language and frameworks

- Always **TypeScript**, never plain JavaScript.
- Frontend: React + TypeScript, mainly a SPA (routing can be added later if needed).
- Backend: Cloudflare Workers + TypeScript. A light router (for example Hono) is allowed but not required.

### 2.2 Project structure

```
/
├─ frontend/           # Vite + React frontend
├─ worker/             # Cloudflare Worker API (src/, migrations/, test/)
└─ docs/               # Product and AI collaboration docs
   ├─ master-plan.md
   ├─ implementation-plan.md
   ├─ roadmap.md
   ├─ ai-rules.md
   ├─ design-guidelines.md
   ├─ db-schema.md
   ├─ api-spec.md
   ├─ tasks.md
   ├─ rubrics-amazon.json / rubrics-make.json / rubrics-meta.json
   └─ prompts/
```

- When adding files or folders, make sure:
  - The location makes sense (do not scatter code files in the root).
  - It matches the plan in `implementation-plan.md` and `tasks.md`.

---

## 3. Git and files rules

### 3.1 `.gitignore`

- Must ignore:
  - `node_modules/`
  - `.env`, `.env.*` (but `.env.example` may be kept)
  - `.dev.vars`, `.dev.vars.*` (Wrangler's local secrets file; `.dev.vars.example` may be kept)
  - Build output: `dist/`, `build/`, `.next/`, `.wrangler/`, and so on
  - OS / editor junk: `.DS_Store`, `Thumbs.db`, `.vscode/*` (`settings.json` / `extensions.json` may be kept)
- The root `.gitignore` is the last line of defense: even though `worker/` and `frontend/` have their own `.gitignore`, the secret-related patterns (`.env*`, `.dev.vars*`) must be repeated in the root one.
- When updating `.gitignore`, first check for newly appearing large outputs or sensitive file types, and never remove existing important rules (especially secrets and `node_modules`).

### 3.2 Secrets and environment variables

- API keys and DB connection strings may exist only in:
  - A local `.env` (ignored by git)
  - The environment-variable / secret settings of Cloudflare and Neon
- Forbidden:
  - Hardcoding real keys, tokens, or passwords in any code file
  - Adding `.env` or any file containing secrets to git
  - Printing secret values anywhere (chat, logs, tool output). When inspecting a secrets file, look only at key names and structure, never values.
- Keep the repo free of personal data too (real employers, achievements, compensation numbers, personal emails), including in documentation and code examples. Write the reason for a privacy decision, not the protected content itself.

### 3.3 Branch strategy

- This is a single-developer project: day-to-day work is committed **directly to `main`** (the early `dev` branch was removed because it only lagged behind and added sync work).
- Large or risky changes may use a short-lived `feature/<short-description>` branch, merged back after they are verified.
- Pushing to GitHub does **not** deploy anything: the Cloudflare Pages project has no Git integration. Deploys are manual (`wrangler deploy` for the Worker, `wrangler pages deploy` for the frontend), and "deployed" should only be claimed after checking that the live site serves the new asset filenames.

---

## 4. AI workflow and chat-splitting rules

### 4.1 Documents first

Before changing code or configuration in any chat, an AI should, in order:

1. Read `docs/master-plan.md`, `docs/implementation-plan.md`, `docs/ai-rules.md`.
2. If UI / UX is affected, also read `docs/design-guidelines.md`.
3. If touching backend rubrics or grading, read the relevant `docs/rubrics-*.json`.
4. If acting on a specific task, read `docs/tasks.md`.

After reading, report the key principles it understood (3–8 items) as a summary plus confirmation.

### 4.2 Chat splitting

- One chat handles **one clear kind of task**, for example:
  - `[BE] implement /api/feedback`
  - `[FE] practice page UI tweaks`
  - `[DB] update the Neon schema`
- Do not mix large amounts of frontend / backend / infra / documentation refactoring in one chat; context gets muddled.
- To switch tasks, open a new chat and cite the relevant documents again (especially master-plan / implementation-plan / ai-rules / tasks).

### 4.3 Plan before executing

- For feature work, refactors, or infra changes, the AI should first:
  - Propose a plan in text (which files change, in how many steps)
  - Write the relevant entries into (or suggest updates to) `docs/tasks.md`
- Only after the plan is accepted should it start modifying code.
- Prefer a clear TL;DR and steps over dumping large amounts of code.
- If an instruction could point at two or more different things on the live site and the change will be deployed, confirm which one is meant before editing.

### 4.4 Vibe coding principles

- Spend roughly 80% of the time planning and talking (chat mode) and 20% executing.
- Before implementing, update `master-plan`, `implementation-plan`, and `tasks` first.
- Prefer clarity over speed; ask when a requirement is ambiguous.
- After a significant bug or a wrong design direction, go back and update `ai-rules.md` or the relevant document so it does not repeat.

---

## 5. Grading logic and prompt rules

### 5.1 Rubrics as the single source of truth

- `docs/rubrics-amazon.json` (Amazon), `docs/rubrics-make.json` (Make, since 2026-08-14), and `docs/rubrics-meta.json` (Meta, since 2026-10-02) are the only authoritative scoring tables for every question type. The file is chosen from `question.company` / `resume_coach_profile.target_company` (`rubricsFor` in `worker/src/rubrics.ts`).
  - All three companies currently prepare for a **PM role** and share the same 7 question-type keys (`product_sense`, `analytical_execution`, `leadership_principles_behavioral`, `strategy_business`, `estimation`, `system_design`, `ai_pm`). These are generic interview archetypes, not company-specific frameworks.
  - **A lesson that still applies to adding companies:** from 2026-08-26 to 2026-10-02 the app also supported a company whose target role was a **completely different job (Technical Account Manager)**, which required 5 role-specific question-type keys and a separate rubric structure (removed in `worker/migrations/0015_remove_rtbhouse_add_meta.sql`). **Before adding a company, confirm whether the role is a PM role.** If not, design a new type / rubric structure instead of forcing the 7 PM types. For Meta the role was confirmed to be PM first, so the existing 7 types were reused.
  - `getTypeLabel(type)` in `worker/src/rubrics.ts` searches every known rubric file in order, so a type only has to exist in one file to get a label. This is so that a future company introducing its own types needs no change here, even though today all three files share the same 7 keys.
  - Within the same role, most subdimension keys should be shared across companies (the same skill does not change with the company). Only the few genuinely company-specific ones are named separately (for example `amazon_ecosystem_and_flywheel_fit` / `make_ecosystem_and_platform_fit` / `meta_ecosystem_and_network_effects_fit`). When adding a company, reuse existing keys and add a new key only when the concept really is company-specific. (The frontend i18n system was removed earlier, so there are no translation dictionaries to keep in sync.)
  - When adding a role-specific question type, the `questions.type` CHECK constraint (`questions_type_check`) must be widened in the same change (a drop-and-recreate, as in `worker/migrations/0012_add_tam_question_types.sql`, narrowed again in `0015_remove_rtbhouse_add_meta.sql`), and `QUESTION_TYPES_BY_COMPANY` in `frontend/src/types.ts` must record which types belong to which company, otherwise the Practice dropdown shows options with no questions.
- When designing or modifying the `/api/feedback` prompt, an AI must:
  - Quote this JSON structure directly.
  - Keep the response format stable: `scores`, `strengths`, `improvements`, `overall_feedback`, `example_answer`.
  - Explain any new field (for example the resume coach's `suggested_lps`, `rewritten_star_answer`) in documentation first.

### 5.2 Live grading uses Workers AI only

- Every live grading request (the user pressing submit) must:
  - Go through the Cloudflare Worker
  - And the Worker calls **Cloudflare Workers AI**
- Prompt design principles:
  - The system message must say: you are a senior PM / AI PM interviewer, score by the rubric JSON structure, and return strict JSON (no extra text).
  - Control output length so it stays within a reasonable share of the Workers AI free allowance.

### 5.3 Claude Pro is for designing prompts, not answering online

- Claude may help write or review Workers AI prompts and test their effect offline.
- Claude must not answer user requests in production.

### 5.4 Neon queries must be parameterized (never string-concatenated SQL)

- Whenever SQL is built, use the tagged template from `@neondatabase/serverless` (for example `` sql`select * from questions where type = ${type}` ``). **Never** embed user input into SQL text by concatenation or template-literal interpolation.
- Audit result: every query in `worker/src/db.ts` uses tagged templates, including values coming straight from users (`type`, `answerText`, `rawInput`, and so on).

### 5.5 Tests that touch the real database

- Worker tests hit the real Neon database on purpose (mocked tests would not have caught a dead endpoint that never wrote anything). That is allowed only under these rules:
  - The suite runs as a **dedicated test user**, never as the owner. `test/index.spec.ts` overrides `ALLOWED_EMAIL` with a test identity, so tests never write to the owner's rows, not even briefly. Cleanup alone cannot hide test rows while a run is in progress.
  - Every write still needs a cleanup path (retried through dropped connections), plus a file-level `afterAll` sweep of anything created during the run.
  - Verify with a before/after fingerprint of the owner's data (row counts and `updated_at` values), not only a check for leftovers.
  - Keep `testTimeout` / `hookTimeout` generous (30 seconds): a test aborted midway by a slow remote query is how rows get left behind.

---

## 6. UI / UX rules

See `docs/design-guidelines.md` for details; this section only lists the principles.

- Overall style: clean, readable, tool-like; no flashy animation.
- Question page layout:
  - Left: the question and its description
  - Right: the answer input
  - Below: AI feedback (scores, written advice, example answer)
- Resume Coach: persistent resume and target job description, the Story Bank, and the AI result for a chosen story.
- Avoid too many colors or gradients, motion that hurts reading, and meaningless emoji (unless the product explicitly calls for them).

When adding or changing UI, an AI should reuse existing components and style patterns and make sure the result works on both phone and desktop.

---

## 7. Debugging and learning (4x4 and updating docs)

When there is a bug or unexpected behavior, an AI should follow a 4x4-style approach:

1. Try the tool's own auto-fix if one exists.
2. Raise awareness: read the browser console / Worker logs, add `console.log` or clearer error messages, rerun, and analyze.
3. If needed, switch to "consultant mode": analyze code and logs only, without editing files.
4. After the problem is solved, **update the documentation**:
   - If the cause was an unclear prompt, update `ai-rules.md` or the prompt file.
   - If it was an architecture decision, update `implementation-plan.md` or the related architecture notes.
   - If it was a poor design decision, update `design-guidelines.md`.

When a problem repeats, the fix is probably in the wrong place: change the level of protection, not just the wording of the rule.

---

## 8. When in doubt

When an AI is unsure which technology or design direction to pick, the order is:

1. Check whether `master-plan.md` has a relevant constraint or vision.
2. Check whether `implementation-plan.md` already plans a phased approach.
3. Check whether this file, `ai-rules.md`, explicitly forbids or recommends something.
4. If there is still no answer:
   - Propose 2–3 options with pros and cons and their impact on the $0 principle.
   - Do not automatically choose an option that costs money or adds a lot of complexity.
