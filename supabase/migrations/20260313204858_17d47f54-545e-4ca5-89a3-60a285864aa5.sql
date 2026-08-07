
-- 1. clientes_sem_credenciais is a VIEW, not a table, so we can't add RLS directly.
-- The security definer function get_clientes_for_tecnico already bypasses RLS.
-- To prevent direct access to the view by non-admins, we revoke SELECT on it
-- and only allow access through the security definer function.

-- Revoke direct access to the view from authenticated users
REVOKE SELECT ON public.clientes_sem_credenciais FROM authenticated;
REVOKE SELECT ON public.clientes_sem_credenciais FROM anon;

-- The get_clientes_for_tecnico function is SECURITY DEFINER so it still works.

-- 2. Restrict agendamentos SELECT: admins see all, others see only their team's
DROP POLICY IF EXISTS "Authenticated can select agendamentos" ON public.agendamentos;

CREATE POLICY "Admins can select all agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team members can select own agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (
  equipe_id IN (
    SELECT id FROM public.equipes 
    WHERE auth.uid()::text = ANY(membros)
  )
);

-- Also allow selecting unassigned agendamentos (no team yet) so they can be claimed
CREATE POLICY "Anyone can select unassigned agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (equipe_id IS NULL);
