import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSystemCheck() {
  const [isReady, setIsReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSystem = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('clientes').select('id').limit(1);
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        setIsReady(false);
      } else {
        setIsReady(true);
      }
    } catch {
      setIsReady(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSystem();
  }, []);

  return { isReady, loading, recheck: checkSystem };
}
