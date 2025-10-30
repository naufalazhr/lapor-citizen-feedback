# WhatsApp Image Attachment Fix - Deployment Guide

## 📋 Summary of Changes

This fix addresses the issue where images sent via WhatsApp were not being stored or displayed in the dashboard.

### Root Causes Identified:
1. **Silent Failure**: Attachment processing errors were not visible (caught and swallowed)
2. **Storage Bucket Misconfiguration**: Missing or improperly configured `report-photos` bucket
3. **Missing Logging**: No diagnostic information to identify failures
4. **Frontend Gap**: Dashboard didn't query or display attachments even when stored

### What Was Fixed:

#### Backend (Edge Function):
- ✅ Added comprehensive logging to track attachment processing pipeline
- ✅ Added error tracking to `webhook_errors` table for failed attachments
- ✅ Added step-by-step logging in attachment processor
- ✅ Improved error messages with detailed context

#### Database:
- ✅ Created migration to ensure `report-photos` bucket exists
- ✅ Added RLS policies for service_role to upload files
- ✅ Added public read policies for dashboard access
- ✅ Created diagnostic SQL queries

#### Frontend (Dashboard):
- ✅ Created `AttachmentDisplay` component for rich image/file display
- ✅ Updated `Conversations.tsx` to fetch attachments from database
- ✅ Added image preview with full-screen view
- ✅ Added download functionality
- ✅ Added support for multiple file types (images, videos, documents, audio)

---

## 🚀 Deployment Steps

### Step 1: Run Database Migrations

```bash
# Apply the storage bucket configuration migration
npx supabase db push

# Or if using migration files directly:
npx supabase migration up
```

**This will:**
- Create/update the `report-photos` storage bucket
- Set up proper RLS policies for Edge Functions and public access
- Configure file size limits (10MB) and allowed MIME types

### Step 2: Run Diagnostic Queries

Before deploying code changes, check current state:

```bash
# Open Supabase SQL Editor and run:
cat supabase/diagnostics/check-attachments.sql
```

**Important queries to run:**

```sql
-- 1. Check if any attachments exist
SELECT COUNT(*) FROM public.attachments;

-- 2. Check if storage bucket exists
SELECT * FROM storage.buckets WHERE name = 'report-photos';

-- 3. Check storage policies
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%report-photos%';
```

**Expected results:**
- Bucket should exist with `public = true`
- At least 6 policies should exist (service_role INSERT/SELECT/UPDATE/DELETE, public SELECT, authenticated SELECT)

### Step 3: Deploy Edge Function

```bash
# Deploy the updated fonnte-webhook function
npx supabase functions deploy fonnte-webhook

# Verify deployment
npx supabase functions list
```

### Step 4: Deploy Frontend

```bash
# Build and deploy frontend (adjust for your deployment method)
npm run build

# If using Vercel/Netlify/etc:
# Follow your normal deployment process
```

### Step 5: Test the Integration

#### Test 1: Send WhatsApp Message with Image

1. Send a test WhatsApp message with an image to your Fonnte number
2. Check Edge Function logs immediately:

```bash
npx supabase functions logs fonnte-webhook --tail
```

**Look for these log messages:**

```
✓ Success indicators:
  - "Received webhook from Fonnte:"
  - "Attachment check: { hasUrl: true, hasFilename: true, hasExtension: true }"
  - "✓ Starting attachment processing:"
  - "[Attachment] Step 1: Downloading from Fonnte URL..."
  - "[Attachment] ✓ Downloaded X bytes"
  - "[Attachment] Step 2: Uploading to Supabase Storage..."
  - "[Attachment] ✓ Uploaded successfully"
  - "[Attachment] ✓✓✓ ATTACHMENT PROCESSING COMPLETE ✓✓✓"

✗ Failure indicators:
  - "✗ Skipping attachment processing - missing required fields"
  - "[Attachment] ✗ Download failed:"
  - "[Attachment] ✗ Upload failed:"
  - "✗ Attachment processing returned null"
```

#### Test 2: Verify Database Storage

```sql
-- Check if attachment was stored
SELECT
  a.id,
  a.filename,
  a.download_status,
  a.upload_status,
  a.storage_url,
  a.error_message,
  m.content as message_content
FROM public.attachments a
JOIN public.messages m ON m.id = a.message_id
ORDER BY a.created_at DESC
LIMIT 5;
```

**Expected result:**
- New record with `download_status = 'downloaded'` and `upload_status = 'uploaded'`
- `storage_url` should be populated with a valid URL
- `error_message` should be NULL

#### Test 3: Verify Storage File

```sql
-- Check if file exists in storage
SELECT
  name,
  bucket_id,
  created_at,
  metadata
FROM storage.objects
WHERE bucket_id = 'report-photos'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected result:**
- File should appear in `report-photos` bucket
- Path should be: `whatsapp-attachments/{timestamp}_{filename}`

#### Test 4: Verify Frontend Display

1. Open admin dashboard
2. Navigate to **Conversations** page
3. Find the test conversation
4. Click "View Messages"
5. **Expected behavior:**
   - Image should display inline in the conversation
   - Image should be clickable for full-screen preview
   - Download button should work
   - File metadata (filename, size) should show

---

## 🔍 Troubleshooting Guide

### Issue: No attachments being stored

**Diagnosis:**
```bash
# Check Edge Function logs
npx supabase functions logs fonnte-webhook --tail

