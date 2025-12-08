-- ============================================================================
-- Add suggested_opd_name column for AI OPD recommendations by name
-- ============================================================================
-- This allows AI to recommend OPD by name (e.g., "Dinas Lingkungan")
-- without requiring exact database ID match
-- ============================================================================

-- Add suggested_opd_name column
ALTER TABLE public.report_ai_insights
ADD COLUMN IF NOT EXISTS suggested_opd_name TEXT;

-- Add documentation comment
COMMENT ON COLUMN public.report_ai_insights.suggested_opd_name
IS 'AI-suggested OPD name/type (e.g., Dinas Lingkungan, Dinas Pendidikan) based on report content analysis';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
