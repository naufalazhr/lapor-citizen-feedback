-- Add RLS policies for members and viewers to access reports
CREATE POLICY "Members can view all reports"
ON public.reports
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'member'::app_role));

-- Add RLS policies for viewers to view conversations
CREATE POLICY "Viewers can view all conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'viewer'::app_role));

-- Add RLS policies for members to view conversations
CREATE POLICY "Members can view all conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'member'::app_role));

-- Add RLS policies for viewers to view messages
CREATE POLICY "Viewers can view all messages"
ON public.messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'viewer'::app_role));

-- Add RLS policies for members to view messages
CREATE POLICY "Members can view all messages"
ON public.messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'member'::app_role));

-- Add RLS policies for members to update reports (optional - can be adjusted based on requirements)
CREATE POLICY "Members can update reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'member'::app_role));

-- Add RLS policies for viewers to view attachments
CREATE POLICY "Viewers can view attachments"
ON public.attachments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'viewer'::app_role));

-- Add RLS policies for members to view attachments
CREATE POLICY "Members can view attachments"
ON public.attachments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'member'::app_role));