-- ============================================================================
-- Fix RLS Policies for Disposition, Internal Notes, and Status Change
-- ============================================================================
-- This migration fixes 3 broken features:
-- 1. OPD Tujuan dropdown - empty due to RLS policy issues
-- 2. Catatan Internal - RLS policy missing superadmin and other roles
-- 3. Ubah Status - opd_id NOT NULL constraint prevents status-only changes
-- ============================================================================

-- ============================================================================
-- PART 1: Add tenant_id column to profiles table (if not exists)
-- ============================================================================

-- Add tenant_id column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN tenant_id UUID;
  END IF;
END $$;

-- Create index for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);

-- ============================================================================
-- PART 2: Create get_user_tenant_id() function (only if not exists)
-- ============================================================================

-- Only create the function if it doesn't already exist
-- (Skip if exists to avoid breaking dependent policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_user_tenant_id'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    CREATE FUNCTION public.get_user_tenant_id(p_user_id UUID)
    RETURNS UUID
    LANGUAGE SQL
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $func$
      SELECT tenant_id FROM public.profiles WHERE id = p_user_id;
    $func$;
  END IF;
END $$;

-- ============================================================================
-- PART 3: Fix OPDs RLS Policies - Add explicit superadmin SELECT policy
-- ============================================================================

-- Drop existing superadmin policy if it exists (to recreate cleanly)
DROP POLICY IF EXISTS "Superadmins can view all opds" ON public.opds;

-- Create explicit SELECT policy for superadmin
-- This ensures superadmin can see all OPDs regardless of tenant
CREATE POLICY "Superadmins can view all opds"
  ON public.opds FOR SELECT
  USING (has_role(auth.uid(), 'superadmin'));

-- ============================================================================
-- PART 4: Fix report_comments RLS Policies
-- ============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can view all comments" ON report_comments;
DROP POLICY IF EXISTS "Admins can insert comments" ON report_comments;
DROP POLICY IF EXISTS "Admins can update their own comments" ON report_comments;
DROP POLICY IF EXISTS "Staff can view all comments" ON report_comments;
DROP POLICY IF EXISTS "Staff can insert comments" ON report_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON report_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON report_comments;

-- Recreate SELECT policy with all staff roles
CREATE POLICY "Staff can view all comments"
ON report_comments FOR SELECT
USING (
  has_role(auth.uid(), 'superadmin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'owner'::app_role) OR
  has_role(auth.uid(), 'member'::app_role) OR
  has_role(auth.uid(), 'opd_member'::app_role)
);

-- Recreate INSERT policy with all staff roles
CREATE POLICY "Staff can insert comments"
ON report_comments FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'superadmin'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'owner'::app_role) OR
  has_role(auth.uid(), 'member'::app_role) OR
  has_role(auth.uid(), 'opd_member'::app_role)
);

-- Recreate UPDATE policy - users can update their own comments
CREATE POLICY "Users can update their own comments"
ON report_comments FOR UPDATE
USING (user_id = auth.uid());

-- Add DELETE policy - users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON report_comments FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- PART 5: Fix report_dispositions schema - Make opd_id nullable
-- ============================================================================

-- Make opd_id nullable to allow status-only changes without OPD assignment
ALTER TABLE public.report_dispositions
ALTER COLUMN opd_id DROP NOT NULL;

-- ============================================================================
-- PART 6: Ensure superadmin policies for report_dispositions
-- ============================================================================

-- Drop and recreate superadmin policy for report_dispositions
DROP POLICY IF EXISTS "Superadmins can manage all dispositions" ON report_dispositions;

CREATE POLICY "Superadmins can manage all dispositions"
  ON public.report_dispositions FOR ALL
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. Added profiles.tenant_id column (if not exists)
-- 2. Created get_user_tenant_id() function
-- 3. Added explicit superadmin SELECT policy for opds table
-- 4. Fixed report_comments RLS policies to include all staff roles
-- 5. Made report_dispositions.opd_id nullable for status-only changes
-- 6. Ensured superadmin policy exists for report_dispositions
--
-- Result:
-- - Superadmin can see OPD dropdown
-- - All staff can add internal notes (Catatan Internal)
-- - Status can be changed without requiring OPD assignment
-- ============================================================================
