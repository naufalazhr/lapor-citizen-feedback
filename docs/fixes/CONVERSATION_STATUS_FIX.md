# Conversation Status Fix Guide

## Overview

This fix addresses the issue where all conversations remain in `'active'` status even after reports are completed or conversations are abandoned.

## What Was Fixed

### Code Changes (Already Implemented)

1. **Fix 1: Mark as COMPLETED when report created**
   - File: `supabase/functions/submit-report/index.ts`
   - When a report is successfully created, the conversation is marked as `'completed'`

2. **Fix 2: Mark as ABANDONED when timeout reached**
   - File: `supabase/functions/fonnte-webhook/conversation-manager.ts`
   - When a new message arrives and old conversations have timed out, they are marked as `'abandoned'`

### Database Changes (Need to Run)

3. **Fix 3: Cleanup existing conversations**
   - Migration: `supabase/migrations/20251031000000_fix_conversation_status.sql`
   - Creates reusable function: `cleanup_conversation_status()`
   - Runs one-time fix for all existing conversations

## Status Update Logic

| Condition | Current Status | Report ID | Last Message | New Status |
|-----------|---------------|-----------|--------------|------------|
| Has report | active | ✓ Present | Any time | **completed** |
| Timed out | active | ✗ Null | > 30 min ago | **abandoned** |
| Within timeout | active | ✗ Null | < 30 min ago | **active** (no change) |

## How to Apply the Fix

### Step 1: Check Current Status (Optional but Recommended)

Before applying the fix, check what will be changed:

```bash
# Run diagnostic script via Supabase Studio or psql
supabase db execute -f supabase/diagnostics/check_conversation_status.sql
```

Or via Supabase Studio SQL Editor:
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `supabase/diagnostics/check_conversation_status.sql`
3. Run the query

This will show:
- Current status distribution
- How many conversations will be updated
- Detailed list of conversations to be changed

### Step 2: Apply the Migration

Run the migration to fix all existing conversations:

```bash
supabase db push
```

Or manually apply the migration via Supabase Studio:
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/20251031000000_fix_conversation_status.sql`
3. Run the query

The migration will:
- Create the `cleanup_conversation_status()` function
- Fix all existing conversations
- Show a summary in the output

### Step 3: Deploy Edge Functions

Deploy the updated Edge Functions:

```bash
# Deploy both functions
supabase functions deploy fonnte-webhook
supabase functions deploy submit-report
```

Or deploy individually:
```bash
supabase functions deploy fonnte-webhook
```
```bash
supabase functions deploy submit-report
```

### Step 4: Verify the Fix

Check the conversations dashboard:

1. Go to `/admin/conversations` in your application
2. You should now see conversations with different statuses:
   - **completed**: Reports that were successfully created
   - **abandoned**: Conversations that timed out without creating reports
   - **active**: Current ongoing conversations

## Manual Cleanup (Future Use)

If you need to manually clean up conversation statuses in the future, you can call the function:

```sql
SELECT * FROM cleanup_conversation_status();
```

This returns:
- `updated_completed`: Number of conversations marked as completed
- `updated_abandoned`: Number of conversations marked as abandoned
- `total_updated`: Total number of conversations updated

## Testing

### Test Scenario 1: Report Completion
1. Send a message to the WhatsApp bot
2. Complete the report submission
3. Check `/admin/conversations` - status should be `'completed'`
4. Send another message
5. A NEW conversation should be created (different session)

### Test Scenario 2: Abandoned Conversation
1. Send a message to the WhatsApp bot
2. Don't complete the report (just stop responding)
3. Wait for timeout period (default: 30 minutes)
4. Send another message
5. Check dashboard:
   - Old conversation should be `'abandoned'`
   - New conversation should be `'active'`

### Test Scenario 3: Continue Within Timeout
1. Send a message to the WhatsApp bot
2. Send another message within 30 minutes
3. Should continue the same conversation
4. Status remains `'active'`

## Monitoring

Check Edge Function logs for these messages:

```bash
# Fonnte webhook logs
supabase functions logs fonnte-webhook
```

Look for:
- `✓ Marked old conversation as 'abandoned':`
- `✓ Marked old conversation as 'completed':`

```bash
# Submit report logs
supabase functions logs submit-report
```

Look for:
- `✓ Conversation marked as completed:`
- `⚠ No active conversation found for phone:`

## Troubleshooting

### No conversations are being updated

**Check 1: Verify migration was applied**
```sql
-- Check if function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'cleanup_conversation_status';
```

**Check 2: Run diagnostic script**
```bash
supabase db execute -f supabase/diagnostics/check_conversation_status.sql
```

**Check 3: Verify fonnte_config timeout**
```sql
SELECT session_timeout_minutes, is_active
FROM fonnte_config;
```

### Edge Functions not updating status

**Check 1: Verify functions are deployed**
```bash
supabase functions list
```

**Check 2: Check function logs**
```bash
supabase functions logs fonnte-webhook --tail
supabase functions logs submit-report --tail
```

**Check 3: Test manually**
Send a test message through the WhatsApp bot and check logs immediately.

## Files Created/Modified

| File | Type | Description |
|------|------|-------------|
| `supabase/functions/submit-report/index.ts` | Modified | Added conversation completion logic |
| `supabase/functions/fonnte-webhook/conversation-manager.ts` | Modified | Added abandonment check |
| `supabase/migrations/20251031000000_fix_conversation_status.sql` | New | Migration to fix existing data + create function |
| `supabase/diagnostics/check_conversation_status.sql` | New | Diagnostic script to preview changes |
| `CONVERSATION_STATUS_FIX.md` | New | This guide |

## Summary

✅ **Fix 1**: Future reports will mark conversations as completed
✅ **Fix 2**: New messages will mark timed-out conversations as abandoned
✅ **Fix 3**: Existing conversations in DB will be fixed by migration
✅ **Reusable Function**: Can manually run cleanup anytime

All conversations will now properly reflect their true status!
