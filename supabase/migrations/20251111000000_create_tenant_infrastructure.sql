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
-- PART 3: Add tenant_id to ALL tables that have it on production
-- ============================================================================
-- These columns were added manually on production but never captured in
-- migration files. We add them here so subsequent migrations can reference them.
-- Uses safe pattern: checks BOTH table existence and column existence.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'reports',
    'conversations',
    'messages',
    'attachments',
    'api_keys',
    'flowise_config',
    'fonnte_config',
    'webhook_errors',
    'report_comments',
    'user_approvals'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id UUID', tbl);
      RAISE NOTICE 'Added tenant_id to %', tbl;
    ELSE
      RAISE NOTICE 'Skipping % (table missing or tenant_id already exists)', tbl;
    END IF;
  END LOOP;
END $$;

-- Create indexes for tenant_id on key tables
CREATE INDEX IF NOT EXISTS idx_reports_tenant_id ON public.reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON public.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attachments_tenant_id ON public.attachments(tenant_id);

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
