# Master Plan – PrepPilot (PM / AI PM Interview Practice)

> Last updated: 2026-10-04. The product positioning (a $0-infrastructure practice site for PM / AI PM interviews) has not changed. The "User journeys" and "Scope boundaries" sections below were updated to match the current implementation; multi-company support, once listed as out of scope, is now done.

## What the product is

A practice website built for **Product Manager / TPM / AI Product Manager / Sr PM candidates**.

Users practice the question types that actually come up in real interviews and get structured AI feedback built on publicly available industry resources and well-known teaching material.

**Important constraint: the infrastructure must cost $0.**

Apart from the **Claude Pro** subscription I already pay for (only for building and planning, not for serving end users), the product's hosting / DB / inference must all use free tiers:

- Frontend: Cloudflare Pages (free tier)
- Backend: Cloudflare Workers (free tier)
- DB: Neon Postgres free plan
- Live grading model: Cloudflare Workers AI free allowance
- Any other third-party service or SDK: prefer something with a free tier; if it would cost money, do not use it

Claude Pro is used only for:

- Planning, writing code, designing prompts, and generating documents during development
- It is not the API behind live grading on the site, to avoid extra token cost

Main content and framework sources (not copied verbatim, only abstracted into structure):

- Official PM interview resources from large tech companies
- igotanoffer: PM and AI PM interview guides
- Exponent: PM / AI PM interview guides and examples
- Ben Erez's product sense / analytical frameworks in Lenny's Newsletter
- AI PM interview structures and question types compiled by AI PM coaches such as Aakash Gupta

## Who it is for

- People preparing for PM / Sr PM / TPM / AI PM roles
- People who have already read some interview guides (igotanoffer, Exponent, Aakash's articles) and understand the broad ideas and frameworks
- **Added emphasis:** people who lack "specific, structured feedback on their own resume and real experience", including:
  - Not sure which resume bullets / experiences to use for leadership-principles and behavioral questions
  - Not sure whether their stories have the depth and structure large tech companies expect (Ownership, Dive Deep, and so on)
  - Wanting to "translate" their existing experience into stories and answers in the style of large tech companies

In other words, this product is not for a beginner's "first encounter with this kind of interview"; it is for **the stage after reading the guides, where you need hands-on practice and personalized feedback**.

## Practice dimensions and question types

The first phase supports several question types without cutting any, though they can be implemented in priority order:

1. **Product Sense / Product Design**
   - Design a new feature / product
   - Improve the experience of an existing digital product
   - Evaluate trade-offs between different solutions
   - Scoring references: Ben Erez's framework plus the spirit of Customer Obsession

2. **Analytical / Execution / Metrics**
   - Define success metrics, debug a metric anomaly, design an experiment, prioritize
   - Emphasizes input / output metrics and decision-making clarity

3. **Leadership Principles / Behavioral (including resume stories)**
   - STAR / STAR+ story questions
   - Stories about a specific principle (Ownership, Dive Deep, Bias for Action, and so on)
   - **Special support for a "start from the resume" mode:**
     - The user can paste their own resume bullet or a piece of experience
     - The system helps by:
       - Judging which principles / question types the experience fits
       - Giving rewrite suggestions (more specific, quantifiable, closer to how large tech companies like it expressed)
       - Suggesting how to package the same story as answers to several question types (for example Conflict / Failure / Deliver Results)

4. **Strategy / Business / platform ecosystem thinking**
   - For example: how to grow an e-commerce / platform product over 3 years, whether to enter a new market, how to respond to competition
   - Emphasizes flywheel, selection / price / convenience, and long term versus short term

5. **Estimation / Guesstimate**
   - Sizing and resource estimation
   - The focus is decomposition, clarity of assumptions, and sanity checks

6. **System design / technical collaboration (leaning TPM / Technical PM)**
   - Following the common directions of PM system design interviews in igotanoffer / Exponent:
     - High-level system design (for example the architecture of a high-traffic service)
     - How to communicate and collaborate with engineers / architects
     - How to decide among trade-offs (cost / latency / reliability)
   - Scoring emphasizes:
     - Structured breakdown of requirements and constraints
     - Understanding of the available technical options (high level; no code required)
     - Using a "product angle" to align the design with the technical team

7. **AI Product Manager questions (AI PM specific)**

   Based on the common types in AI PM guides from igotanoffer, Exponent, Aakash Gupta, and others, covering:

   - **AI Product Fundamentals / AI Product Sense**
     - For example:
       - "How would you design a roadmap for an AI product?"
       - "How do you choose between a non-AI and an AI solution?"
       - "How do you set success goals for an AI-only community product?"
   - **AI Execution / Metrics**
     - Success metrics for launching an AI product
     - How to debug model quality / latency / cost problems
   - **Technical (AI/ML related) fluency** (communication level only)
     - As igotanoffer mentions:
       - Explaining high-level concepts such as RAG, LLM, RLHF, and DPO
       - When to use rule-based versus traditional ML versus an LLM
       - How to think about model selection and evaluation
   - **AI-specific behavioral / ethics**
     - How to take responsibility toward users / internal stakeholders when a model is biased, unpredictable, or raises safety concerns

   Overall, the AI PM rubric reuses the previously defined product / analytical / behavioral framework and adds AI-specific dimensions (model understanding, probabilistic systems, AI UX).

## Core experience (user journeys)

1. **Single question practice**
   - Choose:
     - Company: Amazon / Make / Meta (see the `company` column in `docs/db-schema.md`), each with its own question bank and scoring rubric (`docs/rubrics-*.json`)
     - Question type: Product / Execution / LP / Strategy / Estimation / System Design / AI PM
   - The system picks a question from the bank (AI-generated questions could be added later but are not required)
   - The user answers → the Worker stores it in Neon → Workers AI grades it → the response returns:
     - Scores (following the rubric JSON structure)
     - Strengths / improvements
     - A summary of a high-scoring example answer

2. **Resume story practice (Resume Coach)**
   - Saved once: the full resume, the target job's description, and an editable Story Bank (the user's own experience stories)
   - Every generation sends four sources to the AI together: the resume (background), the job description (tone and emphasis), a single story (the main material), and the company's values framework (Amazon's 16 Leadership Principles; for Make and Meta, the themes each company repeatedly uses when it describes its own culture)
   - The system provides:
     - Which principles / question types the story fits best
     - A STAR / STAR+ rewrite, with emphasis adjusted to the job description
     - A 60-second "hype script" the user can read to themselves right before the interview
   - Generated results have a usage history that expires automatically after 5 days (Cron Trigger), so the free DB does not fill up

