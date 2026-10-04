-- Interview Rounds tab (2026-09-03, per user request): a per-company,
-- structured breakdown of each interview round (HR screen, hiring manager,
-- case, team fit, final, plus reference sections like a fact sheet or a
-- salary/negotiation playbook) — round_order controls display sequence.
--
-- qa_items holds an ordered array of {question, answer} objects. Unlike
-- story_bank this has no soft-delete/undo grace period — it's reference
-- material the user edits directly, not an AI-generation input worth
-- protecting from accidental loss the same way.

create table if not exists interview_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  company text not null,
  round_order integer not null default 0,
  title text not null,
  what_it_tests text,
  prep_focus text,
  qa_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interview_rounds_user_company on interview_rounds (user_id, company);
