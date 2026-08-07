
-- Fix security definer view by recreating with security_invoker = true
CREATE OR REPLACE VIEW public.clientes_sem_credenciais
  WITH (security_invoker = true) AS
  SELECT id, nome, documento, telefone, email, rua, numero, bairro, cidade, uf, cep,
         inversor, potencia_kwp, quantidade_placas, kwh_mensal, valor_mensal,
         duracao_meses, inicio_contrato, termino_contrato, ativo, observacoes, vendedor_id,
         created_at, updated_at
  FROM public.clientes;
