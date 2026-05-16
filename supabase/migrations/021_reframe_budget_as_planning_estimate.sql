-- Reframe AWPB review budgeting as planning guidance instead of monitoring.
-- Admins can approve entries even when approved totals exceed the current
-- planning estimate. Estimate variance is surfaced for later budget adjustment.

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
            'Approved plan: ' || COALESCE(v_entry.title_of_activities, 'Untitled entry'),
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

REVOKE ALL ON FUNCTION public.admin_approve_entry(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_entry(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_unit_planning_budget_stats()
RETURNS TABLE (
    unit TEXT,
    planning_estimate NUMERIC(14,2),
    approved_total NUMERIC(14,2),
    variance NUMERIC(14,2),
    approved_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
    WITH requester AS (
        SELECT public.is_active_user() AS allowed
    ),
    active_units AS (
        SELECT upper(trim(COALESCE(code, name, ''))) AS unit
        FROM public.units
        WHERE is_active = true
          AND COALESCE(code, name, '') <> ''
    ),
    estimate_movements AS (
        SELECT
            upper(trim(unit)) AS unit,
            round(
                COALESCE(
                    SUM(
                        CASE
                            WHEN type = 'ADDED' THEN amount
                            WHEN type = 'DEDUCTED' THEN -amount
                            ELSE 0
                        END
                    ),
                    0
                ),
                2
            ) AS planning_estimate
        FROM public.budget_transactions
        WHERE entry_id IS NULL
        GROUP BY upper(trim(unit))
    ),
    entry_amounts AS (
        SELECT
            e.id,
            upper(trim(COALESCE(u.code, u.name, ''))) AS unit,
            round(COALESCE(SUM(COALESCE(mt.target_quantity, 0) * COALESCE(e.unit_cost, 0)), 0), 2) AS amount
        FROM public.entries e
        JOIN public.units u ON u.id = e.unit_id
        LEFT JOIN public.monthly_targets mt ON mt.entry_id = e.id
        WHERE lower(trim(e.status::TEXT)) = 'approved'
        GROUP BY e.id, u.code, u.name
    ),
    approved_by_unit AS (
        SELECT
            unit,
            round(COALESCE(SUM(amount), 0), 2) AS approved_total,
            COUNT(*) AS approved_count
        FROM entry_amounts
        GROUP BY unit
    )
    SELECT
        u.unit,
        COALESCE(m.planning_estimate, 0)::NUMERIC(14,2) AS planning_estimate,
        COALESCE(a.approved_total, 0)::NUMERIC(14,2) AS approved_total,
        (COALESCE(m.planning_estimate, 0) - COALESCE(a.approved_total, 0))::NUMERIC(14,2) AS variance,
        COALESCE(a.approved_count, 0)::BIGINT AS approved_count
    FROM active_units u
    CROSS JOIN requester r
    LEFT JOIN estimate_movements m ON m.unit = u.unit
    LEFT JOIN approved_by_unit a ON a.unit = u.unit
    WHERE r.allowed
    ORDER BY
        CASE u.unit
            WHEN 'MOR' THEN 1
            WHEN 'LDN' THEN 2
            WHEN 'BKD' THEN 3
            WHEN 'RCU' THEN 4
            ELSE 99
        END,
        u.unit;
$$;

REVOKE ALL ON FUNCTION public.get_unit_planning_budget_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unit_planning_budget_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
