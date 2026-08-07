
-- Update handle_new_user to auto-create vendedor and assign proper roles
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
  
  -- Determine role: first user is master, rest are tecnico
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count <= 1 THEN
    assigned_role := 'master';
  ELSE
    assigned_role := 'tecnico';
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

-- Update has_role: master has all admin privileges
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
      AND (
        role = _role 
        OR (role = 'master' AND _role = 'admin')
      )
  )
$$;

-- Helper to check master specifically
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'master'
  )
$$;
