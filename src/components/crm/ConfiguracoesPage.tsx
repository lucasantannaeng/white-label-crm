import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Settings,
  Upload,
  Palette,
  Download,
  Percent,
  BotMessageSquare,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Compass,
  Sparkles,
  Database,
  Trash2,
  ExternalLink,
  RefreshCw,
  Layers,
  Cpu,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';
import GerenciarUsuarios from './GerenciarUsuarios';
import GerenciarFaixasPreco from './GerenciarFaixasPreco';
import GerenciarPresetsModulos from './GerenciarPresetsModulos';
import SetupWizard from './SetupWizard';
import { saveAs } from 'file-saver';

const PROVIDER_KEY_LINKS: Record<string, { name: string; url: string; helpText: string }> = {
  gemini: {
    name: 'Google AI Studio',
    url: 'https://aistudio.google.com/app/apikey',
    helpText: 'Gere sua API Key oficial e gratuita no Google AI Studio',
  },
  groq: {
    name: 'Groq Console',
    url: 'https://console.groq.com/keys',
    helpText: 'Gere sua API Key de ultra velocidade Llama 3 no Groq Console',
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/settings/keys',
    helpText: 'Gere sua chave unificada multi-modelos no OpenRouter',
  },
  openai: {
    name: 'OpenAI Platform',
    url: 'https://platform.openai.com/api-keys',
    helpText: 'Gere sua API Key oficial GPT-4o na OpenAI Platform',
  },
  deepseek: {
    name: 'DeepSeek Platform',
    url: 'https://platform.deepseek.com/api_keys',
    helpText: 'Gere sua API Key DeepSeek no painel oficial',
  },
};

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('geral');
  const [uploading, setUploading] = useState(false);
  const [corInput, setCorInput] = useState('#f97316');
  const [nomeEmpresa, setNomeEmpresa] = useState('Solar Service');
  const [comissaoPercentual, setComissaoPercentual] = useState(10);
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [exportando, setExportando] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Supabase Database Configuration State
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    return localStorage.getItem('CUSTOM_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || '';
  });
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => {
    return localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  });
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [testandoSupabase, setTestandoSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'success' | 'error' | null>(null);

  // AI Configuration State (Multi-Key & Fallback Pool)
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiApiKeySecondary, setAiApiKeySecondary] = useState('');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [aiCustomEndpoint, setAiCustomEndpoint] = useState('');
  const [aiFallbackEnabled, setAiFallbackEnabled] = useState(true);
  const [aiFallbackProvider, setAiFallbackProvider] = useState('groq');
  const [aiFallbackModel, setAiFallbackModel] = useState('llama-3.3-70b-versatile');
  const [aiFallbackKey, setAiFallbackKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiKeySecondary, setShowApiKeySecondary] = useState(false);
  const [showFallbackKey, setShowFallbackKey] = useState(false);
  const [testandoIA, setTestandoIA] = useState(false);
  const [testStatus, setTestStatus] = useState<'success' | 'error' | null>(null);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    const { data } = await supabase.from('configuracoes').select('*').limit(1).single();
    if (data) {
      setConfig(data);
      setNomeEmpresa(data.nome_empresa || 'Solar Service');
      setComissaoPercentual(Number(data.comissao_percentual) || 10);
      setAiProvider(data.ai_provider || 'gemini');
      setAiApiKey(data.ai_api_key || '');
      setAiApiKeySecondary(data.ai_api_key_secondary || '');
      setAiModel(data.ai_model || 'gemini-2.5-flash');
      setAiCustomEndpoint(data.ai_custom_endpoint || '');
      setAiFallbackEnabled(data.ai_fallback_enabled ?? true);
      setAiFallbackProvider(data.ai_fallback_provider || 'groq');
      setAiFallbackModel(data.ai_fallback_model || 'llama-3.3-70b-versatile');
      setAiFallbackKey(data.ai_fallback_key || '');
      if (data.cor_primaria) {
        setCorInput(hslStringToHex(data.cor_primaria));
      }
    }
  }

  function hslStringToHex(hslStr: string): string {
    try {
      const parts = hslStr.replace(/%/g, '').split(/\s+/).map(Number);
      if (parts.length < 3) return '#f97316';
      const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
      const a2 = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    } catch { return '#f97316'; }
  }

  function hexToHslString(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
        case g: h = ((b - r) / d + 2) * 60; break;
        case b: h = ((r - g) / d + 4) * 60; break;
      }
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (config?.id) {
        await supabase.from('configuracoes').update({ logo_url: base64 }).eq('id', config.id);
      }
      setConfig((prev: any) => ({ ...prev, logo_url: base64 }));
      toast.success('Logo atualizada com sucesso!');

      try {
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `logo_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('assets')
          .upload(fileName, file, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(fileName);
          if (urlData?.publicUrl && config?.id) {
            await supabase.from('configuracoes').update({ logo_url: urlData.publicUrl }).eq('id', config.id);
            setConfig((prev: any) => ({ ...prev, logo_url: urlData.publicUrl }));
          }
        }
      } catch (err) {
        console.warn('Storage upload fallback kept base64:', err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleDirectUrlLogo(url: string) {
    setLogoInputUrl(url);
    if (!url.trim() || !config?.id) return;
    await supabase.from('configuracoes').update({ logo_url: url.trim() }).eq('id', config.id);
    setConfig((prev: any) => ({ ...prev, logo_url: url.trim() }));
    toast.success('URL da logo aplicada!');
  }

  async function removerLogo() {
    if (config?.id) {
      await supabase.from('configuracoes').update({ logo_url: null }).eq('id', config.id);
    }
    setConfig((prev: any) => ({ ...prev, logo_url: null }));
    setLogoInputUrl('');
    toast.info('Logo removida.');
  }

  async function testarConexaoSupabase() {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      toast.error('Informe a URL e a Chave Anon do Supabase');
      return;
    }
    setTestandoSupabase(true);
    setSupabaseStatus(null);
    try {
      const testClient = createClient(supabaseUrl.trim(), supabaseAnonKey.trim());
      const { error } = await testClient.from('configuracoes').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      setSupabaseStatus('success');
      toast.success('✅ Conexão com o Supabase validada com sucesso!');
    } catch (err: any) {
      setSupabaseStatus('error');
      toast.error('❌ Falha na conexão com Supabase: ' + (err.message || 'Verifique as credenciais'));
    } finally {
      setTestandoSupabase(false);
    }
  }

  function salvarCredenciaisSupabase() {
    if (supabaseUrl.trim()) {
      localStorage.setItem('CUSTOM_SUPABASE_URL', supabaseUrl.trim());
    }
    if (supabaseAnonKey.trim()) {
      localStorage.setItem('CUSTOM_SUPABASE_ANON_KEY', supabaseAnonKey.trim());
    }
    toast.success('Credenciais do Supabase salvas localmente!');
  }

  function restaurarPadraoSupabase() {
    localStorage.removeItem('CUSTOM_SUPABASE_URL');
    localStorage.removeItem('CUSTOM_SUPABASE_ANON_KEY');
    setSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
    setSupabaseAnonKey(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
    setSupabaseStatus(null);
    toast.info('Credenciais restauradas para o padrão do servidor (.env).');
  }

  async function salvarConfiguracoes() {
    if (!config?.id) return;
    const hslColor = hexToHslString(corInput);
    const { error } = await supabase.from('configuracoes').update({
      cor_primaria: hslColor,
      nome_empresa: nomeEmpresa,
      comissao_percentual: comissaoPercentual,
      ai_provider: aiProvider,
      ai_api_key: aiApiKey || null,
      ai_api_key_secondary: aiApiKeySecondary || null,
      ai_model: aiModel || null,
      ai_custom_endpoint: aiCustomEndpoint || null,
      ai_fallback_enabled: aiFallbackEnabled,
      ai_fallback_provider: aiFallbackProvider || 'groq',
      ai_fallback_model: aiFallbackModel || 'llama-3.3-70b-versatile',
      ai_fallback_key: aiFallbackKey || null,
    }).eq('id', config.id);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }

    document.documentElement.style.setProperty('--primary', hslColor);
    document.documentElement.style.setProperty('--accent', hslColor);
    document.documentElement.style.setProperty('--ring', hslColor);
    document.documentElement.style.setProperty('--sidebar-primary', hslColor);
    document.documentElement.style.setProperty('--sidebar-ring', hslColor);
    document.documentElement.style.setProperty('--solar-orange', hslColor);

    toast.success('Configurações salvas com sucesso!');
    loadConfig();
  }

  async function testarConexaoIA() {
    if (!aiApiKey && !aiApiKeySecondary && aiProvider !== 'custom') {
      toast.error('Informe pelo menos uma API Key para testar a conexão');
      return;
    }
    setTestandoIA(true);
    setTestStatus(null);
    try {
      if (config?.id) {
        await supabase.from('configuracoes').update({
          ai_provider: aiProvider,
          ai_api_key: aiApiKey || null,
          ai_api_key_secondary: aiApiKeySecondary || null,
          ai_model: aiModel || null,
          ai_custom_endpoint: aiCustomEndpoint || null,
          ai_fallback_enabled: aiFallbackEnabled,
          ai_fallback_provider: aiFallbackProvider,
          ai_fallback_model: aiFallbackModel,
          ai_fallback_key: aiFallbackKey || null,
        }).eq('id', config.id);
      }

      const { data, error } = await supabase.functions.invoke('ai-voice-assistant', {
        body: { query: 'Teste de conectividade multi-chaves: responda OK.' },
      });

      if (error) throw error;
      if (data?.answer) {
        setTestStatus('success');
        toast.success('Conexão com o pool de IA validada com sucesso!');
      } else {
        throw new Error('Sem resposta');
      }
    } catch (err: any) {
      setTestStatus('error');
      toast.error('Falha no teste: ' + (err.message || 'Verifique as chaves'));
    } finally {
      setTestandoIA(false);
    }
  }

  async function exportarBackupCompleto() {
    setExportando(true);
    try {
      const [
        { data: clientes },
        { data: contratos },
        { data: agendamentos },
        { data: servicosExtras },
        { data: equipes },
        { data: comissoes },
        { data: faixasPreco },
        { data: presetsModulos },
      ] = await Promise.all([
        supabase.from('clientes').select('*'),
        supabase.from('contratos').select('*'),
        supabase.from('agendamentos').select('*'),
        supabase.from('servicos_extras').select('*'),
        supabase.from('equipes').select('*'),
        supabase.from('comissoes').select('*'),
        supabase.from('faixas_preco').select('*'),
        supabase.from('presets_modulos').select('*'),
      ]);

      const backupData = {
        empresa: nomeEmpresa,
        gerado_em: new Date().toISOString(),
        tabelas: {
          clientes: clientes || [],
          contratos: contratos || [],
          agendamentos: agendamentos || [],
          servicos_extras: servicosExtras || [],
          equipes: equipes || [],
          comissoes: comissoes || [],
          faixas_preco: faixasPreco || [],
          presets_modulos: presetsModulos || [],
        },
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json;charset=utf-8' });
      const filename = `backup_solar_crm_${new Date().toISOString().split('T')[0]}.json`;
      saveAs(blob, filename);
      toast.success('Backup exportado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao gerar backup: ' + err.message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Painel de Configurações</h2>
          <p className="text-muted-foreground text-sm">Personalize a identidade da marca, infraestrutura e inteligência artificial.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportarBackupCompleto}
            disabled={exportando}
            className="gap-1.5 text-xs h-9"
          >
            {exportando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exportando ? 'Exportando...' : 'Backup do Sistema'}
          </Button>

          <Button
            size="sm"
            onClick={() => setWizardOpen(true)}
            className="gap-1.5 text-xs h-9 bg-primary text-primary-foreground"
          >
            <Sparkles className="w-3.5 h-3.5" /> Assistente Walkthrough
          </Button>
        </div>
      </div>

      <SetupWizard open={wizardOpen} onOpenChange={setWizardOpen} onSetupComplete={loadConfig} />

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="geral" className="flex items-center gap-2 text-xs">
            <Settings className="w-4 h-4" /> Geral & Marca
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="flex items-center gap-2 text-xs">
            <BotMessageSquare className="w-4 h-4 text-primary" /> IA & Supabase
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: GERAL & MARCA */}
        <TabsContent value="geral" className="space-y-6">
          {/* Identidade Visual */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Identidade Visual (White-Label)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo */}
              <div className="space-y-3">
                <Label>Logo da Empresa</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-muted/20">
                  {config?.logo_url ? (
                    <div className="space-y-3">
                      <div className="p-2 bg-background/80 rounded-lg border border-border inline-block">
                        <img src={config.logo_url} alt="Logo" className="max-h-16 max-w-[220px] mx-auto object-contain" />
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                          <Button variant="outline" size="sm" asChild>
                            <span><Upload className="w-3.5 h-3.5 mr-1" />{uploading ? 'Enviando...' : 'Trocar Logo'}</span>
                          </Button>
                        </label>
                        <Button variant="ghost" size="sm" onClick={removerLogo} className="text-xs text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-3">Selecione uma imagem para a logo</p>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                        <Button variant="outline" size="sm" asChild>
                          <span>{uploading ? 'Enviando...' : 'Upload de Imagem'}</span>
                        </Button>
                      </label>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Ou cole a URL direta da imagem:</Label>
                  <Input
                    value={logoInputUrl}
                    onChange={e => handleDirectUrlLogo(e.target.value)}
                    placeholder="https://minhaempresa.com/logo.png"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Cor e Nome */}
              <div className="space-y-4">
                <div>
                  <Label>Nome da Empresa / Franquia</Label>
                  <Input value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Cor Primária da Marca</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="color"
                      value={corInput}
                      onChange={e => setCorInput(e.target.value)}
                      className="w-12 h-10 rounded-md border border-input cursor-pointer"
                    />
                    <Input value={corInput} onChange={e => setCorInput(e.target.value)} className="flex-1 font-mono uppercase text-xs" />
                    <div className="w-10 h-10 rounded-md border border-border" style={{ backgroundColor: corInput }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comissão */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              Configuração de Comissão Padrão
            </h3>
            <div className="max-w-xs space-y-1">
              <Label>Percentual de Comissão (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={comissaoPercentual}
                  onChange={e => setComissaoPercentual(Number(e.target.value))}
                  className="font-mono text-sm"
                />
                <span className="text-xs font-semibold text-muted-foreground">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Aplicado sobre o primeiro valor mensal do contrato.</p>
            </div>
          </div>

          {/* Faixas de Preço e Módulos */}
          <GerenciarFaixasPreco />
          <GerenciarPresetsModulos />

          {/* Usuários */}
          <GerenciarUsuarios />

          <Button onClick={salvarConfiguracoes} className="w-full sm:w-auto">
            Salvar Configurações Gerais
          </Button>
        </TabsContent>

        {/* TAB 2: INTEGRAÇÕES (IA & SUPABASE) */}
        <TabsContent value="integracoes" className="space-y-6">
          {/* Seção Banco de Dados Supabase */}
          <div className="glass-card rounded-xl p-6 border border-border/80">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-display font-semibold flex items-center gap-2 text-foreground">
                <Database className="w-5 h-5 text-primary" />
                Conexão com o Supabase (Banco de Dados)
              </h3>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20"
              >
                Abrir Supabase Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Configure as chaves do seu banco de dados Supabase para apontar para a sua conta ou a conta do seu cliente final.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">URL do Supabase (Project URL)</Label>
                    <a
                      href="https://supabase.com/dashboard/project/_/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      Acessar API Settings <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <Input
                    value={supabaseUrl}
                    onChange={e => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyz.supabase.co"
                    className="font-mono text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs">Anon / Public Key</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showSupabaseKey ? 'text' : 'password'}
                      value={supabaseAnonKey}
                      onChange={e => setSupabaseAnonKey(e.target.value)}
                      placeholder="eyJhbGciOi..."
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSupabaseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={testarConexaoSupabase}
                    disabled={testandoSupabase}
                    className="text-xs h-8 gap-1.5"
                  >
                    {testandoSupabase ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-primary" />}
                    {testandoSupabase ? 'Testando Banco...' : 'Testar Conexão Supabase'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={salvarCredenciaisSupabase}
                    className="text-xs h-8"
                  >
                    Salvar Credenciais
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={restaurarPadraoSupabase}
                    className="text-xs h-8 text-muted-foreground"
                    title="Restaurar padrão do .env"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Restaurar Padrão
                  </Button>
                </div>

                {supabaseStatus === 'success' && (
                  <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Banco conectado com sucesso!
                  </span>
                )}
                {supabaseStatus === 'error' && (
                  <span className="text-xs font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Falha na conexão com o banco.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Seção Inteligência Artificial Multi-Chave & Failover Pool */}
          <div className="glass-card rounded-xl p-6 border border-primary/30 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-display font-semibold flex items-center gap-2 text-foreground">
                  <BotMessageSquare className="w-5 h-5 text-primary" />
                  Inteligência Artificial (IA) Multi-Chave & Rotação
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Alimenta o Assistente Técnico por Voz, Visão Computacional de Sujeira e Otimização de Rotas.
                </p>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-primary/10 text-primary border border-primary/20">
                Multi-Key Failover Engine
              </span>
            </div>

            {/* Provedor Principal */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border/70 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-primary" /> Provedor Primário
                </span>
                {PROVIDER_KEY_LINKS[aiProvider] && (
                  <a
                    href={PROVIDER_KEY_LINKS[aiProvider].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium bg-background px-2.5 py-1 rounded border border-border"
                  >
                    Obter Chave no {PROVIDER_KEY_LINKS[aiProvider].name} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Provedor LLM</Label>
                  <select
                    value={aiProvider}
                    onChange={(e) => {
                      const p = e.target.value;
                      setAiProvider(p);
                      if (p === 'gemini') setAiModel('gemini-2.5-flash');
                      else if (p === 'groq') setAiModel('llama-3.3-70b-versatile');
                      else if (p === 'openrouter') setAiModel('google/gemini-2.5-flash');
                      else if (p === 'openai') setAiModel('gpt-4o-mini');
                      else if (p === 'deepseek') setAiModel('deepseek-chat');
                    }}
                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="gemini">Google Gemini Oficial (Recomendado Gratuito)</option>
                    <option value="groq">Groq (Ultra-rápido Llama 3)</option>
                    <option value="openrouter">OpenRouter (Multi-Modelos)</option>
                    <option value="openai">OpenAI (ChatGPT / GPT-4o / GPT-4o-mini)</option>
                    <option value="deepseek">DeepSeek (V3 / R1)</option>
                    <option value="custom">Endpoint Customizado (FreeLLM / Ollama)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Modelo Principal</Label>
                  <Input
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                    className="mt-1 font-mono text-xs h-9"
                  />
                </div>
              </div>

              {/* Chave Principal */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-primary" /> Chave Principal (Primary API Key)
                  </Label>
                  {PROVIDER_KEY_LINKS[aiProvider] && (
                    <span className="text-[11px] text-muted-foreground">{PROVIDER_KEY_LINKS[aiProvider].helpText}</span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={aiApiKey}
                    onChange={e => setAiApiKey(e.target.value)}
                    placeholder="Chave primária de API..."
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Chave Secundária / Rotação */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-500" /> Chave Secundária / Backup (Secondary API Key)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">Usada se a chave principal atingir limite de cota (429)</span>
                </div>
                <div className="relative">
                  <Input
                    type={showApiKeySecondary ? 'text' : 'password'}
                    value={aiApiKeySecondary}
                    onChange={e => setAiApiKeySecondary(e.target.value)}
                    placeholder="Chave secundária de backup (opcional)..."
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeySecondary(!showApiKeySecondary)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKeySecondary ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {aiProvider === 'custom' && (
                <div>
                  <Label className="text-xs">URL do Endpoint Customizado</Label>
                  <Input
                    value={aiCustomEndpoint}
                    onChange={e => setAiCustomEndpoint(e.target.value)}
                    placeholder="http://localhost:11434/v1/chat/completions"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              )}
            </div>

            {/* Provedor de Fallback / Segunda Linha de Defesa */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border/70 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-500" /> Provedor Alternativo de Fallback (Failover Pool)
                </span>
                {PROVIDER_KEY_LINKS[aiFallbackProvider] && (
                  <a
                    href={PROVIDER_KEY_LINKS[aiFallbackProvider].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium bg-background px-2.5 py-1 rounded border border-border"
                  >
                    Obter Chave no {PROVIDER_KEY_LINKS[aiFallbackProvider].name} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Provedor de Fallback</Label>
                  <select
                    value={aiFallbackProvider}
                    onChange={(e) => {
                      const p = e.target.value;
                      setAiFallbackProvider(p);
                      if (p === 'groq') setAiFallbackModel('llama-3.3-70b-versatile');
                      else if (p === 'gemini') setAiFallbackModel('gemini-2.5-flash');
                      else if (p === 'openrouter') setAiFallbackModel('google/gemini-2.5-flash');
                      else if (p === 'openai') setAiFallbackModel('gpt-4o-mini');
                    }}
                    className="w-full h-9 mt-1 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="groq">Groq (Ultra-rápido Llama 3 - Recomendado para Fallback)</option>
                    <option value="gemini">Google Gemini Oficial</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Modelo de Fallback</Label>
                  <Input
                    value={aiFallbackModel}
                    onChange={e => setAiFallbackModel(e.target.value)}
                    className="mt-1 font-mono text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-500" /> Chave de API do Provedor de Fallback
                </Label>
                <div className="relative mt-1">
                  <Input
                    type={showFallbackKey ? 'text' : 'password'}
                    value={aiFallbackKey}
                    onChange={e => setAiFallbackKey(e.target.value)}
                    placeholder="Chave do provedor de fallback (opcional)..."
                    className="pr-10 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFallbackKey(!showFallbackKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showFallbackKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Fallback Resilience Switch */}
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Modo de Resiliência Local (Heurísticas Offline)
                </span>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Se todas as chaves falharem, o CRM executa diagnóstico de inversores local e telemetria Open-Meteo sem gerar telas de erro para os técnicos.
                </p>
              </div>
              <Switch
                checked={aiFallbackEnabled}
                onCheckedChange={setAiFallbackEnabled}
              />
            </div>

            {/* Ações de Teste e Salvar */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testarConexaoIA}
                  disabled={testandoIA}
                  className="text-xs h-9 gap-1.5"
                >
                  {testandoIA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BotMessageSquare className="w-3.5 h-3.5 text-primary" />}
                  {testandoIA ? 'Testando Conexão...' : 'Testar Conexão com IA'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={salvarConfiguracoes}
                  className="text-xs h-9"
                >
                  Salvar Configurações de IA
                </Button>
              </div>

              {testStatus === 'success' && (
                <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Pool de IA validado com sucesso!
                </span>
              )}
              {testStatus === 'error' && (
                <span className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Falha no teste. Verifique as chaves.
                </span>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
