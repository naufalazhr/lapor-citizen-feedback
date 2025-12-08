-- ============================================================================
-- Add AI Classification Fields to report_ai_insights
-- ============================================================================
-- This migration adds classification columns to the report_ai_insights table:
-- - urgency: Critical, Moderate, Minor (for prioritization)
-- - sentiment: Positive, Negative, Neutral (report tone analysis)
-- - suggested_opd: AI-suggested OPD to handle the report
-- ============================================================================

-- ============================================================================
-- PART 1: Create enum types for classification
-- ============================================================================

-- Create enum for urgency levels
DO $$ BEGIN
  CREATE TYPE public.urgency_level AS ENUM ('critical', 'moderate', 'minor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for sentiment types
DO $$ BEGIN
  CREATE TYPE public.sentiment_type AS ENUM ('positive', 'negative', 'neutral');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 2: Add classification columns to report_ai_insights
-- ============================================================================

-- Add urgency classification
ALTER TABLE public.report_ai_insights
ADD COLUMN IF NOT EXISTS urgency public.urgency_level;

-- Add urgency reason (AI explanation)
ALTER TABLE public.report_ai_insights
ADD COLUMN IF NOT EXISTS urgency_reason TEXT;

-- Add sentiment classification
ALTER TABLE public.report_ai_insights
ADD COLUMN IF NOT EXISTS sentiment public.sentiment_type;

-- Add sentiment reason (AI explanation)
ALTER TABLE public.report_ai_insights
ADD COLUMN IF NOT EXISTS sentiment_reason TEXT;

-- Add suggested OPD (foreign key to opds table)
ALTER TABLE public.report_ai_insights
ADD COLUMN IF NOT EXISTS suggested_opd_id UUID REFERENCES public.opds(id) ON DELETE SET NULL;

-- Add confidence level for OPD suggestion
ALTER TABLE public.report_ai_insights
ADD COLUMN IF NOT EXISTS suggested_opd_confidence TEXT CHECK (suggested_opd_confidence IS NULL OR suggested_opd_confidence IN ('high', 'medium', 'low'));

-- ============================================================================
-- PART 3: Create indexes for filtering and querying
-- ============================================================================

-- Index for filtering by urgency
CREATE INDEX IF NOT EXISTS idx_report_ai_insights_urgency
ON public.report_ai_insights(urgency);

-- Index for filtering by sentiment
CREATE INDEX IF NOT EXISTS idx_report_ai_insights_sentiment
ON public.report_ai_insights(sentiment);

-- Index for suggested OPD lookups
CREATE INDEX IF NOT EXISTS idx_report_ai_insights_suggested_opd
ON public.report_ai_insights(suggested_opd_id);

-- ============================================================================
-- PART 4: Add documentation comments
-- ============================================================================

COMMENT ON COLUMN public.report_ai_insights.urgency
IS 'AI-classified urgency level: critical (health/safety risk), moderate (public service impact), minor (general concern)';

COMMENT ON COLUMN public.report_ai_insights.urgency_reason
IS 'AI explanation for the urgency classification decision';

COMMENT ON COLUMN public.report_ai_insights.sentiment
IS 'AI-classified sentiment of the report: positive, negative, or neutral based on tone analysis';

COMMENT ON COLUMN public.report_ai_insights.sentiment_reason
IS 'AI explanation for the sentiment classification decision';

COMMENT ON COLUMN public.report_ai_insights.suggested_opd_id
IS 'AI-suggested OPD (Organisasi Perangkat Daerah) to handle this report based on content analysis';

COMMENT ON COLUMN public.report_ai_insights.suggested_opd_confidence
IS 'Confidence level of OPD suggestion: high (clear match), medium (needs verification), low (uncertain)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- 1. Created urgency_level and sentiment_type enums
-- 2. Added classification columns: urgency, sentiment, suggested_opd_id
-- 3. Added reason columns for AI explanations
-- 4. Added confidence level for OPD suggestions
-- 5. Created indexes for efficient filtering
-- 6. All columns are nullable for backwards compatibility
-- ============================================================================
