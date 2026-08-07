
-- Fix 1: Restrict unassigned agendamentos to admins only
DROP POLICY IF EXISTS "Anyone can select unassigned agendamentos" ON public.agendamentos;

CREATE POLICY "Admins can select unassigned agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (equipe_id IS NULL AND has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Restrict vendedores SELECT to own record + admins
DROP POLICY IF EXISTS "Authenticated can select vendedores" ON public.vendedores;

CREATE POLICY "Users can select own vendedor"
ON public.vendedores
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
