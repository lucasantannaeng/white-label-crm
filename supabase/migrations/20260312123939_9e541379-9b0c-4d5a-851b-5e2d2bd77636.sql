-- Restrict assets bucket: only admins can insert/update
DROP POLICY IF EXISTS "Auth users can insert assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update assets" ON storage.objects;

CREATE POLICY "Admins can insert assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Restrict contratos bucket: only admins can insert
DROP POLICY IF EXISTS "Auth users can insert contratos" ON storage.objects;

CREATE POLICY "Admins can insert contratos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos' AND public.has_role(auth.uid(), 'admin'::public.app_role));