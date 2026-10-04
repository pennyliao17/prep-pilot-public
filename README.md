# PrepPilot — PM / AI PM Interview Practice (Vibe Coding Side Project)

A practice site built for **Product Manager / TPM / AI Product Manager / Sr PM** interview prep.

Users practice the question types that actually come up in these interviews (Product, Execution, Leadership Principles, Strategy, Estimation, System Design, AI PM), and get structured AI feedback built on publicly available industry frameworks and well-known interview guides.

This project is also an experiment in **vibe coding**: as much of the process as possible — planning, design, development, and deployment — is done with AI (Claude / Workers AI) doing the implementation under human direction.

---

## Feature overview

- Question types covered:
  - Product Sense / Product Design
  - Analytical / Execution / Metrics
  - Leadership Principles / Behavioral (including a resume-based story coach)
  - Strategy / Business
  - Estimation / Guesstimate
  - System Design / Technical Collaboration (TPM-leaning)
  - AI Product Manager questions (AI product sense, execution, technical fluency)
- Supports multiple target companies, each with its own rubric and question bank — currently Amazon, Make, and Meta, all prepping for a PM role using the same 7 question types above.
- Per-question practice flow:
  1. Pick a question type and target company
  2. The system pulls a question from that company's question bank
  3. The user answers in free text
  4. The backend calls Workers AI to score the answer against the matching rubric
  5. The result shows:
     - Per-subdimension scores
     - Strengths / improvements
     - A full worked example of a strong answer
- Resume-based story coach (Resume → Leadership Principles / Behavioral):
  - Paste a resume bullet or a piece of experience
  - The AI suggests:
    - Which Leadership Principles / question types it fits
    - A STAR / STAR+ rewrite
    - How to make the story more concrete, more quantified, and closer to how large tech companies expect it to be told
- Interview Rounds — a read-only review page per company, organized by interview round, for last-minute review before the real thing.
- System Design Guide — a quick-reference cheat sheet plus full worked example answers for common system design interview questions, and a separate AI/LLM infrastructure knowledge base.

---

## Architecture and the $0 constraint

**Hard constraint: beyond the Claude Pro subscription I already pay for, the entire product has to run at $0.**

- Frontend (free)
  - Vite + React
  - Deployed on **Cloudflare Pages** (free tier)
- Backend API (free)
  - **Cloudflare Workers** (free tier)
  - Serves:
    - The question bank API (`/api/questions`)
    - The attempt-history API (`/api/attempts`)
    - The grading API (`/api/feedback`, which calls Workers AI internally)
- Database (free)
  - **Neon Postgres** (free tier)
  - Stores:
    - Questions
    - Attempts
    - Scores and feedback
- AI inference (free)
  - **Cloudflare Workers AI**, free tier
  - Used for live grading and for generating worked example answers
  - No separately-billed OpenAI / Anthropic API is used in production
- Claude Pro (paid, development only)
  - Used for:
    - Writing and maintaining docs (master plan, implementation plan, ai-rules, etc.)
    - Pair-programming and refactoring during local development
    - Designing and tuning prompts / rubrics
  - Never used as the production inference backend

---

## Project structure

```
/
├─ frontend/           # Vite + React frontend, deployed to Cloudflare Pages
├─ worker/             # Cloudflare Worker API, talks to Neon + Workers AI
└─ docs/               # Product and AI-collaboration docs
   ├─ master-plan.md
   ├─ implementation-plan.md
   ├─ roadmap.md
   ├─ ai-rules.md
   ├─ rubrics-amazon.json
   ├─ rubrics-make.json
   ├─ rubrics-meta.json
   ├─ design-guidelines.md
   ├─ db-schema.md
   ├─ api-spec.md
   └─ tasks.md
```

## Docs index

The project's design reasoning and AI-collaboration rules live in `docs/`:

- `master-plan.md` — the product's why / what / who it's for, plus question types and value proposition.
- `implementation-plan.md` — a phased build roadmap (Phase 0–5), with goals and done-criteria per phase.
- `roadmap.md` — a combined PM + security health check, business-model direction, and the phased plan going forward.
- `ai-rules.md` — project rules for every AI tool working in this repo: tech stack, the $0 constraint, git conventions, chat-splitting principles, etc.
- `rubrics-amazon.json` / `rubrics-make.json` / `rubrics-meta.json` — per-company scoring dimensions and descriptions, consumed directly by the backend's grading prompts.
- `design-guidelines.md` — baseline UI/UX style and layout rules, so different iterations don't drift visually.
- `db-schema.md` — the Neon Postgres table schema.
- `api-spec.md` — the REST API contract between the frontend and the Cloudflare Worker.
- `tasks.md` — a running, dated log of completed work, detailed enough for an AI collaborator to pick up context without re-deriving it.
