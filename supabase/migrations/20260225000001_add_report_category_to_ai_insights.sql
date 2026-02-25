-- Migration: Add report_category to report_ai_insights
-- Adds incident type classification (flood, fire, accident, etc.)
-- Uses TEXT with a CHECK constraint (avoids enum migration complexity while still enforcing canonical values)

ALTER TABLE report_ai_insights
  ADD COLUMN IF NOT EXISTS report_category TEXT;

-- Add a CHECK constraint to enforce canonical values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'report_ai_insights_report_category_check'
      AND conrelid = 'report_ai_insights'::regclass
  ) THEN
    ALTER TABLE report_ai_insights
      ADD CONSTRAINT report_ai_insights_report_category_check
      CHECK (report_category IS NULL OR report_category IN (
        'flood',
        'fire',
        'accident',
        'road_damage',
        'waste',
        'public_facility',
        'security',
        'health',
        'education',
        'drainage',
        'street_lighting',
        'licensing',
        'aspiration',
        'other'
      ));
  END IF;
END $$;
