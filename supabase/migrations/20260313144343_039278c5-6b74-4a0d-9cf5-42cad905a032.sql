
-- Function to create notifications when agendamentos change
CREATE OR REPLACE FUNCTION public.notify_agendamento_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  membro text;
  equipe_membros text[];
  cliente_nome text;
  titulo text;
  mensagem text;
  tipo_notif text := 'agendamento';
BEGIN
  -- Get client name
  SELECT nome INTO cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;

  -- Determine notification content
  IF TG_OP = 'INSERT' THEN
    titulo := 'Novo agendamento';
    mensagem := NEW.tipo || ' para ' || COALESCE(cliente_nome, 'cliente') || ' em ' || to_char(NEW.data_agendamento, 'DD/MM/YYYY');
  ELSIF TG_OP = 'UPDATE' AND OLD.data_agendamento IS DISTINCT FROM NEW.data_agendamento THEN
    titulo := 'Agendamento reagendado';
    mensagem := NEW.tipo || ' de ' || COALESCE(cliente_nome, 'cliente') || ' movido para ' || to_char(NEW.data_agendamento, 'DD/MM/YYYY');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    titulo := 'Status atualizado';
    mensagem := NEW.tipo || ' de ' || COALESCE(cliente_nome, 'cliente') || ': ' || NEW.status;
  ELSE
    RETURN NEW;
  END IF;

  -- Get team members if equipe is assigned
  IF NEW.equipe_id IS NOT NULL THEN
    SELECT membros INTO equipe_membros FROM public.equipes WHERE id = NEW.equipe_id;
    IF equipe_membros IS NOT NULL THEN
      FOREACH membro IN ARRAY equipe_membros
      LOOP
        -- Insert notification for each team member (membro is user_id text)
        INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, metadata)
        VALUES (membro::uuid, titulo, mensagem, tipo_notif, jsonb_build_object(
          'agendamento_id', NEW.id,
          'cliente_id', NEW.cliente_id,
          'data', NEW.data_agendamento::text
        ));
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on agendamentos
CREATE TRIGGER trg_notify_agendamento
  AFTER INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_agendamento_change();
