-- ================================================================
-- Migration: Add BytePlus AI Config
-- Date: 2026-03-06
-- Purpose: Create byteplus_config table for BytePlus AI Insight channel
-- ================================================================

CREATE TABLE IF NOT EXISTS public.byteplus_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  config_name VARCHAR(100) NOT NULL DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  api_key TEXT,
  base_url TEXT NOT NULL DEFAULT 'https://ark.ap-southeast.bytepluses.com/api/v3',
  default_model TEXT DEFAULT 'seed-2-0-lite-260228',
  max_tokens INTEGER DEFAULT 2048,
  temperature NUMERIC(3,2) DEFAULT 0.70,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, config_name)
);

ALTER TABLE public.byteplus_config ENABLE ROW LEVEL SECURITY;

-- Superadmin: full cross-tenant access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'byteplus_config'
      AND policyname = 'superadmin_all_byteplus'
  ) THEN
    CREATE POLICY "superadmin_all_byteplus"
      ON public.byteplus_config FOR ALL
      USING (has_role(auth.uid(), 'superadmin'));
  END IF;
END $$;

-- Admin/Owner: manage own tenant only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'byteplus_config'
      AND policyname = 'admin_owner_manage_byteplus_own_tenant'
  ) THEN
    CREATE POLICY "admin_owner_manage_byteplus_own_tenant"
      ON public.byteplus_config FOR ALL
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
    WHERE tablename = 'byteplus_config'
      AND policyname = 'service_role_read_byteplus'
  ) THEN
    CREATE POLICY "service_role_read_byteplus"
      ON public.byteplus_config FOR SELECT
      USING (auth.role() = 'service_role');
  END IF;
END $$;
