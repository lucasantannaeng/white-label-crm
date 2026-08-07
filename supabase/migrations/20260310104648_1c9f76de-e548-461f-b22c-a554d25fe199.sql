
CREATE TABLE public.servicos_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_servico TEXT NOT NULL DEFAULT 'Outro',
  descricao TEXT NOT NULL DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pendente',
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select servicos_extras" ON public.servicos_extras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert servicos_extras" ON public.servicos_extras FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update servicos_extras" ON public.servicos_extras FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete servicos_extras" ON public.servicos_extras FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_servicos_extras_updated_at BEFORE UPDATE ON public.servicos_extras FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
