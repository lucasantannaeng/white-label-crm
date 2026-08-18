-- ==========================================================
-- Migration: 20260402000000_operational_rbac_and_inverters_hardening.sql
-- Description: Hardening de RLS operacional para técnicos, vendedores e inversores
-- ==========================================================

-- 1. Políticas RLS para tabela 'clientes'
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operational roles can select clientes" ON public.clientes;
CREATE POLICY "Operational roles can select clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Operational roles can insert clientes" ON public.clientes;
CREATE POLICY "Operational roles can insert clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'vendedor'::app_role) OR
    public.is_master(auth.uid())
  );

DROP POLICY IF EXISTS "Operational roles can update clientes" ON public.clientes;
CREATE POLICY "Operational roles can update clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'vendedor'::app_role) OR
    public.has_role(auth.uid(), 'tecnico'::app_role) OR
    public.is_master(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'vendedor'::app_role) OR
    public.has_role(auth.uid(), 'tecnico'::app_role) OR
    public.is_master(auth.uid())
  );

-- 2. Políticas RLS para tabela 'inversores'
ALTER TABLE public.inversores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can select inversores" ON public.inversores;
CREATE POLICY "Authenticated can select inversores" ON public.inversores
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Operational roles can insert inversores" ON public.inversores;
CREATE POLICY "Operational roles can insert inversores" ON public.inversores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'vendedor'::app_role) OR
    public.has_role(auth.uid(), 'tecnico'::app_role) OR
    public.is_master(auth.uid())
  );

DROP POLICY IF EXISTS "Operational roles can update inversores" ON public.inversores;
CREATE POLICY "Operational roles can update inversores" ON public.inversores
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'vendedor'::app_role) OR
    public.has_role(auth.uid(), 'tecnico'::app_role) OR
    public.is_master(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'vendedor'::app_role) OR
    public.has_role(auth.uid(), 'tecnico'::app_role) OR
    public.is_master(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete inversores" ON public.inversores;
CREATE POLICY "Admins can delete inversores" ON public.inversores
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.is_master(auth.uid())
  );

-- 3. Políticas RLS para tabela 'documentos_cliente'
ALTER TABLE public.documentos_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can select documentos_cliente" ON public.documentos_cliente;
CREATE POLICY "Authenticated can select documentos_cliente" ON public.documentos_cliente
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Operational roles can insert documentos_cliente" ON public.documentos_cliente;
CREATE POLICY "Operational roles can insert documentos_cliente" ON public.documentos_cliente
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'vendedor'::app_role) OR
    public.has_role(auth.uid(), 'tecnico'::app_role) OR
    public.is_master(auth.uid())
  );
