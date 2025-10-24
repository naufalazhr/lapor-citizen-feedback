-- Create API keys table for managing third-party integrations
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Admins can view all API keys
CREATE POLICY "Admins can view all API keys"
ON public.api_keys
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create API keys
CREATE POLICY "Admins can create API keys"
ON public.api_keys
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update API keys (deactivate/reactivate)
CREATE POLICY "Admins can update API keys"
ON public.api_keys
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete API keys
CREATE POLICY "Admins can delete API keys"
ON public.api_keys
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster key lookups
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;