# Send test message with image and watch logs
```

**Possible causes:**

#### 1. Fonnte not sending attachment fields
**Log indicator:** `"✗ Skipping attachment processing - missing required fields"`

**Solution:**
- Check Fonnte webhook configuration
- Verify webhook URL is correct
- Check `allPayloadFields` in logs to see what Fonnte sends
- Fonnte might send different field names - check documentation

#### 2. Storage bucket doesn't exist
**Log indicator:** `"[Attachment] ✗ Upload failed:"`

**Solution:**
```sql
-- Run this manually if migration didn't work:
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-photos', 'report-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
```

#### 3. Permission denied on storage
**Log indicator:** `"Failed to upload to storage: new row violates row-level security policy"`

**Solution:**
```sql
-- Verify service_role policies exist:
SELECT * FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%Service role%';

-- If missing, run the migration again:
-- supabase/migrations/20251030000000_fix_attachment_storage.sql
```

#### 4. Download from Fonnte fails
**Log indicator:** `"[Attachment] ✗ Download error: HTTP 403"` or timeout

**Possible causes:**
- Fonnte URL expired (they expire after some time)
- Network/firewall issue from Supabase Edge
- Invalid Fonnte URL

**Solution:**
- Check Fonnte webhook logs
- Verify URLs are accessible
- Contact Fonnte support if URLs are consistently failing

### Issue: Attachments stored but not displaying in dashboard

**Diagnosis:**
```sql
-- Check if attachments exist in DB
SELECT COUNT(*) FROM public.attachments WHERE upload_status = 'uploaded';

-- If count > 0, attachments are stored but not showing in UI
```

**Possible causes:**

1. **Frontend not deployed**
   - Deploy latest frontend code
   - Clear browser cache

2. **Storage bucket not public**
   ```sql
   UPDATE storage.buckets
   SET public = true
   WHERE name = 'report-photos';
   ```

3. **Missing public read policy**
   ```sql
   CREATE POLICY "Public can read attachments"
   ON storage.objects
   FOR SELECT
   TO public
   USING (bucket_id = 'report-photos');
   ```

### Issue: Images showing "Has Attachment" badge but no image

This means you're running old frontend code.

**Solution:**
1. Deploy latest frontend code
2. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
3. Verify `AttachmentDisplay.tsx` component exists in your deployment

---

## 📊 Monitoring and Logs

### View Edge Function Logs

```bash
# Real-time logs
npx supabase functions logs fonnte-webhook --tail

# Filter for attachment-related logs
npx supabase functions logs fonnte-webhook --tail | grep "Attachment"

# View last 50 logs
npx supabase functions logs fonnte-webhook --limit 50
```

### Query Webhook Errors

```sql
-- Recent attachment errors
SELECT
  source,
  error_type,
  error_message,
  payload,
  created_at
FROM public.webhook_errors
WHERE source IN ('attachment-processing', 'fonnte-webhook')
ORDER BY created_at DESC
LIMIT 10;
```

### Monitor Attachment Success Rate

```sql
-- Attachment processing statistics
SELECT
  download_status,
  upload_status,
  COUNT(*) as count,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as errors
FROM public.attachments
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY download_status, upload_status;
```

### Check Storage Usage

```sql
-- Total storage used by attachments
SELECT
  COUNT(*) as total_files,
  SUM(metadata->>'size')::bigint as total_bytes,
  ROUND(SUM((metadata->>'size')::bigint) / 1024.0 / 1024.0, 2) as total_mb
FROM storage.objects
WHERE bucket_id = 'report-photos';
```

---

## 🎯 Success Criteria

After deployment, verify these conditions:

- [ ] Storage bucket `report-photos` exists and is public
- [ ] At least 6 RLS policies exist for the bucket
- [ ] Edge Function deploys without errors
- [ ] Test WhatsApp message with image processes successfully
- [ ] Attachment record appears in `attachments` table with `uploaded` status
- [ ] File appears in `storage.objects` table
- [ ] Image displays in dashboard Conversations view
- [ ] Image can be clicked to open full-screen preview
- [ ] Download button works
- [ ] Edge Function logs show successful processing (✓ symbols)

---

## 📝 Files Modified

### Backend:
- `supabase/functions/fonnte-webhook/index.ts` - Added logging and error tracking
- `supabase/functions/fonnte-webhook/attachment-processor.ts` - Added detailed logging
- `supabase/migrations/20251030000000_fix_attachment_storage.sql` - Storage bucket setup

### Frontend:
- `src/components/AttachmentDisplay.tsx` - New component for displaying attachments
- `src/pages/admin/Conversations.tsx` - Updated to fetch and display attachments

### Diagnostics:
- `supabase/diagnostics/check-attachments.sql` - SQL queries for troubleshooting

---

## 🆘 Need Help?

If issues persist after following this guide:

1. **Collect diagnostic data:**
   ```bash
   # Run all diagnostic queries
   psql $DATABASE_URL -f supabase/diagnostics/check-attachments.sql > diagnostic-output.txt

   # Export recent logs
   npx supabase functions logs fonnte-webhook --limit 100 > webhook-logs.txt
   ```

2. **Check common issues:**
   - Verify Supabase project is on a plan that supports Storage
   - Verify Edge Functions are enabled
   - Check network connectivity between Supabase Edge and Fonnte CDN
   - Verify webhook URL is correctly configured in Fonnte dashboard

3. **Review the detailed investigation report in your codebase** for architecture understanding

---

## 📚 Additional Resources

- [Fonnte Webhook Documentation](https://docs.fonnte.com/webhook-get-attachment-with-nodejs/)
- [Fonnte File Limitations](https://docs.fonnte.com/file-limitation-2/)
- [Flowise API Documentation](https://docs.flowiseai.com/api-reference/prediction)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase Edge Functions Logs](https://supabase.com/docs/guides/functions/logging)

---

**Last Updated:** 2025-10-30
**Version:** 1.0.0
