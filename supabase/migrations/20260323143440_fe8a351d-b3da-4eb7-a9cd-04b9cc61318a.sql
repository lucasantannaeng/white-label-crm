CREATE OR REPLACE FUNCTION public.criar_primeiro_agendamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_count integer;
  target_date date;
  day_of_week integer;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM public.agendamentos WHERE cliente_id = NEW.id;
  IF existing_count = 0 AND NEW.inicio_contrato IS NOT NULL THEN
    target_date := NEW.inicio_contrato + INTERVAL '3 months';
    day_of_week := EXTRACT(DOW FROM target_date);
    IF day_of_week = 0 THEN target_date := target_date + 1;
    ELSIF day_of_week = 6 THEN target_date := target_date + 2;
    END IF;
    INSERT INTO public.agendamentos (cliente_id, tipo, data_agendamento, status)
    VALUES (NEW.id, 'Limpeza Preventiva', target_date, 'Pendente');
  END IF;
  RETURN NEW;
END;
$function$;