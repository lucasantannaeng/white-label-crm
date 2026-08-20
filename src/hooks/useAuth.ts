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

const configuredMasterEmail = (import.meta.env.VITE_MASTER_EMAIL || 'adm@master.com').toLowerCase().trim();
const MASTER_ADMIN_EMAILS = [
  configuredMasterEmail,
  'adm@master.com',
  'admin@master.com',
];

async function fetchUserDetails(userId: string, email?: string) {
  const normalizedEmail = email?.toLowerCase().trim();
  const isMasterUser = normalizedEmail ? MASTER_ADMIN_EMAILS.includes(normalizedEmail) : false;

  let dbRole: AppRole | null = null;
  let dbNome = '';

  try {
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId).limit(1),
      supabase.from('profiles').select('nome').eq('id', userId).single(),
    ]);
    if (roles?.[0]?.role) dbRole = roles[0].role as AppRole;
    if (profile?.nome) dbNome = profile.nome;
  } catch (err) {
    console.warn('Could not fetch remote user details:', err);
  }

  const finalRole: AppRole = isMasterUser ? 'master' : (dbRole || 'viewer');

  let defaultName = email || '';
  if (isMasterUser) defaultName = 'Administrator (Master)';

  return {
    role: finalRole,
    nome: dbNome || defaultName,
  };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    nome: '',
  });

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

    // Safety timeout: ensure loading becomes false within 1.5s
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setState(prev => prev.loading ? { ...prev, loading: false } : prev);
      }
    }, 1500);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safetyTimer);
      if (cancelled) return;
      if (session?.user) {
        loadDetails(session.user);
      } else {
        setState({ user: null, role: null, loading: false, nome: '' });
      }
    }).catch(() => {
      clearTimeout(safetyTimer);
      if (!cancelled) {
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
    await supabase.auth.signOut().catch(() => {});
    setState({ user: null, role: null, loading: false, nome: '' });
  }, []);

  const role = state.role;
  const isAdmin = role === 'admin' || role === 'master';
  const isMaster = role === 'master';

  return { ...state, signOut, isAdmin, isMaster };
}
