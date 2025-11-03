# Image Attachment Testing Checklist

## Pre-Testing Verification

### 1. Database Setup
Run this query to verify storage bucket and policies are configured:

```sql
-- Check storage bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'report-photos';

-- Check storage policies
SELECT policyname, cmd, roles, qual
FROM storage.policies
WHERE bucket_id = 'report-photos';

-- Verify attachments table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'attachments'
ORDER BY ordinal_position;
```

**Expected Results:**
- ✅ Bucket 'report-photos' exists with public=true
- ✅ Policy for service_role INSERT exists
- ✅ Policy for public SELECT exists
- ✅ Attachments table has all required columns

---

### 2. Edge Function Deployment
Verify the webhook function is deployed:

```bash
npx supabase functions list
```

**Expected:**
- ✅ `fonnte-webhook` appears in the list

---

### 3. Environment Variables
Verify Edge Function has necessary environment variables:

```bash
npx supabase secrets list
```

**Expected:**
- ✅ SUPABASE_URL
- ✅ SUPABASE_SERVICE_ROLE_KEY

---

## Testing Scenarios

### Test 1: Image-Only Message (No Caption)

**Action:**
1. Open WhatsApp
2. Take a photo or select from gallery
3. **DO NOT add any caption**
4. Send to your Fonnte number

**Monitor Logs:**
```bash
npx supabase functions logs fonnte-webhook --tail
```

**Expected Logs - Section A: Webhook Receipt**
```javascript
Received webhook from Fonnte: {
  sender: "628xxx",
  device: "089xxx",
  hasAttachment: true,
  messageLength: 0,  // ← Zero is OK for image-only
  attachmentUrl: "https://api.fonnte.com/t/...",
  attachmentFilename: "webhook-089654126493-...",  // ← Auto-generated from URL
  attachmentExtension: "jpeg"
}
```

**Expected Logs - Section B: Validation**
```javascript
✓ Payload validation passed: {
  hasSender: true,
  hasDevice: true,
  hasMessage: false,  // ← False is OK because hasAttachment=true
  hasAttachment: true
}
```

**Expected Logs - Section C: Attachment Processing**
```javascript
✓ Starting attachment processing: {
  filename: "webhook-089654126493-...",
  extension: "jpeg"
}

[Attachment] ✓ Downloaded X bytes
[Attachment] ✓ Uploaded successfully
[Attachment] ✓✓✓ ATTACHMENT PROCESSING COMPLETE ✓✓✓

✓ Attachment processed successfully: {
  storageUrl: "https://ykaawgnggvwleiyzvilf.supabase.co/storage/v1/object/public/report-photos/...",
  method: "URL in question field"
}
```

**Expected Logs - Section D: Flowise Request**
```javascript
Calling Flowise API: {
  hasSessionId: true,
  hasHistory: false,
  questionPreview: "https://ykaawgnggvwleiyzvilf.supabase.co/storage/..."
}

🖼️ Image URL detected in question: {
  method: "URL in question field",
  urlDetected: true
}
```

**Expected Logs - Section E: Flowise Response**
```javascript
📥 Flowise API Response: {
  hasText: true,
  textPreview: "Based on the image, I can see..."  // ← Should mention image content!
}

Message sent to WhatsApp successfully
```

**Success Criteria:**
- ✅ No validation errors
- ✅ Attachment downloaded and uploaded
- ✅ `urlDetected: true` in logs
- ✅ `questionPreview` shows Supabase Storage URL
- ✅ **NO `.split()` errors** from Flowise
- ✅ Flowise response mentions image content (NOT just "Photo")
- ✅ Response sent back to WhatsApp

---

### Test 2: Image + Text Message

**Action:**
1. Open WhatsApp
2. Select an image
3. **Add caption:** "Jalan rusak di depan rumah saya"
4. Send to your Fonnte number

**Expected Logs - Section D: Flowise Request**
```javascript
Calling Flowise API: {
  questionPreview: "Jalan rusak di depan rumah saya\n\nhttps://ykaawgnggvwleiyzvilf.supabase.co/storage/..."
}

🖼️ Image URL detected in question: {
  method: "URL in question field",
  urlDetected: true
}
```

**Expected Logs - Section E: Flowise Response**
```javascript
📥 Flowise API Response: {
  textPreview: "Terima kasih atas laporannya. Berdasarkan gambar yang Anda kirim, saya melihat..."
}
```

**Success Criteria:**
- ✅ Both text and URL appear in `questionPreview`
- ✅ Flowise response addresses both the text and image
- ✅ Tool action receives clean URL (verify in your API logs)

---

### Test 3: Text-Only Message (No Image)

**Action:**
1. Send text message: "Halo, saya mau melapor"

**Expected Logs:**
```javascript
Received webhook from Fonnte: {
  hasAttachment: false,
  messageLength: 25
}

Calling Flowise API: {
  questionPreview: "Halo, saya mau melapor"
}
```

**Success Criteria:**
- ✅ No attachment processing triggered
- ✅ Normal text flow works
- ✅ No `urlDetected` log appears

---

## Database Verification

After sending test images, verify data in database:

