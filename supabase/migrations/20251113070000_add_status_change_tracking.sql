-- Migration: Add Status Change Tracking to Timeline
-- Purpose: Create RPC function to track all status changes in report_dispositions table
-- This ensures all status changes appear in the timeline with full audit trail

-- Create function to update report status with timeline tracking
CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_report RECORD;
  v_tenant_id UUID;
  v_old_status TEXT;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Get user's tenant_id for tenant isolation
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE id = v_user_id;

  -- Get current report with row lock to prevent race conditions
  SELECT * INTO v_report
  FROM reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Report not found'
    );
  END IF;

  -- Store old status for timeline entry
  v_old_status := v_report.status::text;

  -- If status hasn't changed, don't create a timeline entry
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Status unchanged'
    );
  END IF;

  -- Create timeline entry in report_dispositions table
  INSERT INTO report_dispositions (
    report_id,
    opd_id,
    assigned_by,
    assigned_at,
    status_before,
    status_after,
    notes,
    action_type,
    tenant_id
  ) VALUES (
    p_report_id,
    v_report.assigned_opd_id,  -- Preserve current OPD assignment
    v_user_id,                   -- Who made the change
    now(),                       -- When the change happened
    v_old_status,                -- Status before change
    p_new_status,                -- Status after change
    p_notes,                     -- Optional notes
    'status_change',             -- Action type for timeline display
    v_tenant_id                  -- Tenant isolation
  );

  -- Update the report status
  UPDATE reports
  SET status = p_new_status::report_status
  WHERE id = p_report_id;

  -- Return success with status transition info
  RETURN jsonb_build_object(
    'success', true,
    'old_status', v_old_status,
    'new_status', p_new_status
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_report_status(UUID, TEXT, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.update_report_status IS
'Updates report status and creates a timeline entry in report_dispositions.
This ensures all status changes are tracked with full audit trail (who, when, from/to).
Usage: SELECT update_report_status(report_id, new_status, optional_notes)';
