-- Simplified entries table that stores string values directly (no UUID FK lookups)
-- This matches the frontend data model exactly.

CREATE TABLE awpb_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    owner_username TEXT NOT NULL DEFAULT '',
    owner_full_name TEXT NOT NULL DEFAULT '',
    planning_year TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    component TEXT NOT NULL DEFAULT '',
    sub_component TEXT NOT NULL DEFAULT '',
    key_activity TEXT NOT NULL DEFAULT '',
    no TEXT NOT NULL DEFAULT '',
    performance_indicator TEXT NOT NULL DEFAULT '',
    sub_activity TEXT NOT NULL DEFAULT '',
    title_of_activities TEXT NOT NULL,
    unit_cost DECIMAL(12,2) DEFAULT 0,
    monthly_breakdown JSONB DEFAULT '[]',
    grand_total DECIMAL(12,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending Review',
    admin_comment TEXT DEFAULT '',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    resubmitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE awpb_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Encoders view own entries" ON awpb_entries
    FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Admins view all entries" ON awpb_entries
    FOR SELECT USING (public.is_admin());
CREATE POLICY "Encoders insert own entries" ON awpb_entries
    FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Encoders update own returned entries" ON awpb_entries
    FOR UPDATE USING (owner_id = auth.uid() AND status = 'Returned');
CREATE POLICY "Admins update all entries" ON awpb_entries
    FOR UPDATE USING (public.is_admin());
CREATE POLICY "Encoders delete own entries" ON awpb_entries
    FOR DELETE USING (owner_id = auth.uid());
CREATE POLICY "Admins delete any entry" ON awpb_entries
    FOR DELETE USING (public.is_admin());

CREATE TRIGGER update_awpb_entries_updated_at
    BEFORE UPDATE ON awpb_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert admin profile (uses ON CONFLICT so it's safe to re-run)
INSERT INTO profiles (id, username, full_name, email, role, status)
VALUES (
    '9aac5906-89c6-4355-acbf-ff51cdc09dde',
    'adm_admin',
    'Default Admin',
    'adm_admin@dti.gov.ph',
    'admin',
    'active'
) ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    status = EXCLUDED.status;
