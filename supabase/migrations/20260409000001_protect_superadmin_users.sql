-- ============================================================================
-- Protect superadmin users from being modified via assign_user_role()
-- Superadmins are managed only via dedicated superadmin routes, not the
-- tenant admin dashboard. This adds a defense-in-depth check at the DB layer
-- to prevent role changes on users who currently have the superadmin role,
-- regardless of who is calling.
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

  -- SECURITY: Prevent any modification of superadmin users
  -- Superadmins are managed via dedicated superadmin routes only.
  IF EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = target_user_id AND role = 'superadmin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot modify superadmin users'
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
