# Implementation Plan – PrepPilot (PM / AI PM Practice, 0-cost infra)

This document defines the implementation order and phased goals, so the whole project can be built step by step on **$0 infrastructure** (the Cloudflare + Neon + Workers AI free tiers).

Claude Pro is used only for: planning, writing code, editing documents and prompts. It is not used for inference in the live service.

## Current status (2026-10-04)

Phases 0 through 4 are **all done**, and extra work beyond the plan followed (see Phase 5 at the end). The phases below keep their original planning content as a historical record; where reality now differs, the spot is marked in place with "(2026-10 status: …)". Item-by-item completion records and how each was verified are in `docs/tasks.md`.

---

## Phase 0 – Project skeleton and docs ready

**Goal:** before writing any feature, settle the project skeleton, version control, and AI collaboration rules, so all later development follows them.

**Work items:**

- Create the Git project and basic structure:
  - Root directory:
    - `frontend/`: the React frontend (Vite + React)
    - `worker/`: the Cloudflare Worker API
    - `docs/`: product and AI documents
- Create and organize in `docs/`:
  - `master-plan.md` (the latest version)
  - `implementation-plan.md` (this document)
  - `ai-rules.md`: project development and AI collaboration rules (including the $0 constraint, technology choices, Git rules)
  - `rubrics-amazon.json`: the scoring rubric per question type (Product / Execution / LP / Strategy / Estimation / System Design / AI PM)
- Git / GitHub setup (all on free tiers):
  - Create a private repo on GitHub, with a `main` / `dev` / `feature/*` branch strategy (2026-10 status: `dev` was deleted and a single developer works directly on `main`; the repo was made public on 2026-10-04 as a fresh, single-commit clean version)
  - Initialize `.gitignore` in the project, making sure it:
    - Ignores `.env` / `.env.*`
    - Ignores `node_modules` and build output
- Tooling:
  - Install and configure locally:
    - Node.js / npm
    - Prettier (format on save)
  - Choose a development environment:
    - Preferred: the free version of Cursor (with Claude Pro / Claude Code)
    - Fallback: VS Code plus the Claude web app

**How Claude / AI is used:**

- Every new development chat starts by declaring:
  - The project has `docs/master-plan.md`, `docs/implementation-plan.md`, `docs/ai-rules.md`, and the rubric JSON files
  - The AI must read them and briefly state the key rules before starting
- 80% of the time in chat (planning and communication), 20% actually executing code changes (following the vibe-coding mindset)

---

## Phase 1 – $0 infrastructure foundation: Neon + Cloudflare

**Goal:** before writing any question-type logic, wire the free infrastructure together and confirm the path "frontend → Worker → Neon → Workers AI" works end to end.

### 1. Neon database

**Work items:**

- Create a project and a Postgres DB on the Neon free tier
- Have the AI help design and create the initial schema (SQL or Drizzle both work):
  - `users` (used later for sign-in; v1 may leave it empty or with just an id)
  - `questions`
    - `id`
    - `type` (product_sense / analytical / lp / strategy / estimation / system_design / ai_pm)
    - `title`
    - `description`
    - `metadata` (JSON, can hold LP tags, difficulty, and so on)
  - `attempts`
    - `id`
    - `question_id`
    - `answer_text`
    - `type`
    - `created_at`
  - `feedback`
    - `id`
    - `attempt_id`
    - `scores` (JSON, matching `rubrics-amazon.json`)
    - `strengths` (JSON)
    - `improvements` (JSON)
    - `overall_feedback` (text)
    - `example_answer` (text)

### 2. Cloudflare Workers API

**Work items:**

- Use `wrangler` to create the `worker/` project (free tier):
  - Configure `wrangler.toml` (2026-10 status: the project actually uses `wrangler.jsonc`):
    - Bind the Neon connection string (an environment variable, never in Git)
    - Set up the route for the API (for example `/api/*`)
- Implement a minimal API in the Worker:
  - `GET /api/health`: health check
  - `GET /api/questions?type=XXX`: first return hardcoded fake data (connect Neon later)
  - `POST /api/attempts`: accept `{ questionId, type, answerText }`, only keep it in memory for now
  - `POST /api/feedback`: for now return fake JSON (fixed scores), to test front-to-back wiring
- Connect Cloudflare Workers AI (free tier):
  - Add an example in the Worker that calls a text model:
    - e.g. `@cf/meta/llama-3.1-8b-instruct-fp8` (as Cloudflare actually provides it; models get retired or updated over time, so check the currently available list against the Cloudflare API before deploying) (2026-10 status: the grading model is now `@cf/meta/llama-3.3-70b-instruct-fp8-fast`)
  - Design a minimal prompt that makes the model return one fixed-format JSON (to be replaced with the real rubric in Phase 2)

