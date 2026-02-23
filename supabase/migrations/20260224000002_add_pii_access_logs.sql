-- Migration: Add PII Access Logs table for audit trail
--
-- Part of the reporter PII masking system. Records every time a staff user
-- views a report's PII data, capturing the masking level applied at that time.
-- Audit logs are append-only (no UPDATE/DELETE for regular users).

CREATE TABLE IF NOT EXISTS public.pii_access_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  accessed_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_at_time  TEXT NOT NULL,    -- snapshot of user's role when access occurred
  masking_level TEXT NOT NULL,    -- L0/L1/L2/L3 — level that was applied to this user
  action        TEXT NOT NULL DEFAULT 'view',  -- 'view' | 'export'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Indexes for common audit query patterns
CREATE INDEX IF NOT EXISTS idx_pii_logs_report_id   ON public.pii_access_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_pii_logs_accessed_by ON public.pii_access_logs(accessed_by);
CREATE INDEX IF NOT EXISTS idx_pii_logs_tenant_id   ON public.pii_access_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pii_logs_created_at  ON public.pii_access_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.pii_access_logs ENABLE ROW LEVEL SECURITY;

-- Admin, owner, and superadmin can read audit logs (within their tenant)
DROP POLICY IF EXISTS "Admins can read PII access logs" ON public.pii_access_logs;
CREATE POLICY "Admins can read PII access logs"
ON public.pii_access_logs
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'superadmin')
  )
);

-- Any authenticated user can insert their own log entry
-- WITH CHECK ensures users can only log their own access
DROP POLICY IF EXISTS "Users can log own PII access" ON public.pii_access_logs;
CREATE POLICY "Users can log own PII access"
ON public.pii_access_logs
FOR INSERT
TO authenticated
WITH CHECK (accessed_by = auth.uid());

-- Audit logs are immutable for regular users — only service role can manage
DROP POLICY IF EXISTS "Service role manages PII access logs" ON public.pii_access_logs;
CREATE POLICY "Service role manages PII access logs"
ON public.pii_access_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.pii_access_logs IS
'Append-only audit trail for reporter PII access in the admin dashboard.
Captures who viewed which report, with what masking level applied, and when.
Part of the RBAC-based PII masking system (L0/L1/L2/L3).';
