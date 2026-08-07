import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

let isRunning = false;

export async function triggerRouteOptimizer() {
  // Prevent concurrent invocations (guards against infinite loops)
  if (isRunning) {
    console.log('[RouteOptimizer] Already running, skipping.');
    return;
  }

  try {
    isRunning = true;
    // Small delay to ensure the new agendamento is committed
    await new Promise(r => setTimeout(r, 1500));

    console.log('[RouteOptimizer] Triggering AI route optimizer...');

    const { data, error } = await supabase.functions.invoke('ai-route-optimizer');
    
    if (error) {
      console.error('[RouteOptimizer] Invocation error:', error);
      return;
    }

    console.log('[RouteOptimizer] Response:', data);

    if (data?.error) {
      console.warn('[RouteOptimizer] Returned error:', data.error);
      return;
    }

    if (data?.success && data.applied > 0) {
      const fallbackMsg = data.usedFallback ? ' (distribuição automática)' : '';
      toast.info(`🤖 IA designou equipes para ${data.applied} agendamento(s)${fallbackMsg}`, { duration: 5000 });
    } else if (data?.success && data.applied === 0) {
      console.log('[RouteOptimizer] No assignments needed.');
    }
  } catch (err) {
    console.error('[RouteOptimizer] Failed:', err);
  } finally {
    isRunning = false;
  }
}