### 3. Frontend basics (Cloudflare Pages)

**Work items:**

- Initialize the project in `frontend/` with Vite + React
- Minimal pages:
  - Home page: list the question types (Product / Execution / LP / Strategy / Estimation / System Design / AI PM)
  - Practice page:
    - Show one fake question
    - A textarea for the user's answer
    - A "Submit and get AI feedback" button
    - Below it, show the JSON received from `/api/feedback` (as a debug dump for now)
- Deploy to Cloudflare Pages (free tier):
  - Set the build command (`npm run build`) and the output directory
  - Configure routes so `/api/*` points at the Worker above

**Phase 1 done when:**

- A public URL (Cloudflare Pages) can:
  - Show a fake question
  - Let the user enter an answer
  - Call the Worker → the Worker calls Workers AI → return JSON → display it on screen
- Neon is connected successfully (even if attempts / feedback are not written for real yet)

---

## Phase 2 – Question types v1: Product / Analytical / LP / Resume Coach

**Goal:** on top of the existing infrastructure, deliver the first batch of genuinely useful practice experiences, in this priority order:

1. Product Sense / Product Design
2. Analytical / Execution
3. LP / Behavioral plus the resume story coach

### 1. Question bank and rubric wiring

**Work items:**

- In `docs/rubrics-amazon.json`, complete:
  - The subdimension definitions for Product / Analytical / LP / Strategy / Estimation / System Design / AI PM
- In the Neon `questions` table, first insert a batch of practice questions manually or by script:
  - At least 5–10 per type
  - Question content may take reference from igotanoffer / Exponent / official company sites, but must be rewritten in our own words
- Change the Worker's `/api/questions` to read questions from Neon:
  - Support the query parameters `type` and `limit`

### 2. The real grading endpoint (Product / Analytical / LP)

**Work items:**

- Reimplement `POST /api/feedback` in `worker`:
  - Request body: `{ questionId, type, answerText, mode }`
    - `mode` distinguishes an ordinary question from the resume-coach mode
  - Pick the matching rubric by `type` and `rubrics-amazon.json`
  - Write one unified system prompt that contains:
    - You are a senior PM / AI PM interviewer
    - Score using the dimensions in `rubrics-amazon.json`
    - Return a fixed JSON structure (scores / strengths / improvements / overall_feedback / example_answer)
  - Call Cloudflare Workers AI (a free-tier model):
    - Strictly require JSON only
  - Write the result into the Neon `attempts` / `feedback` tables
- Frontend:
  - Replace the fake feedback with real feedback:
    - Scores (simple text at first)
    - 2–3 points each for Strengths / Improvements
    - The example answer in a collapsible block

### 3. Resume story coach (LP / Behavioral + Resume)

**Work items:**

- Add a "Resume Coach" page to the frontend:
  - The user can:
    - Paste a block of resume text (or a single bullet)
    - Choose which LP / behavioral question they want to practice, or let the system recommend
  - Call `POST /api/feedback` with `type = "leadership_principles_behavioral"` and `mode = "resume_coach"` (the actual implementation uses the same type enum value as ordinary question types, not a separate `lp_behavioral`)
- When `mode = resume_coach`, the Worker:
  - Uses a different prompt template that asks the model to:
    - Judge which LP / question type the resume passage fits
    - Rewrite the experience into one STAR or STAR+ answer skeleton
    - Give bullet-level suggestions (how to be more specific, more quantifiable, closer to how large tech companies like it expressed)
  - Returns a JSON structure similar to an ordinary LP question, with a few extra fields:
    - `suggested_lps`
    - `rewritten_star_answer`
    - `resume_rewrite_suggestions`

**Phase 2 done when:**

- A user can, on the website:
  - Pick the Product / Analytical / LP types, answer any of dozens of bank questions, and get quality AI feedback
  - Paste resume text on the Resume Coach page and get:
    - A suggested matching LP
    - A STAR structure demonstration
    - Resume rewrite suggestions

---

## Phase 3 – Question type expansion: Strategy / Estimation / System Design / AI PM

**Goal:** on the existing architecture, expand to the remaining question types so overall coverage matches the Master Plan.

### 1. Strategy / Business questions

**Work items:**

- Add Strategy questions to the Neon bank (10 or more)
- Confirm the Strategy dimensions in `rubrics-amazon.json` are complete
- Frontend: enable "Strategy / Business" in the type menu
- Worker: for `type = "strategy_business"`:
  - Use a Strategy-specific rubric prompt template
  - Emphasize flywheel thinking, long-term planning, and trade-offs

