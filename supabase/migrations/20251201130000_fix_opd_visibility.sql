-- ============================================================================
-- Fix OPD Visibility for All Staff Members
-- ============================================================================
-- Problem: OPD dropdown is empty because RLS policies are too restrictive
-- - Current policies rely on tenant_id matching or superadmin role
-- - If tenant_id is NULL or not set, users can't see any OPDs
--
-- Solution: Add a permissive SELECT policy for all authenticated staff members
-- This allows anyone with a staff role to view all active OPDs for disposition
-- ============================================================================

-- Drop any conflicting policies first
DROP POLICY IF EXISTS "Staff can view all opds" ON public.opds;
DROP POLICY IF EXISTS "Authenticated staff can view opds" ON public.opds;

-- Create a permissive SELECT policy for all authenticated staff members
-- This allows admin, superadmin, owner, member, and opd_member to view ALL opds
CREATE POLICY "Authenticated staff can view opds"
  ON public.opds FOR SELECT
  USING (
    -- Any authenticated user with a staff role can view all OPDs
    auth.uid() IS NOT NULL
    AND (
      has_role(auth.uid(), 'superadmin'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'owner'::app_role) OR
      has_role(auth.uid(), 'member'::app_role) OR
      has_role(auth.uid(), 'opd_member'::app_role)
    )
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This policy allows any staff member to see all OPDs in the system
-- regardless of tenant_id, which is correct behavior for disposition dialogs
-- where users need to select from all available OPDs
-- ============================================================================
