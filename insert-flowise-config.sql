-- Insert actual Flowise configuration
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
  'default',
  true,
  'https://tanya-suhu.up.railway.app',
  '60JyzljIO4QbqNlwODZUYcXYKV8V-qOpCF59h3XPYBk',
  '487749ef-c4cd-4e17-b7a2-ec6376e482ea',
  false,
  30,
  '{}'::jsonb
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

-- Verify the configuration
SELECT
  id,
  config_name,
  is_active,
  api_url,
  LEFT(api_key, 20) || '...' as api_key_preview,
  chatflow_id,
  streaming,
  timeout_seconds,
  created_at
FROM public.flowise_config
WHERE config_name = 'default';