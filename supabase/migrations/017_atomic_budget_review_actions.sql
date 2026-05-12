-- Make admin review actions atomic so entry status and allocation movements
-- cannot get out of sync.

CREATE TABLE IF NOT EXISTS public.budget_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('ADDED', 'DEDUCTED')),
    description TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    entry_id UUID REFERENCES public.entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budget_transactions
ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2);

ALTER TABLE public.budget_transactions
ADD COLUMN IF NOT EXISTS type TEXT;

ALTER TABLE public.budget_transactions
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

ALTER TABLE public.budget_transactions
ADD COLUMN IF NOT EXISTS unit TEXT;

ALTER TABLE public.budget_transactions
ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.budget_transactions
ADD COLUMN IF NOT EXISTS actor_name TEXT;

ALTER TABLE public.budget_transactions
ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES public.entries(id) ON DELETE SET NULL;

ALTER TABLE public.budget_transactions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    ALTER TABLE public.budget_transactions
    ADD CONSTRAINT budget_transactions_amount_positive
    CHECK (amount > 0) NOT VALID;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
    ALTER TABLE public.budget_transactions
    ADD CONSTRAINT budget_transactions_type_valid
    CHECK (type IN ('ADDED', 'DEDUCTED')) NOT VALID;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$$;

DROP INDEX IF EXISTS public.idx_budget_transactions_single_approval_deduction;

CREATE INDEX IF NOT EXISTS idx_budget_transactions_actor_id
ON public.budget_transactions(actor_id);

CREATE INDEX IF NOT EXISTS idx_budget_transactions_entry_id
ON public.budget_transactions(entry_id);

CREATE INDEX IF NOT EXISTS idx_budget_transactions_unit_created_at
ON public.budget_transactions(unit, created_at DESC);

ALTER TABLE public.budget_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view budget transactions" ON public.budget_transactions;
CREATE POLICY "Admins can view budget transactions" ON public.budget_transactions
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert budget transactions" ON public.budget_transactions;
CREATE POLICY "Admins can insert budget transactions" ON public.budget_transactions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update budget transactions" ON public.budget_transactions;
CREATE POLICY "Admins can update budget transactions" ON public.budget_transactions
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete budget transactions" ON public.budget_transactions;
CREATE POLICY "Admins can delete budget transactions" ON public.budget_transactions
    FOR DELETE TO authenticated
    USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_entry(
    p_entry_id UUID,
    p_note TEXT DEFAULT ''
)
RETURNS public.entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_entry public.entries;
    v_updated public.entries;
    v_unit TEXT;
    v_amount NUMERIC(14,2);
    v_remaining NUMERIC(14,2);
    v_actor_name TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active admins can approve entries.'
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

    IF lower(trim(v_entry.status::TEXT)) = 'approved' THEN
        RAISE EXCEPTION 'Entry is already approved.'
            USING ERRCODE = '23505';
    END IF;

    SELECT upper(trim(COALESCE(code, name, '')))
    INTO v_unit
    FROM public.units
    WHERE id = v_entry.unit_id;

    IF COALESCE(v_unit, '') = '' THEN
        RAISE EXCEPTION 'Entry unit was not found.'
            USING ERRCODE = 'P0002';
    END IF;

    SELECT round(COALESCE(SUM(COALESCE(target_quantity, 0) * COALESCE(v_entry.unit_cost, 0)), 0), 2)
    INTO v_amount
    FROM public.monthly_targets
    WHERE entry_id = p_entry_id;

    SELECT COALESCE(
        SUM(
            CASE
                WHEN type = 'ADDED' THEN amount
                WHEN type = 'DEDUCTED' THEN -amount
                ELSE 0
            END
        ),
        0
    )
    INTO v_remaining
    FROM public.budget_transactions
    WHERE upper(trim(unit)) = v_unit;

    IF v_amount > v_remaining THEN
        RAISE EXCEPTION 'Insufficient allocation. Need %, remaining %.', v_amount, v_remaining
            USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), auth.uid()::TEXT)
    INTO v_actor_name
    FROM public.profiles
    WHERE id = auth.uid();

    v_actor_name := COALESCE(v_actor_name, auth.uid()::TEXT);

    IF v_amount > 0 THEN
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
            v_amount,
            'DEDUCTED',
            'Approved: ' || COALESCE(v_entry.title_of_activities, 'Untitled entry'),
            v_unit,
            auth.uid(),
            v_actor_name,
            p_entry_id
        );
    END IF;

    UPDATE public.entries
    SET
        status = 'Approved'::public.entry_status,
        admin_comment = COALESCE(p_note, ''),
        review_date = NOW(),
        reviewer_id = auth.uid()
    WHERE id = p_entry_id
    RETURNING * INTO v_updated;

    RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_entry_review_status(
    p_entry_id UUID,
    p_status TEXT,
    p_note TEXT DEFAULT ''
)
RETURNS public.entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_entry public.entries;
    v_updated public.entries;
    v_unit TEXT;
    v_current_amount NUMERIC(14,2);
    v_reversal_amount NUMERIC(14,2);
    v_actor_name TEXT;
    v_next_status public.entry_status;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active admins can review entries.'
            USING ERRCODE = '42501';
    END IF;

    IF p_entry_id IS NULL THEN
        RAISE EXCEPTION 'Entry id is required.'
            USING ERRCODE = '22023';
    END IF;

    IF p_status NOT IN ('Returned', 'Rejected') THEN
        RAISE EXCEPTION 'Review status must be Returned or Rejected.'
            USING ERRCODE = '22023';
    END IF;

    v_next_status := p_status::public.entry_status;

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
                    '" changed from ' || v_entry.status::TEXT || ' to ' || p_status,
                v_unit,
                auth.uid(),
                v_actor_name,
                p_entry_id
            );
        END IF;
    END IF;

    UPDATE public.entries
    SET
        status = v_next_status,
        admin_comment = COALESCE(p_note, ''),
        review_date = NOW(),
        reviewer_id = auth.uid()
    WHERE id = p_entry_id
    RETURNING * INTO v_updated;

    RETURN v_updated;
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

    DELETE FROM public.entries
    WHERE id = p_entry_id;

    RETURN p_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_entry(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_entry_review_status(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_review_entry(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_approve_entry(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_entry_review_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_review_entry(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
