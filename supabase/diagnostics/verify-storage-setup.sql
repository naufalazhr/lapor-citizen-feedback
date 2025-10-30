-- ============================================
-- VERIFY STORAGE BUCKET SETUP
-- Run this after migration to confirm everything is configured correctly
-- ============================================

-- 1. CHECK STORAGE BUCKET EXISTS
SELECT
  '=== STORAGE BUCKET ===' as section,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE name = 'report-photos';

-- Expected: 1 row with public=true, file_size_limit=10485760

-- 2. CHECK RLS POLICIES
SELECT
  '=== RLS POLICIES ===' as section,
  policyname as policy_name,
  cmd as operation,
  roles,
  CASE
    WHEN policyname LIKE '%Service role%' THEN 'Edge Function Access'
    WHEN policyname LIKE '%Public%' THEN 'Dashboard View Access'
    WHEN policyname LIKE '%Authenticated%' THEN 'Dashboard View Access'
    ELSE 'Other'
  END as purpose
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%report-photos%'
ORDER BY policyname;

-- Expected: At least 6 policies
-- - Service role can upload attachments (INSERT, service_role)
-- - Service role can read attachments (SELECT, service_role)
-- - Service role can update attachments (UPDATE, service_role)
-- - Service role can delete attachments (DELETE, service_role)
-- - Public can read attachments (SELECT, public)
-- - Authenticated users can read attachments (SELECT, authenticated)

-- 3. COUNT POLICIES
SELECT
  '=== POLICY COUNT ===' as section,
  COUNT(*) as total_policies,
  COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
  COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
  COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
  COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%report-photos%';

-- Expected: total_policies >= 6

-- 4. CHECK IF ANY FILES EXIST IN BUCKET
SELECT
  '=== CURRENT FILES ===' as section,
  COUNT(*) as total_files,
  COALESCE(SUM((metadata->>'size')::bigint), 0) as total_bytes,
  ROUND(COALESCE(SUM((metadata->>'size')::bigint), 0) / 1024.0 / 1024.0, 2) as total_mb
FROM storage.objects
WHERE bucket_id = 'report-photos';

-- Expected: May be 0 files if no attachments processed yet

-- 5. CHECK BUCKET PERMISSIONS (Test if bucket is publicly accessible)
SELECT
  '=== BUCKET ACCESS TEST ===' as section,
  CASE
    WHEN public = true THEN '✓ Bucket is PUBLIC - Dashboard can view images'
    ELSE '✗ Bucket is PRIVATE - Dashboard cannot view images'
  END as access_status,
  CASE
    WHEN file_size_limit = 10485760 THEN '✓ File size limit: 10MB'
    WHEN file_size_limit IS NULL THEN '⚠ No file size limit set'
    ELSE '⚠ File size limit: ' || (file_size_limit / 1024 / 1024) || 'MB'
  END as size_limit_status
FROM storage.buckets
WHERE name = 'report-photos';

-- 6. SUMMARY - READY STATUS
SELECT
  '=== SETUP STATUS ===' as section,
  CASE
    WHEN bucket_exists.count > 0 AND policy_count.count >= 6 THEN
      '✓✓✓ STORAGE FULLY CONFIGURED - Ready for attachments!'
    WHEN bucket_exists.count > 0 AND policy_count.count < 6 THEN
      '⚠ Bucket exists but missing some policies - Check policy list above'
    WHEN bucket_exists.count = 0 THEN
      '✗ Bucket does not exist - Migration may have failed'
    ELSE
      '⚠ Unknown state - Review results above'
  END as status,
  bucket_exists.count as bucket_count,
  policy_count.count as policy_count
FROM
  (SELECT COUNT(*) as count FROM storage.buckets WHERE name = 'report-photos') bucket_exists,
  (SELECT COUNT(*) as count FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%report-photos%') policy_count;

-- ============================================
-- INTERPRETATION:
-- ============================================
-- ✓ = Success, everything is configured correctly
-- ⚠ = Warning, something might be wrong
-- ✗ = Error, critical issue
--
-- If you see "✓✓✓ STORAGE FULLY CONFIGURED", you can proceed to deploy the Edge Function!
