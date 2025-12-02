-- ============================================================================
-- Add AI Insights Feature for Reports
-- ============================================================================
-- This migration creates the report_ai_insights table to store AI-generated
-- analysis for each report including:
-- - Summary Analysis (text paragraph)
-- - Key Insights (bullet points)
-- - Recommended Actions (bullet points)
-- ============================================================================

-- ============================================================================
-- PART 1: Create report_ai_insights table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  summary_analysis TEXT NOT NULL,
  key_insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_used TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster lookups by report_id
CREATE INDEX IF NOT EXISTS idx_report_ai_insights_report_id ON public.report_ai_insights(report_id);

-- Create unique constraint to ensure one insight per report (can be regenerated)
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_ai_insights_unique_report ON public.report_ai_insights(report_id);

-- Add comment for documentation
COMMENT ON TABLE public.report_ai_insights IS 'Stores AI-generated insights for citizen reports';
COMMENT ON COLUMN public.report_ai_insights.summary_analysis IS 'One paragraph summary analysis of the report';
COMMENT ON COLUMN public.report_ai_insights.key_insights IS 'JSON array of key insight bullet points';
COMMENT ON COLUMN public.report_ai_insights.recommended_actions IS 'JSON array of recommended action bullet points';
COMMENT ON COLUMN public.report_ai_insights.model_used IS 'The AI model used to generate this insight';
COMMENT ON COLUMN public.report_ai_insights.generated_by IS 'User ID who triggered the AI insight generation';

-- ============================================================================
-- PART 2: Enable RLS on the table
-- ============================================================================

ALTER TABLE public.report_ai_insights ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 3: Create RLS Policies
-- ============================================================================
-- Access: superadmin, admin, member can read and create insights
-- ============================================================================

-- SELECT policy: Superadmin, Admin, Member can view AI insights
CREATE POLICY "Staff can view ai insights"
  ON public.report_ai_insights FOR SELECT
  USING (
    has_role(auth.uid(), 'superadmin'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'member'::app_role)
  );

-- INSERT policy: Superadmin, Admin, Member can create AI insights
CREATE POLICY "Staff can insert ai insights"
  ON public.report_ai_insights FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'member'::app_role)
  );

-- UPDATE policy: Superadmin, Admin, Member can update AI insights (for regeneration)
CREATE POLICY "Staff can update ai insights"
  ON public.report_ai_insights FOR UPDATE
  USING (
    has_role(auth.uid(), 'superadmin'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'member'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'superadmin'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'member'::app_role)
  );

-- DELETE policy: Only superadmin can delete AI insights
CREATE POLICY "Superadmins can delete ai insights"
  ON public.report_ai_insights FOR DELETE
  USING (has_role(auth.uid(), 'superadmin'::app_role));

-- ============================================================================
-- PART 4: Create trigger for updated_at
-- ============================================================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for report_ai_insights
DROP TRIGGER IF EXISTS update_report_ai_insights_updated_at ON public.report_ai_insights;
CREATE TRIGGER update_report_ai_insights_updated_at
  BEFORE UPDATE ON public.report_ai_insights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- 1. Created report_ai_insights table with columns for summary, insights, actions
-- 2. Added indexes for performance
-- 3. Enabled RLS with policies for superadmin, admin, and member roles
-- 4. Added trigger for automatic updated_at timestamp
-- ============================================================================
