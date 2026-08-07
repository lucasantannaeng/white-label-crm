
DROP POLICY IF EXISTS "Vendedores can insert clientes" ON public.clientes;

CREATE POLICY "Vendedores can insert clientes"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'vendedor'::app_role)
    AND vendedor_id = (SELECT id FROM public.vendedores WHERE user_id = auth.uid() LIMIT 1)
  );
