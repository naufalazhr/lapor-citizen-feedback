-- Create storage bucket for login logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('login-logos', 'login-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for login-logos bucket
CREATE POLICY "Admins can upload login logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'login-logos' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Admins can update login logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'login-logos' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Admins can delete login logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'login-logos' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
);

CREATE POLICY "Anyone can view login logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'login-logos');