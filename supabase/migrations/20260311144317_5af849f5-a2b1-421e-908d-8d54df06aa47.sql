-- Assign admin role to the existing user
INSERT INTO public.user_roles (user_id, role)
VALUES ('85739c10-ed0b-466b-8f5a-06721c778a6c', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create profile for the user
INSERT INTO public.profiles (id, nome, email)
VALUES ('85739c10-ed0b-466b-8f5a-06721c778a6c', 'ADM', 'admin@crm-solar.example')
ON CONFLICT (id) DO NOTHING;

-- Create default configuracoes record
INSERT INTO public.configuracoes (nome_empresa, cor_primaria, comissao_percentual)
SELECT 'Solar CRM Pro', '25 95% 53%', 10
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes LIMIT 1);