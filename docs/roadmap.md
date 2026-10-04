# Roadmap – PrepPilot

First version: 2026-07-06 (a health check from both a PM and a security angle)
Last full update: 2026-07-14. **2026-10-04**: added the current-status note in §0 and the recent milestones in §F (multiple companies, the 70B model, the reviewer demo account, the public repo). Smaller updates: 2026-07-16 (the Dashboard full-review feature, clearing the test data, formally entering the usage period); **2026-07-18** (the full Resume Coach rework: Story Bank + 4-source generation + auto-expiring usage history; the Mock Interview tab was removed; the problems and lessons from that rework are in the project's private retrospective).

This document is the strategy layer: "why we build and what comes first". Item-by-item execution status is in `docs/tasks.md`.

---

## 0. Overall assessment (2026-07-14)

**In one sentence: the feature side is already ahead of plan, and the project's bottleneck has moved from "what is still missing" to "the quality ceiling" and "a decision not yet made".**

Three items originally scheduled for Growth (3 months out) were all done early: the company knowledge board, the hype script, and the mock interview loop. The mock interview loop was later removed on 2026-07-18 at the user's request (after using it, it turned out not to be needed; see the private retrospective). The product then had four tabs (Practice / Resume Coach / Dashboard / Company Knowledge), 88 questions across 7 types, each type with a rubric and a structured example answer, history and trends, and 9 business lines each with complete memorizable sample answers. The Resume Coach was reworked on 2026-07-18 from "paste a one-off resume snippet" into "a persistent resume + target job description + an editable Story Bank, with four sources (resume / JD / story / the 16 LPs) generating every AI output together", plus a usage history (auto-expiring after 5 days, implemented with a Cron Trigger). **For a "single-person interview prep tool" the product is complete, and closer than the 2026-07-14 version to the shape the user actually wants (the mock interview was built first and only after using it was it clear it was not needed; that is itself a live validation of the "diminishing marginal value of features" insight).**

**2026-10-04 status note**: the product now has six tabs (Practice / Resume Coach / Dashboard / Company Knowledge / Interview Rounds / System Design Guide), three companies (Amazon / Make / Meta), and 130 questions across the 7 types (Amazon 88, Make 21, Meta 21). The grading model is now llama-3.3-70b, there is a read-only demo account for reviewers, and the repo is public. The three insights below are the July 2026 judgments, kept as history, with later developments noted at the end of each.

This leads to three insights worth facing honestly:

### Insight 1: every further feature has diminishing marginal value, and practice volume is the scarce resource

Most of the Dashboard's current data was typed in during development testing and is not real practice. The product's value formula is "tool quality × actual usage", and the right-hand factor is near zero right now. **The highest-value next action is not writing code; it is the user practicing 3 questions a day with it.** That is also why Phase 4's "adjust rubrics / prompts from real usage experience" was deliberately placed after all the features: without real usage data, any prompt tweak is guesswork. Recommendation: first accumulate 2 weeks, at least 4 scored practices per question type (also the minimum for the Dashboard trend to appear), then come back and decide from the data what to adjust.

### Insight 2: the quality ceiling is the 8B model, and we have already seen what its limit looks like

This is not a guess, it is evidenced: after the example answers got longer, about 2/3 of the 8B model's calls dropped the closing `}` of the JSON (handled with a two-layer repair logic). A model that cannot hold the format steady must have a ceiling of the same level in the finesse of its scoring. At single-person volume, the quota cost of switching to llama-3.3-70b is entirely affordable, and **it is currently the best-value upgrade**. But it should wait until the real practice data from Insight 1 yields concrete cases of "which feedback felt inaccurate", so the before and after have a comparable baseline; otherwise after switching there is no way to know whether it got better.

**2026-10 update**: the switch to llama-3.3-70b has been made. The approach was to try it first while staying on Workers AI; NVIDIA's free tier was not adopted because its terms exclude production use with real end users. The 70B model's response has an OpenAI-chat shape, and the `.response` field that Cloudflare fills in automatically gets truncated for this model, so `runFeedbackModel()` now prefers `choices[0].message.content`. The user's "feedback felt inaccurate" cases are still accumulating, and the 8B-versus-70B quality comparison can be done when they are enough.

### Insight 3: the project stands at a fork, and not choosing is also a choice

Every item in the Later phase (trial counting, Stripe, a privacy policy, moving OAuth to Production, Turnstile, removing the allowlist) only serves "opening it to other people". If the product's positioning is self-use until the interviews are over, the whole Later phase can be deleted openly, with maintenance cost near zero. If it is really going to be commercialized, the Later phase is an **indivisible atomic package**: the wrong order of opening the door before adding the lock already cost one lesson in the Turnstile incident (see §E). The suggested decision point: **after the user has used it intensively for 2–4 weeks**. If even they do not use it daily, the commercialization case does not hold; if they cannot do without it, that is the best PMF signal.

**2026-10 update**: a third path has appeared. Besides "self-use" and "commercialization" there is now "portfolio showcase": public code plus a read-only demo account for reviewers, so people can see the engineering judgment and product thinking without open registration. This path needs nothing from the commercialization package (it has no cost exposure: the demo account can make only 3 AI calls a day), so the commercialization decision point stays open, it is just no longer "choose or you get stuck with two options".

---

## A. Product view (the 2026-07-06 first findings → status on 2026-07-14)

Of the 7 problems found in the first version, 6 are solved. Only one survives, and its nature has changed:

| # | First finding | Status |
|---|---------|------|
| 1 | Each type always serves the same question (close to a bug) | ✅ Fixed (random + "Next question" never repeats) |
| 2 | The bank is too thin (18 questions, 3 of 7 types usable) | ✅ 88 questions (Amazon), 7/7 types usable; since 2026-10 a total of 130 across three companies |
| 3 | Data is collected but its value is not fed back | ✅ Dashboard launched (history + average / trend per type) |
| 4 | Feedback quality ceiling (the 8B model) | ⚠️ **Still alive, upgraded to the main bottleneck** (see the §0 Insight 2) |
| 5 | No sign-out button | ✅ Added |
| 6 | Missing practice-mechanics design | 🔶 Partly solved and partly rolled back: the mock interview loop once added a "mock interview mode", but on 2026-07-18 the user asked to remove it (in use it turned out unnecessary; single-question practice plus the Dashboard review is enough); the timer, streak, and spaced repetition are still not built, and for a single self-use tool building them now is still putting the cart before the horse (see the §0 Insight 1) |
| 7 | No landing page / onboarding | ⏸️ Only needed on the commercialization path, parked in Later |

**New product debt (accumulated since 2026-07-14)**: the Company Knowledge "Recent news" is time-sensitive (last verified 2026-07-13), which is exactly why the `LAST_UPDATED` constant exists: it should be re-searched on the web once a month, because stale news is worse than no news (getting the current situation wrong in an interview is a negative score).

## B. Security view (ranked by risk, status on 2026-07-14)

1. **Open registration = a cost exposure surface (unchanged, still the most important).** The `ALLOWED_EMAIL` allowlist is currently the strongest cost protection. A trial-count limit must ship in the same commit as open registration; the door cannot be opened first and the lock added later.
2. **The Google OAuth consent screen is still in Testing mode** (up to 100 test users). It only needs handling on the commercialization path. **A point that is easy to misread (clarified 2026-07-13): this 100-person cap is a manual allowlist in the Google Console; bots cannot get in and cannot use up its slots.** It is a different matter from the abuse surface Turnstile guards against (spamming email verification mail, burning Resend quota).
3. **The resume is PII and sits in Neon indefinitely.** At single-user self-use the risk is acceptable (your own resume, stored by you); before opening registration there must be a privacy policy and a deletion mechanism.
4. **The session token is stored in localStorage.** XSS could steal it; with no third-party JS and a single user the risk is low. Move to an httpOnly cookie when commercializing.
5. ~~OTP stored in plaintext in KV~~ ✅ Fixed (SHA-256, 2026-07-10).
6. The sender domain is unverified (using `onboarding@resend.dev`). The user evaluated this and postponed it; handle it if verification mail starts landing in spam.
7. **No usage alerts: confirmed to be a product limit of the Cloudflare Free plan** (confirmed on 2026-07-10 by paging through all 53 notification types in the browser; it is not a permissions issue), so there is no solution for now. The practical mitigation: the account itself is on Workers Free, and exhausting the allowance means "returning errors", not "incurring charges", so this is an availability risk rather than a cost risk.
8. **Secrets discipline (paid for once more on 2026-07-13).** `tail .dev.vars` printed the Neon password and SESSION_SECRET into the conversation, and they were rotated the same day (Neon with `rotate-secrets.mjs`, SESSION_SECRET regenerated, both pushed to production and verified). The rule is now fixed: **when inspecting a secrets file, only look at key names, never print values.** This was the third incident of this kind in the project, and it was written into long-term memory.
9. **A leftover dead value:** production holds a `TURNSTILE_SECRET_KEY` that no code currently reads (its value is Cloudflare's public test key, not sensitive), a remnant of the Turnstile revert that will be overwritten when Turnstile is redone.
10. **A pre-publication audit of the repo (2026-10-04).** After searching the whole git history, the real secrets (`.env` / `.dev.vars`, the demo password and its hash, the various API keys, the database connection string) had never been committed; but the documents and config held personal data (former employers and quantified achievements, personal and work email addresses, GitHub account names). Handling: the documents were rewritten generically, `ALLOWED_EMAIL` became a Cloudflare secret, and the repo was published as a fresh single-commit repo while the old repo stays private. Private engineering retrospectives and reading notes are not placed in the public repo.

## C. Business model suggestions (only if the commercialization path is chosen, see the §0 Insight 3)

The premise is unchanged: once there is charging, the "$0 cost" principle is rewritten as "cost must be well below revenue".

1. **Freemium subscription (the main recommendation)**: free 3 practices + 1 resume coach, subscription US$12–19 per month. Pricing anchors: Exponent at roughly US$79–150 per month, and a human mock interview at US$150+ per session, leaving a large space in between.
2. **Credit packs (supplementary)**: interview prep is a short, intense need, so a one-time question pack (US$10 for 30 questions) fits the scenario better than a subscription and has zero friction with the attempts-counting architecture.
3. **B2B2C (later)**: white-label licensing to resume coaches / bootcamps.
4. **The moat is content, not technology**, and these two weeks validated it: the technical side (auth, rate limiting, JSON repair) is replicable engineering, and what took real thought was the 88-question bank, the sample answers for 9 business lines, and the type-structured scoring framework. **A commercial investment should keep going into content density.**
5. **Use Stripe for payments** (Payment Links / Checkout); do not build it yourself.

## D. Phased plan (reordered 2026-07-14)

### ✅ Now + Next + Growth feature items: all done
Question rotation, the 88-question bank, rubrics for 7 types, OTP hashing, the history Dashboard (with the Topic Review Panel), the company knowledge board (with sample answers), the full Resume Coach rework (Story Bank + persistent resume / JD + 4-source generation + auto-expiring usage history), a site-wide loading animation, dependency vulnerability fixes (vitest v4, `npm audit` 0), and the branch strategy settled (work on main directly). The mock interview loop was removed after being built (see §0 and §A-6 above). Item-by-item details and verification records are in `docs/tasks.md`.

### Now (the next 2–4 weeks): the usage period, deliberately no new features
- [x] **Cleared the test data, formally starting the usage period (2026-07-16)**: deleted the 117 attempts + 87 feedback rows accumulated during development on the owner account (test data from the development stage, not real practice), leaving the `users` / `questions` tables unaffected. Row counts were checked before and after to confirm the scope was precise (only this user_id was deleted) and that the count was zero afterwards. The Dashboard is now a clean start, and what accumulates from here is real practice records
- [x] **Cleared the test data a second time (2026-07-18, a new problem from the Resume Coach rework)**: this time it was story / profile test data written by the worker test suite (which, by project convention, hits the real Neon), noticed only when the user actually opened the page and saw it. It was cleared after the scope was checked precisely; the full account is in the private retrospective
- [ ] **The user's own real practice**: target at least 4 scored records per question type (the minimum for the Dashboard trend), noting concrete cases of "which feedback felt inaccurate / too lenient / too strict" along the way. The Dashboard's Recent attempts can now be expanded to see the full answer and full AI feedback (added 2026-07-16), so when recording cases you can expand the matching record and quote it directly without looking up what you typed. The Resume Coach also has its own Story Bank + usage history, and both databases were cleaned on 2026-07-18, so real data can start accumulating safely
- [ ] **Update the Company Knowledge "Recent news" monthly** (re-verify by web search and change `LAST_UPDATED`; last done: 2026-07-13)
- [ ] First manual export backup of the Neon data (the free-tier PITR is limited, and the practice data accumulated so far is starting to have value)

### Later (after there is real usage data): quality upgrades
- [x] **Evaluate upgrading to llama-3.3-70b (switched in 2026-10; the quality comparison still waits for real cases to accumulate)**: use the "inaccurate feedback" cases recorded during the usage period as the baseline, run the same batch of answers on the old and new models for a comparison; also retest JSON stability (the 8B dropped-`}` problem may disappear naturally on a larger model, in which case the repair logic could be simplified)
- [ ] Adjust rubric weights / prompts from usage experience (a Phase 4 leftover, deliberately waiting until now)
- [ ] If practice frequency becomes steady: then evaluate habit mechanics such as a timer / streak (the §A-6 remainder)

### The commercialization package (an atomic package: do all of it or formally delete it; decision point in the §0 Insight 3)
- [ ] Trial counting (3+1) + blocking overage before the Workers AI call → **in the same commit as opening registration**
- [ ] Turnstile (the code is at commit `1ea660c` and can be cherry-picked; **the correct order: first create the real widget and set the production secret, then deploy the code that requires the token**; the 2026-07-13 deploy-order incident is in §E)
- [ ] Stripe payments, a privacy policy / terms of service / data deletion, moving the OAuth consent screen to Production, removing the ALLOWED_EMAIL allowlist + the 404 disguise
- [ ] Landing page + onboarding
- [x] Multi-company question banks, done: Amazon / Make / Meta (one more company was supported for a while and then removed). The content maintenance cost really does multiply by the number of companies: each company needs a rubric, a question bank, and Company Knowledge (including the recent news that needs regular updates)

## E. Process lessons (paid for in real tuition over these two weeks, for the future self and AI collaborators)

1. **Deploy order = dependency order (the Turnstile incident, 2026-07-13).** The code was correct and the tests all passed, yet production still broke, because "the code that requires a `turnstileToken`" shipped before "production had a real Turnstile secret". Lesson: **any feature that introduces a new external dependency (a secret, a third-party service) must deploy in the order: configure the dependency first, then deploy the code that uses it.** Also, propping the service up with a "fake safeguard" (an always-passing test key) was the wrong direction, and a complete revert was right: better to temporarily lack the feature than to have a safeguard that looks present but does nothing.
2. **For secrets, only look at structure, never print values (fixed after the third incident, 2026-07-13).** Even a `tail` just to "glance at the end of the file" is not acceptable. The rotation procedure (`rotate-secrets.mjs` + `wrangler secret put`) has been verified three times, is cheap, and should be done as soon as a leak is found, with no hoping for the best.
3. **The real culprit behind "Failed to fetch" was sharing the wrong URL (2026-07-14).** The hash-prefixed preview URL that Cloudflare Pages generates on every deploy (`xxxx.preppilot.pages.dev`) is not on the Worker's CORS allowlist, so every API call from a page opened at those URLs is blocked by the browser. **Give out only the production domain `https://preppilot.pages.dev`**, which always points at the latest deploy.
4. **Test the limits of a free tier; do not trust intuition (the usage alerts, 2026-07-10).** At first it looked like an API-token permission problem, but paging through the whole Dashboard showed it was a product limit of the plan tier. The conclusions differ a lot: the former is "ask the user to configure it by hand", the latter is "no solution for now, and not worth working around".
5. **Disprove the risk of a major-version upgrade with an experiment; do not inflate it with imagination (vitest v4, 2026-07-13).** An upgrade originally marked "has migration risk, set aside" turned out to need a change to a single config file, with all 62 tests passing. The cost of setting it aside (6 known vulnerabilities left open for over a week) was in fact higher than the upgrade itself.
6. **The same "wrong URL" trap came back in a different guise, which shows that writing it into the repo docs is not enough (2026-07-18).** The lesson about the hash-prefixed preview URL in point 3 was written into this document on 2026-07-14, but on 2026-07-18 the same URL triggered Google OAuth's `origin_mismatch` (Google's Authorized JavaScript origins allowlist also did not include that URL). The document was right, but it did not stop the collaborating AI from leaving that URL open in a browser tab after the next deploy. This time the rule was stored in **cross-conversation persistent memory** (not only this repo's documents), because repo documents only take effect when the AI chooses to read them, while memory is loaded automatically in every conversation. Lesson: **when the same kind of mistake happens twice, the fix is in the wrong place: the rule was not unclear, it was not placed where it actually gets checked.**
7. **When running tests against the production database, the tests themselves must clean up, especially for "one row per user" tables (2026-07-18).** The new worker tests for the Resume Coach rework followed the project's existing convention (hit the real Neon, no mocks), but `resume_coach_profile` has upsert semantics (a user always has exactly one row), so the marker strings a test wrote (such as `"Resume marker <uuid>"`) directly overwrite that row: it is not an extra row waiting to be cleaned up later, it **overwrites the real content the user can see right then**. The user noticed by opening the page and seeing it, not because I caught it first. Lesson: before writing a test, ask "is this table global-unique / single-row?"; if it is, the test must clean up after itself at the end (following the existing CRUD tests), and cannot assume "it will be cleaned up later anyway", because the user may see it before "later" happens.
8. **Test isolation comes from separating identities, not only from cleaning up afterwards (2026-10-04).** The tests deliberately hit the real database, and the first two incidents both strengthened the cleanup; only the third showed that as long as the tests and the real user share an identity, the gap before cleanup is visible to the user. The fix is to run the tests as a dedicated test identity, and to prove with a before-and-after data fingerprint that the real data was not touched.
9. **A document written to explain a privacy decision is itself a leak channel (2026-10-04).** When recording "why this content is excluded", write the reason and do not copy the content in with it.

## F. Recent milestones (2026-08 to 2026-10)

- 2026-08: added Make as the second company (question bank, rubric, Company Knowledge, Resume Coach values framework)
- 2026-09: Interview Rounds was first built as editable and then redone as a read-only view; the System Design Guide went through five iterations; the language-switch feature was removed
- 2026-10-01: the grading model switched to llama-3.3-70b
- 2026-10-01 to 02: the reviewer demo account (a separate sign-in, a route allowlist, a daily cap of 3 gradings), and a wider visible scope (Dashboard, the generic Interview Prep Guide (later extended to all three companies with a Company dropdown), the Salary Positioning example tool)
- 2026-10-02: removed one company and added Meta
- 2026-10-04: the pre-publication audit and personal-data cleanup, the tests moved to a dedicated identity, and the repo made public
