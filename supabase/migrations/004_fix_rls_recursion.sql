-- Fix infinite recursion in RLS policies
-- Root cause: admin policies on profiles/entries queried the profiles table
-- directly, which re-triggered the same policies → infinite loop.
-- Fix: use a SECURITY DEFINER function that bypasses RLS when checking role.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Profiles ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (public.is_admin());

-- ── Entries ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all entries" ON entries;
DROP POLICY IF EXISTS "Admins can update all entries" ON entries;
DROP POLICY IF EXISTS "Admins can delete any entry" ON entries;

CREATE POLICY "Admins can view all entries" ON entries
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all entries" ON entries
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete any entry" ON entries
    FOR DELETE USING (public.is_admin());

-- ── Monthly Targets ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all targets" ON monthly_targets;
DROP POLICY IF EXISTS "Admins can update all targets" ON monthly_targets;
DROP POLICY IF EXISTS "Admins can delete any targets" ON monthly_targets;

CREATE POLICY "Admins can view all targets" ON monthly_targets
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all targets" ON monthly_targets
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete any targets" ON monthly_targets
    FOR DELETE USING (public.is_admin());
