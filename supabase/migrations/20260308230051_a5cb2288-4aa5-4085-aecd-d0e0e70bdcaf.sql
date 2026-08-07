
-- ========================================
-- SOLAR SERVICE CRM - DATABASE SCHEMA
-- ========================================

-- Table: clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  documento TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  rua TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  inversor TEXT,
  login_inversor TEXT,
  senha_inversor TEXT,
  potencia_kwp NUMERIC,
  quantidade_placas INTEGER DEFAULT 0,
  kwh_mensal NUMERIC DEFAULT 0,
  valor_mensal NUMERIC DEFAULT 0,
  duracao_meses INTEGER DEFAULT 12,
  inicio_contrato DATE DEFAULT CURRENT_DATE,
  termino_contrato DATE,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: agendamentos
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'Limpeza Preventiva',
  data_agendamento DATE NOT NULL,
  hora TEXT DEFAULT '08:00',
  status TEXT NOT NULL DEFAULT 'Pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: templates_contrato
CREATE TABLE public.templates_contrato (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_contrato ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth for this CRM)
CREATE POLICY "Allow all access to clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to agendamentos" ON public.agendamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to templates_contrato" ON public.templates_contrato FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- RPC: calcular_preco_limpeza
-- ========================================
CREATE OR REPLACE FUNCTION public.calcular_preco_limpeza(p_quantidade_modulos INTEGER)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC := 0;
  restante INTEGER := p_quantidade_modulos;
  faixa INTEGER;
BEGIN
  faixa := LEAST(restante, 10);
  total := total + faixa * 50;
  restante := restante - faixa;
  IF restante <= 0 THEN RETURN total; END IF;

  faixa := LEAST(restante, 10);
  total := total + faixa * 45;
  restante := restante - faixa;
  IF restante <= 0 THEN RETURN total; END IF;

  faixa := LEAST(restante, 10);
  total := total + faixa * 40;
  restante := restante - faixa;
  IF restante <= 0 THEN RETURN total; END IF;

  faixa := LEAST(restante, 10);
  total := total + faixa * 35;
  restante := restante - faixa;
  IF restante <= 0 THEN RETURN total; END IF;

  faixa := LEAST(restante, 10);
  total := total + faixa * 30;
  restante := restante - faixa;
  IF restante <= 0 THEN RETURN total; END IF;

  total := total + restante * 25;
  RETURN total;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ========================================
-- TRIGGER: BEFORE INSERT/UPDATE on clientes
-- ========================================
CREATE OR REPLACE FUNCTION public.calcular_valores_cliente()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.kwh_mensal <= 200 THEN
    NEW.valor_mensal := 100;
  ELSIF NEW.kwh_mensal <= 400 THEN
    NEW.valor_mensal := 160;
  ELSIF NEW.kwh_mensal <= 600 THEN
    NEW.valor_mensal := 270;
  ELSE
    NEW.valor_mensal := 380;
  END IF;

  IF NEW.inicio_contrato IS NOT NULL AND NEW.duracao_meses IS NOT NULL THEN
    NEW.termino_contrato := NEW.inicio_contrato + (NEW.duracao_meses || ' months')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_calcular_valores_cliente
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.calcular_valores_cliente();

-- ========================================
-- TRIGGER: AFTER INSERT on clientes
-- ========================================
CREATE OR REPLACE FUNCTION public.criar_primeiro_agendamento()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.agendamentos (cliente_id, tipo, data_agendamento, status)
  VALUES (
    NEW.id,
    'Limpeza Preventiva',
    NEW.inicio_contrato + INTERVAL '3 months',
    'Pendente'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_criar_primeiro_agendamento
AFTER INSERT ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.criar_primeiro_agendamento();
