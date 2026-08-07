
-- Table for configurable price tiers (cleaning and monitoring)
CREATE TABLE public.faixas_preco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('limpeza', 'monitoramento')),
  faixa_inicio integer NOT NULL DEFAULT 0,
  faixa_fim integer, -- NULL means unlimited (e.g. 51+)
  valor numeric NOT NULL DEFAULT 0,
  label text, -- display label e.g. "1 - 10" or "0 - 500 kWh"
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faixas_preco ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
CREATE POLICY "Authenticated can select faixas_preco" ON public.faixas_preco
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage faixas_preco" ON public.faixas_preco
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Seed default cleaning tiers
INSERT INTO public.faixas_preco (tipo, faixa_inicio, faixa_fim, valor, label, ordem) VALUES
  ('limpeza', 1, 10, 50, '1 - 10', 1),
  ('limpeza', 11, 20, 45, '11 - 20', 2),
  ('limpeza', 21, 30, 40, '21 - 30', 3),
  ('limpeza', 31, 40, 35, '31 - 40', 4),
  ('limpeza', 41, 50, 30, '41 - 50', 5),
  ('limpeza', 51, NULL, 25, '51+', 6);

-- Seed default monitoring tiers
INSERT INTO public.faixas_preco (tipo, faixa_inicio, faixa_fim, valor, label, ordem) VALUES
  ('monitoramento', 0, 500, 100, 'Até 500 kWh', 1),
  ('monitoramento', 501, 1000, 160, '501 - 1000 kWh', 2),
  ('monitoramento', 1001, 2000, 270, '1001 - 2000 kWh', 3),
  ('monitoramento', 2001, NULL, 380, 'Acima de 2000 kWh', 4);

-- Update the calcular_preco_limpeza function to use the table
CREATE OR REPLACE FUNCTION public.calcular_preco_limpeza(p_quantidade_modulos integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total numeric := 0;
  restante integer := p_quantidade_modulos;
  rec record;
  qtd integer;
  faixa_max integer;
BEGIN
  FOR rec IN 
    SELECT faixa_inicio, faixa_fim, valor 
    FROM faixas_preco 
    WHERE tipo = 'limpeza' 
    ORDER BY ordem
  LOOP
    IF restante <= 0 THEN EXIT; END IF;
    
    IF rec.faixa_fim IS NULL THEN
      faixa_max := restante;
    ELSE
      faixa_max := rec.faixa_fim - rec.faixa_inicio + 1;
    END IF;
    
    qtd := LEAST(restante, faixa_max);
    total := total + (qtd * rec.valor);
    restante := restante - qtd;
  END LOOP;
  
  RETURN total;
END;
$$;
