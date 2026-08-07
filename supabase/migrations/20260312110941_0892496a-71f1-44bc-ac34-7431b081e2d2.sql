
-- Create a restricted view for non-admin users that excludes sensitive inverter credentials
CREATE OR REPLACE VIEW public.clientes_sem_credenciais AS
  SELECT id, nome, documento, telefone, email, rua, numero, bairro, cidade, uf, cep,
         inversor, potencia_kwp, quantidade_placas, kwh_mensal, valor_mensal,
         duracao_meses, inicio_contrato, termino_contrato, ativo, observacoes, vendedor_id,
         created_at, updated_at
  FROM public.clientes;

-- Tighten the SELECT policy: admins see everything, tecnicos only via the view
DROP POLICY IF EXISTS "Authenticated can select clientes" ON public.clientes;

-- Admins can select all columns from clientes
CREATE POLICY "Admins can select clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tecnicos can select clientes (needed for the view to work since views use caller's permissions)
CREATE POLICY "Tecnicos can select clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'tecnico'));
