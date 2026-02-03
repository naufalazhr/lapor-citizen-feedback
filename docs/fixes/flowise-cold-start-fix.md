# Flowise Cold Start Issue - Implementation Guide

**Date:** January 4, 2026
**Issue:** Flowise API timeouts after idle periods
**Root Cause:** Cold start after several days of inactivity
**Solution:** Supabase cron keep-alive job

---

## Problem Summary

### What's Happening
- WhatsApp chatbot users receive timeout errors: "Maaf, sistem sedang sibuk. Silakan coba lagi dalam beberapa saat."
- Issue only occurs after Flowise has been idle for several days
- Once Flowise is "warm" (after restart or active use), everything works perfectly
- Flowise UI testing always works fast (<10 seconds)

### Error Logs
```
ERROR: Flowise API failed after 3 attempts: Maaf, sistem sedang sibuk...
ERROR: Flowise API attempt 1 failed: Maaf, sistem sedang sibuk...
ERROR: Flowise API attempt 2 failed: Maaf, sistem sedang sibuk...
```

### Why This Happens

**Cold Start Timeline:**
1. After several days of no WhatsApp messages → Flowise enters degraded/idle state
2. First user sends WhatsApp message → Triggers webhook
3. Webhook calls Flowise API → Flowise needs 30-90 seconds to "wake up"
   - Reinitialize database connections (Postgis)
   - Reconnect to Redis cache
   - Reload vector embeddings
   - Initialize LLM connections
4. Supabase Edge Function timeout = 30 seconds
5. Flowise wake-up time (30-90s) > Edge Function timeout (30s) → **Request fails**
6. Retry logic runs 3 times (30s × 3 = 90s) → Still fails, wastes time
7. User receives error message

**After Cold Start:**
- Flowise is now "warm" and responsive
- Subsequent messages work perfectly
- Response time: 10-20 seconds (normal)

---

## Solution: Keep-Alive Cron Job

### Architecture

```
Supabase Cron (every 10 min)
    ↓
Supabase Edge Function (keep-flowise-alive)
    ↓
HTTP GET → https://pimpinan.up.railway.app/api/v1/health
    ↓
Flowise stays warm ✅
```

**How It Works:**
1. Supabase cron triggers every 10 minutes
2. Calls our Edge Function `keep-flowise-alive`
3. Edge Function pings Flowise health endpoint
4. Keeps Flowise active and responsive
5. Prevents cold starts entirely

**Benefits:**
- ✅ Flowise never enters idle state
- ✅ All user requests complete in 10-20 seconds
- ✅ No timeout errors
- ✅ Costs nearly nothing (Supabase cron is free, Railway charges per hour not per request)
- ✅ Simple to implement and maintain

---

## Implementation Steps

### Step 1: Create Keep-Alive Edge Function

**Create file:** `supabase/functions/keep-flowise-alive/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req: Request) => {
  const FLOWISE_HEALTH_URL = 'https://pimpinan.up.railway.app/api/v1/health';

  try {
    const response = await fetch(FLOWISE_HEALTH_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    console.log('✅ Flowise keep-alive ping:', {
      status: response.status,
      ok: response.ok,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: response.status,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Flowise keep-alive failed:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
```

### Step 2: Deploy the Edge Function

```bash
# From project root directory
npx supabase functions deploy keep-flowise-alive
```

**Expected output:**
```
Deploying function keep-flowise-alive...
✓ Function deployed successfully
Function URL: https://[PROJECT-ID].supabase.co/functions/v1/keep-flowise-alive
```

### Step 3: Setup Cron Trigger

**Go to:** Supabase Dashboard → SQL Editor → New Query

**Run this SQL:**

```sql
-- Schedule keep-alive job to run every 10 minutes
SELECT cron.schedule(
  'keep-flowise-alive',           -- Job name
  '*/10 * * * *',                 -- Cron expression: every 10 minutes
  $$
  SELECT net.http_post(
    url := 'https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/keep-flowise-alive',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrYWF3Z25nZ3Z3bGVpeXp2aWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxOTI0NTQsImV4cCI6MjA0NTc2ODQ1NH0.7bLJRO4OmBKw2kBl0M-_6ysAGpCKOOHMQWmQRFb5hHo"}'::jsonb
  )
  $$
);
```

