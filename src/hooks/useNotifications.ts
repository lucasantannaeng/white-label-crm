import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

const VAPID_PUBLIC_KEY = 'BHnJanU-CKj1B8EkdPC4PoIw0Rz_3igSfMNaJqSFmiIMayclrYm4E6gz8UKQhSkAbBsBtrLFH1lFQ5GDqBMsMPk';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications(userId: string | undefined) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load notifications
  const loadNotificacoes = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      setNotificacoes(data as unknown as Notificacao[]);
      setNaoLidas(data.filter((n: { lida: boolean }) => !n.lida).length);
    }
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    loadNotificacoes();

    const channel = supabase
      .channel(`notificacoes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const nova = payload.new as unknown as Notificacao;
          setNotificacoes(prev => [nova, ...prev]);
          setNaoLidas(prev => prev + 1);

          // Show browser notification if permitted
          if (Notification.permission === 'granted') {
            new Notification(nova.titulo, {
              body: nova.mensagem,
              icon: '/pwa-icon-192.png',
              tag: nova.id,
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [userId, loadNotificacoes]);

  // Mark as read
  const marcarComoLida = useCallback(async (id: string) => {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    setNaoLidas(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const marcarTodasComoLidas = useCallback(async () => {
    if (!userId) return;
    await supabase.from('notificacoes').update({ lida: true }).eq('user_id', userId).eq('lida', false);
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    setNaoLidas(0);
  }, [userId]);

  // Delete notification
  const excluirNotificacao = useCallback(async (id: string) => {
    const notif = notificacoes.find(n => n.id === id);
    await supabase.from('notificacoes').delete().eq('id', id);
    setNotificacoes(prev => prev.filter(n => n.id !== id));
    if (notif && !notif.lida) setNaoLidas(prev => Math.max(0, prev - 1));
  }, [notificacoes]);

  // Request push permission & subscribe
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const permission = await Notification.requestPermission();
    setPushPermission(permission);

    if (permission !== 'granted' || !userId) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      } as PushSubscriptionOptionsInit);

      const subJson = subscription.toJSON();
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subJson.endpoint!,
        keys: subJson.keys as Record<string, string>,
      }, { onConflict: 'user_id,endpoint' });
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }, [userId]);

  // Check current permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  return {
    notificacoes,
    naoLidas,
    pushPermission,
    marcarComoLida,
    marcarTodasComoLidas,
    excluirNotificacao,
    requestPushPermission,
  };
}
