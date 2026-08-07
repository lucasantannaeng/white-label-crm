
-- Create storage bucket for client documents (signed contracts, VT photos)
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos-clientes', 'documentos-clientes', true)
ON CONFLICT (id) DO NOTHING;

-- Create table for storing document references
CREATE TABLE IF NOT EXISTS public.documentos_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'foto_vt',
  nome text NOT NULL,
  url text NOT NULL,
  assinatura_tecnico_url text,
  assinatura_cliente_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select documentos_cliente" ON public.documentos_cliente
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert documentos_cliente" ON public.documentos_cliente
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete documentos_cliente" ON public.documentos_cliente
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage RLS policies
CREATE POLICY "Authenticated can upload docs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos-clientes');

CREATE POLICY "Anyone can view docs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documentos-clientes');

CREATE POLICY "Admins can delete docs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documentos-clientes' AND public.has_role(auth.uid(), 'admin'));
