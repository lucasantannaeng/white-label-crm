import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Sparkles,
  Palette,
  BotMessageSquare,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  Key,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  DollarSign,
  Zap,
  Database,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Layers,
  Cpu,
} from 'lucide-react';

interface SetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetupComplete?: () => void;
}

const PROVIDER_KEY_LINKS: Record<string, { name: string; url: string; helpText: string }> = {
  gemini: {
    name: 'Google AI Studio',
    url: 'https://aistudio.google.com/app/apikey',
    helpText: 'Gere sua API Key oficial e gratuita no Google AI Studio',
  },
  groq: {
    name: 'Groq Console',
    url: 'https://console.groq.com/keys',
    helpText: 'Gere sua API Key ultrarrápida Llama 3 no Console Groq',
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

export default function SetupWizard({ open, onOpenChange, onSetupComplete }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Supabase / Database Connection
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    return localStorage.getItem('CUSTOM_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || '';
  });
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => {
    return localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  });
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [testandoSupabase, setTestandoSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'success' | 'error' | null>(null);

  // Step 2: Branding / Identity
  const [nomeEmpresa, setNomeEmpresa] = useState('Solar Service');
  const [corPrimaria, setCorPrimaria] = useState('#f97316');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Step 3: AI Configuration (Multi-Key & Fallback Pool)
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

  // Step 4: Commercial & Pricing
  const [comissaoPercentual, setComissaoPercentual] = useState(10);
  const [precoAte10, setPrecoAte10] = useState(50);
  const [precoAte20, setPrecoAte20] = useState(45);
  const [precoAte30, setPrecoAte30] = useState(40);

  // Step 5: First Operational Team
  const [nomeEquipe, setNomeEquipe] = useState('Equipe Campo 01');
  const [membrosEquipe, setMembrosEquipe] = useState('Técnico Líder, Auxiliar de Campo');

  // Load existing config on open
  useEffect(() => {
    if (open) {
      loadInitialData();
      setStep(1);
    }
  }, [open]);

  async function loadInitialData() {
    try {
      const { data: config } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
      if (config) {
        setNomeEmpresa(config.nome_empresa || 'Solar Service');
        setComissaoPercentual(Number(config.comissao_percentual) || 10);
        setLogoUrl(config.logo_url || null);
        if (config.logo_url && !config.logo_url.startsWith('data:')) {
          setLogoInputUrl(config.logo_url);
        }
        setAiProvider(config.ai_provider || 'gemini');
        setAiApiKey(config.ai_api_key || '');
        setAiApiKeySecondary(config.ai_api_key_secondary || '');
        setAiModel(config.ai_model || 'gemini-2.5-flash');
        setAiCustomEndpoint(config.ai_custom_endpoint || '');
        setAiFallbackEnabled(config.ai_fallback_enabled ?? true);
        setAiFallbackProvider(config.ai_fallback_provider || 'groq');
        setAiFallbackModel(config.ai_fallback_model || 'llama-3.3-70b-versatile');
        setAiFallbackKey(config.ai_fallback_key || '');
        if (config.cor_primaria) {
          setCorPrimaria(hslStringToHex(config.cor_primaria));
        }
      }
    } catch (e) {
      console.error('Error loading config in wizard:', e);
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

  async function testarConexaoSupabase() {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      toast.error('Informe a URL e a Anon Key do Supabase para testar.');
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setLogoUrl(base64);

      try {
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `logo_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('assets')
          .upload(fileName, file, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            setLogoUrl(urlData.publicUrl);
          }
        }
      } catch (err) {
        console.warn('Storage upload fallback to base64:', err);
      } finally {
        setUploadingLogo(false);
        toast.success('Logo atualizada com sucesso!');
      }
    };
    reader.readAsDataURL(file);
  }

  function handleDirectUrlLogo(url: string) {
    setLogoInputUrl(url);
    if (url.trim()) {
      setLogoUrl(url.trim());
    }
  }

  function removerLogo() {
    setLogoUrl(null);
    setLogoInputUrl('');
    toast.info('Logo removida.');
  }

  async function testarConexaoIA() {
    if (!aiApiKey && !aiApiKeySecondary && aiProvider !== 'custom') {
      toast.error('Informe uma API Key para testar a conexão');
      return;
    }
    setTestandoIA(true);
    setTestStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-voice-assistant', {
        body: { query: 'Teste rápido de conectividade multi-chaves.' },
      });
      if (error) throw error;
      if (data?.answer) {
        setTestStatus('success');
        toast.success('Conexão com a IA validada com sucesso!');
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

  async function finalizarSetup() {
    setSaving(true);
    try {
      if (supabaseUrl.trim()) {
        localStorage.setItem('CUSTOM_SUPABASE_URL', supabaseUrl.trim());
      }
      if (supabaseAnonKey.trim()) {
        localStorage.setItem('CUSTOM_SUPABASE_ANON_KEY', supabaseAnonKey.trim());
      }

      const hslColor = hexToHslString(corPrimaria);

      const { data: existingConfig } = await supabase.from('configuracoes').select('id').limit(1).maybeSingle();
      const configPayload = {
        nome_empresa: nomeEmpresa,
        cor_primaria: hslColor,
        logo_url: logoUrl,
        comissao_percentual: comissaoPercentual,
        ai_provider: aiProvider,
        ai_api_key: aiApiKey || null,
        ai_api_key_secondary: aiApiKeySecondary || null,
        ai_model: aiModel || null,
        ai_custom_endpoint: aiCustomEndpoint || null,
        ai_fallback_enabled: aiFallbackEnabled,
        ai_fallback_provider: aiFallbackProvider,
        ai_fallback_model: aiFallbackModel,
        ai_fallback_key: aiFallbackKey || null,
      };

      if (existingConfig?.id) {
        await supabase.from('configuracoes').update(configPayload).eq('id', existingConfig.id);
      } else {
        await supabase.from('configuracoes').insert(configPayload);
      }

      if (nomeEquipe.trim()) {
        const membros = membrosEquipe.split(',').map(m => m.trim()).filter(Boolean);
        const { data: existingTeam } = await supabase.from('equipes').select('id').eq('nome', nomeEquipe.trim()).maybeSingle();
        if (!existingTeam) {
          await supabase.from('equipes').insert({
            nome: nomeEquipe.trim(),
            membros: membros.length > 0 ? membros : ['Técnico Responsável'],
            ativo: true,
          });
        }
      }

      document.documentElement.style.setProperty('--primary', hslColor);
      document.documentElement.style.setProperty('--accent', hslColor);
      document.documentElement.style.setProperty('--ring', hslColor);
      document.documentElement.style.setProperty('--sidebar-primary', hslColor);
      document.documentElement.style.setProperty('--sidebar-ring', hslColor);
      document.documentElement.style.setProperty('--solar-orange', hslColor);

      toast.success('🎉 Configuração concluída com sucesso! O CRM está pronto para operar.');
      onOpenChange(false);
      if (onSetupComplete) onSetupComplete();
    } catch (err: any) {
      toast.error('Erro ao finalizar configuração: ' + (err.message || 'Tente novamente'));
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { num: 1, label: 'Banco Supabase', icon: Database },
    { num: 2, label: 'Identidade da Marca', icon: Palette },
    { num: 3, label: 'IA & Multi-Chaves', icon: BotMessageSquare },
    { num: 4, label: 'Regras Comerciais', icon: DollarSign },
    { num: 5, label: 'Equipe Inicial', icon: Users },
    { num: 6, label: 'Ativação Final', icon: Sparkles },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border/80 bg-card">
        {/* Wizard Header */}
        <div className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Assistente de Configuração (Walkthrough)</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Configure o banco de dados Supabase, identidade visual, IA multi-chaves e regras operacionais.
                </DialogDescription>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded bg-muted text-muted-foreground">
              Passo {step} de 6
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-6 gap-1.5">
            {steps.map((s) => {
              const Icon = s.icon;
              const isCompleted = step > s.num;
              const isCurrent = step === s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all text-center ${
                    isCurrent
                      ? 'bg-primary/15 text-primary border border-primary/30 font-medium'
                      : isCompleted
                      ? 'text-emerald-500 bg-emerald-500/10'
                      : 'text-muted-foreground/60 bg-muted/40 hover:bg-muted/70'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                    <span className="text-[10px] font-mono">0{s.num}</span>
                  </div>
                  <span className="text-[9px] leading-tight line-clamp-1 hidden sm:block">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Body Content */}
        <div className="p-6 space-y-6 min-h-[340px]">
          {/* STEP 1: Conexão Supabase */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <Database className="w-4 h-4 text-primary" /> Conexão com o Supabase (Banco de Dados)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Conecte o CRM à instância do Supabase com validação em tempo real.
                  </p>
                </div>
                <a
                  href="https://supabase.com/dashboard/project/_/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded border border-primary/20"
                >
                  API Settings no Supabase <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <Label className="text-xs">URL do Projeto Supabase (Project URL)</Label>
                  <Input
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="font-mono text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Chave Pública Anon (Anon / Public Key)</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showSupabaseKey ? 'text' : 'password'}
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
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

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={testarConexaoSupabase}
                    disabled={testandoSupabase}
                    className="text-xs h-8 gap-1.5"
                  >
                    {testandoSupabase ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5 text-primary" />}
                    {testandoSupabase ? 'Testando Conexão...' : 'Testar Conexão Supabase'}
                  </Button>

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
          )}

          {/* STEP 2: Identidade Visual & Logo */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                  <Palette className="w-4 h-4 text-primary" /> Identidade Visual & Marca da Empresa
                </h4>
                <p className="text-xs text-muted-foreground">
                  Defina o nome da sua empresa, envie a logo e escolha a cor primária que personalizará todo o CRM.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs">Nome da Empresa / Franquia</Label>
                  <Input
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    placeholder="Ex: Solar Service Engenharia"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Cor Primária da Marca</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={corPrimaria}
                      onChange={(e) => setCorPrimaria(e.target.value)}
                      className="w-10 h-10 rounded-md border border-input cursor-pointer p-0"
                    />
                    <Input
                      value={corPrimaria}
                      onChange={(e) => setCorPrimaria(e.target.value)}
                      className="font-mono text-xs uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Logo Management */}
              <div className="pt-2 space-y-3">
                <Label className="text-xs">Logo da Empresa</Label>
                
                <div className="border-2 border-dashed border-border rounded-xl p-4 bg-muted/20">
                  {logoUrl ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="p-2 bg-background/80 rounded-lg border border-border">
                        <img src={logoUrl} alt="Logo Preview" className="max-h-14 max-w-[200px] object-contain" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                          <Button variant="outline" size="sm" asChild>
                            <span><Upload className="w-3.5 h-3.5 mr-1.5" />{uploadingLogo ? 'Enviando...' : 'Trocar Logo'}</span>
                          </Button>
                        </label>
                        <Button variant="ghost" size="sm" onClick={removerLogo} className="text-xs text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <Upload className="w-7 h-7 mx-auto mb-1.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground mb-3">Selecione uma imagem do computador ou cole uma URL direta</p>
                      <label className="cursor-pointer inline-block">
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                        <Button variant="outline" size="sm" asChild>
                          <span>{uploadingLogo ? 'Enviando...' : 'Fazer Upload de Imagem'}</span>
                        </Button>
                      </label>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-[11px] text-muted-foreground">Ou cole a URL pública da imagem:</Label>
                  <Input
                    value={logoInputUrl}
                    onChange={(e) => handleDirectUrlLogo(e.target.value)}
                    placeholder="https://exemplo.com/minha-logo.png"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Inteligência Artificial Multi-Chaves */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                    <BotMessageSquare className="w-4 h-4 text-primary" /> IA Multi-Chaves & Failover Pool
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Configure chaves primárias e de backup com rotação automática em caso de limite de cota.
                  </p>
                </div>
                {PROVIDER_KEY_LINKS[aiProvider] && (
                  <a
                    href={PROVIDER_KEY_LINKS[aiProvider].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2.5 py-1 rounded border border-primary/20"
                  >
                    Obter Chave no {PROVIDER_KEY_LINKS[aiProvider].name} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <Label className="text-xs">Provedor Principal</Label>
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
                    <option value="custom">Endpoint Customizado (FreeLLM / Local)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Modelo Selecionado</Label>
                  <Input
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="mt-1 font-mono text-xs h-9"
                  />
                </div>
              </div>

              {/* Chave Principal */}
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-primary" /> Chave Principal (Primary Key)
                </Label>
                <div className="relative mt-1">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
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

              {/* Chave Secundária de Backup */}
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-500" /> Chave Secundária / Rotação de Backup (Opcional)
                </Label>
                <div className="relative mt-1">
                  <Input
                    type={showApiKeySecondary ? 'text' : 'password'}
                    value={aiApiKeySecondary}
                    onChange={(e) => setAiApiKeySecondary(e.target.value)}
                    placeholder="Segunda chave para failover automático..."
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

              {/* Provedor de Fallback Alternativo */}
              <div className="p-3.5 rounded-lg bg-muted/30 border border-border/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-500" /> Provedor de Fallback Secundário
                  </span>
                  {PROVIDER_KEY_LINKS[aiFallbackProvider] && (
                    <a
                      href={PROVIDER_KEY_LINKS[aiFallbackProvider].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      Chave no {PROVIDER_KEY_LINKS[aiFallbackProvider].name} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <select
                      value={aiFallbackProvider}
                      onChange={(e) => setAiFallbackProvider(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                    >
                      <option value="groq">Groq (Recomendado Fallback)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>
                  <div>
                    <Input
                      type={showFallbackKey ? 'text' : 'password'}
                      value={aiFallbackKey}
                      onChange={(e) => setAiFallbackKey(e.target.value)}
                      placeholder="Chave do fallback..."
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> Modo de Resiliência Local (Heurísticas Offline)
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Se faltar internet ou cota na IA, o CRM roda automaticamente rotas heurísticas e clima Open-Meteo.
                  </p>
                </div>
                <Switch checked={aiFallbackEnabled} onCheckedChange={setAiFallbackEnabled} />
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testarConexaoIA}
                  disabled={testandoIA}
                  className="text-xs h-8 gap-1.5"
                >
                  {testandoIA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BotMessageSquare className="w-3.5 h-3.5 text-primary" />}
                  {testandoIA ? 'Validando...' : 'Testar Conexão com IA'}
                </Button>

                {testStatus === 'success' && (
                  <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pool de IA validado!
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="text-xs font-medium text-destructive">
                    Falha na chave informada.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Regras Comerciais */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                  <DollarSign className="w-4 h-4 text-primary" /> Regras Comerciais & Comissões
                </h4>
                <p className="text-xs text-muted-foreground">
                  Configure a comissão dos vendedores e as faixas de preço por placa solar.
                </p>
              </div>

              <div className="pt-2">
                <Label className="text-xs">Percentual Padrão de Comissão do Vendedor (%)</Label>
                <div className="flex items-center gap-3 mt-1.5 max-w-xs">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={comissaoPercentual}
                    onChange={(e) => setComissaoPercentual(Number(e.target.value))}
                    className="font-mono text-sm"
                  />
                  <span className="text-xs font-semibold text-muted-foreground">%</span>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <Label className="text-xs font-medium">Faixas de Preço por Módulo Solar (R$/placa)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <span className="text-[11px] text-muted-foreground block mb-1">1 a 10 placas</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        value={precoAte10}
                        onChange={(e) => setPrecoAte10(Number(e.target.value))}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <span className="text-[11px] text-muted-foreground block mb-1">11 a 20 placas</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        value={precoAte20}
                        onChange={(e) => setPrecoAte20(Number(e.target.value))}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <span className="text-[11px] text-muted-foreground block mb-1">21 a 30 placas</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        value={precoAte30}
                        onChange={(e) => setPrecoAte30(Number(e.target.value))}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Equipe Inicial */}
          {step === 5 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                  <Users className="w-4 h-4 text-primary" /> Equipe Operacional de Campo
                </h4>
                <p className="text-xs text-muted-foreground">
                  Cadastre a primeira equipe técnica para receber agendamentos e rotas de vistoria/limpeza.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs">Nome da Equipe</Label>
                  <Input
                    value={nomeEquipe}
                    onChange={(e) => setNomeEquipe(e.target.value)}
                    placeholder="Ex: Equipe Alfa - Região dos Lagos"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs">Membros / Técnicos (Separados por vírgula)</Label>
                  <Input
                    value={membrosEquipe}
                    onChange={(e) => setMembrosEquipe(e.target.value)}
                    placeholder="Ex: Carlos Silva (Técnico), Roberto (Eletricista)"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Conclusão & Ativação */}
          {step === 6 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-1 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-base text-foreground">Tudo Pronto para Operar!</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Revise o resumo das configurações antes de ativar sua instância White-Label.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/80 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Banco de Dados
                  </span>
                  <p className="text-xs font-mono text-foreground truncate">{supabaseUrl || 'Padrão do Servidor'}</p>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/80 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Empresa & Marca
                  </span>
                  <p className="text-xs font-medium text-foreground">{nomeEmpresa}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: corPrimaria }} />
                    <span className="text-[11px] font-mono text-muted-foreground">{corPrimaria}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/80 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Inteligência Artificial
                  </span>
                  <p className="text-xs font-medium text-foreground capitalize">{aiProvider} ({aiModel})</p>
                  <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Multi-Chaves & Fallback Ativo
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border/80 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Equipe Operacional
                  </span>
                  <p className="text-xs font-medium text-foreground">{nomeEquipe}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="p-4 border-t border-border bg-muted/10 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || saving}
            className="text-xs gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Button>

          <div className="flex items-center gap-2">
            {step < 6 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setStep((s) => Math.min(6, s + 1))}
                className="text-xs gap-1.5"
              >
                Próximo Passo <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={finalizarSetup}
                disabled={saving}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {saving ? 'Salvando...' : 'Salvar e Ativar CRM'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
