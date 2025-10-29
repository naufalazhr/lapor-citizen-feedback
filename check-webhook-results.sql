-- ============================================================================
-- Check Webhook Test Results
-- Run these queries in Supabase SQL Editor to see what happened
-- ============================================================================

-- 1. Check recent conversations
SELECT
  id,
  phone_number,
  sender_name,
  session_id,
  status,
  device_number,
  started_at,
  last_message_at
FROM public.conversations
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check messages for each conversation
SELECT
  c.phone_number,
  c.session_id,
  m.role,
  m.message_index,
  LEFT(m.content, 100) as content_preview,
  m.created_at
FROM public.messages m
JOIN public.conversations c ON c.id = m.conversation_id
ORDER BY m.created_at DESC
LIMIT 20;

-- 3. Check for any webhook errors
SELECT
  source,
  error_type,
  error_message,
  LEFT(error_stack, 200) as error_stack_preview,
  created_at
FROM public.webhook_errors
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if chatId was extracted correctly
SELECT
  phone_number,
  session_id,
  CASE
    WHEN session_id LIKE 'temp_%' THEN '❌ Temporary (chatId NOT extracted)'
    WHEN LENGTH(session_id) > 30 THEN '✅ Real chatId from Flowise'
    ELSE '⚠️  Unknown format'
  END as session_id_status,
  started_at
FROM public.conversations
ORDER BY created_at DESC
LIMIT 10;

-- 5. Count messages per conversation (to see if history is building)
SELECT
  c.phone_number,
  c.session_id,
  c.status,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM public.conversations c
LEFT JOIN public.messages m ON m.conversation_id = c.id
GROUP BY c.id, c.phone_number, c.session_id, c.status
ORDER BY MAX(m.created_at) DESC
LIMIT 10;