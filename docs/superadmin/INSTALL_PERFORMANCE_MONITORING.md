# Installing Performance Monitoring for fonnte-webhook

## Overview
This guide will help you add performance tracking to the fonnte-webhook edge function so metrics are collected and stored in the `performance_metrics` table.

---

## Option 1: Replace Entire File (Recommended)

### Step 1: Backup Current File
```bash
cd "c:/Users/yugie/lapor ai/lapor-citizen-feedback/supabase/functions/fonnte-webhook/"
cp index.ts index.ts.backup
```

### Step 2: Replace with Instrumented Version
```bash
cp index-instrumented.ts index.ts
```

### Step 3: Deploy to Supabase
```bash
cd "c:/Users/yugie/lapor ai/lapor-citizen-feedback"
supabase functions deploy fonnte-webhook
```

---

## Option 2: Manual Integration (If you've made custom changes)

If you have custom modifications to `index.ts` that aren't in the backup, follow these steps:

### Changes Required:

#### 1. Add performance tracking variables (after line 59)
```typescript
  // Performance tracking
  const startTime = performance.now();
  const perfMetrics: Record<string, number> = {};
  let tenantId: string | null = null;
  let hasError = false;
```

#### 2. Add the performance logging function (after imports, before serve())
```typescript
// =============================================================================
// Performance Tracking Helper
// =============================================================================
async function logPerformanceMetrics(
  tenantId: string | null,
  conversationId: string | null,
  metricType: string,
  durationMs: number,
  metadata: Record<string, any> = {}
) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.from('performance_metrics').insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      metric_type: metricType,
      duration_ms: Math.round(durationMs),
      metadata
    });
  } catch (error) {
    console.error('Failed to log performance metric:', error);
    // Don't throw - performance logging should not break webhook
  }
}
```

#### 3. Track tenant_id (after findOrCreateConversation, around line 112)
```typescript
    conversationId = conversation.id;
    tenantId = conversation.tenant_id; // ADD THIS LINE
```

#### 4. Wrap each major operation with timing:

**Database Operations:**
```typescript
// Before: const conversation = await findOrCreateConversation(...)
// After:
const dbStart = performance.now();
const conversation = await findOrCreateConversation(
  normalized.sender,
  normalized.device,
  normalized.name
);
perfMetrics.db_find_conversation = performance.now() - dbStart;
```

**Flowise API:**
```typescript
// Before: const { response: flowiseResponse } = await callFlowiseWithRetry(...)
// After:
const flowiseStart = performance.now();
const { response: flowiseResponse } = await callFlowiseWithRetry(flowiseRequest);
perfMetrics.flowise_api = performance.now() - flowiseStart;
```

**Fonnte Send:**
```typescript
// Before: const sendResult = await sendFonnteMessageWithRetry(...)
// After:
const fonnteStart = performance.now();
const sendResult = await sendFonnteMessageWithRetry({
  target: normalized.sender,
  message: finalResponseText,
  token: fonnteConfig.api_token
});
perfMetrics.fonnte_send = performance.now() - fonnteStart;
```

#### 5. Log performance metrics (before final return, around line 315)
```typescript
    // Calculate total duration
    const totalDuration = performance.now() - startTime;

    // Log to console
    console.log('📊 PERFORMANCE:', {
      total: `${totalDuration.toFixed(0)}ms`,
      flowise: `${(perfMetrics.flowise_api || 0).toFixed(0)}ms`,
      db: `${(
        (perfMetrics.db_find_conversation || 0) +
        (perfMetrics.db_get_history || 0) +
        (perfMetrics.db_save_user_message || 0)
      ).toFixed(0)}ms`
    });

    // Log to database
    await logPerformanceMetrics(
      tenantId,
      conversationId,
      'webhook_total',
      totalDuration,
      {
        has_attachment: normalized.hasAttachment,
        message_length: messageContent.length,
        flowise_duration: perfMetrics.flowise_api || 0
      }
    );

    // Log individual metrics
    if (perfMetrics.flowise_api) {
      await logPerformanceMetrics(tenantId, conversationId, 'flowise_api', perfMetrics.flowise_api);
    }
    if (perfMetrics.fonnte_send) {
      await logPerformanceMetrics(tenantId, conversationId, 'fonnte_send', perfMetrics.fonnte_send);
    }
```

#### 6. Add import for Supabase client (at top of file)
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

---

## Verification

### 1. Check Edge Function Logs
After deployment, send a test WhatsApp message and check the logs:
```bash
supabase functions logs fonnte-webhook
```

You should see output like:
```
📊 PERFORMANCE: {
  total: "4250ms",
  flowise: "3800ms",
  db: "320ms"
}
```

### 2. Query Performance Metrics Table
```sql
SELECT
  metric_type,
  duration_ms,
  created_at,
  metadata
FROM performance_metrics
ORDER BY created_at DESC
LIMIT 10;
```

You should see rows with:
- `metric_type = 'webhook_total'`
- `metric_type = 'flowise_api'`
- `metric_type = 'fonnte_send'`

---

## Troubleshooting

### Performance metrics not being inserted
- Check that the `performance_metrics` table migration was applied
- Verify Supabase service role key is set in edge function environment
- Check edge function logs for errors

### High latency
- Check `flowise_api` duration - this is usually the primary bottleneck
- Check if Railway (Flowise host) is responding slowly
- Check network latency between Supabase and Railway

---

## Next Steps

Once performance data is being collected:
1. Go to the Superadmin Dashboard
2. Navigate to **Performance** page (will be built in next phase)
3. View real-time and historical performance metrics
4. Identify slow requests and optimization opportunities
