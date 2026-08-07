
-- Allow tecnico and vendedor to SELECT clientes (via view without credentials)
CREATE POLICY "Tecnicos can select clientes"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'tecnico'::app_role)
);

CREATE POLICY "Vendedores can select clientes"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'vendedor'::app_role)
);

-- Allow tecnico and vendedor to INSERT servicos_extras
CREATE POLICY "Tecnicos can insert servicos_extras"
ON public.servicos_extras
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'tecnico'::app_role)
);

CREATE POLICY "Vendedores can insert servicos_extras"
ON public.servicos_extras
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'vendedor'::app_role)
);

-- Allow tecnico and vendedor to UPDATE servicos_extras
CREATE POLICY "Tecnicos can update servicos_extras"
ON public.servicos_extras
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'tecnico'::app_role));

CREATE POLICY "Vendedores can update servicos_extras"
ON public.servicos_extras
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'vendedor'::app_role));

-- Allow tecnico and vendedor to INSERT clientes (for NovoClienteDialog)
CREATE POLICY "Tecnicos can insert clientes"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'tecnico'::app_role)
);

CREATE POLICY "Vendedores can insert clientes"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'vendedor'::app_role)
);
