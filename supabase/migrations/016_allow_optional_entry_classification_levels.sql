-- Some client templates intentionally stop at higher classification levels.
-- Allow submitted entries to keep those missing levels as NULL instead of
-- blocking submission when the UI selection is N/A.

ALTER TABLE IF EXISTS entries
ALTER COLUMN sub_component_id DROP NOT NULL;

ALTER TABLE IF EXISTS entries
ALTER COLUMN key_activity_id DROP NOT NULL;

CREATE OR REPLACE VIEW entries_with_targets AS
SELECT
    e.*,
    json_agg(
        json_build_object(
            'month', mt.month,
            'target_quantity', mt.target_quantity
        ) ORDER BY mt.month
    ) FILTER (WHERE mt.id IS NOT NULL) as monthly_targets
FROM entries e
LEFT JOIN monthly_targets mt ON e.id = mt.entry_id
GROUP BY e.id, e.owner_id, e.unit_id, e.planning_year, e.component_id,
         e.sub_component_id, e.key_activity_id, e.sub_activity_id,
         e.title_of_activities, e.unit_cost, e.status, e.submission_date,
         e.review_date, e.reviewer_id, e.admin_comment, e.created_at, e.updated_at
ORDER BY e.created_at DESC;