### 2. Estimation questions

**Work items:**

- Add estimation questions to the bank
- The Estimation dimensions in `rubrics-amazon.json` (assumption clarity / breakdown / communication) must be complete
- Frontend: enable the Estimation type
- When `type = "estimation"` the Worker's prompt emphasizes: stating assumptions / breakdown steps / a sanity check

### 3. System Design / TPM questions

**Work items:**

- Add PM / TPM-leaning system design questions to the bank (for example designing a high-level system architecture, a high-level API / service design)
- Add to `rubrics-amazon.json`: understanding requirements and constraints, how reasonable the high-level architecture is, trade-offs (latency / reliability / cost), and communication
- Frontend: the question page may include a simple text note reminding the user they can sketch on paper, but the answer itself must describe the key components and data flow
- Worker: for `type = "system_design"` the prompt emphasizes high-level communication, no detailed code, and explaining the design from a product angle in collaboration with the engineering team

### 4. AI Product Manager questions

**Work items:**

- Add AI PM questions to the bank, referring to:
  - AI product sense (when to use AI / when not, LLM versus traditional ML)
  - AI execution / metrics (how to define model quality, how to debug model problems)
  - AI technical fluency (explaining RAG, prompting, safety / ethics, and so on)
- Add AI-specific subdimensions to `rubrics-amazon.json`, for example:
  - AI system understanding (knowing this is a probabilistic / data-driven system)
  - Responsible AI / risk awareness
  - AI-specific metrics (offline / online evaluation, quality versus cost versus latency)
- Worker: for `type = "ai_pm"` load the AI PM-specific rubric and prompt template

**Phase 3 done when:**

- Every question type defined in the Master Plan can be selected, answered, and given reasonable feedback on the website
- The rubric JSON structure is stable, so adding more questions later changes only the questions / rubric and not the code

---

## Phase 4 – Review / Analytics and internal-use polish

**Goal:** first make the product a training room you will use yourself for a long time, and only then consider any outside use or growth.

**Work items:**

- Add a simple Dashboard to the frontend:
  - Show:
    - A list of recent practice records (time / type / score)
    - The average score trend per question type
    - The average score per subdimension (for example segmentation, problem, and solution within Product)
- Neon queries and Worker APIs:
  - `GET /api/attempts?type=...` and similar, for the Dashboard
- Based on your own experience, go back and adjust:
  - The distribution of question difficulty
  - The tone of the AI feedback
  - The rubric weights (if some dimensions are too strict / too lenient)

**Phase 4 done when:**

- After using the website for a while, you feel it:
  - Is more efficient than practicing directly in a Claude chat
  - Helped you find your genuinely weak dimensions (not just a feeling)

---

## Phase 5 – Work beyond the plan that is already done (2026-07 to 2026-10)

These were not in the original plan; they grew out of real needs during use:

- **Multiple companies**: Amazon → Make → Meta (one more company was supported for a while and then removed). Each company has its own question bank and rubric, with the same 7 PM question types; the `company` parameter runs through the question bank, grading, the Resume Coach values framework, and Company Knowledge
- **Sign-in and permissions**: Google sign-in plus an email one-time code, allowlist-only; the Worker verifies a signed session
- **Resume Coach rework**: a persistent resume plus target job description plus Story Bank, four sources generated together, and a usage history that auto-expires after 5 days
- **Company Knowledge**, **Interview Rounds**, and **System Design Guide**: three knowledge-style tabs
- **Grading model upgrade**: from 8B to llama-3.3-70b (the response format differs, and the Worker handles the compatibility)
- **Reviewer demo account**: a separate sign-in, a route allowlist, a daily cap of 3 AI gradings, a generic per-company Interview Prep Guide (Company dropdown), and a Salary Positioning tool with a per-company, per-region estimated band (once every 10 days per company)
- **Tests**: the worker tests deliberately hit the real Neon, but run as a dedicated test identity and never touch the owner's real data
- **Public repo**: on 2026-10-04 a privacy audit and cleanup before going public was done, and the repo was published as a fresh single-commit repo (private engineering retrospectives and reading notes are not published with it)

## Possible future phases (not planned yet)

- More companies (DoorDash / Uber / Microsoft / Expedia)
- Email reports / reminders (would involve extra service cost, so postponed; Resend is currently only used for sign-in codes)
- Open registration and commercialization (trial counting, payments, and a privacy policy must all be done together, see `docs/roadmap.md`)
- Practice-habit mechanics (timer, streak, spaced repetition): evaluate once there is enough real practice volume
