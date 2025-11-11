-- ============================================================================
-- Phase 1b: Create OPD Tables, Indexes, and RLS Policies
-- ============================================================================

-- 2. Create opds table (multi-tenant)
CREATE TABLE public.opds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  head_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- Indexes for opds
CREATE INDEX idx_opds_tenant_id ON public.opds(tenant_id);
CREATE INDEX idx_opds_is_active ON public.opds(is_active);
CREATE INDEX idx_opds_code ON public.opds(code);

-- Enable RLS on opds
ALTER TABLE public.opds ENABLE ROW LEVEL SECURITY;

-- RLS Policies for opds
CREATE POLICY "Superadmins can manage all opds"
  ON public.opds FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can manage tenant opds"
  ON public.opds FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
  )
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
  );

CREATE POLICY "Users can view tenant opds"
  ON public.opds FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Trigger for updated_at on opds
CREATE TRIGGER update_opds_updated_at
  BEFORE UPDATE ON public.opds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create user_opd_assignments table
CREATE TABLE public.user_opd_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opd_id UUID NOT NULL REFERENCES public.opds(id) ON DELETE CASCADE,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, opd_id)
);

-- Indexes for user_opd_assignments
CREATE INDEX idx_user_opd_user_id ON public.user_opd_assignments(user_id);
CREATE INDEX idx_user_opd_opd_id ON public.user_opd_assignments(opd_id);
CREATE INDEX idx_user_opd_is_active ON public.user_opd_assignments(is_active);

-- Enable RLS on user_opd_assignments
ALTER TABLE public.user_opd_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_opd_assignments
CREATE POLICY "Superadmins can manage all assignments"
  ON public.user_opd_assignments FOR ALL
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can manage tenant assignments"
  ON public.user_opd_assignments FOR ALL
  USING (
    opd_id IN (
      SELECT id FROM public.opds 
      WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
  )
  WITH CHECK (
    opd_id IN (
      SELECT id FROM public.opds 
      WHERE tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
  );

CREATE POLICY "Users can view own assignments"
  ON public.user_opd_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can view assignments"
  ON public.user_opd_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. Create report_dispositions table (timeline)
CREATE TABLE public.report_dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  opd_id UUID NOT NULL REFERENCES public.opds(id) ON DELETE CASCADE,
  previous_opd_id UUID REFERENCES public.opds(id),
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_before TEXT,
  status_after TEXT,
  notes TEXT,
  action_type TEXT NOT NULL DEFAULT 'disposition',
  tenant_id UUID NOT NULL
);

-- Indexes for report_dispositions
CREATE INDEX idx_dispositions_report_id ON public.report_dispositions(report_id);
CREATE INDEX idx_dispositions_opd_id ON public.report_dispositions(opd_id);
CREATE INDEX idx_dispositions_assigned_at ON public.report_dispositions(assigned_at DESC);
CREATE INDEX idx_dispositions_tenant_id ON public.report_dispositions(tenant_id);

-- Enable RLS on report_dispositions
ALTER TABLE public.report_dispositions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_dispositions
CREATE POLICY "Superadmins can manage all dispositions"
  ON public.report_dispositions FOR ALL
  USING (has_role(auth.uid(), 'superadmin'))
  WITH CHECK (has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Users can view tenant dispositions"
  ON public.report_dispositions FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Members can create dispositions"
  ON public.report_dispositions FOR INSERT
  WITH CHECK (
    (has_role(auth.uid(), 'member') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'opd_member'))
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- 5. Update reports table
ALTER TABLE public.reports ADD COLUMN assigned_opd_id UUID REFERENCES public.opds(id);
ALTER TABLE public.reports ADD COLUMN disposition_notes TEXT;

-- Index for reports
CREATE INDEX idx_reports_assigned_opd_id ON public.reports(assigned_opd_id);

-- 6. Add RLS policies for OPD Members on reports
CREATE POLICY "OPD Members can view assigned OPD reports"
  ON public.reports FOR SELECT
  USING (
    has_role(auth.uid(), 'opd_member')
    AND assigned_opd_id IN (
      SELECT opd_id FROM public.user_opd_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "OPD Members can update assigned OPD reports"
  ON public.reports FOR UPDATE
  USING (
    has_role(auth.uid(), 'opd_member')
    AND assigned_opd_id IN (
      SELECT opd_id FROM public.user_opd_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'opd_member')
    AND assigned_opd_id IN (
      SELECT opd_id FROM public.user_opd_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );