-- Part 2: Database Enhancement for Government Reporting Dashboard

-- 1. Add ticket_id to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS ticket_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_reports_ticket_id ON reports(ticket_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);

-- 2. Enhance profiles table with government representative information
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 3. Create user_approvals table for tracking approval workflow
CREATE TABLE IF NOT EXISTS user_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_role app_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  organization TEXT,
  department TEXT,
  position TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_approvals
ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_approvals
CREATE POLICY "Admins and owners can view all approval requests"
ON user_approvals FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'owner'::app_role)
);

CREATE POLICY "Users can view their own approval requests"
ON user_approvals FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Anyone can create approval requests"
ON user_approvals FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and owners can update approval requests"
ON user_approvals FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'owner'::app_role)
);

-- 4. Create comments table for internal notes on reports
CREATE TABLE IF NOT EXISTS report_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on report_comments
ALTER TABLE report_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_comments
CREATE POLICY "Admins can view all comments"
ON report_comments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can insert comments"
ON report_comments FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update their own comments"
ON report_comments FOR UPDATE
USING (user_id = auth.uid() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role)));

-- 5. Create function to auto-generate ticket IDs
CREATE OR REPLACE FUNCTION generate_ticket_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ticket_id TEXT;
  year_month TEXT;
  sequence_num INTEGER;
BEGIN
  -- Format: RPRT-YYYYMM-XXXXX
  year_month := TO_CHAR(NOW(), 'YYYYMM');
  
  -- Get the count of reports this month + 1
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM reports
  WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
  
  -- Create ticket ID
  new_ticket_id := 'RPRT-' || year_month || '-' || LPAD(sequence_num::TEXT, 5, '0');
  
  RETURN new_ticket_id;
END;
$$;

-- 6. Create trigger to auto-generate ticket_id on report insert
CREATE OR REPLACE FUNCTION set_ticket_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_id IS NULL THEN
    NEW.ticket_id := generate_ticket_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_ticket_id ON reports;
CREATE TRIGGER trigger_set_ticket_id
BEFORE INSERT ON reports
FOR EACH ROW
EXECUTE FUNCTION set_ticket_id();

-- 7. Backfill ticket_id for existing reports
DO $$
DECLARE
  report_record RECORD;
  counter INTEGER := 1;
  year_month TEXT;
BEGIN
  FOR report_record IN 
    SELECT id, created_at 
    FROM reports 
    WHERE ticket_id IS NULL 
    ORDER BY created_at ASC
  LOOP
    year_month := TO_CHAR(report_record.created_at, 'YYYYMM');
    UPDATE reports 
    SET ticket_id = 'RPRT-' || year_month || '-' || LPAD(counter::TEXT, 5, '0')
    WHERE id = report_record.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- 8. Update trigger for report_comments
DROP TRIGGER IF EXISTS update_report_comments_updated_at ON report_comments;
CREATE TRIGGER update_report_comments_updated_at
BEFORE UPDATE ON report_comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 9. Update trigger for user_approvals
DROP TRIGGER IF EXISTS update_user_approvals_updated_at ON user_approvals;
CREATE TRIGGER update_user_approvals_updated_at
BEFORE UPDATE ON user_approvals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 10. Update RLS policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- 11. Add viewer role access to reports (read-only)
CREATE POLICY "Viewers can view all reports"
ON reports FOR SELECT
USING (has_role(auth.uid(), 'viewer'::app_role));