**Important:** Replace `[PROJECT-ID]` and `[ANON-KEY]` with actual values:
- **Project ID:** Found in Supabase Dashboard → Project Settings → General → Reference ID
- **Anon Key:** Found in Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`

**Note:** We use `net.http_post` here because Supabase cron doesn't support GET directly. The Edge Function will still make a GET request to Flowise.

### Step 4: Verify Cron is Running

**Check active cron jobs:**

```sql
SELECT * FROM cron.job;
```

**Expected result:**
```
jobid | schedule      | command                    | nodename  | active
------|---------------|----------------------------|-----------|--------
1     | */10 * * * *  | SELECT net.http_post(...)  | localhost | t
```

**Check cron job history:**

```sql
SELECT
  jobid,
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'keep-flowise-alive')
ORDER BY start_time DESC
LIMIT 10;
```

### Step 5: Monitor Logs

**Supabase Edge Function Logs:**

1. Go to Supabase Dashboard → Edge Functions → `keep-flowise-alive`
2. Click on "Logs" tab
3. You should see entries every 10 minutes:
```
✅ Flowise keep-alive ping: {
  status: 200,
  ok: true,
  timestamp: "2026-01-04T12:00:00.000Z"
}
```

**Railway Flowise Logs:**

1. Go to Railway Dashboard → Flowise service → Logs
2. You should see incoming health check requests every 10 minutes
3. Look for GET `/api/v1/health` requests

---

## Troubleshooting

### Issue: Cron job not running

**Check 1: Verify cron job exists**
```sql
SELECT * FROM cron.job WHERE jobname = 'keep-flowise-alive';
```

If no results → Job wasn't created, re-run Step 3

**Check 2: Verify cron extension is enabled**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

If no results → Enable pg_cron extension (should be enabled by default in Supabase)

### Issue: Edge Function returns 500 error

**Possible causes:**
1. Flowise URL is incorrect
2. Flowise is genuinely down
3. Network connectivity issue

**Check Edge Function logs** (Supabase Dashboard → Edge Functions → Logs)

Look for error details in the response.

### Issue: Edge Function not found (404)

**Verify function is deployed:**
```bash
npx supabase functions list
```

Should show `keep-flowise-alive` in the list.

**Re-deploy if needed:**
```bash
npx supabase functions deploy keep-flowise-alive
```

---

## Testing

### Manual Test

**Test the Edge Function directly:**

```bash
curl -X POST https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/keep-flowise-alive \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrYWF3Z25nZ3Z3bGVpeXp2aWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxOTI0NTQsImV4cCI6MjA0NTc2ODQ1NH0.7bLJRO4OmBKw2kBl0M-_6ysAGpCKOOHMQWmQRFb5hHo"
```

**Expected response:**
```json
{
  "success": true,
  "status": 200,
  "timestamp": "2026-01-04T12:00:00.000Z"
}
```

### Integration Test

**Wait for idle period:**
1. Stop using WhatsApp chatbot for 2-3 days
2. Let cron job keep pinging Flowise (every 10 min)
3. After 2-3 days, send a WhatsApp message
4. **Expected:** Message is processed successfully in 10-20 seconds (no timeout)

---

## Cleanup (If Needed)

### Stop the cron job

```sql
SELECT cron.unschedule('keep-flowise-alive');
```

### Delete the Edge Function

```bash
npx supabase functions delete keep-flowise-alive
```

---

## Cost Impact

**Supabase:**
- Cron jobs: Free (unlimited)
- Edge Function invocations: Free tier includes 500,000 requests/month
- Expected usage: ~4,320 requests/month (6 per hour × 24 hours × 30 days)
- **Cost: $0**

**Railway:**
- Flowise will run continuously (instead of scaling to zero)
- Charges per hour of runtime (not per request)
- Expected cost increase: Minimal to none (Flowise was already running most of the time)
- **Additional cost: ~$0-5/month** depending on Railway plan

**Total additional cost: <$5/month** to eliminate timeout issues entirely.

---

## Alternative Solutions (Not Recommended)

### 1. UptimeRobot (External monitoring service)
- Free tier: 50 monitors, 5-minute intervals
- Pros: Also provides uptime monitoring and alerts
- Cons: Another service to manage
- **Use if:** You want uptime alerts in addition to keep-alive

### 2. Railway Cron Schedule
- Pros: Built into Railway
- Cons: **Won't work** - Railway cron runs INSIDE the container, can't keep it alive if scaled to zero
- **Do not use for this purpose**

### 3. Increase Edge Function timeout
- Pros: Simple config change
- Cons: Doesn't solve root cause, wastes time waiting for cold starts
- **Not recommended**

---

## Success Criteria

After implementation, verify:
- ✅ Cron job runs every 10 minutes (check `cron.job_run_details`)
- ✅ Edge Function logs show successful pings
- ✅ Railway Flowise logs show incoming health checks
- ✅ No timeout errors after idle periods (test after 2-3 days)
- ✅ WhatsApp messages are processed in 10-20 seconds consistently

---

## Questions?

If you encounter any issues during implementation:

1. Check the logs (Supabase Edge Functions + Railway Flowise)
2. Verify the cron job is active (`SELECT * FROM cron.job`)
3. Test the Edge Function manually with curl
4. Check Railway settings (Serverless should be DISABLED)

**Support contact:** [Your contact info or team channel]

---

## File References

**Files to create:**
- `supabase/functions/keep-flowise-alive/index.ts` - New keep-alive Edge Function

**Related existing files:**
- `supabase/functions/fonnte-webhook/index.ts` - Main webhook (no changes needed)
- `supabase/functions/fonnte-webhook/flowise-client.ts` - Flowise API client (no changes needed)

**Configuration:**
- Supabase cron job in `cron.job` table
- Railway Flowise settings (verify Serverless is disabled)
