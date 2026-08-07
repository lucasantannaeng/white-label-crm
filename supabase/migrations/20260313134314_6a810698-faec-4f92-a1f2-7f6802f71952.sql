
-- Fix 1: Restrict inversores SELECT to admin only (tecnicos use clientes_sem_credenciais view)
DROP POLICY IF EXISTS "Authenticated can select inversores" ON public.inversores;

CREATE POLICY "Admins can select inversores" ON public.inversores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Restrict configuracoes SELECT to authenticated users only
DROP POLICY IF EXISTS "Allow all read configuracoes" ON public.configuracoes;

CREATE POLICY "Authenticated can read configuracoes" ON public.configuracoes
  FOR SELECT TO authenticated
  USING (true);
