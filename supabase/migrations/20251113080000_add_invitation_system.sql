-- Migration: Add Invitation System for Multi-Tenant User Onboarding
-- Purpose: Enable admins to invite users with automatic tenant and role assignment
--
-- Features:
-- - Token-based invitation links
-- - 14-day expiration
-- - Email validation
-- - One-time use (marked accepted after use)
-- - Admin-only creation with tenant isolation

-- ============================================================================
-- CREATE INVITATIONS TABLE
-- ============================================================================

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_tenant ON public.invitations(tenant_id);
CREATE INDEX idx_invitations_expires ON public.invitations(expires_at) WHERE accepted_at IS NULL;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR INVITATIONS TABLE
-- ============================================================================

-- Policy 1: Admins and Owners can create invitations for their own tenant
CREATE POLICY "Admins can create invitations"
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

-- Policy 2: Admins and Owners can view their own tenant's invitations
CREATE POLICY "Admins can view own tenant invitations"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

-- Policy 3: Admins and Owners can update their own tenant's invitations (for revocation)
CREATE POLICY "Admins can update own tenant invitations"
  ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    AND tenant_id = get_user_tenant_id(auth.uid())
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

-- Policy 4: Admins and Owners can delete their own tenant's invitations
CREATE POLICY "Admins can delete own tenant invitations"
  ON public.invitations
  FOR DELETE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

-- Policy 5: Superadmins can manage all invitations
CREATE POLICY "Superadmins can manage all invitations"
  ON public.invitations
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

-- Policy 6: Anyone (including unauthenticated) can view invitations by token (for acceptance)
-- This is necessary for the AcceptInvitation page to work
CREATE POLICY "Anyone can view invitations by token"
  ON public.invitations
  FOR SELECT
  TO public
  USING (true);

-- ============================================================================
-- UPDATE handle_new_user() TRIGGER TO SUPPORT INVITATION TOKENS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- ========================================================================
  -- STEP 1: Check if user signed up with an invitation token
  -- ========================================================================

  IF NEW.raw_user_meta_data->>'invitation_token' IS NOT NULL THEN
    -- Query the invitations table for a valid invitation
    SELECT * INTO invitation_record
    FROM public.invitations
    WHERE token = NEW.raw_user_meta_data->>'invitation_token'
      AND email = NEW.email  -- Email must match invitation
      AND expires_at > NOW()  -- Not expired
      AND accepted_at IS NULL;  -- Not already used

    IF FOUND THEN
      -- ====================================================================
      -- INVITATION FOUND: Assign tenant and role from invitation
      -- ====================================================================

      -- Create profile WITH tenant_id from invitation
      INSERT INTO public.profiles (
        id,
        email,
        full_name,
        tenant_id,  -- ✅ Assigned from invitation
        organization,
        department,
        position
      ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        invitation_record.tenant_id,  -- ✅ From invitation
        NEW.raw_user_meta_data->>'organization',
        NEW.raw_user_meta_data->>'department',
        NEW.raw_user_meta_data->>'position'
      );

      -- Assign role from invitation
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, invitation_record.role);

      -- Mark invitation as accepted
      UPDATE public.invitations
      SET accepted_at = NOW()
      WHERE id = invitation_record.id;

      RETURN NEW;
    END IF;
  END IF;

  -- ========================================================================
  -- STEP 2: No valid invitation - Create profile WITHOUT tenant_id
  -- ========================================================================

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    tenant_id,  -- ✅ NULL - user will see ProfileSetup page
    organization,
    department,
    position
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULL,  -- No tenant assigned
    NEW.raw_user_meta_data->>'organization',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'position'
  );

  -- NOTE: No role assigned - user will need invitation or admin approval

  RETURN NEW;
END;
$$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.invitations IS
'Stores invitation links for users to join tenants. Tokens are generated by admins and expire after 14 days. When a user signs up with a valid token, they are automatically assigned to the tenant and role specified in the invitation.';

COMMENT ON COLUMN public.invitations.token IS
'Unique crypto-secure random token used in invitation URL. Should be at least 32 characters.';

COMMENT ON COLUMN public.invitations.expires_at IS
'Invitation expiration timestamp. Default is 14 days from creation. Expired invitations cannot be accepted.';

COMMENT ON COLUMN public.invitations.accepted_at IS
'Timestamp when invitation was accepted. NULL means invitation is still pending. Once accepted, invitation cannot be reused.';

COMMENT ON FUNCTION public.handle_new_user() IS
'Trigger function that runs after a new user is created in auth.users. Checks for invitation token in user metadata and assigns tenant/role if found. Otherwise creates profile without tenant.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Authenticated users need to be able to query invitations table for acceptance
GRANT SELECT ON public.invitations TO authenticated;
GRANT SELECT ON public.invitations TO anon;

-- Only authenticated users can insert/update/delete (handled by RLS policies)
GRANT INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
