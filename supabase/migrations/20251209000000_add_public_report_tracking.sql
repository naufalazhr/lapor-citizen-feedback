-- Migration: Add public report tracking function
-- Description: Creates a secure function for public report tracking without exposing sensitive data

-- Create the public report tracking function
CREATE OR REPLACE FUNCTION public.get_public_report_tracking(p_ticket_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  report_uuid UUID;
BEGIN
  -- Get the report ID from ticket_id
  SELECT id INTO report_uuid
  FROM reports
  WHERE ticket_id = p_ticket_id;

  -- Return null if report not found
  IF report_uuid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build the result with public-safe information only
  -- Excludes: reporter_name, phone, internal notes, staff names, emails
  SELECT json_build_object(
    'ticket_id', r.ticket_id,
    'status', r.status,
    'type', r.type,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'current_opd', CASE
      WHEN o.id IS NOT NULL THEN json_build_object(
        'name', o.name,
        'code', o.code
      )
      ELSE NULL
    END,
    'timeline', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', rd.id,
          'timestamp', rd.assigned_at,
          'action_type', rd.action_type,
          'status_before', rd.status_before,
          'status_after', rd.status_after,
          'opd', CASE
            WHEN opd.id IS NOT NULL THEN json_build_object(
              'name', opd.name,
              'code', opd.code
            )
            ELSE NULL
          END,
          'previous_opd', CASE
            WHEN prev_opd.id IS NOT NULL THEN json_build_object(
              'name', prev_opd.name,
              'code', prev_opd.code
            )
            ELSE NULL
          END
        ) ORDER BY rd.assigned_at ASC
      ), '[]'::json)
      FROM report_dispositions rd
      LEFT JOIN opds opd ON opd.id = rd.opd_id
      LEFT JOIN opds prev_opd ON prev_opd.id = rd.previous_opd_id
      WHERE rd.report_id = report_uuid
      -- Only include certain action types that are relevant to public tracking
      AND rd.action_type IN ('disposition', 'status_change', 'return_to_member')
    )
  ) INTO result
  FROM reports r
  LEFT JOIN opds o ON o.id = r.assigned_opd_id
  WHERE r.id = report_uuid;

  RETURN result;
END;
$$;

-- Grant execute permission to anonymous users (public tracking)
GRANT EXECUTE ON FUNCTION public.get_public_report_tracking(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_report_tracking(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_public_report_tracking(TEXT) IS
'Public function for citizens to track their report status by ticket ID.
Returns only public-safe data without sensitive information like reporter details,
internal notes, or staff information.';
