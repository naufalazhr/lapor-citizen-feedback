-- ============================================
-- Fix Attachment Storage Configuration
-- Created: 2025-10-30
-- Purpose: Ensure report-photos bucket exists and has correct permissions
-- ============================================

-- 1. CREATE STORAGE BUCKET (if not exists)
-- This bucket stores WhatsApp attachment files uploaded via Fonnte webhook
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-photos',
  'report-photos',
  true, -- Public bucket so images can be viewed in dashboard
  10485760, -- 10MB limit (10 * 1024 * 1024 bytes)
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'video/mp4',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'audio/mpeg'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'video/mp4',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'audio/mpeg'
  ]::text[];

-- 2. DROP EXISTING POLICIES (clean slate)
DROP POLICY IF EXISTS "Service role can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update attachments" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;

-- 3. CREATE POLICIES FOR SERVICE_ROLE (Edge Functions)
-- Allow service_role to INSERT files (upload from webhook)
CREATE POLICY "Service role can upload attachments"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'report-photos');

-- Allow service_role to SELECT files (read for processing)
CREATE POLICY "Service role can read attachments"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'report-photos');

-- Allow service_role to UPDATE files (if needed)
CREATE POLICY "Service role can update attachments"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'report-photos')
WITH CHECK (bucket_id = 'report-photos');

-- Allow service_role to DELETE files (cleanup)
CREATE POLICY "Service role can delete attachments"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'report-photos');

-- 4. CREATE POLICY FOR PUBLIC READ ACCESS
-- Allow anyone to view/download attachments (needed for dashboard)
CREATE POLICY "Public can read attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'report-photos');

-- 5. CREATE POLICY FOR AUTHENTICATED USERS
-- Allow authenticated users (admin dashboard) to read attachments
CREATE POLICY "Authenticated users can read attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'report-photos');

-- 6. VERIFY CONFIGURATION
-- Run this query to verify bucket and policies are created correctly:
-- SELECT
--   b.id as bucket_id,
--   b.name as bucket_name,
--   b.public,
--   b.file_size_limit,
--   b.allowed_mime_types,
--   (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%report-photos%') as policy_count
-- FROM storage.buckets b
-- WHERE b.name = 'report-photos';

-- Note: COMMENT command removed due to permission restrictions in managed environments
