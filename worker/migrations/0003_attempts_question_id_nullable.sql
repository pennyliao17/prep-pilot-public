-- Resume Coach mode (attempts.mode = 'resume_coach') has no associated question,
-- so question_id must be allowed to be null. See docs/db-schema.md §3.
alter table attempts alter column question_id drop not null;
