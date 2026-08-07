
-- Add tipo and nome_projeto columns to templates_contrato
ALTER TABLE public.templates_contrato 
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'monitoramento',
  ADD COLUMN IF NOT EXISTS nome_projeto text;

-- Create storage bucket for contract templates
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contratos', 'contratos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to contratos bucket
CREATE POLICY "Public read access on contratos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'contratos');

-- Allow authenticated insert to contratos bucket  
CREATE POLICY "Allow insert to contratos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contratos');

-- Allow authenticated delete from contratos bucket
CREATE POLICY "Allow delete from contratos"
ON storage.objects FOR DELETE
USING (bucket_id = 'contratos');
