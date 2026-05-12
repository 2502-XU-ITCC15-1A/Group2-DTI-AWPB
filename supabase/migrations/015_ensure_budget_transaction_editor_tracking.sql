-- Ensure allocation movement rows can always record who made the edit, even
-- on projects where older actor-tracking migrations were skipped.

ALTER TABLE IF EXISTS budget_transactions
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES profiles(id);

ALTER TABLE IF EXISTS budget_transactions
ADD COLUMN IF NOT EXISTS actor_name TEXT;

DO $$
BEGIN
    IF to_regclass('public.budget_transactions') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_budget_transactions_actor_id
        ON public.budget_transactions(actor_id);
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
