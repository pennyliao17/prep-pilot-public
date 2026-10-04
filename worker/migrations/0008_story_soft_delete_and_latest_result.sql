-- Story Bank UX overhaul (2026-07-18, per user feedback):
--
-- 1. Soft delete with a 3-day undo window: deleting a story no longer
--    removes it immediately — it's hidden from the active list and
--    permanently deleted 3 days later by the scheduled() cron job
--    (see worker/src/index.ts), unless restored first.
-- 2. Story Bank now shows each story's most recent generated result
--    inline (LPs, behavioral questions, STAR+ answer, hype script) and
--    lets the user filter stories by LP — that requires the latest
--    result to be readable without depending on the 5-day-expiring
--    attempts/feedback history, so it's denormalized onto the story row.

alter table story_bank add column if not exists deleted_at timestamptz;
alter table story_bank add column if not exists latest_extra jsonb;
alter table story_bank add column if not exists latest_generated_at timestamptz;

create index if not exists idx_story_bank_deleted_at on story_bank (deleted_at);
