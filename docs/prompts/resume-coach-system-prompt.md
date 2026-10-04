# Resume Coach System Prompt

Used by `POST /api/feedback` when `mode = "resume_coach"`. Implemented in `worker/src/prompts.ts`
(`buildResumeCoachSystemPrompt` / `buildResumeCoachUserMessage` / `parseResumeCoachResponse`) and
wired up in `worker/src/index.ts`'s `handleResumeCoachFeedback` — see `docs/tasks.md` Phase 2
"Resume Coach mode", `docs/api-spec.md` for the current request/response shape.

**2026-07-16 overhaul:** every AI output on the Resume Coach page (bullet-rewrite suggestions,
behavioral question types, the rewritten STAR+ answer, and the 60-second hype script) is now
generated from all four sources together — resume, target JD, the specific Story Bank entry, and
the Amazon Leadership Principles — instead of just a pasted resume snippet. Previously the hype
script only used resume + JD; it's now on the same four-source footing as everything else.

## Construction

Interpolates:

- `{{LP_LIST}}` — the fixed list of Amazon Leadership Principles (title + one-line description),
  hardcoded in the Worker (not derived from `rubrics-amazon.json`, which only has the generic
  `leadership_principles_behavioral` rubric, not a per-LP breakdown)
- `{{TARGET_LPS}}` — optional; if the user picked specific LPs to target, list them and ask the
  model to prioritize those; otherwise ask the model to infer the best-fitting LPs itself

## System prompt template

```
You are an Amazon interview coach helping a candidate turn one of their personal stories into a
strong Leadership Principles (LP) behavioral story, tailored to a specific job they're applying
for.

The Amazon Leadership Principles are:
{{LP_LIST}}

You will be given four sources: the candidate's full resume (context only — other experience,
seniority, domain), the target job description (to tailor tone, seniority, and emphasis), the
specific story from their Story Bank (the primary raw material — this is the story to rewrite),
and the LP list above. Use all four together: ground the rewritten story and hype script in the
Story Bank content, use the resume only for supporting context (do not invent achievements that
only exist in the resume but not the story), and let the job description shape which skills/impact
to emphasize and the seniority of the language used.

{{TARGET_LPS ? "Focus specifically on these LP(s): " + TARGET_LPS : "Infer which 1-2 LPs this
story best demonstrates."}}

Do three things:

1. Identify which LP(s) this story best demonstrates and why (in one sentence per LP).
2. Rewrite it as a STAR+ story: Situation, Task, Action, Result, and a short Reflection on what
   the candidate learned or would do differently. Use only details present in or reasonably
   inferable from the story (and resume context) — do not fabricate metrics or outcomes that
   aren't implied. Emphasize the aspects most relevant to the target job description.
3. Write a "hype script": a confident, first-person, ~150-word script (about 60 seconds spoken
   aloud) the candidate could say to themselves right before walking into the interview for this
   specific job. Name their top 1-2 achievements — drawing on this story and, where relevant, the
   resume — state concretely why they're qualified for this specific role based on the job
   description, and what makes them distinct. Grounded only in the story/resume — no fabricated
   claims.

Respond with ONLY a single JSON object (no markdown fences, no commentary), with exactly this
shape:

{
  "suggested_lps": ["<LP name>", ...],
  "behavioral_question_types": ["<a realistic interview question this story would answer>", ...],
  "rewritten_star_answer": {
    "situation": "...",
    "task": "...",
    "actions": "...",
    "results": "...",
    "reflection": "..."
  },
  "hype_script": "<~150-word first-person hype script, one continuous paragraph, no line breaks>"
}
```

**2026-07-18: dropped the "resume bullet rewrite suggestions" task** (previously task 3 of 4) per user
feedback — not useful enough to justify the extra output tokens. `ParsedResumeCoach.resumeRewriteSuggestions`
stays optional in `worker/src/prompts.ts` purely so old, already-stored results (from before this change)
still parse and render; it's no longer requested from the model and `ResumeCoachResultDisplay.tsx` no longer
renders that section.

## User message

Built from `ResumeCoachSources` (`worker/src/prompts.ts`) — the story is always present;
resume/JD fall back to an explicit "(not provided)" marker rather than being omitted, since a
saved-but-empty profile is a normal, expected state (not every user fills in both before
generating):

```
Story Bank entry (primary material to rewrite):
{{STORY_CONTENT}}

Full resume (context only):
{{RESUME_TEXT ?? "(not provided)"}}

Target job description (tailor tone/emphasis to this):
{{JOB_DESCRIPTION ?? "(not provided)"}}

{{TARGET_LPS ? "Target LPs: " + TARGET_LPS : ""}}
```

`STORY_CONTENT` comes from the Story Bank entry the request's `storyId` points to (see
`docs/api-spec.md`'s `POST /api/feedback` resume_coach section) — `handleResumeCoachFeedback`
looks it up server-side via `getStoryById`, and looks up `RESUME_TEXT`/`JOB_DESCRIPTION` via
`getResumeCoachProfile`. The client never sends resume/JD/story content directly in the feedback
request; it only sends the `storyId`.

## Output contract

Maps into `feedback.extra` (jsonb) verbatim as returned by the model — `scores` / `strengths` /
`improvements` stay `null` for this mode (there's no rubric scoring in Resume Coach, just
generative rewriting). `overallFeedback` can hold a 1-2 sentence summary; `exampleAnswer` is
unused (`null`) since `rewritten_star_answer` already serves that purpose in a more structured
form. `hype_script` (added 2026-07-13, extended to the full 4-source treatment 2026-07-16) is the
60-second first-person pep talk described above, rendered by
`frontend/src/ResumeCoachResultDisplay.tsx` as a highlighted card at the end of the results — both
inline right after generating (`frontend/src/ResumeCoach.tsx`) and later in the usage history
(`GET /api/resume-coach/history`), until it auto-expires 5 days after creation.

**2026-07-18:** every successful generation also updates `story_bank.latest_extra`/
`latest_generated_at` for the story it was generated from (`worker/src/db.ts`'s
`updateStoryLatestExtra`, called from `handleResumeCoachFeedback` right after building `extra`) —
that's what lets the Story Bank list show each story's current LP tags (for the "filter by LP" UI)
without depending on the 5-day-expiring history. `frontend/src/ResumeCoach.tsx` also triggers a
fresh generation automatically right after a story edit is saved, since the story text just
changed and the previous result no longer reflects it.
