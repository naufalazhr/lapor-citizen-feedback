-- =============================================================================
-- Diagnostic: Verify Column Swap Issue
-- This query checks if phone_number and device_number are swapped
-- =============================================================================

SELECT '================================================' AS divider;
SELECT 'ISSUE VERIFICATION' AS title;
SELECT '================================================' AS divider;

-- Show sample data from conversations table
SELECT
  'CONVERSATIONS TABLE SAMPLE' AS section,
  id,
  phone_number AS current_phone_number_value,
  device_number AS current_device_number_value,
  started_at
FROM conversations
ORDER BY started_at DESC
LIMIT 5;

-- Show sample data from reports table
SELECT '================================================' AS divider;
SELECT 'REPORTS TABLE SAMPLE' AS section,
  '' AS id,
  phone AS report_phone_value,
  '' AS current_device_number_value,
  created_at AS started_at
FROM reports
ORDER BY created_at DESC
LIMIT 5;

-- Test which column actually matches reports.phone
SELECT '================================================' AS divider;
SELECT 'MATCHING TEST' AS title;
SELECT '================================================' AS divider;

-- Test 1: Match using phone_number (current logic - likely WRONG)
WITH match_phone_number AS (
  SELECT COUNT(*) AS match_count
  FROM conversations c
  INNER JOIN reports r ON c.phone_number = r.phone
)
SELECT
  'Test 1: conversations.phone_number = reports.phone' AS test,
  match_count AS matches_found
FROM match_phone_number;

-- Test 2: Match using device_number (likely CORRECT due to swap)
WITH match_device_number AS (
  SELECT COUNT(*) AS match_count
  FROM conversations c
  INNER JOIN reports r ON c.device_number = r.phone
)
SELECT
  'Test 2: conversations.device_number = reports.phone' AS test,
  match_count AS matches_found
FROM match_device_number;

-- Detailed comparison
SELECT '================================================' AS divider;
SELECT 'DETAILED COMPARISON' AS title;
SELECT '================================================' AS divider;

SELECT
  c.id AS conversation_id,
  c.phone_number AS conv_phone_number,
  c.device_number AS conv_device_number,
  r.phone AS report_phone,
  CASE
    WHEN c.phone_number = r.phone THEN 'phone_number matches'
    WHEN c.device_number = r.phone THEN 'device_number matches'
    ELSE 'no match'
  END AS which_column_matches,
  c.started_at,
  r.created_at
FROM conversations c
LEFT JOIN reports r ON (c.phone_number = r.phone OR c.device_number = r.phone)
  AND r.created_at >= c.started_at
  AND r.created_at <= c.last_message_at + INTERVAL '5 minutes'
ORDER BY c.started_at DESC
LIMIT 10;

-- Summary
SELECT '================================================' AS divider;
SELECT 'SUMMARY' AS title;
SELECT '================================================' AS divider;

WITH total_convs AS (
  SELECT COUNT(*) AS cnt FROM conversations
),
match_phone AS (
  SELECT COUNT(*) AS cnt
  FROM conversations c
  INNER JOIN reports r ON c.phone_number = r.phone
),
match_device AS (
  SELECT COUNT(*) AS cnt
  FROM conversations c
  INNER JOIN reports r ON c.device_number = r.phone
)
SELECT
  total_convs.cnt AS total_conversations,
  match_phone.cnt AS matches_using_phone_number,
  match_device.cnt AS matches_using_device_number,
  CASE
    WHEN match_device.cnt > match_phone.cnt THEN 'CONFIRMED: Columns are SWAPPED'
    WHEN match_phone.cnt > match_device.cnt THEN 'OK: Columns are correct'
    ELSE 'UNCLEAR: Need manual inspection'
  END AS diagnosis
FROM total_convs, match_phone, match_device;
