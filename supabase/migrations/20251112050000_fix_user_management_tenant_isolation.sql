-- Fix User Management Tenant Isolation
-- This migration fixes a critical security issue where tenant admins could see and manage
-- users from other tenants. It adds proper tenant isolation to profiles and user_roles tables.
--
-- NOTE: This migration requires profiles.tenant_id and get_user_tenant_id() function,
-- which are created in migration 20251201120000. If they don't exist yet, this migration
-- will skip the tenant-isolation policies and they will be created in that later migration.

-- ============================================================================
-- PART 1: Drop old broken policies (always safe)
-- ============================================================================

-- Drop the 3 broken admin policies that allow cross-tenant access
DROP POLICY IF EXISTS "Admins and owners can view all profiles for management" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- ============================================================================
-- PART 2: Create tenant-scoped policies only if tenant_id exists
-- ============================================================================

DO $$
BEGIN
  -- Check if profiles.tenant_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'tenant_id'
  ) THEN
    -- Create tenant-scoped admin policies
    -- Admins can only view profiles in their own tenant (excluding superadmins)
    EXECUTE 'CREATE POLICY "Admins can view own tenant profiles"
      ON profiles FOR SELECT
      TO authenticated
      USING (
        (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''owner''))
        AND tenant_id = get_user_tenant_id(auth.uid())
        AND tenant_id IS NOT NULL
      )';

    -- Admins can only update profiles in their own tenant (excluding superadmins)
    EXECUTE 'CREATE POLICY "Admins can update own tenant profiles"
      ON profiles FOR UPDATE
      TO authenticated
      USING (
        (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''owner''))
        AND tenant_id = get_user_tenant_id(auth.uid())
        AND tenant_id IS NOT NULL
      )';

    RAISE NOTICE 'Created tenant-scoped profile policies (tenant_id exists)';
  ELSE
    RAISE NOTICE 'Skipping profile tenant policies (profiles.tenant_id not yet available)';
  END IF;
END $$;

-- ============================================================================
-- PART 3: Enable RLS on user_roles Table (always safe)
-- ============================================================================

-- Enable Row Level Security on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles (no tenant_id needed)
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Superadmins can view all roles across all tenants (no tenant_id needed)
DROP POLICY IF EXISTS "Superadmins can view all user roles" ON user_roles;
CREATE POLICY "Superadmins can view all user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'));

-- ============================================================================
-- PART 4: Create tenant-scoped user_roles policy only if tenant_id exists
-- ============================================================================

DO $$
BEGIN
  -- Check if profiles.tenant_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'tenant_id'
  ) THEN
    -- Admins can view roles of users in their tenant only
    EXECUTE 'CREATE POLICY "Admins can view own tenant user roles"
      ON user_roles FOR SELECT
      TO authenticated
      USING (
        (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''owner''))
        AND user_id IN (
          SELECT id FROM profiles
          WHERE tenant_id = get_user_tenant_id(auth.uid())
          AND tenant_id IS NOT NULL
        )
      )';

    RAISE NOTICE 'Created tenant-scoped user_roles policy (tenant_id exists)';
  ELSE
    RAISE NOTICE 'Skipping user_roles tenant policy (profiles.tenant_id not yet available)';
  END IF;
END $$;

-- ============================================================================
-- PART 5: Fix assign_user_role() Function with Tenant Validation
-- This function is safe to create - it checks for tenant_id at runtime
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
  has_tenant_support BOOLEAN;
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

  -- Check if tenant_id column exists (for backwards compatibility)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'tenant_id'
  ) INTO has_tenant_support;

  -- TENANT ISOLATION: Verify same tenant (unless caller is superadmin)
  IF has_tenant_support AND NOT has_role(auth.uid(), 'superadmin') THEN
    SELECT tenant_id INTO caller_tenant_id FROM profiles WHERE id = auth.uid();
    SELECT tenant_id INTO target_tenant_id FROM profiles WHERE id = target_user_id;

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
-- 1. Dropped 3 cross-tenant admin policies on profiles
-- 2. Created tenant-scoped policies IF tenant_id exists (otherwise deferred)
-- 3. Enabled RLS on user_roles table with basic policies
-- 4. Added tenant-scoped user_roles policy IF tenant_id exists
-- 5. Created assign_user_role() function with runtime tenant validation
--
-- Note: If tenant_id doesn't exist yet, the tenant-scoped policies will be
-- created in migration 20251201120000_fix_rls_disposition_notes.sql
-- ============================================================================
