-- Add video attachment support to the Lapor platform
-- 1. Add video_url column to reports table
-- 2. Increase storage bucket file size limit from 10MB to 20MB (WhatsApp videos up to 16MB)
-- 3. Update attachments table file size constraint to 20MB

-- Add video_url to reports (nullable, alongside existing photo_url)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Increase report-photos bucket size limit to 20MB for video support
UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'report-photos';

-- Update attachments file size constraint to 20MB
ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS chk_file_size;
ALTER TABLE public.attachments ADD CONSTRAINT chk_file_size
  CHECK (file_size IS NULL OR file_size <= 20971520);
