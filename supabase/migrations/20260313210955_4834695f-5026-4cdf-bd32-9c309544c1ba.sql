
-- Table to track per-contract commission installments
CREATE TABLE public.comissao_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  parcela_num integer NOT NULL DEFAULT 1,
  total_parcelas integer NOT NULL DEFAULT 1,
  valor numeric NOT NULL DEFAULT 0,
  pago boolean NOT NULL DEFAULT false,
  data_pagamento timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, cliente_id, parcela_num)
);

ALTER TABLE public.comissao_parcelas ENABLE ROW LEVEL SECURITY;

-- Admins can manage all commission installments
CREATE POLICY "Admins can manage comissao_parcelas"
ON public.comissao_parcelas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Vendedores can view their own
CREATE POLICY "Vendedores can select own comissao_parcelas"
ON public.comissao_parcelas
FOR SELECT
TO authenticated
USING (
  vendedor_id IN (
    SELECT id FROM public.vendedores WHERE user_id = auth.uid()
  )
);
