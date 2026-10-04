-- Phase 2 seed data: >=5 real questions per type for product_sense,
-- analytical_execution, leadership_principles_behavioral.
-- Idempotent-ish: guarded by NOT EXISTS on title so re-running doesn't duplicate.

insert into questions (company, type, title, description, metadata)
select 'amazon', v.type, v.title, v.description, v.metadata::jsonb
from (values
  ('product_sense', 'Design a new feature to improve the Amazon product detail page.',
   'You are a PM on the Amazon Retail team. How would you design a new feature to help customers make better purchase decisions on the PDP?',
   '{"difficulty":"mid","tags":["customer_obsession","conversion"]}'),
  ('product_sense', 'Design a subscription box service for pet owners on Amazon.',
   'Amazon wants to launch a recurring subscription box for pet supplies. Walk through how you would design the v1 experience, from discovery to renewal.',
   '{"difficulty":"mid","tags":["subscriptions","new_product"]}'),
  ('product_sense', 'How would you improve the Amazon returns experience?',
   'Customers frequently complain that initiating and tracking a return is confusing. Design a feature to make this easier.',
   '{"difficulty":"mid","tags":["post_purchase","customer_obsession"]}'),
  ('product_sense', 'Design a feature to help Amazon customers discover sustainable products.',
   'Amazon wants to help environmentally-conscious shoppers find and choose more sustainable products. Design a feature for this.',
   '{"difficulty":"senior","tags":["discovery","sustainability"]}'),
  ('product_sense', 'Design a new onboarding experience for first-time Alexa users.',
   'Many new Echo device owners never go beyond basic voice commands. Design an onboarding experience that gets them to real habitual usage.',
   '{"difficulty":"mid","tags":["onboarding","alexa"]}'),
  ('product_sense', 'Design an MVP for small businesses to set up a store within Amazon''s ecosystem.',
   'Amazon wants to help small business owners launch a branded storefront on Amazon with minimal setup effort. Design the v1 experience.',
   '{"difficulty":"senior","tags":["marketplace","sellers"]}'),

  ('analytical_execution', 'Sign-ups for Amazon Fresh dropped by 20%.',
   'How would you investigate the drop and decide what to do next?',
   '{"difficulty":"mid","tags":["metrics","debugging"]}'),
  ('analytical_execution', 'Average order value on Amazon.com decreased 5% quarter over quarter.',
   'Walk through how you would investigate the cause and what actions you might recommend.',
   '{"difficulty":"mid","tags":["metrics","revenue"]}'),
  ('analytical_execution', 'Video completion rates dropped for a specific content category on Prime Video.',
   'You are the PM for Prime Video. Completion rates for a specific genre have dropped noticeably over the last month. Walk through your approach.',
   '{"difficulty":"senior","tags":["metrics","prime_video"]}'),
  ('analytical_execution', 'Customer support contact rate for a shipping issue tripled last month.',
   'How would you diagnose the root cause, and how would you decide whether and how to respond?',
   '{"difficulty":"mid","tags":["metrics","operations"]}'),
  ('analytical_execution', 'How would you measure the success of a new "buy again" feature on the homepage?',
   'Amazon just launched a "buy again" module on the homepage. Define how you would measure whether it is working.',
   '{"difficulty":"mid","tags":["metrics","experimentation"]}'),
  ('analytical_execution', 'Mobile app search conversion is 30% lower than desktop.',
   'Conversion rate on mobile app search results pages is meaningfully lower than on desktop. How do you investigate?',
   '{"difficulty":"senior","tags":["metrics","mobile"]}'),

  ('leadership_principles_behavioral', 'Tell me about a time you disagreed with your manager.',
   'Walk through the situation, what you did, and the outcome.',
   '{"difficulty":"mid","tags":["Have Backbone; Disagree and Commit"]}'),
  ('leadership_principles_behavioral', 'Tell me about a time you had to make a decision with incomplete information.',
   'Describe the situation, how you approached the decision, and what happened as a result.',
   '{"difficulty":"mid","tags":["Bias for Action","Are Right, A Lot"]}'),
  ('leadership_principles_behavioral', 'Describe a time you delivered a project under a tight deadline with limited resources.',
   'Walk through the constraints you faced and how you still delivered results.',
   '{"difficulty":"mid","tags":["Deliver Results","Bias for Action"]}'),
  ('leadership_principles_behavioral', 'Tell me about a time you took ownership of a problem that wasn''t originally your responsibility.',
   'Describe the situation, what you did, and the impact.',
   '{"difficulty":"mid","tags":["Ownership"]}'),
  ('leadership_principles_behavioral', 'Tell me about a time you received critical feedback. How did you respond?',
   'Describe the feedback, your reaction, and what you changed afterward.',
   '{"difficulty":"mid","tags":["Earn Trust","Learn and Be Curious"]}'),
  ('leadership_principles_behavioral', 'Describe a time you had to influence a team or stakeholder without direct authority.',
   'Walk through how you built buy-in and what the outcome was.',
   '{"difficulty":"senior","tags":["Earn Trust","Ownership"]}')
) as v(type, title, description, metadata)
where not exists (
  select 1 from questions q where q.title = v.title
);
