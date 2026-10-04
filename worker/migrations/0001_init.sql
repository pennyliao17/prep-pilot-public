-- Initial schema for PrepPilot (PM / AI PM Practice).
-- Source of truth: docs/db-schema.md. Run once against the Neon database
-- (Neon SQL Editor, or `psql "$DATABASE_URL" -f worker/migrations/0001_init.sql`).

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  company text not null default 'amazon',
  type text not null check (type in (
    'product_sense',
    'analytical_execution',
    'leadership_principles_behavioral',
    'strategy_business',
    'estimation',
    'system_design',
    'ai_pm'
  )),
  title text not null,
  description text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_questions_company_type on questions (company, type);

create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id),
  question_id uuid not null references questions (id),
  company text not null default 'amazon',
  type text not null,
  mode text not null default 'single_question',
  answer_text text not null,
  raw_input jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_attempts_user_created_at on attempts (user_id, created_at);
create index if not exists idx_attempts_type_created_at on attempts (type, created_at);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references attempts (id),
  company text,
  type text,
  scores jsonb,
  strengths jsonb,
  improvements jsonb,
  example_answer text,
  overall_feedback text,
  extra jsonb,
  model_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_type_created_at on feedback (type, created_at);
