-- ============================================================================
-- Check Webhook Data (Run in Supabase Dashboard SQL Editor with admin access)
-- ============================================================================

-- 1. Check all conversations
SELECT
  id,
  session_id,
  phone_number,
  sender_name,
  status,
  channel,
  device_number,
  started_at,
  last_message_at,
  completed_at
FROM public.conversations
ORDER BY created_at DESC;

-- 2. Check all messages
SELECT
  m.id,
  c.phone_number,
  c.session_id,
  m.role,
  m.message_index,
  m.content,
  m.has_attachment,
  m.created_at
FROM public.messages m
JOIN public.conversations c ON c.id = m.conversation_id
ORDER BY m.created_at DESC;

-- 3. Check webhook errors
SELECT
  id,
  source,
  error_type,
  error_message,
  error_stack,
  payload,
  conversation_id,
  created_at
FROM public.webhook_errors
ORDER BY created_at DESC;

-- 4. Check attachments
SELECT
  a.id,
  m.conversation_id,
  a.original_url,
  a.storage_path,
  a.filename,
  a.file_type,
  a.file_size,
  a.download_status,
  a.upload_status,
  a.created_at
FROM public.attachments a
JOIN public.messages m ON m.id = a.message_id
ORDER BY a.created_at DESC;

-- 5. Check fonnte_config
SELECT
  id,
  config_name,
  is_active,
  session_timeout_minutes,
  max_file_size_mb,
  allowed_file_extensions,
  api_token,
  created_at
FROM public.fonnte_config;

-- 6. Check flowise_config
SELECT
  id,
  config_name,
  is_active,
  api_url,
  api_key,
  chatflow_id,
  timeout_seconds,
  max_retries,
  created_at
FROM public.flowise_config;

-- 7. Count statistics
SELECT
  'conversations' as table_name,
  COUNT(*) as total_count
FROM public.conversations
UNION ALL
SELECT
  'messages' as table_name,
  COUNT(*) as total_count
FROM public.messages
UNION ALL
SELECT
  'webhook_errors' as table_name,
  COUNT(*) as total_count
FROM public.webhook_errors
UNION ALL
SELECT
  'attachments' as table_name,
  COUNT(*) as total_count
FROM public.attachments;