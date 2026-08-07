
CREATE TABLE public.presets_modulos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  potencia_wp integer NOT NULL,
  geracao_estimada_kwh numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.presets_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select presets_modulos"
  ON public.presets_modulos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage presets_modulos"
  ON public.presets_modulos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
