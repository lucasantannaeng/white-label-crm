
-- 1. Expand app_role enum with new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';

-- 2. Add user_id column to vendedores table
ALTER TABLE public.vendedores ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vendedores_user_id_unique ON public.vendedores(user_id) WHERE user_id IS NOT NULL;
