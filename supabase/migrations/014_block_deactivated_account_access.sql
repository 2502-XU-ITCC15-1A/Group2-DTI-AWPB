-- Deactivated users should not keep app/data access through an existing
-- Supabase session. Admin policies already require active admins; this adds
-- the same active-user check to owner-level policies.

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own entries" ON entries;
CREATE POLICY "Users can view own entries" ON entries
    FOR SELECT USING (owner_id = auth.uid() AND public.is_active_user());

DROP POLICY IF EXISTS "Users can insert own entries" ON entries;
CREATE POLICY "Users can insert own entries" ON entries
    FOR INSERT WITH CHECK (owner_id = auth.uid() AND public.is_active_user());

DROP POLICY IF EXISTS "Users can update own entries" ON entries;
CREATE POLICY "Users can update own entries" ON entries
    FOR UPDATE USING (
        owner_id = auth.uid()
        AND public.is_active_user()
        AND (status = 'draft' OR status = 'Returned')
    );

DROP POLICY IF EXISTS "Users can delete own draft entries" ON entries;
CREATE POLICY "Users can delete own draft entries" ON entries
    FOR DELETE USING (
        owner_id = auth.uid()
        AND public.is_active_user()
        AND status = 'draft'
    );

DROP POLICY IF EXISTS "Users can view own entry targets" ON monthly_targets;
CREATE POLICY "Users can view own entry targets" ON monthly_targets
    FOR SELECT USING (
        public.is_active_user()
        AND EXISTS (
            SELECT 1 FROM entries
            WHERE id = entry_id AND owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert own entry targets" ON monthly_targets;
CREATE POLICY "Users can insert own entry targets" ON monthly_targets
    FOR INSERT WITH CHECK (
        public.is_active_user()
        AND EXISTS (
            SELECT 1 FROM entries
            WHERE id = entry_id AND owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update own entry targets" ON monthly_targets;
CREATE POLICY "Users can update own entry targets" ON monthly_targets
    FOR UPDATE USING (
        public.is_active_user()
        AND EXISTS (
            SELECT 1 FROM entries
            WHERE id = entry_id AND owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete own entry targets" ON monthly_targets;
CREATE POLICY "Users can delete own entry targets" ON monthly_targets
    FOR DELETE USING (
        public.is_active_user()
        AND EXISTS (
            SELECT 1 FROM entries
            WHERE id = entry_id AND owner_id = auth.uid()
        )
    );

DO $$
BEGIN
    IF to_regclass('public.awpb_entries') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Encoders view own entries" ON public.awpb_entries;
        CREATE POLICY "Encoders view own entries" ON public.awpb_entries
            FOR SELECT USING (owner_id = auth.uid() AND public.is_active_user());

        DROP POLICY IF EXISTS "Encoders insert own entries" ON public.awpb_entries;
        CREATE POLICY "Encoders insert own entries" ON public.awpb_entries
            FOR INSERT WITH CHECK (owner_id = auth.uid() AND public.is_active_user());

        DROP POLICY IF EXISTS "Encoders update own returned entries" ON public.awpb_entries;
        CREATE POLICY "Encoders update own returned entries" ON public.awpb_entries
            FOR UPDATE USING (
                owner_id = auth.uid()
                AND public.is_active_user()
                AND status = 'Returned'
            );

        DROP POLICY IF EXISTS "Encoders delete own entries" ON public.awpb_entries;
        CREATE POLICY "Encoders delete own entries" ON public.awpb_entries
            FOR DELETE USING (owner_id = auth.uid() AND public.is_active_user());
    END IF;
END;
$$;
