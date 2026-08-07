
-- Tabela de equipes
CREATE TABLE public.equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  membros text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select equipes" ON public.equipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage equipes" ON public.equipes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Adicionar equipe_id e data_confirmacao aos agendamentos
ALTER TABLE public.agendamentos ADD COLUMN equipe_id uuid REFERENCES public.equipes(id);
ALTER TABLE public.agendamentos ADD COLUMN data_confirmacao date;
ALTER TABLE public.agendamentos ADD COLUMN data_orcamento date;
