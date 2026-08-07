
-- Add 'viewer' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Update handle_new_user to assign 'viewer' as default role for new users (except first user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count integer;
  assigned_role app_role;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', ''), NEW.email);
  
  -- Determine role: first user is master, rest are viewer (pending assignment)
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count <= 1 THEN
    assigned_role := 'master';
  ELSE
    assigned_role := 'viewer';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  
  -- Auto-create vendedor entry linked to user
  INSERT INTO public.vendedores (nome, email, user_id)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    NEW.id
  );
  
  RETURN NEW;
END;
$function$;
