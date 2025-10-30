-- ============================================
-- DIAGNOSTIC QUERIES FOR IMAGE ATTACHMENT ISSUES
-- Run these queries in Supabase SQL Editor to diagnose the problem
-- ============================================

-- 1. CHECK IF ANY ATTACHMENTS EXIST AT ALL
-- This will show if attachment processing ever started
SELECT
  COUNT(*) as total_attachments,
  COUNT(CASE WHEN download_status = 'downloaded' THEN 1 END) as successful_downloads,
  COUNT(CASE WHEN upload_status = 'uploaded' THEN 1 END) as successful_uploads,
  COUNT(CASE WHEN download_status = 'failed' THEN 1 END) as failed_downloads,
  COUNT(CASE WHEN upload_status = 'failed' THEN 1 END) as failed_uploads,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as with_errors
FROM public.attachments;

-- 2. CHECK RECENT ATTACHMENT ATTEMPTS
-- Shows last 10 attachment processing attempts with details
SELECT
  a.id,
  a.filename,
  a.extension,
  a.mime_type,
  a.file_size,
  a.download_status,
  a.upload_status,
  a.error_message,
  a.original_url,
  a.storage_url,
  a.created_at,
  m.content as message_content
FROM public.attachments a
LEFT JOIN public.messages m ON m.id = a.message_id
ORDER BY a.created_at DESC
LIMIT 10;

-- 3. CHECK IF STORAGE BUCKET EXISTS
-- Verify the report-photos bucket is created
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE name = 'report-photos';

-- 4. CHECK STORAGE POLICIES
-- Verify service_role has permissions to upload
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%report-photos%'
ORDER BY policyname;

-- 5. CHECK ACTUAL FILES IN STORAGE
-- See if any files were uploaded to the bucket
SELECT
  name,
  bucket_id,
  owner,
  created_at,
  updated_at,
  last_accessed_at,
  metadata
FROM storage.objects
WHERE bucket_id = 'report-photos'
ORDER BY created_at DESC
LIMIT 10;

-- 6. CHECK MESSAGES WITH ATTACHMENT FLAG
-- See if messages are marked as having attachments
SELECT
  m.id,
  m.role,
  m.content,
  m.has_attachment,
  m.created_at,
  c.phone_number,
  COUNT(a.id) as actual_attachment_count
FROM public.messages m
LEFT JOIN public.conversations c ON c.id = m.conversation_id
LEFT JOIN public.attachments a ON a.message_id = m.id
WHERE m.has_attachment = true
GROUP BY m.id, m.role, m.content, m.has_attachment, m.created_at, c.phone_number
ORDER BY m.created_at DESC
LIMIT 10;

-- 7. CHECK WEBHOOK ERRORS
-- Look for attachment-related errors in webhook_errors table
SELECT
  source,
  error_type,
  error_message,
  error_stack,
  payload,
  created_at
FROM public.webhook_errors
WHERE source = 'fonnte-webhook'
  OR error_message LIKE '%attachment%'
  OR error_message LIKE '%storage%'
ORDER BY created_at DESC
LIMIT 10;

-- 8. CHECK RECENT CONVERSATIONS
-- See recent WhatsApp conversations to verify webhook is working
SELECT
  c.id,
  c.phone_number,
  c.customer_name,
  c.status,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM public.conversations c
LEFT JOIN public.messages m ON m.conversation_id = c.id
GROUP BY c.id, c.phone_number, c.customer_name, c.status
ORDER BY MAX(m.created_at) DESC
LIMIT 10;

-- ============================================
-- INTERPRETATION GUIDE:
-- ============================================
-- Query 1: If total_attachments = 0, attachment processing never started (payload check failed)
-- Query 2: Check error_message column to see specific failures
-- Query 3: If no rows returned, bucket doesn't exist (CRITICAL ISSUE)
-- Query 4: If no rows returned, no RLS policies exist (CRITICAL ISSUE)
-- Query 5: If no rows returned but attachments table has records, upload failed
-- Query 6: If has_attachment=true but actual_attachment_count=0, processing failed silently
-- Query 7: Shows recent errors that might explain failures
-- Query 8: Verifies webhook is receiving messages at all
