-- Fills the last two previously-empty question types (roadmap.md "Next" phase).
-- Coverage is modeled on the standard Exponent / IGotAnOffer question banks but
-- every prompt is written in our own words (see docs/ai-rules.md — don't copy
-- source material verbatim). Rubrics for both types were added to
-- docs/rubrics-amazon.json in the same change.
--   system_design (TPM-flavored, not SDE-level): 0 -> 10
--   ai_pm: 0 -> 10
-- Idempotent: guarded by NOT EXISTS on title so re-running doesn't duplicate.

insert into questions (company, type, title, description, metadata)
select 'amazon', v.type, v.title, v.description, v.metadata::jsonb
from (values
  -- ---------- system_design (new, +10) ----------
  ('system_design', 'Design a system to detect fake product reviews at scale.',
   'Amazon wants to automatically detect and remove fake or incentivized reviews. Design the system at a high level.',
   '{"difficulty":"senior","tags":["trust","fraud_detection"]}'),
  ('system_design', 'Design a notification system that reliably reaches millions of customers.',
   'Design a system that can send order/delivery notifications to millions of customers reliably and with low latency.',
   '{"difficulty":"mid","tags":["messaging","scale"]}'),
  ('system_design', 'Design a system to handle Prime Day traffic spikes.',
   'Prime Day traffic is many times normal load for a short window. Design a system approach to handle it without degrading customer experience.',
   '{"difficulty":"senior","tags":["scalability","peak_load"]}'),
  ('system_design', 'Design an inventory system that keeps stock counts accurate across warehouses.',
   'Design a system that keeps product stock counts accurate in near real time across many warehouses and sales channels.',
   '{"difficulty":"senior","tags":["inventory","consistency"]}'),
  ('system_design', 'Design a system to detect fraudulent orders in real time.',
   'Design a system that flags likely-fraudulent orders before they ship, without meaningfully slowing down checkout.',
   '{"difficulty":"senior","tags":["fraud_detection","real_time"]}'),
  ('system_design', 'Design a real-time package tracking system.',
   'Design the system behind letting a customer see the live location/status of their package as it moves through the delivery network.',
   '{"difficulty":"mid","tags":["logistics","real_time"]}'),
  ('system_design', 'Design a search autocomplete system for Amazon.com.',
   'Design a system that suggests search terms as a customer types, at Amazon''s scale and latency requirements.',
   '{"difficulty":"mid","tags":["search","latency"]}'),
  ('system_design', 'Design a system to personalize the Amazon homepage for each customer.',
   'Design the high-level system that decides what each customer sees on the Amazon homepage.',
   '{"difficulty":"senior","tags":["personalization","architecture"]}'),
  ('system_design', 'Design a system that lets sellers upload and manage millions of product listings.',
   'Design the system that lets third-party sellers bulk-upload, update, and manage large product catalogs.',
   '{"difficulty":"mid","tags":["marketplace","catalog"]}'),
  ('system_design', 'Design a system to prevent duplicate orders from being placed.',
   'Customers occasionally double-click "place order" or retry after a slow response, risking duplicate orders. Design a system to prevent this reliably.',
   '{"difficulty":"mid","tags":["reliability","checkout"]}'),

  -- ---------- ai_pm (new, +10) ----------
  ('ai_pm', 'Design an AI feature to help customers find products using natural language.',
   'Customers often struggle to find the right product with keyword search alone. Design an AI-powered feature that lets them describe what they want in plain language.',
   '{"difficulty":"senior","tags":["search","nlp"]}'),
  ('ai_pm', 'How would you decide whether a recommendation model change is ready to launch?',
   'The recommendations team has a new model that looks better in offline testing. Walk through how you would decide whether to launch it.',
   '{"difficulty":"senior","tags":["evaluation","launch_decision"]}'),
  ('ai_pm', 'Should Amazon use AI to auto-generate product descriptions for sellers?',
   'Many third-party sellers submit poor-quality product descriptions. Evaluate whether Amazon should offer an AI feature to auto-generate them.',
   '{"difficulty":"mid","tags":["generative_ai","marketplace"]}'),
  ('ai_pm', 'How would you build and evaluate a model to detect counterfeit listings?',
   'Design an ML-based approach to flag likely counterfeit product listings, and describe how you would evaluate whether it works.',
   '{"difficulty":"senior","tags":["trust","fraud_detection"]}'),
  ('ai_pm', 'Amazon wants to launch an AI shopping assistant. What would you build and how would you evaluate it?',
   'Design the v1 of an AI assistant that helps customers shop, and describe how you would measure whether it is actually helping.',
   '{"difficulty":"senior","tags":["generative_ai","new_product"]}'),
  ('ai_pm', 'Design an AI-powered returns-fraud detection feature.',
   'Some customers abuse the returns process (e.g. returning used or different items). Design an AI feature to detect this without punishing honest customers.',
   '{"difficulty":"senior","tags":["fraud_detection","responsible_ai"]}'),
  ('ai_pm', 'How would you build a model to predict which Prime members are at risk of not renewing?',
   'Design an approach to predict Prime membership churn, and describe what you would do with that prediction.',
   '{"difficulty":"mid","tags":["retention","ml_model"]}'),
  ('ai_pm', 'Amazon wants to use generative AI to write product review summaries. How would you approach this?',
   'Design a feature that summarizes hundreds of customer reviews into a short, trustworthy summary using generative AI.',
   '{"difficulty":"senior","tags":["generative_ai","trust"]}'),
  ('ai_pm', 'How would you think about responsible AI risks for an AI-powered pricing tool?',
   'Amazon is building an AI tool that recommends prices to sellers. What responsible-AI risks would you watch for, and how would you guard against them?',
   '{"difficulty":"senior","tags":["responsible_ai","pricing"]}'),
  ('ai_pm', 'Design an AI feature that helps sellers optimize their product listings.',
   'Design an AI-powered tool that gives third-party sellers concrete suggestions to improve their product listings (titles, images, descriptions).',
   '{"difficulty":"mid","tags":["marketplace","generative_ai"]}')
) as v(type, title, description, metadata)
where not exists (
  select 1 from questions q where q.title = v.title
);
