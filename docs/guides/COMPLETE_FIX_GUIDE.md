# Complete Fix Guide: Conversation Status & Column Swap

## 🔍 Issues Identified

### Issue 1: Column Values Are Swapped
**Current State (WRONG):**
- `conversations.phone_number` = Contains bot's WhatsApp account (Fonnte device)
- `conversations.device_number` = Contains user's phone number

**Expected State (CORRECT):**
- `conversations.phone_number` = Should contain user's phone number (matches `reports.phone`)
- `conversations.device_number` = Should contain bot's WhatsApp account (Fonnte device)

### Issue 2: Matching Logic Fails
- Cannot match conversations with reports because columns are swapped
- `conversations.phone_number` should match `reports.phone`, but currently doesn't

### Issue 3: Missing Relationships
- `conversations.report_id` exists but all values are `NULL`
- No foreign key constraint linking conversations to reports

### Issue 4: All Conversations Marked as Abandoned
- Should be 'completed' if report exists
- Should be 'abandoned' if no report exists

---

## 📁 Files Created

### Diagnostic Files
1. **[verify_column_swap_issue.sql](supabase/diagnostics/verify_column_swap_issue.sql)**
   - Run BEFORE fixes to verify the column swap issue
   - Shows which column actually matches reports.phone

2. **[preview_after_swap.sql](supabase/diagnostics/preview_after_swap.sql)**
   - Run AFTER swap migration to preview matching
   - Shows which conversations will be completed/abandoned

### Migration Files (Run in Order)
1. **[20251031000002_swap_phone_device_columns.sql](supabase/migrations/20251031000002_swap_phone_device_columns.sql)**
   - Swaps phone_number ↔ device_number values
   - Fixes semantic meaning of columns

2. **[20251031000003_match_conversations_with_reports.sql](supabase/migrations/20251031000003_match_conversations_with_reports.sql)**
   - Matches conversations with reports
   - Links report_id and sets status to 'completed'/'abandoned'

3. **[20251031000004_add_report_foreign_key.sql](supabase/migrations/20251031000004_add_report_foreign_key.sql)**
   - Adds foreign key constraint
   - Creates index for performance

### Code Files
- **No code changes needed!** ✓
- `conversation-manager.ts` is already correct
- `submit-report/index.ts` is already correct
- After data swap, all code will work correctly

---

## 🚀 Step-by-Step Fix Process

### **Step 1: Verify the Issue**

Run the diagnostic query to confirm columns are swapped:

```bash
supabase db execute -f supabase/diagnostics/verify_column_swap_issue.sql
```

**Expected Output:**
```
SUMMARY:
- matches_using_phone_number: 0
- matches_using_device_number: 15
- diagnosis: "CONFIRMED: Columns are SWAPPED"
```

### **Step 2: Backup (Recommended)**

Before making changes, backup your database:

```bash
# Via Supabase Dashboard: Database → Backups → Create Backup
```

### **Step 3: Run Migrations in Order**

**IMPORTANT: Run these migrations in the exact order shown!**

#### Migration 1: Swap Column Values

```bash
supabase db push
```

Or manually via Supabase Studio SQL Editor:
1. Copy contents of `supabase/migrations/20251031000002_swap_phone_device_columns.sql`
2. Run in SQL Editor

**Expected Output:**
```
Column Swap Summary:
  - Total conversations updated: 23
  - phone_number now contains: user phone (matches reports.phone)
  - device_number now contains: bot WhatsApp account (Fonnte)
  ✓ Swap appears successful!
```

#### Migration 2: Match with Reports

The migration should automatically run next, or manually run:
1. Copy contents of `supabase/migrations/20251031000003_match_conversations_with_reports.sql`
2. Run in SQL Editor

**Expected Output:**
```
Matching Summary:
  - Conversations marked as COMPLETED: 15
  - Conversations marked as ABANDONED:  8
  - Total conversations processed:      23
```

#### Migration 3: Add Foreign Key

The migration should automatically run next, or manually run:
1. Copy contents of `supabase/migrations/20251031000004_add_report_foreign_key.sql`
2. Run in SQL Editor

**Expected Output:**
```
✓ Foreign key constraint added successfully
  - conversations.report_id → reports.id
  - On delete: SET NULL
✓ Index created on conversations.report_id
```

### **Step 4: Verify the Fix**

Check your admin dashboard at `/admin/conversations`:

**Expected Results:**
- ✅ Conversations with reports → Status: `'completed'`
- ✅ Conversations without reports → Status: `'abandoned'`
- ✅ `report_id` field populated for completed conversations
- ✅ `phone_number` contains user's phone
- ✅ `device_number` contains bot's phone

### **Step 5: Deploy Edge Functions**

Deploy the updated Edge Functions (if not done yet):

```bash
supabase functions deploy fonnte-webhook
supabase functions deploy submit-report
```

---

## 🔬 Technical Details

