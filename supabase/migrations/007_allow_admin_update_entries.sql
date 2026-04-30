-- Allow admins to share the same update policy as encoders without being the owner
ALTER POLICY "Users can update own entries" ON entries
    WITH CHECK (
        public.is_admin()
        OR (
            owner_id = auth.uid()
            AND (status = 'draft' OR status = 'Returned')
        )
    );
