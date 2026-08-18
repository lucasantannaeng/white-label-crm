import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { DollarSign, Sun, Users, CalendarDays, CloudRain, AlertTriangle, Loader2, TrendingUp, Wrench, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { lazy, Suspense } from 'react';
import SetupWizard from './SetupWizard';

const RotasDoDia = lazy(() => import('./RotasDoDia'));

interface KPIs {
  receitaMensal: number;
  totalPaineis: number;
  totalClientes: number;
  agendamentosPendentes: number;
}

interface WeatherAlert {
  alert: string | null;
  precipitation?: number;
  probability?: number;
}

interface ClienteRow {
  valor_mensal: number | null;
  quantidade_placas: number | null;
  cidade: string | null;
  potencia_kwp: number | null;
  inicio_contrato: string | null;
}

interface AgendamentoRow {
  id: string;
  status: string;
  tipo: string;
  data_agendamento: string;
  equipe_id: string | null;
}

const CHART_COLORS = [
  'hsl(25, 95%, 53%)',
  'hsl(38, 92%, 50%)',
  'hsl(142, 71%, 45%)',
  'hsl(199, 89%, 48%)',
  'hsl(280, 65%, 60%)',
  'hsl(0, 84%, 60%)',
];

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({ receitaMensal: 0, totalPaineis: 0, totalClientes: 0, agendamentosPendentes: 0 });
  
  const [weather, setWeather] = useState<WeatherAlert | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [cidadeData, setCidadeData] = useState<{ name: string; clientes: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [receitaFaixa, setReceitaFaixa] = useState<{ faixa: string; valor: number }[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    loadKPIs();
    checkWeather();
  }, []);

  async function loadKPIs() {
    const [{ data: clientes }, { data: agendamentos }, { data: faixasDb }] = await Promise.all([
      supabase.from('clientes').select('valor_mensal, quantidade_placas, cidade, potencia_kwp, inicio_contrato').eq('ativo', true).not('inicio_contrato', 'is', null),
      supabase.from('agendamentos').select('id, status, tipo, data_agendamento, equipe_id'),
      supabase.from('faixas_preco').select('*').eq('tipo', 'monitoramento').order('ordem'),
    ]);

    if (clientes) {
      const cList = clientes as ClienteRow[];
      setKpis({
        receitaMensal: cList.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0),
        totalPaineis: cList.reduce((s, c) => s + (Number(c.quantidade_placas) || 0), 0),
        totalClientes: cList.length,
        agendamentosPendentes: (agendamentos as AgendamentoRow[])?.filter(a => a.status === 'Pendente').length || 0,
      });

      // Clientes por cidade
      const cidadeMap: Record<string, number> = {};
      cList.forEach(c => {
        const city = c.cidade || 'Sem cidade';
        cidadeMap[city] = (cidadeMap[city] || 0) + 1;
      });
      setCidadeData(
        Object.entries(cidadeMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, clientes]) => ({ name, clientes }))
      );

      // Clientes por faixa (dinâmico a partir de faixas_preco)
      if (faixasDb && faixasDb.length > 0) {
        const faixaCounts: Record<string, number> = {};
        faixasDb.forEach(f => {
          const label = f.label || `R$ ${Number(f.valor).toFixed(0)}`;
          faixaCounts[label] = 0;
        });

        cList.forEach(c => {
          const v = Number(c.valor_mensal) || 0;
          let matched = false;
          for (const f of faixasDb) {
            const label = f.label || `R$ ${Number(f.valor).toFixed(0)}`;
            if (f.faixa_fim !== null && v <= Number(f.valor)) {
              faixaCounts[label] = (faixaCounts[label] || 0) + 1;
              matched = true;
              break;
            } else if (f.faixa_fim === null) {
              faixaCounts[label] = (faixaCounts[label] || 0) + 1;
              matched = true;
              break;
            }
          }
          if (!matched && faixasDb.length > 0) {
            const firstLabel = faixasDb[0].label || `R$ ${Number(faixasDb[0].valor).toFixed(0)}`;
            faixaCounts[firstLabel] = (faixaCounts[firstLabel] || 0) + 1;
          }
        });
        setReceitaFaixa(Object.entries(faixaCounts).map(([faixa, valor]) => ({ faixa, valor })));
      } else {
        // Fallback genérico proporcional
        const faixas = { 'Até R$150': 0, 'R$151-250': 0, 'R$251-400': 0, 'Acima R$400': 0 };
        cList.forEach(c => {
          const v = Number(c.valor_mensal) || 0;
          if (v <= 150) faixas['Até R$150'] += 1;
          else if (v <= 250) faixas['R$151-250'] += 1;
          else if (v <= 400) faixas['R$251-400'] += 1;
          else faixas['Acima R$400'] += 1;
        });
        setReceitaFaixa(Object.entries(faixas).map(([faixa, valor]) => ({ faixa, valor })));
      }
    }

    if (agendamentos) {
      const aList = agendamentos as AgendamentoRow[];
      
      const statusMap: Record<string, number> = {};
      aList.forEach(a => {
        statusMap[a.status] = (statusMap[a.status] || 0) + 1;
      });
      setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));
    }
  }

  async function checkWeather() {
    try {
      const { data, error } = await supabase.functions.invoke('ai-weather-alert', {
        body: { city: 'Cabo Frio' },
      });
      if (!error && data) setWeather(data);
    } catch {
      // Silently fail
    } finally {
      setWeatherLoading(false);
    }
  }

  const cards = [
    { label: 'Receita Mensal Estimada', value: formatCurrency(kpis.receitaMensal), icon: DollarSign, color: 'text-primary', badge: 'FATURAMENTO' },
    { label: 'Painéis Monitorados', value: kpis.totalPaineis.toLocaleString('pt-BR'), icon: Sun, color: 'text-amber-500', badge: 'SISTEMAS' },
    { label: 'Clientes Ativos', value: kpis.totalClientes.toString(), icon: Users, color: 'text-sky-500', badge: 'BASE' },
    { label: 'Manutenções Pendentes', value: kpis.agendamentosPendentes.toString(), icon: CalendarDays, color: 'text-emerald-500', badge: 'AGENDA' },
  ];

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header with Telemetry Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <h2 className="font-display text-xl lg:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            Cockpit de Operações
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Centro de comando, telemetria de clientes e logística de campo</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWizardOpen(true)}
            className="text-xs h-7 gap-1.5 px-2.5 bg-primary/5 hover:bg-primary/10 border-primary/20 text-foreground"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Guia de Configuração
          </Button>

          <span className="hud-badge-online">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            SISTEMA OPERACIONAL
          </span>
        </div>
      </div>

      <SetupWizard open={wizardOpen} onOpenChange={setWizardOpen} onSetupComplete={loadKPIs} />

      {/* Weather Alert Sensor */}
      {weatherLoading ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-card/60 border border-border/60">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs font-mono text-muted-foreground">Sincronizando telemetria meteorológica...</span>
        </div>
      ) : weather?.alert ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 relative overflow-hidden">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <CloudRain className="w-4 h-4 text-destructive" />
              <p className="text-xs font-mono font-bold text-destructive uppercase tracking-wider">
                Alerta de Chuva · {(weather.precipitation ?? weather.probability ?? 0)}% de probabilidade
              </p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">
                RISCO DE RETRABALHO
              </span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed">{weather.alert}</p>
            {kpis.agendamentosPendentes > 0 && (
              <p className="text-[11px] font-mono text-muted-foreground mt-1.5">
                Recomendação: Reprogramar as {kpis.agendamentosPendentes} limpeza(s) pendente(s) da rota.
              </p>
            )}
          </div>
        </div>
      ) : weather && (weather.precipitation ?? weather.probability ?? 0) <= 30 ? (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2.5">
            <Sun className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-xs text-foreground/90 font-medium">
              Tempo estável na região — <span className="font-mono text-emerald-500 font-semibold">{(weather.precipitation ?? weather.probability ?? 0)}%</span> de chance de chuva.
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-block">
            ROTAS LIBERADAS
          </span>
        </div>
      ) : null}

      {/* KPI Bento Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="hud-metric-card group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground truncate">{card.label}</span>
                <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center border border-border/50 group-hover:border-primary/40 transition-colors">
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
              </div>
              <p className="hud-metric-value text-xl lg:text-2xl mt-1">{card.value}</p>
              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground">
                <span className="uppercase tracking-wider">{card.badge}</span>
                <span className="text-emerald-500 flex items-center gap-0.5">● ATIVO</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rotas do Dia - Timeline */}
      <Suspense fallback={null}>
        <RotasDoDia />
      </Suspense>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receita por Faixa */}
        <div className="glass-card rounded-xl p-5 border border-border/70">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Distribuição por Faixa de Monitoramento
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted/60">CONTRATOS</span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receitaFaixa}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="faixa" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-mono)' }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number) => [value, 'Clientes']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status dos Agendamentos */}
        <div className="glass-card rounded-xl p-5 border border-border/70">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-sky-500" />
              Status de Ordens de Serviço
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted/60">OPERAÇÕES</span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={4} dataKey="value" nameKey="name">
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Clientes por Cidade */}
      {cidadeData.length > 0 && (
        <div className="glass-card rounded-xl p-5 border border-border/70">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              Densidade Geográfica de Clientes
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted/60">TOP 6 MUNICÍPIOS</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cidadeData} layout="vertical">
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                <YAxis dataKey="name" type="category" width={130} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                <Bar dataKey="clientes" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
