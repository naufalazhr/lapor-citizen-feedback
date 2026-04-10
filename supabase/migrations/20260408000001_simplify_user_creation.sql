-- ============================================================================
-- Simplify User Creation for Single-Tenant Deployment
-- 1. Update handle_new_user() trigger to auto-assign default tenant_id
-- 2. Create update_last_login() RPC for login tracking
-- 3. Backfill existing profiles with NULL tenant_id
-- ============================================================================

-- 1. Update handle_new_user() trigger
--    STEP 2 (no invitation) now uses get_default_tenant_id() instead of NULL
--    STEP 1 (invitation path) remains unchanged for backward compat
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
  v_default_tenant UUID;
BEGIN
  -- ========================================================================
  -- STEP 1: Check if user signed up with an invitation token
  -- ========================================================================
  IF NEW.raw_user_meta_data->>'invitation_token' IS NOT NULL THEN
    SELECT * INTO invitation_record
    FROM public.invitations
    WHERE token = NEW.raw_user_meta_data->>'invitation_token'
      AND email = NEW.email
      AND expires_at > NOW()
      AND accepted_at IS NULL;

    IF FOUND THEN
      INSERT INTO public.profiles (
        id, email, full_name, tenant_id,
        organization, department, position
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        invitation_record.tenant_id,
        NEW.raw_user_meta_data->>'organization',
        NEW.raw_user_meta_data->>'department',
        NEW.raw_user_meta_data->>'position'
      );

      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, invitation_record.role);

      UPDATE public.invitations
      SET accepted_at = NOW()
      WHERE id = invitation_record.id;

      RETURN NEW;
    END IF;
  END IF;

  -- ========================================================================
  -- STEP 2: No valid invitation — auto-assign default tenant
  -- For single-tenant deployments, get_default_tenant_id() returns the
  -- one active tenant. For multi-tenant, returns NULL if ambiguous.
  -- ========================================================================
  SELECT get_default_tenant_id() INTO v_default_tenant;

  INSERT INTO public.profiles (
    id, email, full_name, tenant_id,
    organization, department, position
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_default_tenant,
    NEW.raw_user_meta_data->>'organization',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'position'
  );

  RETURN NEW;
END;
$$;

-- 2. Create update_last_login() RPC
--    Called client-side after successful login to track user activity
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET last_login_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION update_last_login() TO authenticated;

-- 3. Backfill existing profiles with NULL tenant_id
DO $$
DECLARE
  v_default_tenant UUID;
BEGIN
  SELECT get_default_tenant_id() INTO v_default_tenant;
  IF v_default_tenant IS NOT NULL THEN
    UPDATE profiles SET tenant_id = v_default_tenant WHERE tenant_id IS NULL;
    RAISE NOTICE 'Backfilled NULL tenant_id profiles with default tenant: %', v_default_tenant;
  ELSE
    RAISE NOTICE 'No single default tenant found — skipping backfill';
  END IF;
END $$;
