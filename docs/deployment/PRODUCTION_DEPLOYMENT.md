# Production Deployment Guide
# Fonnte-Flowise WhatsApp Integration

**Version:** 1.0
**Last Updated:** October 29, 2025
**Status:** ✅ Ready for Production

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Steps](#deployment-steps)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)
10. [Support](#support)

---

## System Overview

### Architecture

```
User → WhatsApp → Fonnte Gateway → Supabase Edge Function → Flowise AI
                                          ↓
                                    Database Storage
                                    File Storage
```

### Components

| Component | Description | Status |
|-----------|-------------|--------|
| **Database Schema** | PostgreSQL tables for conversations, messages, attachments | ✅ Deployed |
| **Edge Function** | `fonnte-webhook` - Handles WhatsApp messages | ✅ Deployed |
| **Admin UI** | Conversations page, Config managers | ✅ Deployed |
| **File Storage** | Supabase Storage for attachments | ✅ Configured |
| **Flowise Integration** | AI agent connection | ✅ Tested |
| **Fonnte Integration** | WhatsApp gateway | 🟡 Pending webhook config |

### URLs

- **Webhook URL:** `https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook`
- **Admin Dashboard:** `https://your-domain.com/admin/conversations`
- **Flowise API:** `https://tanya-suhu.up.railway.app`
- **Fonnte Dashboard:** `https://fonnte.com/`

---

## Prerequisites

### Required Access

- [x] Supabase project admin access
- [x] Fonnte account with active device
- [x] Flowise instance with chatflow configured
- [x] Admin user account in the application

### Required Information

| Item | Value | Location |
|------|-------|----------|
| Supabase Project ID | `ykaawgnggvwleiyzvilf` | Supabase Dashboard |
| Webhook URL | `https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook` | Edge Functions |
| Flowise API URL | `https://tanya-suhu.up.railway.app` | Config Manager |
| Flowise Chatflow ID | `487749ef-c4cd-4e17-b7a2-ec6376e482ea` | Config Manager |
| Fonnte API Token | `XJcZd5ARToBoPgAtEyQp` | Config Manager |

---

## Pre-Deployment Checklist

### Database Verification

Run these queries in **Supabase Dashboard → SQL Editor**:

```sql
-- 1. Verify all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('conversations', 'messages', 'attachments',
                      'flowise_config', 'fonnte_config', 'webhook_errors')
ORDER BY table_name;
-- Expected: 6 rows

-- 2. Verify Flowise configuration
SELECT
  config_name,
  is_active,
  api_url,
  chatflow_id,
  timeout_seconds,
  updated_at
FROM public.flowise_config
WHERE is_active = true;
-- Expected: 1 row with correct values

-- 3. Verify Fonnte configuration
SELECT
  config_name,
  is_active,
  api_token IS NOT NULL as has_token,
  device_numbers,
  session_timeout_minutes,
  updated_at
FROM public.fonnte_config
WHERE is_active = true;
-- Expected: 1 row with token and device numbers
```

### Edge Function Verification

Run in terminal:

```bash
# Check edge function status
npx supabase functions list

# Expected output:
# fonnte-webhook | ACTIVE | (latest version) | (recent date)

# View recent logs
npx supabase functions logs fonnte-webhook --tail
```

### Admin UI Verification

1. Navigate to: `http://localhost:5173/admin/integration` (development) or your production URL
2. Verify **Flowise Configuration** section displays current config
3. Verify **Fonnte Configuration** section displays current config
4. Check that webhook URL is displayed with copy button
5. Navigate to: `/admin/conversations`
6. Verify page loads without errors

---

## Deployment Steps

### Step 1: Verify Database Configuration

**In Supabase Dashboard:**

1. Go to **SQL Editor**
2. Run the queries from [Database Verification](#database-verification)
3. Confirm all expected results
4. If Flowise config missing:
   - Navigate to `/admin/integration` in your app
   - Fill in the Flowise Configuration form
   - Save configuration
5. If Fonnte config missing:
   - Navigate to `/admin/integration` in your app
   - Fill in the Fonnte Configuration form
   - Save configuration

### Step 2: Configure Fonnte Webhook

**In Fonnte Dashboard:**

1. **Login** to https://fonnte.com/
2. Navigate to **Settings** or **Webhook** section
3. Configure webhook:
   - **Webhook URL:** `https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook`
   - **Method:** POST
   - **Authentication:** None (leave blank)
4. **Save** webhook configuration
5. **Test** by sending a WhatsApp message to your Fonnte device number

### Step 3: Verify Webhook Connection

**Test with real WhatsApp message:**

1. Send a WhatsApp message to your Fonnte device number:
   ```
   Halo, saya mau test sistem
   ```

2. **Check for response** on WhatsApp (should receive AI reply within 5-10 seconds)

3. **Verify in Admin Dashboard:**
   - Navigate to `/admin/conversations`
   - Search for your phone number
   - Click "View Messages"
   - Verify conversation is recorded

4. **Check logs** (if no response):
   ```bash
   npx supabase functions logs fonnte-webhook --tail
   ```

5. **Check for errors:**
   ```bash
   curl https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/get-webhook-errors
   ```

### Step 4: Test File Uploads

**Send test images via WhatsApp:**

1. Send an image with caption: `Test upload gambar`
2. Send a PDF document with caption: `Test upload dokumen`
3. Verify AI responds appropriately
4. Check Supabase Storage:
   - Navigate to **Storage → conversation-attachments**
   - Verify files are uploaded

### Step 5: Configure Monitoring

**Set up monitoring queries** (save in Supabase Dashboard):

```sql
-- Daily conversation count
SELECT
  DATE(created_at) as date,
  COUNT(*) as conversations
FROM public.conversations
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Hourly message volume
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as message_count
FROM public.messages
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Error rate
SELECT
  DATE(created_at) as date,
  COUNT(*) as errors,
  STRING_AGG(DISTINCT error_type, ', ') as error_types
FROM public.webhook_errors
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Average response time (check logs)
-- Active conversations
SELECT
  COUNT(*) as active_conversations
FROM public.conversations
WHERE status = 'active'
  AND last_message_at > NOW() - INTERVAL '30 minutes';

-- Attachment processing success rate
SELECT
  download_status,
  upload_status,
  COUNT(*) as count
FROM public.attachments
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY download_status, upload_status;
```

---

## Configuration

### Flowise Configuration (via Admin UI)

Navigate to: `/admin/integration` → Flowise Configuration

| Field | Value | Notes |
|-------|-------|-------|
| API URL | `https://tanya-suhu.up.railway.app` | Flowise instance URL |
| API Key | `60JyzljIO4QbqNlwODZUYcXYKV8V-qOpCF59h3XPYBk` | Bearer token |
| Chatflow ID | `487749ef-c4cd-4e17-b7a2-ec6376e482ea` | Target chatflow |
| Streaming | `false` | Disable for WhatsApp |
| Timeout | `30` seconds | API timeout |
| Session Variables | `{}` (optional) | Additional config |

### Fonnte Configuration (via Admin UI)

Navigate to: `/admin/integration` → Fonnte Configuration

| Field | Value | Notes |
|-------|-------|-------|
| API Token | `XJcZd5ARToBoPgAtEyQp` | Fonnte auth token |
| Device Numbers | Your device number(s) | Comma-separated |
| Auto Reply | `true` | Enable auto-reply |
| Session Timeout | `30` minutes | Conversation timeout |

### File Upload Settings (Database)

Current limits (configured in `fonnte_config`):

- **Max File Size:** 10 MB
- **Allowed Extensions:**
  - Images: png, jpg, jpeg, webp
  - Videos: mp4
  - Documents: pdf, doc, docx, xls, xlsx, csv, txt
  - Audio: mp3

---

## Testing

### Test Scenarios

#### 1. Simple Text Message
```
Test Case: First message
Input: "Halo, saya mau lapor"
Expected: AI greeting and asks for name
Verify: Conversation created in database
```

#### 2. Follow-up Message (Context)
```
Test Case: Subsequent message
Input: "Nama saya John Doe"
Expected: AI acknowledges and asks for next info
Verify: Same conversation ID, message index incremented
```

#### 3. Image Upload
```
Test Case: Message with image
Input: Image + "Ini foto lokasinya"
Expected: AI acknowledges image and responds
Verify:
  - Attachment record created
  - File in Storage
  - Base64 sent to Flowise
```

#### 4. Session Timeout
```
Test Case: Message after 30+ minutes
Input: Wait 30 minutes, then "Halo lagi"
Expected: New conversation started
Verify: New conversation ID in database
```

### Test Results

Run comprehensive tests:

```bash
# Basic webhook test
node test-webhook-simple.js

# Session management test
node test-webhook-final.js

# Attachment handling test
node test-webhook-attachments.js
```

**Expected Results:**
- All tests should return `200 OK`
- AI responses should be contextually relevant
- Database records should be created
- No errors in `webhook_errors` table

---

## Monitoring

### Real-Time Monitoring

**1. Edge Function Logs**
```bash
# Tail logs
npx supabase functions logs fonnte-webhook --tail

# Filter for errors
npx supabase functions logs fonnte-webhook --filter "error"
```

**2. Database Monitoring**

```sql
-- Real-time active conversations
SELECT
  phone_number,
  sender_name,
  EXTRACT(MINUTE FROM (NOW() - last_message_at)) as minutes_since_last
FROM public.conversations
WHERE status = 'active'
ORDER BY last_message_at DESC;

-- Recent errors
SELECT *
FROM public.webhook_errors
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**3. Admin Dashboard**

Monitor via web interface:
- Navigate to `/admin/conversations`
- Use filters to view active/completed/abandoned
- Click conversations to view message threads
- Check for patterns in abandonment

### Key Metrics

| Metric | Query | Target |
|--------|-------|--------|
| Response Time | Edge function logs | < 5 seconds |
| Success Rate | `(total messages - errors) / total` | > 95% |
| Attachment Success | `uploaded / total attachments` | > 90% |
| Session Abandonment | `abandoned / total conversations` | < 20% |
| AI Response Quality | Manual review | Subjective |

### Alert Thresholds

Set up alerts for:
- ❌ **Error rate > 10%** in 1 hour
- ⚠️ **Response time > 10 seconds** consistently
- ⚠️ **No activity** for 24 hours (system down?)
- ❌ **Attachment upload failure rate > 20%**

---

## Troubleshooting

### Common Issues

#### Issue 1: No Response from AI

**Symptoms:**
- WhatsApp message sent, but no reply received
- Conversation not appearing in admin dashboard

**Diagnosis:**
```bash
# Check edge function logs
npx supabase functions logs fonnte-webhook --tail

# Check for errors
curl https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/get-webhook-errors
```

**Solutions:**
1. **Verify Fonnte webhook configured correctly**
   - Check URL is exact: `https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook`
   - No authentication should be configured

2. **Check Flowise API key**
   - Navigate to `/admin/integration`
   - Verify API key is correct
   - Test Flowise API directly:
   ```bash
   curl -X POST https://tanya-suhu.up.railway.app/api/v1/prediction/487749ef-c4cd-4e17-b7a2-ec6376e482ea \
     -H "Authorization: Bearer 60JyzljIO4QbqNlwODZUYcXYKV8V-qOpCF59h3XPYBk" \
     -H "Content-Type: application/json" \
     -d '{"question":"test"}'
   ```

3. **Verify database connection**
   - Check Supabase project is online
   - Verify RLS policies allow service_role access

#### Issue 2: Attachments Not Uploading

**Symptoms:**
- Images sent, but not stored
- Attachment processing errors in logs

**Diagnosis:**
```sql
-- Check attachment failures
SELECT
  filename,
  download_status,
  upload_status,
  error_message
FROM public.attachments
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND (download_status = 'failed' OR upload_status = 'failed')
ORDER BY created_at DESC;
```

**Solutions:**
1. **Check file size**
   - Max 10MB limit
   - Large files will fail

2. **Verify Storage bucket exists**
   - Navigate to Supabase Dashboard → Storage
   - Ensure `conversation-attachments` bucket exists
   - Check bucket is public or has proper policies

3. **Check file format**
   - Only supported extensions allowed
   - See [File Upload Settings](#file-upload-settings-database)

#### Issue 3: Session Context Lost

**Symptoms:**
- Follow-up messages don't reference previous conversation
- AI treats each message as first message

**Diagnosis:**
```sql
-- Check session IDs
SELECT
  phone_number,
  session_id,
  CASE
    WHEN session_id LIKE 'temp_%' THEN 'NOT EXTRACTED'
    ELSE 'EXTRACTED'
  END as status
FROM public.conversations
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Solutions:**
1. **Verify chatId extraction**
   - Check edge function logs for "Updating conversation with Flowise sessionId"
   - Ensure Flowise returns `chatId` in response

2. **Check conversation timeout**
   - Default: 30 minutes
   - After timeout, new session is created (expected behavior)

3. **Verify history format**
   - Roles must be `userMessage` and `apiMessage`
   - Already fixed in current version

#### Issue 4: High Error Rate

**Symptoms:**
- Multiple errors in webhook_errors table
- Inconsistent responses

**Diagnosis:**
```sql
-- Error breakdown
SELECT
  error_type,
  COUNT(*) as count,
  STRING_AGG(DISTINCT error_message, ' | ') as sample_messages
FROM public.webhook_errors
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type
ORDER BY count DESC;
```

**Solutions:**
1. **Check Flowise API stability**
   - Verify Flowise instance is online
   - Check Railway/hosting platform status

2. **Review timeout settings**
   - Increase timeout if Flowise is slow
   - Navigate to `/admin/integration` → Flowise Configuration
   - Increase from 30 to 60 seconds if needed

3. **Check rate limits**
   - Verify not hitting Flowise rate limits
   - Consider implementing queue if high volume

---

## Rollback Procedures

### Emergency Rollback

If critical issues occur:

**1. Disable Webhook (Immediate)**

In Fonnte Dashboard:
- Remove webhook URL
- Messages will not be processed, but won't fail

**2. Revert Edge Function**

```bash
# List previous versions
npx supabase functions list

# Revert to previous version (if needed)
npx supabase functions deploy fonnte-webhook --version <previous-version>
```

**3. Disable Auto-Reply**

In database:
```sql
UPDATE public.fonnte_config
SET auto_reply_enabled = false
WHERE is_active = true;
```

### Gradual Rollback

For non-critical issues:

1. **Monitor** for 15-30 minutes
2. **Document** issues in `webhook_errors` table
3. **Fix** if simple configuration issue
4. **Roll back** if requires code changes

---

## Support

### Internal Support

**For configuration issues:**
- Check this documentation first
- Review [WEBHOOK_IMPLEMENTATION.md](WEBHOOK_IMPLEMENTATION.md)
- Check [TYPE_DEFINITION_FIX.md](TYPE_DEFINITION_FIX.md)

**For code issues:**
- Review edge function logs
- Check database for errors
- Consult implementation documentation

### External Support

**Supabase Support:**
- Dashboard: https://supabase.com/dashboard/support
- Discord: https://discord.supabase.com

**Flowise Support:**
- GitHub: https://github.com/FlowiseAI/Flowise
- Documentation: https://docs.flowiseai.com

**Fonnte Support:**
- Website: https://fonnte.com/
- Email: support@fonnte.com

### Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| System Admin | [Your contact] | 24/7 |
| Database Admin | [Your contact] | Business hours |
| On-Call Engineer | [Your contact] | 24/7 |

---

## Maintenance

### Regular Tasks

**Daily:**
- Check error rates in dashboard
- Review active conversations
- Monitor attachment upload success rate

**Weekly:**
- Review conversation completion rate
- Check for abandoned conversations
- Verify Flowise API response quality
- Clean up old test conversations (optional)

**Monthly:**
- Review and optimize timeout settings
- Analyze usage patterns
- Check storage usage
- Update documentation if needed

### Database Maintenance

```sql
-- Clean up old abandoned conversations (optional, after 90 days)
DELETE FROM public.conversations
WHERE status = 'abandoned'
  AND completed_at < NOW() - INTERVAL '90 days';

-- Clean up old test conversations (optional)
DELETE FROM public.conversations
WHERE phone_number LIKE '62899%'  -- Adjust pattern for test numbers
  AND created_at < NOW() - INTERVAL '7 days';
```

---

## Appendix

### Webhook Request Format (Fonnte)

```json
{
  "sender": "628123456789",
  "name": "User Name",
  "device": "6281234567890",
  "message": "Message text",
  "url": "https://cdn.fonnte.com/file.jpg",
  "filename": "file.jpg",
  "extension": "jpg"
}
```

### Webhook Response Format

```json
{
  "success": true,
  "message": "AI response text"
}
```

### Flowise API Request Format

```json
{
  "question": "User message",
  "streaming": false,
  "overrideConfig": {
    "sessionId": "chat-id-from-previous-response",
    "phoneNumber": "628123456789",
    "userName": "User Name"
  },
  "history": [
    {"role": "userMessage", "content": "Previous user message"},
    {"role": "apiMessage", "content": "Previous AI response"}
  ],
  "uploads": [
    {
      "type": "file",
      "name": "image.jpg",
      "data": "data:image/jpeg;base64,...",
      "mime": "image/jpeg"
    }
  ]
}
```

### Flowise API Response Format

```json
{
  "text": "AI response text",
  "chatId": "unique-session-id",
  "chatMessageId": "message-id",
  "sessionId": "session-id"
}
```

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-29 | 1.0 | Initial production deployment guide | Claude |

---

## License & Credits

This system integrates:
- **Supabase** - Backend infrastructure
- **Flowise** - AI agent platform
- **Fonnte** - WhatsApp gateway
- **React** - Admin dashboard UI

Built with Claude Code assistance.

---

**End of Production Deployment Guide**