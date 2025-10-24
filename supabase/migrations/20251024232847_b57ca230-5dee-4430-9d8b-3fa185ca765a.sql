-- Create table for API field configurations
CREATE TABLE IF NOT EXISTS public.api_field_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_name text NOT NULL UNIQUE,
  is_required boolean NOT NULL DEFAULT true,
  field_type text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_field_configs ENABLE ROW LEVEL SECURITY;

-- Admins can view all field configs
CREATE POLICY "Admins can view field configs"
  ON public.api_field_configs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update field configs
CREATE POLICY "Admins can update field configs"
  ON public.api_field_configs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert field configs
CREATE POLICY "Admins can insert field configs"
  ON public.api_field_configs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow public read access for API validation (no auth needed)
CREATE POLICY "Public can read field configs"
  ON public.api_field_configs
  FOR SELECT
  USING (true);

-- Insert default field configurations
INSERT INTO public.api_field_configs (field_name, is_required, field_type, description) VALUES
  ('reporter_name', true, 'string', 'Full name of the reporter'),
  ('phone', true, 'string', 'Phone number'),
  ('address', true, 'string', 'Address of the issue'),
  ('description', true, 'string', 'Detailed description'),
  ('type', true, 'string', 'Either "lapor" or "aspirasi"'),
  ('photo_url', false, 'string', 'Optional photo URL'),
  ('geo_location', false, 'object', 'Optional { lat, lng }')
ON CONFLICT (field_name) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_api_field_configs_updated_at
  BEFORE UPDATE ON public.api_field_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();