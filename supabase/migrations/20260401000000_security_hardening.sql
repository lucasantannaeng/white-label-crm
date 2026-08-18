-- ==========================================================
-- Migration: 20260401000000_security_hardening.sql
-- Description: Hardening de segurança Strix (ai_logs, storage RLS, audit_logs)
-- ==========================================================

-- 1. Criar tabela ai_logs com RLS habilitado
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  entrada text,
  resposta text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and masters can view ai_logs" ON public.ai_logs;
CREATE POLICY "Admins and masters can view ai_logs" ON public.ai_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Service role can manage ai_logs" ON public.ai_logs;
CREATE POLICY "Service role can manage ai_logs" ON public.ai_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Hardening da tabela audit_logs (adicionar policy de INSERT para usuários autenticados)
DROP POLICY IF EXISTS "Authenticated can insert audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);

-- 3. Hardening de Storage: Assinaturas e Documentos
UPDATE storage.buckets SET public = false WHERE id IN ('assinaturas', 'documentos-clientes');

DROP POLICY IF EXISTS "Authenticated can delete assinaturas" ON storage.objects;
DROP POLICY IF EXISTS "Public can read assinaturas" ON storage.objects;

-- Apenas admins e masters podem excluir assinaturas
CREATE POLICY "Only admins and masters can delete assinaturas" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'assinaturas' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid())));

-- Leitura de assinaturas para autenticados
CREATE POLICY "Authenticated can read assinaturas" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'assinaturas');
