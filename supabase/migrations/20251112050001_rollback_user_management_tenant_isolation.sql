-- Rollback: Restore User Management to Previous State
-- This migration rollsback the tenant isolation fix and restores the exact previous state
-- where admins could view all users across all tenants.
--
-- IMPORTANT: This rollback migration is for emergency use only if the fix causes issues.
-- It restores the security vulnerability where tenant admins can see all users.

-- ============================================================================
-- PART 1: Restore Profiles Table to Previous State
-- ============================================================================

-- Drop the new tenant-scoped policies
DROP POLICY IF EXISTS "Admins can view own tenant profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update own tenant profiles" ON profiles;

-- Restore original 3 admin policies (that allowed cross-tenant access)
CREATE POLICY "Admins and owners can view all profiles for management"
  ON profiles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- ============================================================================
-- PART 2: Restore user_roles Table to Previous State
-- ============================================================================

-- Remove all policies from user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view own tenant user roles" ON user_roles;
DROP POLICY IF EXISTS "Superadmins can view all user roles" ON user_roles;

-- Disable RLS (restore to previous state)
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 3: Restore Original assign_user_role() Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_user_role(
  target_user_id UUID,
  new_role app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
  admin_count INTEGER;
BEGIN
  -- Check if caller has admin or owner role
  SELECT has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')
  INTO caller_is_admin;

  IF NOT caller_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins and owners can assign roles'
    );
  END IF;

  -- If removing admin role, check if this is the last admin
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = target_user_id
    AND role IN ('admin', 'owner')
  ) AND new_role NOT IN ('admin', 'owner') THEN
    SELECT COUNT(*) INTO admin_count
    FROM user_roles
    WHERE role IN ('admin', 'owner');

    IF admin_count <= 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Cannot remove the last admin'
      );
    END IF;
  END IF;

  -- Delete existing roles for this user
  DELETE FROM user_roles WHERE user_id = target_user_id;

  -- Insert new role
  INSERT INTO user_roles (user_id, role)
  VALUES (target_user_id, new_role);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role assigned successfully'
  );
END;
$$;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
-- The database has been restored to the exact previous state:
-- 1. Profiles table has 3 original admin policies (cross-tenant access)
-- 2. user_roles has RLS disabled (no tenant isolation)
-- 3. assign_user_role() function has no tenant validation
--
-- WARNING: This state has a security vulnerability where tenant admins
-- can see and manage users from other tenants.
-- ============================================================================
