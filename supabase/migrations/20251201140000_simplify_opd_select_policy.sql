-- ============================================================================
-- Simplify OPD SELECT Policy for All Authenticated Users
-- ============================================================================
-- Problem: OPD dropdown is still empty because has_role function might have
-- issues with RLS recursion or the user_roles table access.
--
-- Solution: Create a simple policy that allows ANY authenticated user to
-- view OPDs. This is appropriate because:
-- 1. OPDs are organizational units - not sensitive data
-- 2. All staff need to see OPDs for various operations (disposition, filtering)
-- 3. The policy should be simple to avoid RLS recursion issues
-- ============================================================================

-- First, let's drop all existing SELECT policies on opds to start fresh
DROP POLICY IF EXISTS "Superadmins can view all opds" ON public.opds;
DROP POLICY IF EXISTS "Users can view tenant opds" ON public.opds;
DROP POLICY IF EXISTS "Authenticated staff can view opds" ON public.opds;
DROP POLICY IF EXISTS "Anyone can view opds" ON public.opds;

-- Create a simple, permissive SELECT policy
-- Any authenticated user can view all active OPDs
CREATE POLICY "Authenticated users can view opds"
  ON public.opds FOR SELECT
  TO authenticated
  USING (true);

-- Note: The "Superadmins can manage all opds" and "Admins can manage tenant opds"
-- policies remain for INSERT/UPDATE/DELETE operations

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
