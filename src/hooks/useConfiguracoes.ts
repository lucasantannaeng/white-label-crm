import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Configuracoes {
  id: string;
  logo_url: string | null;
  cor_primaria: string;
  nome_empresa: string;
  comissao_percentual: number;
}

const defaultConfig: Configuracoes = {
  id: '',
  logo_url: null,
  cor_primaria: '25 95% 53%',
  nome_empresa: 'Solar Service',
  comissao_percentual: 10,
};

export function useConfiguracoes() {
  const [config, setConfig] = useState<Configuracoes>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only load config when user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadConfig();
      } else {
        setLoading(false);
      }
    });
  }, []);

  // Apply dynamic theme whenever config changes
  useEffect(() => {
    if (config.cor_primaria) {
      document.documentElement.style.setProperty('--primary', config.cor_primaria);
      document.documentElement.style.setProperty('--accent', config.cor_primaria);
      document.documentElement.style.setProperty('--ring', config.cor_primaria);
      document.documentElement.style.setProperty('--sidebar-primary', config.cor_primaria);
      document.documentElement.style.setProperty('--sidebar-ring', config.cor_primaria);
      document.documentElement.style.setProperty('--solar-orange', config.cor_primaria);
    }
  }, [config.cor_primaria]);

  async function loadConfig() {
    const { data } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
    if (data) {
      setConfig({
        id: data.id,
        logo_url: data.logo_url,
        cor_primaria: data.cor_primaria || '25 95% 53%',
        nome_empresa: data.nome_empresa || 'Solar Service',
        comissao_percentual: Number(data.comissao_percentual) || 10,
      });
    }
    setLoading(false);
  }

  return { config, loading, reload: loadConfig };
}
