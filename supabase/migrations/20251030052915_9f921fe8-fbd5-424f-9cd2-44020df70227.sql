-- Create login_config table for customizable login page settings
CREATE TABLE IF NOT EXISTS public.login_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  login_title text NOT NULL DEFAULT 'Portal Lapor',
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.login_config ENABLE ROW LEVEL SECURITY;

-- Only one config record should exist
CREATE UNIQUE INDEX IF NOT EXISTS login_config_singleton ON public.login_config ((true));

-- RLS Policies
CREATE POLICY "Admins can view login config"
ON public.login_config
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update login config"
ON public.login_config
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can insert login config"
ON public.login_config
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Public can read login config"
ON public.login_config
FOR SELECT
TO anon
USING (true);

-- Insert default config
INSERT INTO public.login_config (login_title, logo_url)
VALUES ('Portal Lapor', null)
ON CONFLICT DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_login_config_updated_at
BEFORE UPDATE ON public.login_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();