
-- 1. Create inversores table for multiple inverters per client
CREATE TABLE public.inversores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  inversor TEXT,
  login_inversor TEXT,
  senha_inversor TEXT,
  potencia_kwp NUMERIC,
  quantidade_placas INTEGER DEFAULT 0,
  kwh_mensal NUMERIC DEFAULT 0,
  numero_serie TEXT,
  marca_modulos TEXT,
  potencia_modulo_wp NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for inversores
ALTER TABLE public.inversores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select inversores" ON public.inversores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert inversores" ON public.inversores
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update inversores" ON public.inversores
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete inversores" ON public.inversores
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add internet login/password and manual monthly value to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS login_internet TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS senha_internet TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS valor_mensal_manual NUMERIC;

-- 3. Fix the trigger to prevent duplicate initial appointments
CREATE OR REPLACE FUNCTION public.criar_primeiro_agendamento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  existing_count integer;
BEGIN
  -- Only create if no agendamento exists for this client yet
  SELECT COUNT(*) INTO existing_count FROM public.agendamentos WHERE cliente_id = NEW.id;
  IF existing_count = 0 AND NEW.inicio_contrato IS NOT NULL THEN
    INSERT INTO public.agendamentos (cliente_id, tipo, data_agendamento, status)
    VALUES (
      NEW.id,
      'Limpeza Preventiva',
      NEW.inicio_contrato + INTERVAL '3 months',
      'Pendente'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Also update calcular_valores_cliente to respect manual value
CREATE OR REPLACE FUNCTION public.calcular_valores_cliente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  -- If manual value is set, use it instead of calculated
  IF NEW.valor_mensal_manual IS NOT NULL THEN
    NEW.valor_mensal := NEW.valor_mensal_manual;
  ELSE
    SELECT valor INTO rec FROM faixas_preco 
      WHERE tipo = 'monitoramento' 
        AND NEW.kwh_mensal >= faixa_inicio 
        AND (faixa_fim IS NULL OR NEW.kwh_mensal <= faixa_fim)
      LIMIT 1;
    
    IF rec IS NOT NULL THEN
      NEW.valor_mensal := rec.valor;
    ELSE
      NEW.valor_mensal := 0;
    END IF;
  END IF;

  IF NEW.inicio_contrato IS NOT NULL AND NEW.duracao_meses IS NOT NULL THEN
    NEW.termino_contrato := NEW.inicio_contrato + (NEW.duracao_meses || ' months')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$function$;
