-- ================================================================
-- Migration: Fix report_ai_insights RLS — add owner + opd_member roles
-- Date: 2026-02-26
-- Context: Original policy only allowed superadmin/admin/member.
--          'owner' was missing → owners cannot read insights via
--          direct SELECT (useExecutiveDashboard breaks in production
--          when the user's role is 'owner').
-- ================================================================

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Staff can view ai insights" ON public.report_ai_insights;

-- Re-create with owner + opd_member included
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'report_ai_insights'
      AND policyname = 'Staff can view ai insights v2'
  ) THEN
    CREATE POLICY "Staff can view ai insights v2"
      ON public.report_ai_insights FOR SELECT
      USING (
        has_role(auth.uid(), 'superadmin') OR
        has_role(auth.uid(), 'owner')      OR
        has_role(auth.uid(), 'admin')      OR
        has_role(auth.uid(), 'member')     OR
        has_role(auth.uid(), 'opd_member')
      );
  END IF;
END $$;

-- Also fix INSERT / UPDATE policies to include owner
DROP POLICY IF EXISTS "Staff can insert ai insights" ON public.report_ai_insights;
DROP POLICY IF EXISTS "Staff can update ai insights" ON public.report_ai_insights;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'report_ai_insights'
      AND policyname = 'Staff can insert ai insights v2'
  ) THEN
    CREATE POLICY "Staff can insert ai insights v2"
      ON public.report_ai_insights FOR INSERT
      WITH CHECK (
        has_role(auth.uid(), 'superadmin') OR
        has_role(auth.uid(), 'owner')      OR
        has_role(auth.uid(), 'admin')      OR
        has_role(auth.uid(), 'member')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'report_ai_insights'
      AND policyname = 'Staff can update ai insights v2'
  ) THEN
    CREATE POLICY "Staff can update ai insights v2"
      ON public.report_ai_insights FOR UPDATE
      USING (
        has_role(auth.uid(), 'superadmin') OR
        has_role(auth.uid(), 'owner')      OR
        has_role(auth.uid(), 'admin')      OR
        has_role(auth.uid(), 'member')
      )
      WITH CHECK (
        has_role(auth.uid(), 'superadmin') OR
        has_role(auth.uid(), 'owner')      OR
        has_role(auth.uid(), 'admin')      OR
        has_role(auth.uid(), 'member')
      );
  END IF;
END $$;