### Column Swap Logic

The swap is done in a single atomic UPDATE:

```sql
UPDATE conversations
SET
  phone_number = device_number,
  device_number = phone_number;
```

PostgreSQL handles this correctly because it evaluates the right side first before updating.

### Matching Logic

After swap, conversations are matched with reports by:

```sql
-- Match by user phone number
conversations.phone_number = reports.phone

-- Report created during or after conversation (5 min buffer)
reports.created_at >= conversations.started_at
AND reports.created_at <= conversations.last_message_at + INTERVAL '5 minutes'
```

**Why 5 minute buffer?**
- Flowise takes a few seconds to process and submit the report
- Network latency
- Ensures we don't miss valid matches

### Foreign Key Behavior

```sql
FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL
```

- If a report is deleted, `conversation.report_id` is set to `NULL` (not deleted)
- Preserves conversation history even if report is removed

---

## 📊 Column Meanings (After Fix)

| Column | Contains | Example | Used For |
|--------|----------|---------|----------|
| `phone_number` | User's phone number | `+6281234567890` | Matching with reports, user identification |
| `device_number` | Bot's WhatsApp account | `+6287654321098` | Fonnte device metadata, tracking which bot handled |
| `report_id` | Linked report ID | `uuid-123-456` | Foreign key to reports table |

---

## 🧪 Testing Scenarios

### Test 1: New Report Submission
1. User sends message to bot
2. User completes report submission
3. **Expected:** Conversation status = `'completed'`, `report_id` populated

### Test 2: Abandoned Conversation
1. User sends message to bot
2. User stops responding (doesn't complete report)
3. Wait > 30 minutes (or configured timeout)
4. User sends new message
5. **Expected:**
   - Old conversation status = `'abandoned'`
   - New conversation created with status = `'active'`

### Test 3: Continue Within Timeout
1. User sends message to bot
2. User replies within 30 minutes
3. **Expected:** Same conversation continues, status = `'active'`

---

## 🔍 Troubleshooting

### Problem: Swap didn't work

**Check 1: Verify swap actually happened**
```sql
SELECT phone_number, device_number FROM conversations LIMIT 5;
```

**Check 2: Compare with reports**
```sql
SELECT c.phone_number, r.phone
FROM conversations c
INNER JOIN reports r ON c.phone_number = r.phone
LIMIT 5;
```

If still not matching, the phone formats might be different (e.g., one has country code, one doesn't).

### Problem: No conversations matched with reports

**Check 1: Verify timing**
```sql
SELECT
  c.phone_number,
  c.last_message_at,
  r.created_at,
  r.created_at - c.last_message_at AS time_diff
FROM conversations c
INNER JOIN reports r ON c.phone_number = r.phone
LIMIT 10;
```

If `time_diff` is > 5 minutes, you may need to increase the buffer.

**Check 2: Verify phone number formats**
```sql
-- Check phone formats
SELECT DISTINCT phone_number FROM conversations LIMIT 10;
SELECT DISTINCT phone FROM reports LIMIT 10;
```

If formats differ, you may need to normalize them first.

### Problem: Foreign key constraint fails

**Error:** `violates foreign key constraint`

**Cause:** Some `report_id` values don't exist in reports table

**Fix:**
```sql
-- Find invalid report_ids
SELECT c.id, c.report_id
FROM conversations c
LEFT JOIN reports r ON c.report_id = r.id
WHERE c.report_id IS NOT NULL AND r.id IS NULL;

-- Set them to NULL
UPDATE conversations
SET report_id = NULL
WHERE report_id NOT IN (SELECT id FROM reports);
```

Then re-run migration 20251031000004.

---

## 📝 Summary

| Component | Status | What It Does |
|-----------|--------|--------------|
| **Migration 1** | ✅ Ready | Swap phone_number ↔ device_number |
| **Migration 2** | ✅ Ready | Match conversations with reports |
| **Migration 3** | ✅ Ready | Add foreign key constraint |
| **Code Changes** | ✅ Not needed | Already correct! |
| **Future Behavior** | ✅ Automatic | New conversations will work correctly |

---

## ⚠️ Important Notes

1. **Run migrations in order** - They depend on each other
2. **Backup first** - Always backup before schema changes
3. **No code changes needed** - The swap fixes the data, code is already correct
4. **One-time fix** - After migrations run, new data will be inserted correctly
5. **Foreign key** - Adds data integrity, prevents orphaned report_ids

---

## 🎯 Quick Commands

```bash
# 1. Verify issue
supabase db execute -f supabase/diagnostics/verify_column_swap_issue.sql

# 2. Run all migrations
supabase db push

# 3. Deploy functions (if not done)
supabase functions deploy fonnte-webhook
supabase functions deploy submit-report

# 4. Verify in dashboard
# Visit /admin/conversations
```

---

**All fixes are ready to apply! Start with Step 1 to verify the issue, then run the migrations in order.**
