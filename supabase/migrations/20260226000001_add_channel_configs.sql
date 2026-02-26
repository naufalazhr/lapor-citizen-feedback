-- ================================================================
-- Migration: Add Channel Integration Configs
-- Date: 2026-02-26
-- Purpose:
--   1. Update flowise_config RLS to allow admin/owner to manage their own tenant's config
--   2. Update fonnte_config RLS to allow admin/owner to manage their own tenant's config
--   3. Create openrouter_config table for AI Analytics channel
-- ================================================================

-- ================================================================
-- 1. Update flowise_config RLS — add admin/owner for own tenant
--    Context: 20251112060000_restrict_flowise_fonnte_to_superadmin.sql removed
--    all admin/owner policies. We now re-add them scoped to own tenant only.
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'flowise_config'
      AND policyname = 'admin_owner_manage_flowise_own_tenant'
  ) THEN
    CREATE POLICY "admin_owner_manage_flowise_own_tenant"
      ON public.flowise_config
      FOR ALL
      USING (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
      );
  END IF;
END $$;

-- ================================================================
-- 2. Update fonnte_config RLS — add admin/owner for own tenant
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fonnte_config'
      AND policyname = 'admin_owner_manage_fonnte_own_tenant'
  ) THEN
    CREATE POLICY "admin_owner_manage_fonnte_own_tenant"
      ON public.fonnte_config
      FOR ALL
      USING (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
      );
  END IF;
END $$;

-- ================================================================
-- 3. Create openrouter_config table for AI Analytics channel
-- ================================================================
CREATE TABLE IF NOT EXISTS public.openrouter_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  config_name VARCHAR(100) NOT NULL DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  api_key TEXT,
  base_url TEXT NOT NULL DEFAULT 'https://openrouter.ai/api/v1',
  default_model TEXT DEFAULT 'openai/gpt-4o',
  max_tokens INTEGER DEFAULT 2048,
  temperature NUMERIC(3,2) DEFAULT 0.70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, config_name)
);

ALTER TABLE public.openrouter_config ENABLE ROW LEVEL SECURITY;

-- Superadmin: full cross-tenant access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'openrouter_config'
      AND policyname = 'superadmin_all_openrouter'
  ) THEN
    CREATE POLICY "superadmin_all_openrouter"
      ON public.openrouter_config FOR ALL
      USING (has_role(auth.uid(), 'superadmin'));
  END IF;
END $$;

-- Admin/Owner: manage own tenant only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'openrouter_config'
      AND policyname = 'admin_owner_manage_openrouter_own_tenant'
  ) THEN
    CREATE POLICY "admin_owner_manage_openrouter_own_tenant"
      ON public.openrouter_config FOR ALL
      USING (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
      )
      WITH CHECK (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
      );
  END IF;
END $$;

-- Service role: read-only for Edge Functions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'openrouter_config'
      AND policyname = 'service_role_read_openrouter'
  ) THEN
    CREATE POLICY "service_role_read_openrouter"
      ON public.openrouter_config FOR SELECT
      USING (auth.role() = 'service_role');
  END IF;
END $$;
