-- Seeds the first batch of RTB House (Technical Account Manager) questions,
-- the third company added to the app and the first prepping for a TAM role
-- rather than a PM role. 3 per type (15 total) — a starter set, matching the
-- same scale Make's initial seed used (migration 0011).
-- Grounded in RTB House's real, researched TAM job postings (main technical
-- point of contact for a client portfolio; investigating discrepancies,
-- frequency analysis, tag drop-offs; managing integrations; translating
-- business objectives into technical deliverables; communicating complex
-- concepts to non-technical audiences) and real company facts (Warsaw,
-- Poland; founded 2013; deep-learning-based programmatic
-- advertising/retargeting DSP; main competitor Criteo; rtb.com self-serve
-- platform launched 2026) — every question is written in our own words, not
-- copied from any source (see docs/ai-rules.md). Rubric lives in
-- docs/rubrics-rtbhouse.json.
-- Idempotent: guarded by NOT EXISTS on title so re-running doesn't duplicate.

insert into questions (company, type, title, description, metadata)
select 'rtbhouse', v.type, v.title, v.description, v.metadata::jsonb
from (values
  -- ---------- customer_relationship_behavioral ----------
  ('customer_relationship_behavioral', 'Tell me about a time you had to rebuild a client''s trust after a campaign issue.',
   'Describe the situation, what caused the client to lose confidence, what you did, and the outcome.',
   '{"difficulty":"mid","tags":["trust","escalation"]}'),
  ('customer_relationship_behavioral', 'Describe a time you managed a difficult client escalation under time pressure.',
   'Walk through how you handled the pressure and what the resolution looked like.',
   '{"difficulty":"mid","tags":["escalation","pressure"]}'),
  ('customer_relationship_behavioral', 'Tell me about a time you disagreed with an account manager or salesperson about what a client actually needed.',
   'Describe how you navigated the disagreement and what you ultimately did.',
   '{"difficulty":"senior","tags":["cross_functional","influence"]}'),

  -- ---------- technical_troubleshooting ----------
  ('technical_troubleshooting', 'A client reports a sudden drop in tracked conversions this morning. Walk through how you would investigate.',
   'Describe your diagnostic process step by step.',
   '{"difficulty":"mid","tags":["debugging","tracking"]}'),
  ('technical_troubleshooting', 'A publisher''s tag appears to have stopped firing for a subset of traffic. How would you diagnose this?',
   'Describe how you would narrow down the cause.',
   '{"difficulty":"mid","tags":["tags","publishers"]}'),
  ('technical_troubleshooting', 'A client''s reported numbers do not match RTB House''s own dashboard. How would you figure out where the discrepancy comes from?',
   'Walk through your approach to isolating the discrepancy.',
   '{"difficulty":"senior","tags":["discrepancy","reporting"]}'),

  -- ---------- data_and_campaign_analysis ----------
  ('data_and_campaign_analysis', 'A campaign''s cost-per-acquisition rose 30% week over week. How would you analyze it?',
   'Describe your analysis approach and the metrics you would look at.',
   '{"difficulty":"mid","tags":["metrics","cpa"]}'),
  ('data_and_campaign_analysis', 'How would you explain a sudden performance dip to a non-technical client?',
   'Describe both your analysis and how you would communicate it.',
   '{"difficulty":"mid","tags":["communication","performance"]}'),
  ('data_and_campaign_analysis', 'A client asks which of their five active campaigns is actually driving incremental revenue. How would you approach answering that?',
   'Describe your analysis plan.',
   '{"difficulty":"senior","tags":["incrementality","analysis"]}'),

  -- ---------- account_strategy_growth ----------
  ('account_strategy_growth', 'You manage a portfolio of 15 client accounts. How do you decide where to spend your time this week?',
   'Describe your prioritization approach.',
   '{"difficulty":"mid","tags":["prioritization","portfolio"]}'),
  ('account_strategy_growth', 'A client''s contract is up for renewal but their results have been mixed. How do you approach the renewal conversation?',
   'Describe how you would prepare for and handle this conversation.',
   '{"difficulty":"senior","tags":["renewal","account_growth"]}'),
  ('account_strategy_growth', 'A client asks for a technical change that you believe will not actually help their stated business goal. How do you handle this?',
   'Describe how you would navigate this conversation.',
   '{"difficulty":"senior","tags":["business_objectives","pushback"]}'),

  -- ---------- technical_communication ----------
  ('technical_communication', 'Explain how deep-learning-based real-time bidding works to a marketing director with no technical background.',
   'Give the explanation as you would actually say it to the client.',
   '{"difficulty":"mid","tags":["explaining","deep_learning"]}'),
  ('technical_communication', 'A client asks why their ad frequency seems too high. How do you explain frequency capping and the trade-offs involved?',
   'Give the explanation as you would actually say it to the client.',
   '{"difficulty":"mid","tags":["explaining","frequency_capping"]}'),
  ('technical_communication', 'A prospective client asks how RTB House''s approach is different from a competitor like Criteo. How would you explain this simply?',
   'Give the explanation as you would actually say it to the client.',
   '{"difficulty":"senior","tags":["positioning","competitors"]}')
) as v(type, title, description, metadata)
where not exists (
  select 1 from questions q where q.title = v.title
);
