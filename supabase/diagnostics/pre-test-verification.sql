-- =============================================================================
-- Pre-Test Verification Script
-- Run this before testing image attachments to ensure everything is configured
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Storage Bucket Verification
-- -----------------------------------------------------------------------------
SELECT
  '1. STORAGE BUCKET' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE id = 'report-photos' AND public = true
    ) THEN '✅ Bucket exists and is public'
    ELSE '❌ Bucket missing or not public - run migration 20251030060000_fix_attachment_storage.sql'
  END as status;

-- Show bucket details
SELECT
  '1a. Bucket Details' as section,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'report-photos';

-- -----------------------------------------------------------------------------
-- 2. Storage Policies Verification
-- -----------------------------------------------------------------------------
SELECT
  '2. STORAGE POLICIES' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM storage.policies
      WHERE bucket_id = 'report-photos'
        AND policyname = 'Service role can upload attachments'
        AND cmd = 'INSERT'
    ) THEN '✅ Service role INSERT policy exists'
    ELSE '❌ Service role INSERT policy missing'
  END as status;

SELECT
  '2a. Public Read Policy' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM storage.policies
      WHERE bucket_id = 'report-photos'
        AND policyname = 'Public can read attachments'
        AND cmd = 'SELECT'
    ) THEN '✅ Public SELECT policy exists'
    ELSE '❌ Public SELECT policy missing'
  END as status;

-- Show all policies for report-photos bucket
SELECT
  '2b. All Policies' as section,
  policyname,
  cmd,
  roles,
  qual
FROM storage.policies
WHERE bucket_id = 'report-photos';

-- -----------------------------------------------------------------------------
-- 3. Database Tables Verification
-- -----------------------------------------------------------------------------
SELECT
  '3. ATTACHMENTS TABLE' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'attachments'
    ) THEN '✅ Attachments table exists'
    ELSE '❌ Attachments table missing'
  END as status;

-- Show attachments table structure
SELECT
  '3a. Attachments Columns' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'attachments'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- 4. Messages Table Verification
-- -----------------------------------------------------------------------------
SELECT
  '4. MESSAGES TABLE' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'messages'
        AND column_name = 'has_attachment'
    ) THEN '✅ Messages table has has_attachment column'
    ELSE '❌ Messages table missing has_attachment column'
  END as status;

-- Verify message_index is INTEGER (not allowing decimals)
SELECT
  '4a. Message Index Type' as section,
  column_name,
  data_type,
  CASE
    WHEN data_type = 'integer' THEN '✅ Correct (integer)'
    ELSE '❌ Wrong type: ' || data_type
  END as status
FROM information_schema.columns
WHERE table_name = 'messages'
  AND column_name = 'message_index';

-- -----------------------------------------------------------------------------
-- 5. Recent Test Data
-- -----------------------------------------------------------------------------
SELECT
  '5. RECENT MESSAGES' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM messages
      WHERE created_at > NOW() - INTERVAL '24 hours'
    ) THEN '✅ ' || COUNT(*)::text || ' messages in last 24h'
    ELSE '⚠️  No recent messages'
  END as status
FROM messages
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Show recent messages with attachment status
SELECT
  '5a. Recent Message Details' as section,
  id,
  role,
  LEFT(content, 50) as content_preview,
  has_attachment,
  message_index,
  created_at
FROM messages
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- 6. Recent Attachments
-- -----------------------------------------------------------------------------
SELECT
  '6. RECENT ATTACHMENTS' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM attachments
      WHERE created_at > NOW() - INTERVAL '24 hours'
    ) THEN '✅ ' || COUNT(*)::text || ' attachments in last 24h'
    ELSE '⚠️  No recent attachments (expected if not tested yet)'
  END as status
FROM attachments
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Show recent attachments with status
SELECT
  '6a. Recent Attachment Details' as section,
  id,
  filename,
  extension,
  download_status,
  upload_status,
  error_message,
  created_at
FROM attachments
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- 7. Webhook Errors Check
-- -----------------------------------------------------------------------------
SELECT
  '7. RECENT WEBHOOK ERRORS' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM webhook_errors
      WHERE created_at > NOW() - INTERVAL '24 hours'
    ) THEN '⚠️  ' || COUNT(*)::text || ' errors in last 24h - review below'
    ELSE '✅ No webhook errors in last 24h'
  END as status
FROM webhook_errors
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Show recent errors
SELECT
  '7a. Error Details' as section,
  source,
  error_type,
  error_message,
  created_at
FROM webhook_errors
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- 8. Flowise Configuration
-- -----------------------------------------------------------------------------
SELECT
  '8. FLOWISE CONFIG' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM flowise_config
      WHERE is_active = true
    ) THEN '✅ Active Flowise config exists'
    ELSE '❌ No active Flowise config'
  END as status;

-- Show active config (without sensitive data)
SELECT
  '8a. Active Config Details' as section,
  id,
  name,
  chatflow_id,
  LEFT(api_url, 30) || '...' as api_url_preview,
  streaming,
  timeout_seconds,
  is_active
FROM flowise_config
WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- 9. Fonnte Configuration
-- -----------------------------------------------------------------------------
SELECT
  '9. FONNTE CONFIG' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM fonnte_config
      WHERE api_token IS NOT NULL AND api_token != ''
    ) THEN '✅ Fonnte API token configured'
    ELSE '❌ Fonnte API token missing'
  END as status;

-- -----------------------------------------------------------------------------
-- 10. Storage Objects Check
-- -----------------------------------------------------------------------------
SELECT
  '10. STORAGE OBJECTS' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'report-photos'
    ) THEN '✅ ' || COUNT(*)::text || ' files in report-photos bucket'
    ELSE '⚠️  No files in bucket (expected if not tested yet)'
  END as status
FROM storage.objects
WHERE bucket_id = 'report-photos';

-- Show recent storage objects
SELECT
  '10a. Recent Files' as section,
  name,
  metadata->>'size' as size_bytes,
  created_at,
  updated_at
FROM storage.objects
WHERE bucket_id = 'report-photos'
ORDER BY created_at DESC
LIMIT 10;

-- =============================================================================
-- SUMMARY STATUS
-- =============================================================================
SELECT
  '═══════════════════════════════════════' as divider,
  'SUMMARY' as section,
  '═══════════════════════════════════════' as status;

SELECT
  'Ready to Test' as summary,
  CASE
    WHEN
      -- All critical checks must pass
      EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'report-photos' AND public = true) AND
      EXISTS (SELECT 1 FROM storage.policies WHERE bucket_id = 'report-photos' AND cmd = 'INSERT') AND
      EXISTS (SELECT 1 FROM storage.policies WHERE bucket_id = 'report-photos' AND cmd = 'SELECT') AND
      EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachments') AND
      EXISTS (SELECT 1 FROM flowise_config WHERE is_active = true) AND
      EXISTS (SELECT 1 FROM fonnte_config WHERE api_token IS NOT NULL)
    THEN '✅✅✅ ALL SYSTEMS READY - You can test now! ✅✅✅'
    ELSE '❌ NOT READY - Review errors above'
  END as status;

-- Next steps if ready
SELECT
  'Next Steps' as instruction,
  '1. Send WhatsApp image to Fonnte number
2. Run: npx supabase functions logs fonnte-webhook --tail
3. Look for these log sections:
   - ✓ Payload validation passed
   - ✓ Attachment processed successfully
   - 🖼️ Image URL detected in question
   - 📥 Flowise API Response
4. Verify no .split() errors
5. Check Flowise response mentions image content
6. Re-run this script to see attachment data' as details;
