import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CloudRain, Route, Loader2, AlertTriangle, CheckCircle, RefreshCw,
  BotMessageSquare, Mic, MicOff, Camera, Eye, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

type Tab = 'clima' | 'rotas' | 'assistente' | 'visao';

export default function AIHubPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? 'clima' : 'assistente');

  const allTabs: { id: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'clima', label: 'Clima & Retrabalho', icon: CloudRain, adminOnly: true },
    { id: 'rotas', label: 'Otimização de Rotas', icon: Route, adminOnly: true },
    { id: 'assistente', label: 'Assistente Técnico', icon: Mic },
    { id: 'visao', label: 'Visão Computacional', icon: Camera },
  ];

  const tabs = allTabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl solar-gradient flex items-center justify-center">
          <BotMessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Hub de Inteligência</h2>
          <p className="text-sm text-muted-foreground">Logística, suporte técnico e análise visual com IA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'clima' && <WeatherTab />}
      {activeTab === 'rotas' && <RoutesTab />}
      {activeTab === 'assistente' && <VoiceAssistantTab />}
      {activeTab === 'visao' && <VisionTab />}
    </div>
  );
}

/* ─── Weather Tab ──────────────────────────────────────────── */
function WeatherTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ alert: string | null; probability: number } | null>(null);

  async function check() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-weather-alert', {
        body: { city: 'Cabo Frio' },
      });
      if (error) throw error;
      setResult(data);
      if (data.alert) {
        toast.warning('Alerta de chuva emitido pela IA');
      } else {
        toast.success('Sem alertas de chuva para amanhã');
      }
    } catch (e: any) {
      toast.error('Erro ao verificar clima: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Previsão de Chuva — Cabo Frio</h3>
            <p className="text-sm text-muted-foreground">
              Consulta a API Open-Meteo e, se a probabilidade de chuva for ≥75%, a IA emite um alerta para adiar limpezas e evitar retrabalho.
            </p>
          </div>
          <Button onClick={check} disabled={loading} className="shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Verificar
          </Button>
        </div>

        {result && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <CloudRain className="w-4 h-4 text-solar-info" />
              <span className="text-sm text-muted-foreground">Probabilidade de chuva amanhã:</span>
              <span className={cn(
                'font-bold text-sm',
                (result.probability ?? 0) >= 75 ? 'text-destructive' : 'text-solar-success'
              )}>
                {result.probability ?? 0}%
              </span>
            </div>

            {result.alert ? (
              <div className="flex gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive mb-1">Alerta de Chuva</p>
                  <p className="text-sm text-foreground">{result.alert}</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 p-4 rounded-lg bg-solar-success/10 border border-solar-success/20">
                <CheckCircle className="w-5 h-5 text-solar-success shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">Sem chuva significativa prevista. As limpezas podem prosseguir normalmente.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Routes Tab ───────────────────────────────────────────── */
function RoutesTab() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  async function optimize() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-route-optimizer', {});
      if (error) throw error;
      setSuggestion(data.suggestion ?? 'A rota já está otimizada.');
      toast.success('Análise de rota concluída');
    } catch (e: any) {
      toast.error('Erro ao otimizar rota: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Otimização de Rotas por IA</h3>
            <p className="text-sm text-muted-foreground">
              A IA analisa todos os agendamentos pendentes e sugere reagrupamentos de clientes por cidade para reduzir deslocamentos desnecessários.
            </p>
          </div>
          <Button onClick={optimize} disabled={loading} className="shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Route className="w-4 h-4 mr-2" />}
            Analisar
          </Button>
        </div>

        {suggestion && (
          <div className="mt-5 flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <BotMessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary mb-1">Sugestão da IA</p>
              <div className="text-sm text-foreground prose prose-sm max-w-none">
                <ReactMarkdown>{suggestion}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Voice Assistant Tab ──────────────────────────────────── */
function VoiceAssistantTab() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const speechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  function startListening() {
    if (!speechSupported) {
      toast.error('Reconhecimento de voz não suportado neste navegador');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
      if (event.results[0]?.isFinal) {
        setQuery(text);
      }
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = (e: any) => {
      console.error('Speech error:', e.error);
      setListening(false);
      if (e.error === 'not-allowed') {
        toast.error('Permissão de microfone negada');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setTranscript('');
    setAnswer(null);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  async function askAI(text?: string) {
    const q = text || query;
    if (!q.trim()) {
      toast.error('Digite ou fale sua dúvida');
      return;
    }
    setLoading(true);
    setAnswer(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('ai-voice-assistant', {
        body: { query: q, user_id: user?.id },
      });
      if (error) throw error;
      setAnswer(data.answer);

      // Try text-to-speech
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(data.answer.replace(/[#*_`]/g, ''));
        utterance.lang = 'pt-BR';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  // Auto-send after speech recognition finishes
  useEffect(() => {
    if (!listening && query && !loading && !answer) {
      askAI(query);
    }
  }, [listening, query]);

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-1">Assistente Técnico de Campo</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Fale ou digite sua dúvida sobre inversores (Goodwe, SAJ, Fronius). A IA responde com passos de ação diretos.
        </p>

        {/* Mic button */}
        <div className="flex flex-col items-center gap-4 mb-5">
          <button
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg',
              listening
                ? 'bg-destructive text-destructive-foreground animate-pulse scale-110'
                : 'bg-primary text-primary-foreground hover:scale-105',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {listening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </button>
          <p className="text-xs text-muted-foreground">
            {listening ? 'Ouvindo... Toque para parar' : speechSupported ? 'Toque para falar' : 'Voz não suportada — digite abaixo'}
          </p>
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="p-3 mb-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Transcrição:</p>
            <p className="text-sm text-foreground italic">"{transcript}"</p>
          </div>
        )}

        {/* Text input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askAI()}
            placeholder="Ex: Erro 30 no inversor Goodwe"
            className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button onClick={() => askAI()} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>

        {/* Answer */}
        {answer && (
          <div className="mt-5 flex gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <BotMessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-foreground prose prose-sm max-w-none">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-5">
        <h4 className="text-sm font-semibold text-foreground mb-2">Exemplos de perguntas:</h4>
        <div className="flex flex-wrap gap-2">
          {[
            'Erro 30 no inversor Goodwe',
            'Erro 516 Fronius — o que fazer?',
            'SAJ erro E013 WiFi',
            'Inversor não liga após chuva',
            'Como resetar inversor Goodwe?',
          ].map(example => (
            <button
              key={example}
              onClick={() => { setQuery(example); askAI(example); }}
              className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Vision Tab ───────────────────────────────────────────── */
function VisionTab() {
  const [analysisType, setAnalysisType] = useState<'soiling' | 'quality'>('soiling');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!preview) {
      toast.error('Selecione uma imagem primeiro');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      // Extract base64 data
      const base64 = preview.split(',')[1];
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke('ai-image-analysis', {
        body: {
          image_base64: base64,
          analysis_type: analysisType,
          user_id: user?.id,
        },
      });
      if (error) throw error;
      setResult(data.result);
      toast.success('Análise concluída');
    } catch (e: any) {
      toast.error('Erro na análise: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-1">Análise Visual com IA</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Faça upload de fotos dos painéis solares para análise automática de sujeira ou validação de qualidade da foto.
        </p>

        {/* Type selector */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setAnalysisType('soiling'); setResult(null); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              analysisType === 'soiling'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Eye className="w-4 h-4" />
            Detecção de Sujeira
          </button>
          <button
            onClick={() => { setAnalysisType('quality'); setResult(null); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              analysisType === 'quality'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <Camera className="w-4 h-4" />
            Qualidade da Foto
          </button>
        </div>

        {/* Upload area */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors mb-4"
        >
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg object-contain" />
          ) : (
            <div className="space-y-2">
              <Camera className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique para selecionar ou tire uma foto</p>
              <p className="text-xs text-muted-foreground">JPG, PNG — Máx 5MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

        {preview && (
          <Button onClick={analyze} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {analysisType === 'soiling' ? 'Analisar Sujeira' : 'Verificar Qualidade'}
          </Button>
        )}

        {/* Soiling Result */}
        {result && analysisType === 'soiling' && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white',
                (result.nivel || 0) <= 2 ? 'bg-solar-success' : (result.nivel || 0) <= 3 ? 'bg-solar-amber' : 'bg-destructive'
              )}>
                {result.nivel || '?'}/5
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{result.descricao || 'Análise concluída'}</p>
                <p className="text-xs text-muted-foreground">Perda estimada: {result.perda_eficiencia || 'N/A'}</p>
              </div>
            </div>

            <div className={cn(
              'p-3 rounded-lg text-sm',
              result.alerta_limpo ? 'bg-solar-amber/10 border border-solar-amber/20' : 'bg-primary/5 border border-primary/20'
            )}>
              {result.alerta_limpo && (
                <p className="font-semibold text-solar-amber mb-1">⚠️ A placa parece limpa. Confirmar execução do serviço?</p>
              )}
              <p className="text-foreground">{result.recomendacao || ''}</p>
            </div>
          </div>
        )}

        {/* Quality Result */}
        {result && analysisType === 'quality' && (
          <div className="mt-5">
            <div className={cn(
              'flex gap-3 p-4 rounded-lg',
              result.aprovada ? 'bg-solar-success/10 border border-solar-success/20' : 'bg-destructive/10 border border-destructive/20'
            )}>
              {result.aprovada ? (
                <CheckCircle className="w-5 h-5 text-solar-success shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div>
                <p className={cn('text-sm font-semibold mb-1', result.aprovada ? 'text-solar-success' : 'text-destructive')}>
                  {result.aprovada ? 'Foto Aprovada ✓' : 'Foto Reprovada ✗'}
                </p>
                {result.problemas?.length > 0 && (
                  <ul className="text-sm text-foreground list-disc list-inside mb-2">
                    {result.problemas.map((p: string, i: number) => <li key={i}>{p}</li>)}
                  </ul>
                )}
                {result.sugestao && (
                  <p className="text-sm text-foreground">{result.sugestao}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Raw result fallback */}
        {result && result.raw && (
          <div className="mt-5 p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-foreground whitespace-pre-wrap">{result.raw}</p>
          </div>
        )}
      </div>
    </div>
  );
}
