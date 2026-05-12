-- Track which admin created allocation movement records.

ALTER TABLE IF EXISTS budget_transactions
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_budget_transactions_actor_id
ON budget_transactions(actor_id);
