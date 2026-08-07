import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CloudRain, Sun, CalendarDays, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

interface Agendamento {
  id: string;
  cliente_id: string;
  tipo: string;
  data_agendamento: string;
  hora: string | null;
  equipe_id: string | null;
  status: string;
  cliente_nome?: string;
}

function isLimpeza(tipo: string) {
  return tipo.toLowerCase().includes('limpeza');
}

function isVT(tipo: string) {
  return tipo.toLowerCase().includes('vistoria');
}

function getEquipeLimits(agDoDia: Agendamento[], equipeId: string) {
  const doEquipe = agDoDia.filter(a => a.equipe_id === equipeId && a.status !== 'Cancelado');
  const limpezas = doEquipe.filter(a => isLimpeza(a.tipo)).length;
  const maxLimpezas = 2;
  let maxVTs = 4;
  if (limpezas === 1) maxVTs = 2;
  if (limpezas >= 2) maxVTs = 0;
  return { limpezas, maxLimpezas, maxVTs };
}

function canFitOnDay(allAg: Agendamento[], dateStr: string, ag: Agendamento): boolean {
  if (!ag.equipe_id) return true;
  const dayAg = allAg.filter(a => a.data_agendamento === dateStr && a.status !== 'Cancelado');
  const limits = getEquipeLimits(dayAg, ag.equipe_id);
  if (isLimpeza(ag.tipo)) return limits.limpezas < limits.maxLimpezas;
  if (isVT(ag.tipo)) {
    const vts = dayAg.filter(a => a.equipe_id === ag.equipe_id && isVT(a.tipo)).length;
    return vts < limits.maxVTs;
  }
  return true;
}

function findNextAvailableDay(allAg: Agendamento[], startDate: string, ag: Agendamento, maxDays = 14): string {
  const d = new Date(startDate + 'T12:00:00');
  for (let i = 1; i <= maxDays; i++) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 0) continue; // skip sunday
    const dateStr = d.toISOString().split('T')[0];
    if (canFitOnDay(allAg, dateStr, ag)) return dateStr;
  }
  // fallback: tomorrow
  const fallback = new Date(startDate + 'T12:00:00');
  fallback.setDate(fallback.getDate() + 1);
  return fallback.toISOString().split('T')[0];
}

export default function WeatherPopup({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [probability, setProbability] = useState(0);
  const [todayAgendamentos, setTodayAgendamentos] = useState<Agendamento[]>([]);
  const [allAgendamentos, setAllAgendamentos] = useState<Agendamento[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [remarking, setRemarking] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAdmin || checked) return;
    const sessionKey = `weather_checked_${new Date().toISOString().split('T')[0]}`;
    if (sessionStorage.getItem(sessionKey)) { setChecked(true); return; }
    checkWeatherToday();
    sessionStorage.setItem(sessionKey, '1');
    setChecked(true);
  }, [isAdmin, checked]);

  async function checkWeatherToday() {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-22.88&longitude=-42.02&daily=precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=1');
      const data = await res.json();
      const prob = data?.daily?.precipitation_probability_max?.[0] || 0;
      setProbability(prob);

      if (prob < 75) return; // below 75% = no concern

      const today = new Date().toISOString().split('T')[0];
      const [{ data: ag }, { data: cl }] = await Promise.all([
        supabase.from('agendamentos').select('*').order('data_agendamento'),
        supabase.from('clientes').select('id, nome'),
      ]);

      if (!ag || !cl) return;
      const clMap = new Map(cl.map(c => [c.id, c.nome]));
      const allMapped = ag.map((a: any) => ({ ...a, cliente_nome: clMap.get(a.cliente_id) || 'Desconhecido' }));
      setAllAgendamentos(allMapped);

      const todayLimpezas = allMapped.filter((a: Agendamento) =>
        a.data_agendamento === today && isLimpeza(a.tipo) && a.status === 'Pendente'
      );

      if (todayLimpezas.length === 0) return;

      setTodayAgendamentos(todayLimpezas);

      const sugs: Record<string, string> = {};
      todayLimpezas.forEach((a: Agendamento) => {
        sugs[a.id] = findNextAvailableDay(allMapped, today, a);
      });
      setSuggestions(sugs);
      setOpen(true);
    } catch {
      // silently fail
    }
  }

  async function handleRescheduleAll() {
    setRemarking(true);
    try {
      for (const ag of todayAgendamentos) {
        const newDate = suggestions[ag.id];
        if (!newDate) continue;
        await supabase.from('agendamentos').update({
          data_agendamento: newDate,
          observacoes: `Remarcado por previsão de chuva (${probability}% de probabilidade). Data original: ${formatDate(ag.data_agendamento)}`,
        }).eq('id', ag.id);
      }
      toast.success(`${todayAgendamentos.length} limpeza(s) remarcada(s) com sucesso!`);
      setOpen(false);
    } catch (err: any) {
      toast.error('Erro ao remarcar: ' + err.message);
    } finally {
      setRemarking(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <CloudRain className="w-5 h-5" />
            Alerta de Chuva — {probability}% de probabilidade hoje
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          A probabilidade de chuva hoje em Cabo Frio é de {probability}%. Recomendamos remarcar as limpezas abaixo para evitar retrabalho.
        </p>

        <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
          {todayAgendamentos.map(ag => (
            <div key={ag.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border text-sm">
              <div>
                <p className="font-medium">{ag.cliente_nome}</p>
                <p className="text-xs text-muted-foreground">{ag.tipo} • {ag.hora || '08:00'}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-destructive line-through">{formatDate(ag.data_agendamento)}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-solar-success font-medium">{formatDate(suggestions[ag.id])}</span>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            <Sun className="w-4 h-4 mr-1" />Manter Hoje
          </Button>
          <Button onClick={handleRescheduleAll} disabled={remarking}>
            {remarking ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CalendarDays className="w-4 h-4 mr-1" />}
            Remarcar Todas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
