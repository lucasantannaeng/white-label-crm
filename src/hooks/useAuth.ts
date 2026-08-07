import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type AppRole = 'master' | 'admin' | 'vendedor' | 'tecnico' | 'viewer';

interface AuthState {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  nome: string;
}

async function fetchUserDetails(userId: string, email?: string) {
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId).limit(1),
    supabase.from('profiles').select('nome').eq('id', userId).single(),
  ]);
  return {
    role: (roles?.[0]?.role as AppRole) || 'viewer',
    nome: profile?.nome || email || '',
  };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true, nome: '' });
  const cachedUserId = useRef<string | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDetails(user: User) {
      if (cachedUserId.current === user.id || fetchingRef.current) {
        return;
      }
      fetchingRef.current = true;
      const details = await fetchUserDetails(user.id, user.email);
      if (!cancelled) {
        cachedUserId.current = user.id;
        fetchingRef.current = false;
        setState({ user, ...details, loading: false });
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        loadDetails(session.user);
      } else {
        setState({ user: null, role: null, loading: false, nome: '' });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        if (cachedUserId.current !== session.user.id) {
          setState(prev => ({ ...prev, user: session.user, loading: !cachedUserId.current }));
          setTimeout(() => { if (!cancelled) loadDetails(session.user); }, 0);
        } else {
          setState(prev => ({ ...prev, user: session.user }));
        }
      } else {
        cachedUserId.current = null;
        fetchingRef.current = false;
        setState({ user: null, role: null, loading: false, nome: '' });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    cachedUserId.current = null;
    fetchingRef.current = false;
    await supabase.auth.signOut();
  }, []);

  const role = state.role;
  const isAdmin = role === 'admin' || role === 'master';
  const isMaster = role === 'master';

  return { ...state, signOut, isAdmin, isMaster };
}
