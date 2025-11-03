# Fix Existing Conversations Based on Actual Reports

## Problem

All conversations are currently marked as `'abandoned'` but some should be `'completed'` because they have associated reports in the database.

## Solution

We need to:
1. **Match conversations with reports** from the `reports` table based on phone number and timestamp
2. **Mark as COMPLETED** if a report exists for that conversation
3. **Mark as ABANDONED** if no report exists

## How to Apply the Fix

### Step 1: Preview What Will Change (Recommended)

Run this diagnostic query to see what will happen:

```bash
supabase db execute -f supabase/diagnostics/preview_conversation_report_matching.sql
```

Or run it in Supabase Studio SQL Editor:
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `supabase/diagnostics/preview_conversation_report_matching.sql`
3. Run the query

This will show:
- Current status summary
- Which conversations will be matched with reports (→ COMPLETED)
- Which conversations have no reports (→ ABANDONED)
- Summary counts

### Step 2: Apply the Fix

Run the migration to fix all conversations:

```bash
supabase db push
```

Or manually apply via Supabase Studio:
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/20251031000001_fix_conversation_status_with_reports.sql`
3. Run the query

### Step 3: Verify the Results

Check your dashboard at `/admin/conversations`. You should now see:
- ✅ **Completed** - Conversations that have reports
- ✅ **Abandoned** - Conversations without reports
- ✅ **Active** - Any current ongoing conversations (if any)

## How the Matching Works

The migration uses this logic to match conversations with reports:

```sql
-- Match by phone number
conversations.phone_number = reports.phone

-- Report must be created during or shortly after the conversation
reports.created_at >= conversations.started_at
AND reports.created_at <= conversations.last_message_at + 5 minutes
```

**Why 5 minutes buffer?**
The Flowise bot might take a few seconds to submit the report after the user's last message, so we allow up to 5 minutes after the last message.

## What Gets Updated

For each matched conversation:
- `report_id` → Set to the matched report's ID
- `status` → Set to `'completed'`
- `completed_at` → Set to the report's creation time

For unmatched conversations:
- `status` → Set to `'abandoned'`
- `completed_at` → Set to the last message time

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20251031000001_fix_conversation_status_with_reports.sql` | Main fix migration |
| `supabase/diagnostics/preview_conversation_report_matching.sql` | Preview query |
| `FIX_EXISTING_CONVERSATIONS.md` | This guide |

## Troubleshooting

### No conversations are being matched

**Check 1: Verify phone numbers match**
```sql
-- Check if phone formats are consistent
SELECT DISTINCT phone FROM reports LIMIT 10;
SELECT DISTINCT phone_number FROM conversations LIMIT 10;
```

If formats don't match (e.g., one has country code, one doesn't), you may need to adjust the matching logic.

**Check 2: Verify timing**
```sql
-- Check if report timestamps are within conversation timeframe
SELECT
  c.phone_number,
  c.started_at,
  c.last_message_at,
  r.created_at,
  r.created_at >= c.started_at AS after_start,
  r.created_at <= c.last_message_at + INTERVAL '5 minutes' AS before_end
FROM conversations c
LEFT JOIN reports r ON c.phone_number = r.phone
LIMIT 10;
```

### Still seeing wrong statuses

**Re-run the fix migration:**
```sql
-- Manually run the fix
-- Copy and paste the contents of 20251031000001_fix_conversation_status_with_reports.sql
-- into SQL Editor and run it
```

## After the Fix

Once existing data is fixed, the new code changes will keep statuses updated automatically:

- ✅ **New reports** → Conversation marked as `'completed'` (via `submit-report` function)
- ✅ **Timed out conversations** → Marked as `'abandoned'` (via `fonnte-webhook` function)
- ✅ **Active conversations** → Stay `'active'` (until completed or abandoned)

No manual intervention needed going forward!
