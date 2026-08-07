import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { DollarSign, Sun, Users, CalendarDays, CloudRain, AlertTriangle, Loader2, TrendingUp, Wrench } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { lazy, Suspense } from 'react';

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

  useEffect(() => {
    loadKPIs();
    checkWeather();
  }, []);

  async function loadKPIs() {
    const [{ data: clientes }, { data: agendamentos }] = await Promise.all([
      supabase.from('clientes').select('valor_mensal, quantidade_placas, cidade, potencia_kwp, inicio_contrato').eq('ativo', true).not('inicio_contrato', 'is', null),
      supabase.from('agendamentos').select('id, status, tipo, data_agendamento, equipe_id'),
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

      // Clientes por faixa
      const faixas = { 'R$100': 0, 'R$160': 0, 'R$270': 0, 'R$380': 0 };
      cList.forEach(c => {
        const v = Number(c.valor_mensal) || 0;
        if (v <= 100) faixas['R$100'] += 1;
        else if (v <= 160) faixas['R$160'] += 1;
        else if (v <= 270) faixas['R$270'] += 1;
        else faixas['R$380'] += 1;
      });
      setReceitaFaixa(Object.entries(faixas).map(([faixa, valor]) => ({ faixa, valor })));
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
    { label: 'Receita Mensal Estimada', value: formatCurrency(kpis.receitaMensal), icon: DollarSign, color: 'text-solar-orange' },
    { label: 'Painéis Monitorados', value: kpis.totalPaineis.toString(), icon: Sun, color: 'text-solar-amber' },
    { label: 'Clientes Ativos', value: kpis.totalClientes.toString(), icon: Users, color: 'text-solar-info' },
    { label: 'Manutenções Pendentes', value: kpis.agendamentosPendentes.toString(), icon: CalendarDays, color: 'text-solar-success' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="font-display text-2xl font-bold text-foreground">Dashboard</h2>

      {/* Weather Alert */}
      {weatherLoading ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Verificando previsão do tempo...</span>
        </div>
      ) : weather?.alert ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CloudRain className="w-4 h-4 text-destructive" />
              <p className="text-sm font-semibold text-destructive">
                Alerta de Chuva — {(weather.precipitation ?? weather.probability ?? 0)}% de probabilidade para amanhã
              </p>
            </div>
            <p className="text-sm text-foreground">{weather.alert}</p>
            {kpis.agendamentosPendentes > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Sugerimos adiar as {kpis.agendamentosPendentes} limpeza(s) pendente(s) para evitar retrabalho.
              </p>
            )}
          </div>
        </div>
      ) : weather && (weather.precipitation ?? weather.probability ?? 0) <= 30 ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-solar-success/10 border border-solar-success/20">
          <Sun className="w-4 h-4 text-solar-success" />
          <span className="text-sm text-foreground">
            Tempo bom em Cabo Frio — {(weather.precipitation ?? weather.probability ?? 0)}% de probabilidade de chuva. Limpezas podem prosseguir normalmente.
          </span>
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="kpi-card p-4 lg:p-6">
              <div className="flex items-center justify-between mb-2 lg:mb-3">
                <span className="text-xs lg:text-sm text-muted-foreground">{card.label}</span>
                <Icon className={`w-4 h-4 lg:w-5 lg:h-5 ${card.color}`} />
              </div>
              <p className="text-lg lg:text-2xl font-display font-bold text-foreground">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Rotas do Dia - Timeline */}
      <Suspense fallback={null}>
        <RotasDoDia />
      </Suspense>

      <div className="glass-card rounded-xl p-6 flex items-center gap-4 border-l-4 border-primary">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <DollarSign className="w-7 h-7 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Receita Mensal Total (Monitoramento)</p>
          <p className="text-3xl font-display font-bold text-foreground">{formatCurrency(kpis.receitaMensal)}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Receita por Faixa */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-solar-orange" />
            Receita por Faixa de Monitoramento
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receitaFaixa}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="faixa" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number) => [value, 'Clientes']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <Bar dataKey="valor" fill="hsl(25, 95%, 53%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status dos Agendamentos */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-solar-info" />
            Agendamentos por Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" nameKey="name" label={({ name, value }) => `${name} (${value})`}>
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Clientes por Cidade */}
      {cidadeData.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-solar-amber" />
            Clientes por Cidade
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cidadeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="clientes" fill="hsl(38, 92%, 50%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
