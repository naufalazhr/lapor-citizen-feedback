-- =============================================================================
-- Preview: Conversation-Report Matching
-- Run this to see which conversations will be matched with reports
-- =============================================================================

-- Summary counts
SELECT
  'CURRENT STATUS SUMMARY' AS section,
  '' AS details,
  NULL::BIGINT AS count
UNION ALL
SELECT
  'Total Conversations',
  '',
  COUNT(*)
FROM conversations
UNION ALL
SELECT
  'Current Status: ' || status,
  '',
  COUNT(*)
FROM conversations
GROUP BY status
UNION ALL
SELECT '', '', NULL
UNION ALL
SELECT
  'Total Reports in Database',
  '',
  COUNT(*)
FROM reports
UNION ALL
SELECT '', '', NULL;

-- Show matching logic
SELECT '================================================' AS divider;
SELECT 'MATCHING PREVIEW' AS title;
SELECT '================================================' AS divider;

-- Conversations that WILL be matched with reports (COMPLETED)
WITH matched AS (
  SELECT DISTINCT ON (c.id)
    c.id AS conversation_id,
    c.phone_number,
    c.started_at AS conv_started,
    c.last_message_at AS conv_last_message,
    c.status AS current_status,
    c.report_id AS current_report_id,
    r.id AS matched_report_id,
    r.created_at AS report_created,
    EXTRACT(EPOCH FROM (r.created_at - c.last_message_at)) / 60 AS minutes_diff
  FROM conversations c
  INNER JOIN reports r ON c.phone_number = r.phone
  WHERE
    r.created_at >= c.started_at
    AND r.created_at <= c.last_message_at + INTERVAL '5 minutes'
  ORDER BY c.id, r.created_at DESC
)
SELECT
  'WILL BE COMPLETED' AS action,
  conversation_id,
  phone_number,
  current_status,
  matched_report_id,
  ROUND(minutes_diff::NUMERIC, 2) AS minutes_after_last_msg,
  conv_started,
  conv_last_message,
  report_created
FROM matched
ORDER BY conv_started DESC;

-- Conversations that will NOT be matched (ABANDONED)
SELECT '================================================' AS divider;
SELECT 'WILL BE MARKED AS ABANDONED' AS title;
SELECT '================================================' AS divider;

WITH matched_conv_ids AS (
  SELECT DISTINCT c.id
  FROM conversations c
  INNER JOIN reports r ON c.phone_number = r.phone
  WHERE
    r.created_at >= c.started_at
    AND r.created_at <= c.last_message_at + INTERVAL '5 minutes'
)
SELECT
  'WILL BE ABANDONED' AS action,
  c.id AS conversation_id,
  c.phone_number,
  c.status AS current_status,
  c.started_at,
  c.last_message_at,
  EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) / 60 AS minutes_since_last_msg
FROM conversations c
WHERE c.id NOT IN (SELECT id FROM matched_conv_ids)
ORDER BY c.started_at DESC;

-- Summary of what will change
SELECT '================================================' AS divider;
SELECT 'SUMMARY' AS title;
SELECT '================================================' AS divider;

WITH matched_count AS (
  SELECT COUNT(DISTINCT c.id) AS cnt
  FROM conversations c
  INNER JOIN reports r ON c.phone_number = r.phone
  WHERE
    r.created_at >= c.started_at
    AND r.created_at <= c.last_message_at + INTERVAL '5 minutes'
),
total_count AS (
  SELECT COUNT(*) AS cnt FROM conversations
)
SELECT
  matched_count.cnt AS will_be_completed,
  (total_count.cnt - matched_count.cnt) AS will_be_abandoned,
  total_count.cnt AS total_conversations
FROM matched_count, total_count;
