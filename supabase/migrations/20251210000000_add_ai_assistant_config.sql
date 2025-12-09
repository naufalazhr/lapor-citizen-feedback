-- =============================================================================
-- Migration: Add AI Assistant Configuration for Human-in-the-Loop Control
-- Description: Enables admin to toggle AI on/off with preset text responses
-- Date: 2025-12-10
-- =============================================================================

-- Create the ai_assistant_config table
CREATE TABLE IF NOT EXISTS public.ai_assistant_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  config_name VARCHAR(100) DEFAULT 'default' NOT NULL,

  -- AI governance controls
  is_ai_enabled BOOLEAN DEFAULT true NOT NULL,
  ai_disabled_at TIMESTAMP WITH TIME ZONE,
  ai_disabled_by UUID REFERENCES auth.users(id),

  -- Preset text when AI is disabled
  preset_reply_text TEXT DEFAULT 'Terima kasih telah menghubungi kami. Saat ini layanan AI asisten sedang tidak aktif. Silakan hubungi admin atau coba lagi nanti.' NOT NULL,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),

  -- Ensure one config per tenant per name
  UNIQUE(tenant_id, config_name)
);

-- Add comments
COMMENT ON TABLE public.ai_assistant_config IS 'AI Assistant governance configuration for human-in-the-loop control';
COMMENT ON COLUMN public.ai_assistant_config.is_ai_enabled IS 'When false, AI is bypassed and preset_reply_text is used';
COMMENT ON COLUMN public.ai_assistant_config.preset_reply_text IS 'Message sent when AI is disabled';
COMMENT ON COLUMN public.ai_assistant_config.ai_disabled_at IS 'Timestamp when AI was last disabled';
COMMENT ON COLUMN public.ai_assistant_config.ai_disabled_by IS 'User who disabled the AI';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_assistant_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_assistant_config_updated_at
  BEFORE UPDATE ON public.ai_assistant_config
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_assistant_config_updated_at();

-- Enable RLS
ALTER TABLE public.ai_assistant_config ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- 1. Service role can read all configs (for Edge Functions)
CREATE POLICY "Service role can read ai_assistant_config"
ON public.ai_assistant_config
FOR SELECT
TO service_role
USING (true);

-- 2. All authenticated users can view configs (for status indicator)
-- This allows members to see the AI status on their dashboard
CREATE POLICY "Authenticated users can view ai_assistant_config"
ON public.ai_assistant_config
FOR SELECT
TO authenticated
USING (true);

-- 3. Admins/Owners can update config
CREATE POLICY "Admins can update ai_assistant_config"
ON public.ai_assistant_config
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner', 'superadmin')
  )
);

-- 4. Admins/Owners can insert config
CREATE POLICY "Admins can insert ai_assistant_config"
ON public.ai_assistant_config
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner', 'superadmin')
  )
);

-- 5. Superadmins can delete config
CREATE POLICY "Superadmins can delete ai_assistant_config"
ON public.ai_assistant_config
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'superadmin'
  )
);

-- =============================================================================
-- Create default config (global config without tenant_id for simplicity)
-- =============================================================================
INSERT INTO public.ai_assistant_config (tenant_id, config_name, is_ai_enabled, preset_reply_text)
VALUES (NULL, 'default', true, 'Terima kasih telah menghubungi kami. Saat ini layanan AI asisten sedang tidak aktif. Silakan hubungi admin atau coba lagi nanti.')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Enable Realtime for status indicator updates
-- =============================================================================
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'ai_assistant_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_assistant_config;
  END IF;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
