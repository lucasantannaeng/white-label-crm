import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, ArrowRight, Lightbulb, ArrowDown, Shield } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

// Priority hierarchy: Baixa (1) → Normal (2) → Alta (3) → Urgente (4)
const PRIORITY_ORDER: Record<string, number> = {
  'Baixa': 1,
  'Normal': 2,
  'Alta': 3,
  'Urgente': 4,
};

function getPriorityWeight(prioridade: string): number {
  return PRIORITY_ORDER[prioridade] ?? 2;
}

function getPriorityBadge(prioridade: string) {
  switch (prioridade) {
    case 'Baixa':
      return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">🟢 Baixa</Badge>;
    case 'Normal':
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] px-1.5 py-0">🔵 Normal</Badge>;
    case 'Alta':
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[10px] px-1.5 py-0">🟠 Alta</Badge>;
    case 'Urgente':
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">🔴 Urgente</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{prioridade}</Badge>;
  }
}

interface Agendamento {
  id: string;
  cliente_nome?: string;
  equipe_nome?: string;
  tipo: string;
  data_agendamento: string;
  hora: string | null;
  status: string;
  equipe_id?: string | null;
  prioridade?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  conflictingAgendamentos: Agendamento[];
  allAgendamentos: Agendamento[];
  equipeId: string;
  newPriority?: string;
  onReschedule: (agendamentoId: string, newDate: string) => void;
  getEquipeLimits: (agDoDia: Agendamento[], equipeId: string) => {
    limpezas: number; vts: number; maxLimpezas: number; maxVTs: number; podeLimpeza: boolean; podeVT: boolean;
  };
  isLimpeza: (tipo: string) => boolean;
  isVT: (tipo: string) => boolean;
}

/**
 * Finds the next available date for a given service type and team,
 * starting from a base date and looking up to 60 days ahead.
 */
function findNextAvailableDate(
  allAgendamentos: Agendamento[],
  equipeId: string,
  tipo: string,
  baseDate: string,
  excludeId: string | null,
  getEquipeLimits: Props['getEquipeLimits'],
  isLimpeza: Props['isLimpeza'],
  isVT: Props['isVT'],
): string | null {
  const start = new Date(baseDate + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 1; offset <= 60; offset++) {
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + offset);
    if (candidate < today) continue;
    const dow = candidate.getDay();
    if (dow === 0) continue; // Sunday

    const dateStr = candidate.toISOString().split('T')[0];
    const agDoDia = allAgendamentos.filter(
      a => a.data_agendamento === dateStr && a.equipe_id === equipeId && a.status !== 'Cancelado' && a.id !== excludeId
    );
    const limits = getEquipeLimits(agDoDia, equipeId);

    if (isLimpeza(tipo) && limits.podeLimpeza) return dateStr;
    if (isVT(tipo) && limits.podeVT) return dateStr;
    if (!isLimpeza(tipo) && !isVT(tipo) && limits.podeLimpeza) return dateStr;
  }
  return null;
}

export { findNextAvailableDate, getPriorityBadge, getPriorityWeight, PRIORITY_ORDER };

export default function AgendaConflictDialog({
  open, onClose, conflictingAgendamentos, allAgendamentos, equipeId,
  newPriority, onReschedule, getEquipeLimits, isLimpeza, isVT,
}: Props) {
  const [selectedAgendamento, setSelectedAgendamento] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');

  // Sort conflicting agendamentos by priority ASC (Baixa first — easiest to displace)
  const sortedConflicts = useMemo(() => {
    return [...conflictingAgendamentos]
      .filter(a => a.prioridade !== 'Urgente') // Urgente is never displaced
      .sort((a, b) => getPriorityWeight(a.prioridade || 'Normal') - getPriorityWeight(b.prioridade || 'Normal'));
  }, [conflictingAgendamentos]);

  const selectedItem = sortedConflicts.find(a => a.id === selectedAgendamento);

  // Suggest next available date for the selected item to be rescheduled to
  const suggestedDate = useMemo(() => {
    if (!selectedItem) return null;
    return findNextAvailableDate(
      allAgendamentos, equipeId, selectedItem.tipo,
      selectedItem.data_agendamento, selectedItem.id,
      getEquipeLimits, isLimpeza, isVT,
    );
  }, [selectedItem, allAgendamentos, equipeId, getEquipeLimits, isLimpeza, isVT]);

  // Check if the new date is valid for this agendamento's type and team
  const newDateValid = useMemo(() => {
    if (!newDate || !selectedItem) return null;
    const agDoDia = allAgendamentos.filter(
      a => a.data_agendamento === newDate && a.equipe_id === equipeId && a.status !== 'Cancelado' && a.id !== selectedItem.id
    );
    const limits = getEquipeLimits(agDoDia, equipeId);

    if (isLimpeza(selectedItem.tipo) && !limits.podeLimpeza) {
      return `Equipe já tem ${limits.limpezas} limpeza(s) neste dia.`;
    }
    if (isVT(selectedItem.tipo) && !limits.podeVT) {
      return `Equipe já atingiu o limite de V.T.s neste dia.`;
    }
    return null;
  }, [newDate, selectedItem, allAgendamentos, equipeId, getEquipeLimits, isLimpeza, isVT]);

  const newPriorityLabel = newPriority || 'Alta';

  function handleConfirm() {
    if (selectedAgendamento && newDate && !newDateValid) {
      onReschedule(selectedAgendamento, newDate);
      setSelectedAgendamento(null);
      setNewDate('');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Dia Lotado — Conflito de Prioridade
          </DialogTitle>
          <DialogDescription>
            O dia está lotado para esta equipe. O novo agendamento tem prioridade <strong>{newPriorityLabel}</strong>.
            Escolha qual agendamento de menor prioridade deseja remarcar para liberar espaço.
          </DialogDescription>
        </DialogHeader>

        {/* Priority hierarchy legend */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <ArrowDown className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Ordem de deslocamento:</span>
          <span className="font-medium">🟢 Baixa → 🔵 Normal → 🟠 Alta</span>
          <span className="ml-auto flex items-center gap-1"><Shield className="w-3 h-3" />🔴 Urgente nunca é deslocado</span>
        </div>

        {sortedConflicts.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-orange-500" />
            Todos os agendamentos do dia têm prioridade Urgente e não podem ser deslocados.
            Considere agendar para outra data.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {sortedConflicts.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelectedAgendamento(a.id); setNewDate(''); }}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedAgendamento === a.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{a.cliente_nome}</span>
                    <span className="text-xs text-muted-foreground">{a.tipo}</span>
                    {getPriorityBadge(a.prioridade || 'Normal')}
                  </div>
                  <span className="text-xs text-muted-foreground">{a.hora}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedAgendamento && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Remarcar <strong>{selectedItem?.cliente_nome}</strong> ({getPriorityBadge(selectedItem?.prioridade || 'Normal')}) para:</span>
            </div>

            {/* Date suggestion */}
            {suggestedDate && (
              <button
                onClick={() => setNewDate(suggestedDate)}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              >
                <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-primary">Sugestão: {formatDate(suggestedDate)}</span>
                  <span className="text-xs text-muted-foreground block">Próxima data disponível para esta equipe</span>
                </div>
                <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
              </button>
            )}

            <Input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            {newDateValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{newDateValid}
              </p>
            )}
            {newDate && !newDateValid && (
              <p className="text-xs text-solar-success">✓ Data disponível para remarcação</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAgendamento || !newDate || !!newDateValid || sortedConflicts.length === 0}
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Remarcar e Liberar Espaço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
