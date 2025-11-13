-- Fix User Management Tenant Isolation
-- This migration fixes a critical security issue where tenant admins could see and manage
-- users from other tenants. It adds proper tenant isolation to profiles and user_roles tables.

-- ============================================================================
-- PART 1: Fix Profiles Table RLS Policies
-- ============================================================================

-- Drop the 3 broken admin policies that allow cross-tenant access
DROP POLICY IF EXISTS "Admins and owners can view all profiles for management" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create tenant-scoped admin policies
-- Admins can only view profiles in their own tenant (excluding superadmins)
CREATE POLICY "Admins can view own tenant profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND tenant_id IS NOT NULL  -- Exclude superadmins (tenant_id = null)
  );

-- Admins can only update profiles in their own tenant (excluding superadmins)
CREATE POLICY "Admins can update own tenant profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND tenant_id IS NOT NULL
  );

-- ============================================================================
-- PART 2: Enable RLS on user_roles Table
-- ============================================================================

-- Enable Row Level Security on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view roles of users in their tenant only
CREATE POLICY "Admins can view own tenant user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    AND user_id IN (
      SELECT id FROM profiles
      WHERE tenant_id = get_user_tenant_id(auth.uid())
      AND tenant_id IS NOT NULL
    )
  );

-- Superadmins can view all roles across all tenants
CREATE POLICY "Superadmins can view all user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'));

-- ============================================================================
-- PART 3: Fix assign_user_role() Function with Tenant Validation
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
  caller_tenant_id UUID;
  target_tenant_id UUID;
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

  -- TENANT ISOLATION: Verify same tenant (unless caller is superadmin)
  IF NOT has_role(auth.uid(), 'superadmin') THEN
    SELECT get_user_tenant_id(auth.uid()) INTO caller_tenant_id;
    SELECT get_user_tenant_id(target_user_id) INTO target_tenant_id;

    -- Prevent cross-tenant role assignment
    IF caller_tenant_id IS NULL OR target_tenant_id IS NULL
       OR caller_tenant_id != target_tenant_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Cannot assign roles to users outside your organization'
      );
    END IF;
  END IF;

  -- SECURITY: Prevent non-superadmins from assigning superadmin role
  IF new_role = 'superadmin' AND NOT has_role(auth.uid(), 'superadmin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only superadmins can assign superadmin role'
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
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. Replaced 3 cross-tenant admin policies on profiles with tenant-scoped policies
-- 2. Enabled RLS on user_roles table with tenant-scoped policies
-- 3. Added tenant validation to assign_user_role() function
--
-- Result: Tenant admins can now only see and manage users in their own tenant
-- ============================================================================
