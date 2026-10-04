-- Resume Coach overhaul: persisted resume/JD profile + a permanent Story Bank.
-- Source of truth: docs/db-schema.md.
--
-- story_bank rows are explicitly EXCLUDED from the 5-day AI-output expiry
-- (see the cron cleanup in worker/src/index.ts) — only attempts/feedback
-- rows with mode = 'resume_coach' expire, never the user's own stories.

create table if not exists resume_coach_profile (
  user_id uuid primary key references users (id),
  resume_text text,
  job_description text,
  updated_at timestamptz not null default now()
);

create table if not exists story_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_story_bank_user on story_bank (user_id);

-- Nullable + no default: only resume_coach attempts reference a story, and
-- existing rows (pre-Story-Bank) have nothing to backfill this with.
alter table attempts add column if not exists story_id uuid references story_bank (id);
