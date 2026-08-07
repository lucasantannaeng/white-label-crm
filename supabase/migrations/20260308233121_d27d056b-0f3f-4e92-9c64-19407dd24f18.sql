
-- 1. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. User roles table (enum + table)
CREATE TYPE public.app_role AS ENUM ('admin', 'tecnico');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 3. Vendedores table
CREATE TABLE public.vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  email text,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to vendedores" ON public.vendedores FOR ALL USING (true) WITH CHECK (true);

-- 4. Add vendedor_id to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL;

-- 5. Configuracoes table (white-label settings)
CREATE TABLE public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  cor_primaria text DEFAULT '25 95% 53%',
  nome_empresa text DEFAULT 'Solar Service',
  comissao_percentual numeric DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all read configuracoes" ON public.configuracoes FOR SELECT USING (true);
CREATE POLICY "Admins can update configuracoes" ON public.configuracoes FOR ALL USING (true) WITH CHECK (true);

-- Insert default config
INSERT INTO public.configuracoes (nome_empresa, cor_primaria, comissao_percentual)
VALUES ('Solar Service', '25 95% 53%', 10);

-- 6. Comissoes table for payment tracking
CREATE TABLE public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE CASCADE NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  pago boolean DEFAULT false,
  data_pagamento timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendedor_id, mes, ano)
);
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to comissoes" ON public.comissoes FOR ALL USING (true) WITH CHECK (true);

-- 7. Storage bucket for assets (logo etc)
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public read access on assets" ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "Allow insert to assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets');
CREATE POLICY "Allow update to assets" ON storage.objects FOR UPDATE USING (bucket_id = 'assets');
CREATE POLICY "Allow delete from assets" ON storage.objects FOR DELETE USING (bucket_id = 'assets');

-- 8. Auto-create profile + admin role on first signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);
  
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'tecnico');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
