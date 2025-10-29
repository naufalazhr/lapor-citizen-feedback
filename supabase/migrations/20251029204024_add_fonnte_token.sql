-- =============================================================================
-- Migration: Add Fonnte API Token to fonnte_config
-- Description: Adds api_token field to store Fonnte authentication token
-- Date: 2025-10-29
-- =============================================================================

-- Add api_token column to fonnte_config table
ALTER TABLE public.fonnte_config
ADD COLUMN IF NOT EXISTS api_token TEXT;

-- Add comment
COMMENT ON COLUMN public.fonnte_config.api_token IS 'Fonnte API token for sending messages (Authorization header)';

-- Update existing default config with the token
UPDATE public.fonnte_config
SET api_token = 'XJcZd5ARToBoPgAtEyQp'
WHERE config_name = 'default';

-- Verify
SELECT
  id,
  config_name,
  is_active,
  LEFT(api_token, 10) || '...' as api_token_preview,
  device_numbers,
  auto_reply_enabled,
  session_timeout_minutes,
  created_at
FROM public.fonnte_config
WHERE config_name = 'default';