
-- Fix: Replace overly permissive INSERT policy with admin-only
DROP POLICY "System can insert notifications" ON public.notificacoes;

CREATE POLICY "Admins can insert notifications"
  ON public.notificacoes FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also allow service_role (edge functions) to delete old notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notificacoes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
