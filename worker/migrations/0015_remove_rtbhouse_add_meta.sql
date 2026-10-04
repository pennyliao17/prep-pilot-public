-- Removes RTB House (2026-10-02, per explicit user request) and adds Meta
-- as the third company instead — unlike RTB House's Technical Account
-- Manager archetype, Meta prep reuses the same 7 PM question types as
-- Amazon/Make (see docs/rubrics-meta.json), so this migration also narrows
-- questions.type's CHECK constraint back down, removing the 5 TAM-specific
-- types added in 0012_add_tam_question_types.sql.
--
-- Deletion is safe to do unconditionally: confirmed via direct query before
-- writing this migration that there are zero attempts/feedback rows and
-- zero interview_rounds rows under company = 'rtbhouse' in production, so
-- no other table references the rows being removed here.
delete from questions where company = 'rtbhouse';

-- Postgres has no "alter constraint" — dropping and recreating is the
-- standard way to change a CHECK constraint's allowed value set. Narrowing
-- (rather than widening, as 0012 did) is only safe because the delete above
-- already removed every row that used one of the 5 types being dropped.
alter table questions drop constraint questions_type_check;
alter table questions add constraint questions_type_check check (type in (
  'product_sense',
  'analytical_execution',
  'leadership_principles_behavioral',
  'strategy_business',
  'estimation',
  'system_design',
  'ai_pm'
));

-- Seeds the first batch of Meta questions, 3 per type (21 total) — the same
-- starter-set scale as Make's initial seed in 0011, not full parity with
-- Amazon's larger bank. Grounded in real, researched facts about Meta
-- (Menlo Park, founded 2004 as Facebook, renamed Meta in 2021; family of
-- apps: Facebook, Instagram, WhatsApp, Messenger, Threads; Feed/Reels
-- ranking funded by an ads auction business; Meta AI assistant built on
-- Meta's own foundation models; Reality Labs' AR/VR bet funded by ads
-- revenue) — every question is written in our own words, not copied from
-- any source (see docs/ai-rules.md). Rubric for these lives in
-- docs/rubrics-meta.json. Idempotent: guarded by NOT EXISTS on title so
-- re-running doesn't duplicate.

