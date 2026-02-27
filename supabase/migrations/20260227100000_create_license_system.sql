-- ================================================================
-- Migration: Create License System
-- Date: 2026-02-27
-- Purpose:
--   1. Create license_activations table (track redeemed tokens)
--   2. Add license columns to tenants table
-- ================================================================

-- ================================================================
-- 1. Create license_activations table
--    Stores locally redeemed tokens with SHA-256 hash for anti-reuse.
--    The cryptographic validation (Ed25519) happens in the Edge Function,
--    NOT in the database — this table is only for state tracking.
-- ================================================================
CREATE TABLE IF NOT EXISTS public.license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT UNIQUE NOT NULL,        -- SHA-256 hex of raw 84-byte token (anti-reuse key)
  token_id BIGINT NOT NULL,               -- token_id from Ed25519 payload (uint32)
  plan_tier TEXT NOT NULL,               -- 'starter' | 'pro' | 'enterprise'
  max_users INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  features_bitmap INTEGER NOT NULL DEFAULT 1,
  customer_id INTEGER,                   -- customer_id from token payload
  issued_at TIMESTAMPTZ NOT NULL,        -- issued_at from token payload
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: owner/admin/superadmin can read; insertion only via Edge Function (service_role)
ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'license_activations'
      AND policyname = 'tenant_admin_read_own_activations'
  ) THEN
    CREATE POLICY "tenant_admin_read_own_activations"
      ON public.license_activations
      FOR SELECT
      USING (
        tenant_id = get_user_tenant_id(auth.uid())
        AND (
          has_role(auth.uid(), 'owner')
          OR has_role(auth.uid(), 'admin')
          OR has_role(auth.uid(), 'superadmin')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'license_activations'
      AND policyname = 'service_role_all_activations'
  ) THEN
    CREATE POLICY "service_role_all_activations"
      ON public.license_activations
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ================================================================
-- 2. Add license tracking columns to tenants table
--    These reflect the currently active license for the tenant.
-- ================================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'unlicensed',
  ADD COLUMN IF NOT EXISTS license_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS license_plan TEXT,
  ADD COLUMN IF NOT EXISTS license_max_users INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS license_features_bitmap INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS license_activated_at TIMESTAMPTZ;

-- Add a comment explaining the license_status values
COMMENT ON COLUMN public.tenants.license_status IS
  'unlicensed | active | grace_period | expired';