3. **Review and growth tracking (Review & Analytics)**
   - Answer history: type, time, score, key principle
   - Long-term statistics: which types / dimensions score low (for example AI Product Sense versus traditional Product Sense, or Dive Deep often losing points in LP questions)
   - Suggested next practice direction

4. **Company Knowledge**
   - One page per company: mission and flywheel, business lines (the metrics a PM there tracks, competitors, likely questions with structured example answers), team structure and working norms, and recent news (with source links)
   - Recent news goes stale, so every update re-verifies dates and sources with a web search instead of writing from memory

5. **Interview Rounds review (owner only)**
   - A read-only page per company organized by interview round: what each round asks and what to prepare, for a fast review before the interview. The content is personal data and is not shown to others.

6. **System Design Guide**
   - A cheat sheet, full worked example answers, and AI/LLM infrastructure notes (English only, static, searchable), for system design and TPM question types

7. **Reviewer demo account (read-only)**
   - For people who want to look at the work: a separate username / password sign-in, a fail-closed route allowlist, and 3 live AI gradings per day. It has its own Dashboard (empty at first), Company Knowledge, a hand-written generic Interview Prep Guide for each of the three companies (switched with a Company dropdown), and an example "Salary Positioning" tool (the user enters their pay and living costs; an AI coach positions an ask within a per-company, per-region (Europe or United States) estimated band taken from levels.fyi / Glassdoor, with a reminder to cross-check; usable once every 10 days per company).
   - It can see no personal data: the resume, the Story Bank, and the real Interview Rounds are outside its reach.

## Why it exists (value proposition)

Most PM / AI PM interview guides are excellent, but they leave several gaps:

- They focus on "teaching the framework" and lack large amounts of specific, sentence-level feedback on your own answers
- For AI PM / system design / TPM questions, many articles only explain concepts and give you no safe place to do reps
- Few tools help you systematically rewrite and repeatedly practice "a bullet on your resume → a usable Leadership Principles story"

This product aims to be:

- A **$0, long-term usable** training room (infrastructure entirely on free tiers)
- An AI coach that helps turn "the framework in the book" into "an answer that is yours"
- A sandbox where you can do reps across the full set of PM / AI PM interview question types

## Success metrics (how we know it works)

Product and usage:

- It keeps running entirely on free infrastructure (Cloudflare / Neon / Workers AI) without producing any extra bill
- You practice at least N questions a week on it (for example 5–10)
- Question-type coverage: within a given period, every type has actually been practiced

Learning outcomes (mostly self-assessed):

- Noticeably more confidence on Leadership Principles / AI PM questions
- More certainty about "how to tell a good story from your own resume"
- In real mock or actual interviews, clearly feeling:
  - More familiar with the question-and-answer rhythm
  - Better at framing and diving deep

## Scope boundaries (out of scope, for now)

- Multi-company support is **done** (Amazon, Make, Meta; one more company was supported for a while and later removed as needs changed). Other companies (for example DoorDash / Uber / Microsoft / Expedia) are only a future consideration.
- No integration with human coaches or scheduling systems
- No heavy system design whiteboard editor (text plus simple diagrams is enough)
- No paid email reports; Resend is only used for sign-in codes (free allowance), so it creates no new cost
- No open registration for general users: the real account is allowlist-only, and public demonstration goes only through the read-only reviewer account
