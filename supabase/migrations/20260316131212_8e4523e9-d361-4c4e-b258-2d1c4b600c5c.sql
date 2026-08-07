-- Fix: add missing admin SELECT policy for vendedores
CREATE POLICY "Admins can select vendedores"
ON public.vendedores
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