```sql
-- Check recent messages with attachments
SELECT
  m.id,
  m.content,
  m.role,
  m.has_attachment,
  m.message_index,
  m.created_at,
  a.id as attachment_id,
  a.filename,
  a.storage_url,
  a.download_status,
  a.upload_status,
  a.error_message
FROM messages m
LEFT JOIN attachments a ON a.message_id = m.id
WHERE m.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY m.created_at DESC;
```

**Expected Results:**

**For Image-Only Message:**
- `m.content`: "[Gambar]"
- `m.has_attachment`: true
- `a.filename`: "webhook-089654126493-..."
- `a.storage_url`: "https://ykaawgnggvwleiyzvilf.supabase.co/storage/..."
- `a.download_status`: "downloaded"
- `a.upload_status`: "uploaded"
- `a.error_message`: null

**For Image + Text Message:**
- `m.content`: "Jalan rusak di depan rumah saya"
- `m.has_attachment`: true
- Attachment record exists

---

## Dashboard Verification

### 1. View Conversations Page
Navigate to: `/admin/conversations`

**Expected:**
- ✅ Conversation list shows recent conversation
- ✅ "View Messages" button works

### 2. View Message History
Click "View Messages" on test conversation

**Expected:**
- ✅ User message shows text or "[Gambar]"
- ✅ Image preview appears below message
- ✅ Clicking image opens full-screen view
- ✅ Download button works
- ✅ Assistant response shows below

---

## Flowise Integration Verification

### 1. Check Flowise Dashboard
Open your Flowise dashboard → Chatflows → Your Chatflow

**Expected:**
- ✅ Recent message appears in conversation
- ✅ Question field shows: "text\n\nURL" or just "URL"
- ✅ Image is processed (not just metadata)

### 2. Check Tool Action (If Applicable)
If your Flowise chatflow calls an API tool to save reports:

**Check your API logs for:**
```json
POST /api/reports
{
  "description": "Jalan rusak di depan rumah saya",
  "location": "Jl. Merdeka No. 123",
  "imageUrl": "https://ykaawgnggvwleiyzvilf.supabase.co/storage/v1/object/public/report-photos/...",
  "phoneNumber": "628xxx"
}
```

**Success Criteria:**
- ✅ `imageUrl` is a clean URL (NOT base64)
- ✅ URL is accessible (paste in browser → shows image)
- ✅ Your API can store and use the URL

---

## Troubleshooting Guide

### Issue: "Missing required fields" error

**Diagnosis:**
```bash
npx supabase functions logs fonnte-webhook --tail | grep "validation"
```

**Possible Cause:** Deployment didn't succeed

**Solution:**
```bash
npx supabase functions deploy fonnte-webhook --no-verify-jwt
```

---

### Issue: Attachment not processed (urlDetected: false)

**Diagnosis:**
Check attachment processing logs:
```bash
npx supabase functions logs fonnte-webhook --tail | grep "\[Attachment\]"
```

**Possible Causes:**
1. Fonnte didn't provide URL
2. Storage upload failed

**Solution:**
- Check storage bucket policies
- Verify service role has INSERT permission

---

### Issue: Flowise returns "Photo" (not analyzing image)

**Diagnosis:**
Logs show `urlDetected: true` BUT response is generic

**Cause:** Flowise chatflow not configured for vision

**Solution:**
1. Open Flowise dashboard
2. Edit your chatflow
3. Ensure using vision-capable model:
   - GPT-4 Vision / GPT-4o
   - Claude 3 (with vision)
   - Gemini Pro Vision
4. Test manually in Flowise with an image URL
5. Verify model can fetch and analyze from URL

---

### Issue: .split() error from Flowise

**Diagnosis:**
```bash
npx supabase functions logs fonnte-webhook --tail | grep "split"
```

**Cause:** Flowise received URL in wrong format

**Solution:**
- Verify `questionPreview` in logs shows URL directly
- Should NOT show uploads array
- Redeploy if needed

---

## Success Summary

✅ **All tests passed when:**

1. Image-only message:
   - Stored in database with "[Gambar]" content
   - URL sent to Flowise in question field
   - Flowise responds with image analysis
   - No errors in logs

2. Image + text message:
   - Both text and image processed
   - URL appended to question
   - Flowise responds to both

3. Text-only message:
   - Works normally
   - No attachment processing triggered

4. Database:
   - All attachments have uploaded status
   - Storage URLs are accessible
   - No error_message values

5. Dashboard:
   - Images display correctly
   - Full-screen view works
   - Download works

6. Flowise integration:
   - No .split() errors
   - Vision model analyzes images
   - Tool actions receive clean URLs

---

## Quick Test Command

Run all database checks at once:

```sql
-- Comprehensive status check
SELECT
  'Storage Bucket' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'report-photos' AND public = true)
    THEN '✅ OK' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
  'Service Role Policy' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM storage.policies WHERE bucket_id = 'report-photos' AND cmd = 'INSERT' AND roles @> ARRAY['service_role'])
    THEN '✅ OK' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
  'Public Read Policy' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM storage.policies WHERE bucket_id = 'report-photos' AND cmd = 'SELECT')
    THEN '✅ OK' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
  'Recent Attachments' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM attachments WHERE created_at > NOW() - INTERVAL '1 hour')
    THEN '✅ ' || COUNT(*)::text || ' found' ELSE '⚠️  None in last hour' END as status
FROM attachments
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

**Ready to test!** Send a WhatsApp image and follow the checklist above.
