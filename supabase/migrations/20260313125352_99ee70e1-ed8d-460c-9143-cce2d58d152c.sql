
-- Add columns to agendamentos
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS assinatura_digital_url text;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS venda_confirmada boolean DEFAULT false;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS tipo_contrato text;

-- Create assinaturas bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('assinaturas', 'assinaturas', true) ON CONFLICT (id) DO NOTHING;

-- RLS for assinaturas bucket
CREATE POLICY "Authenticated can upload assinaturas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assinaturas');
CREATE POLICY "Public can read assinaturas" ON storage.objects FOR SELECT USING (bucket_id = 'assinaturas');
CREATE POLICY "Authenticated can delete assinaturas" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'assinaturas');
