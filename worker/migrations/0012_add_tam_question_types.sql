-- Adds RTB House as a third company (2026-08-26) — the first one prepping
-- for a different role archetype than Amazon/Make: Technical Account
-- Manager, not Product Manager. The existing 7 question types
-- (product_sense, analytical_execution, etc.) are PM interview archetypes
-- and don't fit a TAM interview, so this widens questions.type's CHECK
-- constraint to also allow 5 new TAM-specific types. See
-- docs/rubrics-rtbhouse.json for the rubric behind them.
--
-- Postgres has no "alter constraint" — dropping and recreating is the
-- standard way to widen a CHECK constraint's allowed value set. This is
-- purely additive (every previously-valid value is still valid), so no
-- existing row can violate the new constraint.
alter table questions drop constraint questions_type_check;
alter table questions add constraint questions_type_check check (type in (
  'product_sense',
  'analytical_execution',
  'leadership_principles_behavioral',
  'strategy_business',
  'estimation',
  'system_design',
  'ai_pm',
  'customer_relationship_behavioral',
  'technical_troubleshooting',
  'data_and_campaign_analysis',
  'account_strategy_growth',
  'technical_communication'
));