insert into questions (company, type, title, description, metadata)
select 'meta', v.type, v.title, v.description, v.metadata::jsonb
from (values
  -- ---------- product_sense ----------
  ('product_sense', 'Design a way to help someone rediscover a Facebook Group they joined but stopped checking.',
   'A person joined a local parenting Group a year ago, engaged heavily for a few months, and then drifted away even though the Group is still active. Design an experience that helps them re-engage without feeling spammy.',
   '{"difficulty":"mid","tags":["re_engagement","groups"]}'),
  ('product_sense', 'Improve how a first-time Instagram user finds their first few Reels creators to follow.',
   'Someone just created an Instagram account and has no following graph yet. Design the experience that gets them from a blank Reels feed to following a handful of creators they actually care about.',
   '{"difficulty":"mid","tags":["onboarding","reels"]}'),
  ('product_sense', 'Design a feature to help a small business owner get started with Click-to-WhatsApp ads.',
   'A small business owner has never run an ad before and wants customers to be able to message them directly on WhatsApp. Design the experience that gets them to a working campaign.',
   '{"difficulty":"mid","tags":["onboarding","small_business","whatsapp"]}'),

  -- ---------- analytical_execution ----------
  ('analytical_execution', 'Daily active people (DAP) on Threads plateaued after a period of fast initial growth.',
   'How would you investigate the plateau and decide what to do about it?',
   '{"difficulty":"mid","tags":["metrics","growth","threads"]}'),
  ('analytical_execution', 'A test of a new Feed ranking change showed higher time spent but lower likes and comments.',
   'Walk through how you would decide whether this change is actually good for the product, and what you would do next.',
   '{"difficulty":"senior","tags":["ranking","tradeoffs"]}'),
  ('analytical_execution', 'Ad revenue per user dropped in a specific region despite stable daily actives.',
   'Design an analysis plan to figure out why, and describe the metrics you would look at.',
   '{"difficulty":"senior","tags":["ads","root_cause"]}'),

  -- ---------- leadership_principles_behavioral ----------
  ('leadership_principles_behavioral', 'Tell me about a time you shipped something imperfect quickly rather than waiting for a fully polished solution.',
   'Describe the situation, the trade-off you made, and the outcome.',
   '{"difficulty":"mid","tags":["move_fast"]}'),
  ('leadership_principles_behavioral', 'Describe a time you made a bold recommendation that others on your team initially disagreed with.',
   'Walk through how you made the case and what ultimately happened.',
   '{"difficulty":"senior","tags":["be_bold"]}'),
  ('leadership_principles_behavioral', 'Tell me about a time you prioritized your team or company''s success over getting individual credit.',
   'Describe the situation and what you did.',
   '{"difficulty":"mid","tags":["metamates"]}'),

  -- ---------- strategy_business ----------
  ('strategy_business', 'How should Meta think about competing with TikTok for younger users'' attention over the next 3 years?',
   'TikTok continues to lead in short-form video engagement among Gen Z. Lay out a strategy for how Meta should respond across Reels and the broader family of apps.',
   '{"difficulty":"senior","tags":["competition","reels"]}'),
  ('strategy_business', 'Should Meta invest further in Threads as a standalone product, or focus resources on strengthening Instagram and Facebook instead?',
   'Threads has real but still-developing engagement compared to Meta''s established apps. Justify your recommendation.',
   '{"difficulty":"senior","tags":["portfolio","threads"]}'),
  ('strategy_business', 'How should Meta balance continued investment in Reality Labs against investor pressure for near-term profitability?',
   'Reality Labs has posted large losses for several years, funded by the profitable advertising business. How should Meta think about this trade-off going forward?',
   '{"difficulty":"senior","tags":["reality_labs","investment"]}'),

  -- ---------- estimation ----------
  ('estimation', 'Estimate how many Reels are watched globally per day.',
   'Walk through your assumptions and the math.',
   '{"difficulty":"mid","tags":["scale","guesstimate"]}'),
  ('estimation', 'Estimate how many small businesses actively run Click-to-WhatsApp ad campaigns in a given month.',
   'Walk through your assumptions and the math.',
   '{"difficulty":"mid","tags":["ads","guesstimate"]}'),
  ('estimation', 'Estimate what percentage of Meta AI''s weekly active users return and use it again the following week.',
   'Walk through your assumptions and the math.',
   '{"difficulty":"mid","tags":["ai_adoption","retention","guesstimate"]}'),

  -- ---------- system_design ----------
  ('system_design', 'Design the ranking system that decides what shows up in someone''s News Feed.',
   'Describe the high-level architecture, including how you would balance relevance, freshness, and diversity of content.',
   '{"difficulty":"senior","tags":["ranking","scale"]}'),
  ('system_design', 'Design a system to detect and limit the spread of coordinated inauthentic behavior across Facebook and Instagram.',
   'Walk through the high-level architecture and how you would avoid over-flagging genuine, fast-moving organic content.',
   '{"difficulty":"senior","tags":["integrity","trust_and_safety"]}'),
  ('system_design', 'Design the infrastructure that serves a personalized ad in real time during someone''s Feed or Reels session.',
   'Describe the components involved and the latency constraints you would need to design around.',
   '{"difficulty":"senior","tags":["ads","real_time"]}'),

  -- ---------- ai_pm ----------
  ('ai_pm', 'Design how Meta AI should decide when to proactively suggest a reply inside a Messenger conversation.',
   'Describe when the assistant should step in versus stay silent, and how you would evaluate whether it''s actually helpful.',
   '{"difficulty":"senior","tags":["meta_ai","messenger"]}'),
  ('ai_pm', 'How would you decide whether a new Feed ranking model is ready to launch to everyone?',
   'Describe the offline and online evaluation process you would use before a full rollout.',
   '{"difficulty":"senior","tags":["ranking","launch_readiness"]}'),
  ('ai_pm', 'What responsible-AI risks would you watch for in letting Meta AI respond automatically to public posts on Threads?',
   'Describe concrete failure modes and the guardrails you would put in place before allowing that behavior.',
   '{"difficulty":"senior","tags":["responsible_ai","meta_ai","threads"]}')
) as v(type, title, description, metadata)
where not exists (
  select 1 from questions q where q.title = v.title
);
