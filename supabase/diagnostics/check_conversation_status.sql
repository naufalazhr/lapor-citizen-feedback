-- =============================================================================
-- Diagnostic Script: Check Current Conversation Status
-- Run this BEFORE applying the fix to see what will be changed
-- =============================================================================

-- Get the current timeout setting
WITH config AS (
  SELECT session_timeout_minutes
  FROM fonnte_config
  WHERE is_active = true
  LIMIT 1
),
cutoff AS (
  SELECT
    COALESCE(session_timeout_minutes, 30) AS timeout_minutes,
    NOW() - (COALESCE(session_timeout_minutes, 30) || ' minutes')::INTERVAL AS cutoff_time
  FROM config
)

-- Show summary of what will be updated
SELECT
  'SUMMARY' AS section,
  '' AS details,
  NULL AS count
UNION ALL
SELECT
  'Current Timeout',
  timeout_minutes || ' minutes',
  NULL
FROM cutoff
UNION ALL
SELECT
  'Cutoff Time',
  cutoff_time::TEXT,
  NULL
FROM cutoff
UNION ALL
SELECT '', '', NULL
UNION ALL
SELECT
  'CURRENT STATUS',
  status,
  COUNT(*)::INTEGER
FROM conversations
GROUP BY status
UNION ALL
SELECT '', '', NULL
UNION ALL
SELECT
  'WILL BE UPDATED TO COMPLETED',
  'Conversations with report_id but status=active',
  COUNT(*)::INTEGER
FROM conversations
WHERE status = 'active' AND report_id IS NOT NULL
UNION ALL
SELECT
  'WILL BE UPDATED TO ABANDONED',
  'Conversations without report_id and timed out',
  COUNT(*)::INTEGER
FROM conversations, cutoff
WHERE
  conversations.status = 'active'
  AND conversations.report_id IS NULL
  AND conversations.last_message_at < cutoff.cutoff_time
UNION ALL
SELECT
  'WILL REMAIN ACTIVE',
  'Conversations without report_id within timeout',
  COUNT(*)::INTEGER
FROM conversations, cutoff
WHERE
  conversations.status = 'active'
  AND conversations.report_id IS NULL
  AND conversations.last_message_at >= cutoff.cutoff_time;

-- =============================================================================
-- Detailed view of conversations that will be updated
-- =============================================================================

SELECT '================================================' AS divider;
SELECT 'DETAILED VIEW: Conversations to be updated' AS title;
SELECT '================================================' AS divider;

WITH config AS (
  SELECT session_timeout_minutes
  FROM fonnte_config
  WHERE is_active = true
  LIMIT 1
),
cutoff AS (
  SELECT
    COALESCE(session_timeout_minutes, 30) AS timeout_minutes,
    NOW() - (COALESCE(session_timeout_minutes, 30) || ' minutes')::INTERVAL AS cutoff_time
  FROM config
)
SELECT
  c.id,
  c.phone_number,
  c.status AS current_status,
  CASE
    WHEN c.report_id IS NOT NULL THEN 'completed'
    WHEN c.report_id IS NULL AND c.last_message_at < cutoff.cutoff_time THEN 'abandoned'
    ELSE 'active'
  END AS new_status,
  c.last_message_at,
  EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60 AS minutes_since_last_message,
  c.report_id,
  CASE
    WHEN c.report_id IS NOT NULL THEN 'Has report → mark completed'
    WHEN c.report_id IS NULL AND c.last_message_at < cutoff.cutoff_time THEN 'No report + timed out → mark abandoned'
    ELSE 'No report + within timeout → keep active'
  END AS reason
FROM conversations c, cutoff
WHERE c.status = 'active'
ORDER BY
  CASE
    WHEN c.report_id IS NOT NULL THEN 1
    WHEN c.report_id IS NULL AND c.last_message_at < cutoff.cutoff_time THEN 2
    ELSE 3
  END,
  c.last_message_at DESC;
