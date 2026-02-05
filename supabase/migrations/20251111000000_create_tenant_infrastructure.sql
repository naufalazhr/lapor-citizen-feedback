-- ============================================================================
-- Create Tenant Infrastructure
-- ============================================================================
-- This migration creates all tenant-related objects that were set up manually
-- on production but never captured in migration files. It must run BEFORE
-- migrations 20251111172547 onwards that reference these objects.
--
-- Uses idempotent syntax (IF NOT EXISTS) to be safe on existing databases.
-- ============================================================================

-- ============================================================================
-- PART 1: Create tenants table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  domain TEXT,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  subscription_tier TEXT DEFAULT 'basic',
  trial_ends_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- PART 2: Add tenant_id to profiles table
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);

-- ============================================================================
-- PART 3: Add tenant_id to reports table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'reports'
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.reports ADD COLUMN tenant_id UUID;
  END IF;
END $$;

-- ============================================================================
-- PART 4: Create get_user_tenant_id() function
-- ============================================================================

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
