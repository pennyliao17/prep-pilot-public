-- Adds a company field to Story Bank entries (2026-07-18, per user request):
-- stories are now tagged with which company the experience is from, so the
-- Story Bank (renamed from "Usage history") can be browsed/filtered by
-- company. Nullable since the two pre-existing stories predate this field.

alter table story_bank add column if not exists company text;
