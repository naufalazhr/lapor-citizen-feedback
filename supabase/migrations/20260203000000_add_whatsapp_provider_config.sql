-- =============================================================================
-- Migration: Add WhatsApp Provider Configuration
-- Description: Adds support for multiple WhatsApp providers (Fonnte, Twilio)
-- Date: 2026-02-03
-- =============================================================================

-- Create enum for provider types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_provider') THEN
    CREATE TYPE public.whatsapp_provider AS ENUM ('fonnte', 'twilio');
  END IF;
END $$;

-- Create the whatsapp_provider_config table
CREATE TABLE IF NOT EXISTS public.whatsapp_provider_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Provider selection
  provider public.whatsapp_provider NOT NULL DEFAULT 'fonnte',
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Twilio-specific configuration
  -- Note: Twilio credentials (ACCOUNT_SID, AUTH_TOKEN) are stored in Supabase secrets
  -- Only the from_number is stored here as it may vary per tenant
  twilio_from_number TEXT, -- Format: whatsapp:+14155238886
  twilio_status_callback_url TEXT, -- Optional: for delivery receipts

  -- Metadata
  config_name VARCHAR(100) DEFAULT 'default' NOT NULL,
  notes TEXT, -- Admin notes about this configuration

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),

  -- Only one active config per tenant
  UNIQUE(tenant_id, config_name)
);

-- Add comments
COMMENT ON TABLE public.whatsapp_provider_config IS 'Configuration for selecting WhatsApp messaging provider (Fonnte or Twilio)';
COMMENT ON COLUMN public.whatsapp_provider_config.provider IS 'Active WhatsApp provider: fonnte or twilio';
COMMENT ON COLUMN public.whatsapp_provider_config.twilio_from_number IS 'Twilio WhatsApp sender number in format whatsapp:+14155238886';
COMMENT ON COLUMN public.whatsapp_provider_config.twilio_status_callback_url IS 'Optional webhook URL for Twilio delivery status callbacks';
COMMENT ON COLUMN public.whatsapp_provider_config.notes IS 'Admin notes about this configuration';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_whatsapp_provider_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whatsapp_provider_config_updated_at
  BEFORE UPDATE ON public.whatsapp_provider_config
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_provider_config_updated_at();

-- Enable RLS
ALTER TABLE public.whatsapp_provider_config ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- 1. Service role can read all configs (for Edge Functions)
CREATE POLICY "Service role can read whatsapp_provider_config"
ON public.whatsapp_provider_config
FOR SELECT
TO service_role
USING (true);

-- 2. All authenticated users can view configs (for status indicator)
CREATE POLICY "Authenticated users can view whatsapp_provider_config"
ON public.whatsapp_provider_config
FOR SELECT
TO authenticated
USING (true);

-- 3. Superadmins can manage config (full CRUD)
-- Only superadmins can change provider to prevent accidental switches
CREATE POLICY "Superadmins can manage whatsapp_provider_config"
ON public.whatsapp_provider_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'superadmin'
  )
);

-- =============================================================================
-- Create default config (Fonnte for backward compatibility)
-- =============================================================================
INSERT INTO public.whatsapp_provider_config (
  tenant_id,
  config_name,
  provider,
  is_active,
  notes
)
VALUES (
  NULL,
  'default',
  'fonnte',
  true,
  'Default configuration - using Fonnte for backward compatibility'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Enable Realtime for provider switch updates
-- =============================================================================
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'whatsapp_provider_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_provider_config;
  END IF;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
