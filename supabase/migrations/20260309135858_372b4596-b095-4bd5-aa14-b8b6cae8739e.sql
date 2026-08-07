
-- Fix RLS: clientes - authenticated can read, admins can write
DROP POLICY IF EXISTS "Allow all access to clientes" ON public.clientes;
CREATE POLICY "Authenticated can select clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix RLS: agendamentos - authenticated can read/insert/update, admins can delete
DROP POLICY IF EXISTS "Allow all access to agendamentos" ON public.agendamentos;
CREATE POLICY "Authenticated can select agendamentos" ON public.agendamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert agendamentos" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update agendamentos" ON public.agendamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete agendamentos" ON public.agendamentos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix RLS: vendedores - authenticated can read, admins can write
DROP POLICY IF EXISTS "Allow all access to vendedores" ON public.vendedores;
CREATE POLICY "Authenticated can select vendedores" ON public.vendedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert vendedores" ON public.vendedores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update vendedores" ON public.vendedores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete vendedores" ON public.vendedores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix RLS: comissoes - authenticated can read, admins can write
DROP POLICY IF EXISTS "Allow all access to comissoes" ON public.comissoes;
CREATE POLICY "Authenticated can select comissoes" ON public.comissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert comissoes" ON public.comissoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update comissoes" ON public.comissoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete comissoes" ON public.comissoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix RLS: configuracoes - authenticated can read, admins can write
DROP POLICY IF EXISTS "Admins can update configuracoes" ON public.configuracoes;
CREATE POLICY "Admins can manage configuracoes" ON public.configuracoes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix RLS: templates_contrato - authenticated can read, admins can write
DROP POLICY IF EXISTS "Allow all access to templates_contrato" ON public.templates_contrato;
CREATE POLICY "Authenticated can select templates" ON public.templates_contrato FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON public.templates_contrato FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix storage: assets bucket
DROP POLICY IF EXISTS "Allow insert to assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow update to assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from assets" ON storage.objects;
CREATE POLICY "Auth users can insert assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assets');
CREATE POLICY "Auth users can update assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'assets');
CREATE POLICY "Admins can delete assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'assets' AND public.has_role(auth.uid(), 'admin'));

-- Fix storage: contratos bucket
DROP POLICY IF EXISTS "Allow insert to contratos" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete from contratos" ON storage.objects;
CREATE POLICY "Auth users can insert contratos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contratos');
CREATE POLICY "Admins can delete contratos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contratos' AND public.has_role(auth.uid(), 'admin'));
