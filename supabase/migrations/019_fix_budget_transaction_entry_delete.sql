-- Existing deployed databases may still have budget_transactions.entry_id
-- pointing to entries with the default NO ACTION foreign key. That blocks
-- deleting entries that have approval/reversal ledger rows. Rebuild the FK so
-- ledger rows are preserved while their deleted entry reference is cleared.

ALTER TABLE IF EXISTS public.budget_transactions
ADD COLUMN IF NOT EXISTS entry_id UUID;

ALTER TABLE IF EXISTS public.budget_transactions
ALTER COLUMN entry_id DROP NOT NULL;

DO $$
DECLARE
    v_constraint RECORD;
BEGIN
    IF to_regclass('public.budget_transactions') IS NULL THEN
        RETURN;
    END IF;

    FOR v_constraint IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.budget_transactions'::regclass
            AND c.confrelid = 'public.entries'::regclass
            AND c.contype = 'f'
            AND EXISTS (
                SELECT 1
                FROM unnest(c.conkey) AS key(attnum)
                JOIN pg_attribute a
                    ON a.attrelid = c.conrelid
                    AND a.attnum = key.attnum
                WHERE a.attname = 'entry_id'
            )
    LOOP
        EXECUTE format(
            'ALTER TABLE public.budget_transactions DROP CONSTRAINT %I',
            v_constraint.conname
        );
    END LOOP;

    ALTER TABLE public.budget_transactions
    ADD CONSTRAINT budget_transactions_entry_id_fkey
    FOREIGN KEY (entry_id)
    REFERENCES public.entries(id)
    ON DELETE SET NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_review_entry(
    p_entry_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_entry public.entries;
    v_unit TEXT;
    v_current_amount NUMERIC(14,2);
    v_reversal_amount NUMERIC(14,2);
    v_actor_name TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active admins can delete entries.'
            USING ERRCODE = '42501';
    END IF;

    IF p_entry_id IS NULL THEN
        RAISE EXCEPTION 'Entry id is required.'
            USING ERRCODE = '22023';
    END IF;

    LOCK TABLE public.budget_transactions IN SHARE ROW EXCLUSIVE MODE;

    SELECT *
    INTO v_entry
    FROM public.entries
    WHERE id = p_entry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Entry was not found.'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT upper(trim(COALESCE(code, name, '')))
    INTO v_unit
    FROM public.units
    WHERE id = v_entry.unit_id;

    SELECT round(COALESCE(SUM(COALESCE(target_quantity, 0) * COALESCE(v_entry.unit_cost, 0)), 0), 2)
    INTO v_current_amount
    FROM public.monthly_targets
    WHERE entry_id = p_entry_id;

    IF lower(trim(v_entry.status::TEXT)) = 'approved' THEN
        SELECT round(COALESCE(
            SUM(
                CASE
                    WHEN type = 'DEDUCTED' THEN amount
                    WHEN type = 'ADDED' THEN -amount
                    ELSE 0
                END
            ),
            0
        ), 2)
        INTO v_reversal_amount
        FROM public.budget_transactions
        WHERE entry_id = p_entry_id;

        IF v_reversal_amount <= 0 THEN
            v_reversal_amount := v_current_amount;
        END IF;

        SELECT COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), auth.uid()::TEXT)
        INTO v_actor_name
        FROM public.profiles
        WHERE id = auth.uid();

        v_actor_name := COALESCE(v_actor_name, auth.uid()::TEXT);

        IF v_reversal_amount > 0 THEN
            INSERT INTO public.budget_transactions (
                amount,
                type,
                description,
                unit,
                actor_id,
                actor_name,
                entry_id
            )
            VALUES (
                v_reversal_amount,
                'ADDED',
                'REVERSAL: "' || COALESCE(v_entry.title_of_activities, 'Untitled entry') ||
                    '" deleted after approval',
                v_unit,
                auth.uid(),
                v_actor_name,
                p_entry_id
            );
        END IF;
    END IF;

    UPDATE public.budget_transactions
    SET entry_id = NULL
    WHERE entry_id = p_entry_id;

    DELETE FROM public.entries
    WHERE id = p_entry_id;

    RETURN p_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_review_entry(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_review_entry(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
