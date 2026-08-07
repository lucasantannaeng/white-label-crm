-- Drop dependent function first
DROP FUNCTION IF EXISTS public.get_clientes_for_tecnico();

-- Recreate view with security_invoker
DROP VIEW IF EXISTS public.clientes_sem_credenciais;

CREATE VIEW public.clientes_sem_credenciais
WITH (security_invoker = on) AS
SELECT id, nome, documento, telefone, email, rua, numero, bairro, cidade, uf, cep,
       inversor, potencia_kwp, quantidade_placas, kwh_mensal, valor_mensal,
       duracao_meses, inicio_contrato, termino_contrato, ativo, observacoes,
       vendedor_id, created_at, updated_at
FROM public.clientes;

-- Recreate the function referencing the view
CREATE OR REPLACE FUNCTION public.get_clientes_for_tecnico()
RETURNS SETOF public.clientes_sem_credenciais
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id, nome, documento, telefone, email, rua, numero, bairro, cidade, uf, cep,
         inversor, potencia_kwp, quantidade_placas, kwh_mensal, valor_mensal, duracao_meses,
         inicio_contrato, termino_contrato, ativo, observacoes, vendedor_id, created_at, updated_at
  FROM public.clientes;
$$;

-- Fix documentos_cliente: replace permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated can select documentos_cliente" ON public.documentos_cliente;

CREATE POLICY "Admins can select documentos_cliente"
ON public.documentos_cliente
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team members can select own documentos_cliente"
ON public.documentos_cliente
FOR SELECT
TO authenticated
USING (
  agendamento_id IN (
    SELECT a.id FROM public.agendamentos a
    WHERE a.equipe_id IN (
      SELECT e.id FROM public.equipes e
      WHERE (auth.uid())::text = ANY(e.membros)
    )
  )
);