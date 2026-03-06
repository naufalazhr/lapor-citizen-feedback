-- ================================================================
-- Migration: Add AI Insight Provider Configuration
-- Date: 2026-03-06
-- Purpose: Track which AI provider (openrouter, byteplus) is active
--          for AI Insight features, similar to whatsapp_provider_config
-- ================================================================

-- Create enum for AI insight provider types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_insight_provider') THEN
    CREATE TYPE public.ai_insight_provider AS ENUM ('openrouter', 'byteplus');
  END IF;
END $$;

-- Create the ai_insight_provider_config table
CREATE TABLE IF NOT EXISTS public.ai_insight_provider_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider public.ai_insight_provider NOT NULL DEFAULT 'openrouter',
  is_active BOOLEAN NOT NULL DEFAULT true,
  config_name VARCHAR(100) DEFAULT 'default' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, config_name)
);

ALTER TABLE public.ai_insight_provider_config ENABLE ROW LEVEL SECURITY;

-- Superadmin: full cross-tenant access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_insight_provider_config'
      AND policyname = 'superadmin_all_ai_insight_provider'
  ) THEN
    CREATE POLICY "superadmin_all_ai_insight_provider"
      ON public.ai_insight_provider_config FOR ALL
      USING (has_role(auth.uid(), 'superadmin'));
  END IF;
END $$;

-- Admin/Owner: manage own tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_insight_provider_config'
      AND policyname = 'admin_owner_manage_ai_insight_provider'
  ) THEN
    CREATE POLICY "admin_owner_manage_ai_insight_provider"
      ON public.ai_insight_provider_config FOR ALL
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

-- Service role: read for Edge Functions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_insight_provider_config'
      AND policyname = 'service_role_read_ai_insight_provider'
  ) THEN
    CREATE POLICY "service_role_read_ai_insight_provider"
      ON public.ai_insight_provider_config FOR SELECT
      USING (auth.role() = 'service_role');
  END IF;
END $$;
