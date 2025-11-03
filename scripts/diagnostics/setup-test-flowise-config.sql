-- ============================================================================
-- Setup Test Flowise Configuration
-- Run this in Supabase SQL Editor before testing the webhook
-- ============================================================================

-- IMPORTANT: Replace these placeholder values with your actual Flowise credentials
-- 1. api_url: Your Flowise instance URL (e.g., https://your-flowise.com)
-- 2. api_key: Your Flowise API key (Bearer token)
-- 3. chatflow_id: Your specific chatflow ID from Flowise

INSERT INTO public.flowise_config (
  config_name,
  is_active,
  api_url,
  api_key,
  chatflow_id,
  streaming,
  timeout_seconds,
  session_variables
) VALUES (
  'default',                                    -- config_name
  true,                                         -- is_active (only one can be active)
  'https://your-flowise-instance.com',          -- ⚠️ REPLACE: Your Flowise API URL
  'your-flowise-api-key-here',                  -- ⚠️ REPLACE: Your Flowise API Key
  'your-chatflow-id-here',                      -- ⚠️ REPLACE: Your Chatflow ID
  false,                                        -- streaming (false for simpler handling)
  30,                                           -- timeout_seconds
  '{}'::jsonb                                   -- session_variables (empty for now)
)
ON CONFLICT (config_name) DO UPDATE
SET
  is_active = EXCLUDED.is_active,
  api_url = EXCLUDED.api_url,
  api_key = EXCLUDED.api_key,
  chatflow_id = EXCLUDED.chatflow_id,
  streaming = EXCLUDED.streaming,
  timeout_seconds = EXCLUDED.timeout_seconds,
  session_variables = EXCLUDED.session_variables,
  updated_at = NOW();

-- Verify the configuration was inserted
SELECT
  id,
  config_name,
  is_active,
  api_url,
  LEFT(api_key, 20) || '...' as api_key_preview,  -- Show only first 20 chars for security
  chatflow_id,
  streaming,
  timeout_seconds,
  created_at
FROM public.flowise_config
WHERE config_name = 'default';

-- ============================================================================
-- How to get your Flowise credentials:
-- ============================================================================
--
-- 1. API URL: The base URL of your Flowise instance
--    Example: https://flowise.yourcompany.com
--
-- 2. API Key: From Flowise Dashboard > API Keys
--    Create a new API key if you don't have one
--
-- 3. Chatflow ID: From your chatflow URL
--    Example: If URL is https://flowise.com/chatflow/abc123
--    Then chatflow_id is: abc123
--
-- ============================================================================