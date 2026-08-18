-- ==============================================================================
-- SOLAR SERVICE CRM / WHITE-LABEL - MASTER DATABASE INITIALIZATION SCRIPT
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para inicializar um banco de dados novo.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'master', 'vendedor', 'tecnico', 'cliente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES & USER ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper functions for RBAC
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master'::app_role
  )
$$;

-- 4. VENDEDORES & EQUIPES
CREATE TABLE IF NOT EXISTS public.vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  membros TEXT[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;

-- 5. CLIENTES & INVERSORES
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  tipo_contrato TEXT DEFAULT 'recorrente',
  etapa_kanban TEXT DEFAULT 'Novo Lead',
  posicao_kanban INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.inversores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  marca TEXT NOT NULL,
  modelo TEXT,
  numero_serie TEXT,
  login TEXT,
  senha TEXT,
  monitoramento_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inversores ENABLE ROW LEVEL SECURITY;

-- 6. AGENDAMENTOS
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'Limpeza Preventiva',
  data_agendamento DATE NOT NULL,
  hora TEXT DEFAULT '08:00',
  status TEXT NOT NULL DEFAULT 'Pendente',
  prioridade TEXT DEFAULT 'Normal',
  valor_servico NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- 7. SERVIÇOS EXTRAS
CREATE TABLE IF NOT EXISTS public.servicos_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_execucao DATE,
  status TEXT NOT NULL DEFAULT 'Pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.servicos_extras ENABLE ROW LEVEL SECURITY;

-- 8. COMISSÕES
CREATE TABLE IF NOT EXISTS public.comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE CASCADE NOT NULL,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  pago BOOLEAN DEFAULT false,
  data_pagamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendedor_id, mes, ano)
);
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

-- 9. CONFIGURAÇÕES WHITE-LABEL & IA
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa TEXT DEFAULT 'Solar Service',
  cor_primaria TEXT DEFAULT '25 95% 53%',
  logo_url TEXT,
  comissao_percentual NUMERIC DEFAULT 10,
  ai_provider TEXT DEFAULT 'gemini',
  ai_api_key TEXT,
  ai_api_key_secondary TEXT,
  ai_model TEXT DEFAULT 'gemini-2.5-flash',
  ai_custom_endpoint TEXT,
  ai_fallback_enabled BOOLEAN DEFAULT true,
  ai_fallback_provider TEXT DEFAULT 'groq',
  ai_fallback_model TEXT DEFAULT 'llama-3.3-70b-versatile',
  ai_fallback_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Inserir configuração padrão caso tabela esteja vazia
INSERT INTO public.configuracoes (nome_empresa, cor_primaria, comissao_percentual, ai_provider, ai_model, ai_fallback_enabled, ai_fallback_provider, ai_fallback_model)
SELECT 'Solar Service', '25 95% 53%', 10, 'gemini', 'gemini-2.5-flash', true, 'groq', 'llama-3.3-70b-versatile'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes);

-- 10. DOCUMENTOS DO CLIENTE
CREATE TABLE IF NOT EXISTS public.documentos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documentos_cliente ENABLE ROW LEVEL SECURITY;

-- 11. TEMPLATES DE CONTRATO
CREATE TABLE IF NOT EXISTS public.templates_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.templates_contrato ENABLE ROW LEVEL SECURITY;

-- 12. LOGS DE IA
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  entrada TEXT,
  resposta TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

-- 13. FAIXAS DE PREÇO & PRESETS
CREATE TABLE IF NOT EXISTS public.faixas_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de_qtd INTEGER NOT NULL,
  ate_qtd INTEGER NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.faixas_preco ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.presets_modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  potencia_w INTEGER NOT NULL,
  fabricante TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.presets_modulos ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 14. POLÍTICAS RLS (Row Level Security)
-- ==============================================================================

-- Profiles & User Roles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid())
);

-- Permissões operacionais completas para authenticated users
CREATE POLICY "Allow authenticated read clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete clientes" ON public.clientes FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid())
);

CREATE POLICY "Allow authenticated access inversores" ON public.inversores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access agendamentos" ON public.agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access servicos_extras" ON public.servicos_extras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access vendedores" ON public.vendedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access equipes" ON public.equipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access comissoes" ON public.comissoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access templates_contrato" ON public.templates_contrato FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access documentos_cliente" ON public.documentos_cliente FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access faixas_preco" ON public.faixas_preco FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access presets_modulos" ON public.presets_modulos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Configuracoes
CREATE POLICY "Allow authenticated read configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin update configuracoes" ON public.configuracoes FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid())
);

-- ==============================================================================
-- 15. STORAGE BUCKETS (Assets e Documentos)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos', 'documentos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access on assets" ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "Authenticated upload assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assets');
CREATE POLICY "Authenticated update assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'assets');
CREATE POLICY "Authenticated delete assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'assets');

CREATE POLICY "Public read access on documentos" ON storage.objects FOR SELECT USING (bucket_id = 'documentos');
CREATE POLICY "Authenticated upload documentos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "Authenticated update documentos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos');
CREATE POLICY "Authenticated delete documentos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos');

-- ==============================================================================
-- 16. AUTO-PROVISIONAMENTO DE ADMIN MASTER NO PRIMEIRO SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)), NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  -- O primeiro usuário criado no sistema ganha automaticamente a role 'admin' e 'master'
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'master');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- FIM DO SCRIPT DE INICIALIZAÇÃO
-- ==============================================================================
