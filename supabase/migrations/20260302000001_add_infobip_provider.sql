-- =============================================================================
-- Add Infobip WhatsApp Provider
-- Adds 'infobip' to whatsapp_provider enum and creates infobip_config table
-- =============================================================================

-- 1. Add 'infobip' to whatsapp_provider enum (if enum exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_provider') THEN
    ALTER TYPE public.whatsapp_provider ADD VALUE IF NOT EXISTS 'infobip';
  END IF;
END$$;

-- 2. Create infobip_config table
CREATE TABLE IF NOT EXISTS public.infobip_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  config_name TEXT NOT NULL DEFAULT 'default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  api_key TEXT,
  base_url TEXT,
  sender_number TEXT,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT infobip_config_tenant_name_unique UNIQUE (tenant_id, config_name),
  CONSTRAINT infobip_config_timeout_check CHECK (session_timeout_minutes >= 5 AND session_timeout_minutes <= 1440)
);

-- 3. Enable RLS
ALTER TABLE public.infobip_config ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Service role: full access (for Edge Functions)
DROP POLICY IF EXISTS "Service role full access on infobip_config" ON public.infobip_config;
CREATE POLICY "Service role full access on infobip_config"
  ON public.infobip_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admin/owner: manage their own tenant's config
DROP POLICY IF EXISTS "Admin/owner manage own tenant infobip_config" ON public.infobip_config;
CREATE POLICY "Admin/owner manage own tenant infobip_config"
  ON public.infobip_config
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'owner'::app_role) OR
      has_role(auth.uid(), 'superadmin'::app_role)
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'owner'::app_role) OR
      has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

-- 5. Trigger: auto-deactivate other rows when a new active row is inserted/updated
-- Ensures only one active config per tenant (same pattern as fonnte_config)
CREATE OR REPLACE FUNCTION public.ensure_single_active_infobip_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.infobip_config
    SET is_active = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_single_active_infobip_config_trigger ON public.infobip_config;
CREATE TRIGGER ensure_single_active_infobip_config_trigger
  AFTER INSERT OR UPDATE OF is_active ON public.infobip_config
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_active_infobip_config();

-- 6. Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_infobip_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_infobip_config_updated_at_trigger ON public.infobip_config;
CREATE TRIGGER update_infobip_config_updated_at_trigger
  BEFORE UPDATE ON public.infobip_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_infobip_config_updated_at();
