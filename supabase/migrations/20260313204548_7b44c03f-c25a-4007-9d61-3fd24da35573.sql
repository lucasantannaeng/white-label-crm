
-- 1. Fix: Tecnicos should only read via clientes_sem_credenciais view, not the full clientes table
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Tecnicos can select clientes" ON public.clientes;

-- Instead, grant tecnicos SELECT on the view (views inherit the invoker's privileges on base tables,
-- so we need a security-definer function approach OR just let tecnicos read the view directly).
-- The view clientes_sem_credenciais already exists and excludes credential columns.
-- We need RLS on the view or a policy that restricts columns. Since Postgres RLS can't restrict columns,
-- the correct approach is: remove tecnico access to clientes table entirely and use the view.
-- The view already works because it's a simple view that inherits RLS from clientes.
-- BUT without the tecnico SELECT policy on clientes, the view won't work either.
-- Solution: Create a security definer function that tecnicos call, or use a SECURITY INVOKER view 
-- with a separate policy. The simplest correct approach: keep a tecnico policy on clientes but 
-- use column-level security via the view. Actually the best approach:
-- Re-add the policy but tecnicos query through the app uses clientes_sem_credenciais view already.
-- The real fix is to ensure the view is SECURITY DEFINER so it bypasses RLS, then add RLS to the view.
-- Since views can't have RLS in Postgres, we need a different approach.

-- Best approach: Make tecnicos only able to SELECT specific columns by dropping their direct 
-- clientes access and creating a security definer function for view access.

-- Actually simplest: recreate the view as SECURITY INVOKER (default) and add a tecnico-specific 
-- policy on clientes that still allows SELECT but the app code already uses the view.
-- The problem is the POLICY grants SELECT on ALL columns. We can't restrict columns in RLS.
-- So we must: 1) Remove tecnico policy on clientes, 2) Grant access through a security definer function.

-- Create a function that returns clientes without credentials for non-admin users
CREATE OR REPLACE FUNCTION public.get_clientes_for_tecnico()
RETURNS SETOF public.clientes_sem_credenciais
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nome, documento, telefone, email, rua, numero, bairro, cidade, uf, cep,
         inversor, potencia_kwp, quantidade_placas, kwh_mensal, valor_mensal, duracao_meses,
         inicio_contrato, termino_contrato, ativo, observacoes, vendedor_id, created_at, updated_at
  FROM public.clientes;
$$;

-- 2. Fix: Restrict agendamentos UPDATE to admins + team members
DROP POLICY IF EXISTS "Authenticated can update agendamentos" ON public.agendamentos;

CREATE POLICY "Admins can update agendamentos"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team members can update own agendamentos"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (
  equipe_id IN (
    SELECT id FROM public.equipes 
    WHERE auth.uid()::text = ANY(membros)
  )
)
WITH CHECK (
  equipe_id IN (
    SELECT id FROM public.equipes 
    WHERE auth.uid()::text = ANY(membros)
  )
);

-- 3. Fix: Restrict comissoes SELECT to admins + own vendedor
DROP POLICY IF EXISTS "Authenticated can select comissoes" ON public.comissoes;

CREATE POLICY "Admins can select all comissoes"
ON public.comissoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Vendedores can select own comissoes"
ON public.comissoes
FOR SELECT
TO authenticated
USING (
  vendedor_id IN (
    SELECT id FROM public.vendedores WHERE user_id = auth.uid()
  )
);
