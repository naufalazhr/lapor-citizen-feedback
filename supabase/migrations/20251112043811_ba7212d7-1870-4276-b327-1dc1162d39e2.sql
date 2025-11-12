-- Drop the old function that was causing RLS issues
DROP FUNCTION IF EXISTS public.opd_return_report(uuid, text);

-- Create report_return_requests table
CREATE TABLE public.report_return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_return_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_return_requests
-- OPD Members can create return requests for their assigned reports
CREATE POLICY "OPD Members can create return requests"
ON public.report_return_requests
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'opd_member') AND
  EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.user_opd_assignments uoa ON r.assigned_opd_id = uoa.opd_id
    WHERE r.id = report_id 
    AND uoa.user_id = auth.uid() 
    AND uoa.is_active = true
  )
);

-- OPD Members can view their own return requests
CREATE POLICY "OPD Members can view own requests"
ON public.report_return_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'opd_member') AND
  requested_by = auth.uid()
);

-- Members/Admins can view all return requests in their tenant
CREATE POLICY "Members can view tenant return requests"
ON public.report_return_requests
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'member') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')) AND
  tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Members/Admins can update return requests (approve/reject)
CREATE POLICY "Members can update return requests"
ON public.report_return_requests
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'member') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')) AND
  tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Superadmins can manage all return requests
CREATE POLICY "Superadmins can manage return requests"
ON public.report_return_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'superadmin'))
WITH CHECK (has_role(auth.uid(), 'superadmin'));

-- Service role can manage return requests
CREATE POLICY "Service can manage return requests"
ON public.report_return_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_return_requests_report ON public.report_return_requests(report_id);
CREATE INDEX idx_return_requests_status ON public.report_return_requests(status);
CREATE INDEX idx_return_requests_tenant ON public.report_return_requests(tenant_id);
CREATE INDEX idx_return_requests_requested_by ON public.report_return_requests(requested_by);

-- Create approval function
CREATE OR REPLACE FUNCTION public.approve_report_return(
  p_request_id UUID,
  p_approved BOOLEAN,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request RECORD;
  v_report RECORD;
BEGIN
  -- Validate user is Member/Admin/Owner
  IF NOT (has_role(v_user_id, 'member') OR has_role(v_user_id, 'admin') OR has_role(v_user_id, 'owner')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Lock and get request
  SELECT * INTO v_request FROM report_return_requests WHERE id = p_request_id FOR UPDATE;
  
  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_already_processed');
  END IF;

  -- Verify tenant access
  IF v_request.tenant_id != get_user_tenant_id(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_tenant');
  END IF;

  IF p_approved THEN
    -- Get report details
    SELECT * INTO v_report FROM reports WHERE id = v_request.report_id FOR UPDATE;

    IF v_report IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'report_not_found');
    END IF;

    -- Update report - clear OPD assignment (Member has permission to do this)
    UPDATE reports 
    SET assigned_opd_id = NULL, updated_at = now() 
    WHERE id = v_request.report_id;

    -- Create disposition record
    INSERT INTO report_dispositions (
      report_id, opd_id, previous_opd_id, assigned_by, notes,
      status_before, status_after, action_type, tenant_id
    ) VALUES (
      v_request.report_id, v_report.assigned_opd_id, v_report.assigned_opd_id,
      v_user_id, v_request.notes, v_report.status::text, v_report.status::text,
      'return_to_member', v_request.tenant_id
    );

    -- Update request status
    UPDATE report_return_requests 
    SET status = 'approved', reviewed_by = v_user_id, reviewed_at = now(), updated_at = now()
    WHERE id = p_request_id;
  ELSE
    -- Reject the request
    UPDATE report_return_requests 
    SET status = 'rejected', reviewed_by = v_user_id, reviewed_at = now(), 
        rejection_reason = p_rejection_reason, updated_at = now()
    WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_report_return(UUID, BOOLEAN, TEXT) TO authenticated;