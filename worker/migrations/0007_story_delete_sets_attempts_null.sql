-- Fixes a real bug: attempts.story_id -> story_bank.id had no ON DELETE
-- action (defaults to NO ACTION), so deleting a story that had ever been
-- used to generate an LP result threw a foreign key violation — surfaced
-- to the user as a 500 on DELETE /api/resume-coach/stories/:id.
--
-- docs/api-spec.md and docs/db-schema.md already documented the intended
-- behavior ("storyTitle is null once the story has been deleted, the
-- attempt/feedback rows survive") — this migration is what actually makes
-- that true. Stories must stay freely deletable per the user's requirement
-- that Story Bank entries can always be deleted individually.

alter table attempts drop constraint attempts_story_id_fkey;
alter table attempts add constraint attempts_story_id_fkey
  foreign key (story_id) references story_bank (id) on delete set null;
