-- Allow active encoders to remove their own entries while they are still pending review.
DROP POLICY IF EXISTS "Users can delete own draft entries" ON public.entries;
DROP POLICY IF EXISTS "Users can delete own pending entries" ON public.entries;

CREATE POLICY "Users can delete own pending entries" ON public.entries
    FOR DELETE USING (
        owner_id = auth.uid()
        AND public.is_active_user()
        AND status IN ('draft', 'Pending Review')
    );
