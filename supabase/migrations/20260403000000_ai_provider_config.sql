-- ==========================================================
-- Migration: 20260403000000_ai_provider_config.sql
-- Description: Adiciona campos de configuração de IA e Fallback na tabela configuracoes
-- ==========================================================

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS ai_api_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_api_key_secondary TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS ai_custom_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS ai_fallback_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_fallback_provider TEXT DEFAULT 'groq',
  ADD COLUMN IF NOT EXISTS ai_fallback_model TEXT DEFAULT 'llama-3.3-70b-versatile',
  ADD COLUMN IF NOT EXISTS ai_fallback_key TEXT;

-- Garantir que admins e masters possam atualizar configurações de IA
DROP POLICY IF EXISTS "Admins can update configuracoes" ON public.configuracoes;
CREATE POLICY "Admins can update configuracoes" ON public.configuracoes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.is_master(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.is_master(auth.uid())
  );
