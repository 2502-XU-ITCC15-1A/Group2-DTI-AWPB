-- Store enough budget transaction context to display actors reliably and
-- prevent duplicate approval deductions for the same entry.

ALTER TABLE IF EXISTS budget_transactions
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES profiles(id);

ALTER TABLE IF EXISTS budget_transactions
ADD COLUMN IF NOT EXISTS actor_name TEXT;

ALTER TABLE IF EXISTS budget_transactions
ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES entries(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF to_regclass('public.budget_transactions') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_budget_transactions_actor_id
        ON public.budget_transactions(actor_id);

        CREATE INDEX IF NOT EXISTS idx_budget_transactions_entry_id
        ON public.budget_transactions(entry_id);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_transactions_single_approval_deduction
        ON public.budget_transactions(entry_id)
        WHERE entry_id IS NOT NULL
          AND type = 'DEDUCTED'
          AND description LIKE 'Approved:%';
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
