-- Seeds the first batch of Make (make.com) questions, the second company
-- added to the app (2026-08-14) alongside Amazon. 3 per type (21 total) —
-- a starter set, not full parity with Amazon's larger bank; expandable
-- later the same way Amazon's bank grew across migrations 0002/0004/0005.
-- Grounded in real, researched facts about Make (Prague-founded as
-- Integromat, acquired by Celonis in 2020, rebranded Make in 2022; visual
-- "scenarios" built from drag-and-drop "modules"; 3,000+ app integrations;
-- credit/operations-based pricing; Make AI Agents launched 2025/2026;
-- competitors Zapier, n8n, Workato, Tray.ai, Microsoft Power Automate) —
-- every question is written in our own words, not copied from any source
-- (see docs/ai-rules.md). Rubric for these lives in docs/rubrics-make.json.
-- Idempotent: guarded by NOT EXISTS on title so re-running doesn't duplicate.

insert into questions (company, type, title, description, metadata)
select 'make', v.type, v.title, v.description, v.metadata::jsonb
from (values
  -- ---------- product_sense ----------
  ('product_sense', 'Design a way for a non-technical Make user to understand why a scenario failed.',
   'A creator''s automation scenario has 12 modules chained together. It failed silently overnight and they have no idea which step broke. Design an experience that helps them debug it without needing to understand the underlying error logs.',
   '{"difficulty":"mid","tags":["debugging","non_technical_users"]}'),
  ('product_sense', 'Improve how a first-time Make user discovers which modules to use.',
   'Someone signs up for Make wanting to automate "send me a Slack message when I get a new lead form submission," but has never used the product before. Design the experience that gets them to a working scenario.',
   '{"difficulty":"mid","tags":["onboarding","activation"]}'),
  ('product_sense', 'Design a feature to help a Make user move from a simple scenario to a Make AI Agent.',
   'A creator has a working deterministic scenario but keeps hitting cases their fixed logic can''t handle well. Design a feature that helps them recognize this and smoothly upgrade part of their scenario to an AI Agent.',
   '{"difficulty":"senior","tags":["ai_agents","upgrade_path"]}'),

  -- ---------- analytical_execution ----------
  ('analytical_execution', 'Make''s "first successful scenario run" activation rate dropped 15% after a UI redesign.',
   'How would you investigate the drop and decide what to do about it?',
   '{"difficulty":"mid","tags":["metrics","debugging"]}'),
  ('analytical_execution', 'Free-plan users on Make are not converting to paid plans at the expected rate.',
   'Design an analysis plan to figure out why, and describe the metrics you would look at.',
   '{"difficulty":"mid","tags":["conversion","pricing"]}'),
  ('analytical_execution', 'A subset of scenarios using a popular third-party integration started failing more often.',
   'Walk through how you would determine whether this is a Make platform issue, a partner API issue, or a user configuration issue.',
   '{"difficulty":"senior","tags":["reliability","root_cause"]}'),

  -- ---------- leadership_principles_behavioral ----------
  ('leadership_principles_behavioral', 'Tell me about a time you built something that let a non-technical person solve their own problem, without needing engineering help.',
   'Describe the situation, what you built or enabled, and the outcome.',
   '{"difficulty":"mid","tags":["creator_empowerment"]}'),
  ('leadership_principles_behavioral', 'Describe a time you simplified something complex for a user without removing real capability.',
   'Walk through the trade-off you faced and how you resolved it.',
   '{"difficulty":"mid","tags":["radical_simplicity"]}'),
  ('leadership_principles_behavioral', 'Tell me about a time you had to make a product accessible to beginners while keeping it powerful for advanced users.',
   'Describe the tension you navigated and what you ultimately decided.',
   '{"difficulty":"senior","tags":["practical_power"]}'),

  -- ---------- strategy_business ----------
  ('strategy_business', 'How should Make differentiate itself from Zapier over the next 2 years?',
   'Zapier has a larger app ecosystem and a more polished, easier UX. Make is more powerful and considerably cheaper at equivalent usage. Lay out a strategy for how Make should compete.',
   '{"difficulty":"senior","tags":["competition","positioning"]}'),
  ('strategy_business', 'Should Make go further upmarket to compete with Workato and Tray.ai in the enterprise segment?',
   'Make already has enterprise features (Make ONE) but its core user base skews prosumer/SMB. Should Make invest further into enterprise, or double down on its current middle-tier position? Justify your recommendation.',
   '{"difficulty":"senior","tags":["market_segments","roadmap"]}'),
  ('strategy_business', 'How should Make think about its relationship with Celonis as a strategic asset, not just an ownership structure?',
   'Make operates as a business unit within Celonis (a process mining and execution management company). How could Make''s product strategy meaningfully leverage that relationship rather than treating it as incidental?',
   '{"difficulty":"senior","tags":["parent_company","ecosystem"]}'),

  -- ---------- estimation ----------
  ('estimation', 'Estimate how many automation scenarios are actively running on Make at any given moment.',
   'Walk through your assumptions and the math.',
   '{"difficulty":"mid","tags":["scale","guesstimate"]}'),
  ('estimation', 'Estimate what percentage of Make''s active users have connected at least one AI module (OpenAI/Claude/Gemini) to a scenario.',
   'Walk through your assumptions and the math.',
   '{"difficulty":"mid","tags":["ai_adoption","guesstimate"]}'),
  ('estimation', 'Estimate how many support tickets Make receives per month related to a scenario failing unexpectedly.',
   'Walk through your assumptions and the math.',
   '{"difficulty":"mid","tags":["support_load","guesstimate"]}'),

  -- ---------- system_design ----------
  ('system_design', 'Design the execution engine that runs millions of scheduled and triggered automation scenarios reliably.',
   'Include how you would handle retries and partial failures within a multi-step scenario.',
   '{"difficulty":"senior","tags":["reliability","scale"]}'),
  ('system_design', 'Design how a Make AI Agent could safely take an action (like sending an email) inside a scenario without breaking other scenarios that depend on the same data.',
   'Describe the safeguards you would put in place.',
   '{"difficulty":"senior","tags":["ai_agents","safety"]}'),
  ('system_design', 'Design a system that lets Make detect and alert a creator when a third-party integration they depend on changes its API in a breaking way.',
   'Walk through the high-level architecture.',
   '{"difficulty":"mid","tags":["integrations","monitoring"]}'),

  -- ---------- ai_pm ----------
  ('ai_pm', 'Design the product experience for a creator upgrading a simple scenario into a Make AI Agent.',
   'Help a non-technical user go from deterministic, rule-based automation to adaptive, AI-driven decision-making without hitting a wall of complexity.',
   '{"difficulty":"senior","tags":["ai_agents","ux"]}'),
  ('ai_pm', 'How would you decide when a scenario step should be a deterministic module versus an AI Agent step?',
   'Describe the criteria you would use and how you would communicate that trade-off to users.',
   '{"difficulty":"mid","tags":["ai_agents","product_decisions"]}'),
  ('ai_pm', 'What responsible-AI risks would you watch for in Make AI Agents, given they can take real actions in a user''s connected business systems?',
   'Describe concrete failure modes and the guardrails you would put in place.',
   '{"difficulty":"senior","tags":["responsible_ai","ai_agents"]}')
) as v(type, title, description, metadata)
where not exists (
  select 1 from questions q where q.title = v.title
);
