-- Persist the exact No. and Performance Indicator selected in Submit Entry.
-- The template hierarchy now stores these values in performance_indicators,
-- while the existing entries table only points to key_activities.

ALTER TABLE entries
ADD COLUMN IF NOT EXISTS no TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS performance_indicator TEXT DEFAULT '';

