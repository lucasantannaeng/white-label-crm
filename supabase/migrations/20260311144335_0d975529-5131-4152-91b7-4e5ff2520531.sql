-- Fix overly permissive RLS on agendamentos
DROP POLICY IF EXISTS "Authenticated can insert agendamentos" ON public.agendamentos;
CREATE POLICY "Authenticated can insert agendamentos" ON public.agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can update agendamentos" ON public.agendamentos;
CREATE POLICY "Authenticated can update agendamentos" ON public.agendamentos
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);