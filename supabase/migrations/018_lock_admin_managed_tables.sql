-- Keep reference data readable for active signed-in users, but only allow
-- active admins to manage dropdown/template and submission-window records.

DO $$
DECLARE
    v_table_name TEXT;
    v_tables TEXT[] := ARRAY[
        'units',
        'components',
        'sub_components',
        'key_activities',
        'sub_activities',
        'performance_indicators',
        'submission_windows'
    ];
BEGIN
    FOREACH v_table_name IN ARRAY v_tables LOOP
        IF to_regclass(format('public.%I', v_table_name)) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'active_users_read_' || v_table_name, v_table_name);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_active_user())',
            'active_users_read_' || v_table_name,
            v_table_name
        );

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admins_insert_' || v_table_name, v_table_name);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())',
            'admins_insert_' || v_table_name,
            v_table_name
        );

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admins_update_' || v_table_name, v_table_name);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
            'admins_update_' || v_table_name,
            v_table_name
        );

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'admins_delete_' || v_table_name, v_table_name);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin())',
            'admins_delete_' || v_table_name,
            v_table_name
        );

        EXECUTE format('REVOKE ALL ON public.%I FROM anon', v_table_name);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', v_table_name);
    END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
