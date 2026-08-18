import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check, X, Clock, AlertTriangle, FileDown, PenTool, Pencil, Trash2, CalendarClock, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatCurrency } from '@/lib/formatters';
import ChecklistVT from './ChecklistVT';
import AgendaConflictDialog, { findNextAvailableDate, getPriorityBadge } from './AgendaConflictDialog';
import SignaturePad from './SignaturePad';
import RotasDoDia from './RotasDoDia';
import { triggerRouteOptimizer } from '@/hooks/useRouteOptimizer';
import { isWeekday, ensureWeekday } from '@/lib/dateUtils';
import type { Tables } from '@/integrations/supabase/types';

// A2 FIX: Only extend with computed fields, not fields already in base type
type Agendamento = Tables<'agendamentos'> & {
  cliente_nome?: string;
  equipe_nome?: string;
};

interface Equipe {
  id: string;
  nome: string;
  membros: string[];
  ativo: boolean;
}

const TIPOS = ['Limpeza Preventiva', 'Limpeza Avulsa', 'Vistoria Técnica', 'Manutenção Corretiva', 'Inspeção'];
const STATUS_OPTIONS = ['Todos', 'Pendente', 'Agendado', 'Confirmado', 'Concluído', 'Cancelado', 'Reagendado', 'Aguardando Confirmação'];

function isLimpeza(tipo: string) {
  return tipo.toLowerCase().includes('limpeza');
}

function isVT(tipo: string) {
  return tipo.toLowerCase().includes('vistoria');
}

function getEquipeLimits(agendamentosDoDia: Agendamento[], equipeId: string) {
  const doEquipe = agendamentosDoDia.filter(a => a.equipe_id === equipeId && a.status !== 'Cancelado');
  const limpezas = doEquipe.filter(a => isLimpeza(a.tipo)).length;
  const vts = doEquipe.filter(a => isVT(a.tipo)).length;
  const maxLimpezas = 2;
  let maxVTs = 4;
  if (limpezas === 1) maxVTs = 2;
  if (limpezas >= 2) maxVTs = 0;
  return { limpezas, vts, maxLimpezas, maxVTs, podeLimpeza: limpezas < maxLimpezas, podeVT: vts < maxVTs };
}

export default function AgendaPage() {
  const { isAdmin } = useAuth();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string; rua?: string; cidade?: string; uf?: string }[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictingAgendamentos, setConflictingAgendamentos] = useState<Agendamento[]>([]);
  const [loadError, setLoadError] = useState(false);

  // B2 FIX: Filters for the list
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterTipo, setFilterTipo] = useState('Todos');

  // Signature state
  const [signDialog, setSignDialog] = useState<{ open: boolean; agendamento: Agendamento | null }>({ open: false, agendamento: null });
  const [assinaturaCliente, setAssinaturaCliente] = useState<string | null>(null);
  const [savingSign, setSavingSign] = useState(false);

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<{ open: boolean; agendamento: Agendamento | null }>({ open: false, agendamento: null });
  const [editForm, setEditForm] = useState({ data_agendamento: '', hora: '', status: '', equipe_id: '', observacoes: '', prioridade: 'Normal' });
  const [editSaving, setEditSaving] = useState(false);


  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoadError(false);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const dateLimit = sixMonthsAgo.toISOString().split('T')[0];

      const [{ data: ag, error: e1 }, { data: cl, error: e2 }, { data: eq, error: e3 }] = await Promise.all([
        supabase.from('agendamentos').select('*').gte('data_agendamento', dateLimit).order('data_agendamento'),
        supabase.from('clientes').select('id, nome, rua, cidade, uf').order('nome'),
        supabase.from('equipes').select('*').eq('ativo', true).order('nome'),
      ]);
    if (e1 || e2 || e3) throw new Error('Erro ao carregar dados');
    if (eq) setEquipes(eq as Equipe[]);
    if (cl) setClientes(cl);
    if (ag && cl) {
      const eqMap = new Map((eq || []).map((e: any) => [e.id, e.nome]));
      const mapped: Agendamento[] = ag.map((a) => ({
        ...a,
        cliente_nome: cl.find(c => c.id === a.cliente_id)?.nome || 'Desconhecido',
        equipe_nome: a.equipe_id ? eqMap.get(a.equipe_id) || '' : '',
      }));
      setAgendamentos(mapped);
    }
    } catch {
      setLoadError(true);
      toast.error('Erro ao carregar dados da agenda. Verifique sua conexão.');
    }
  }


  async function handleRescheduleAndInsert(agendamentoId: string, newDate: string) {
    const { error } = await supabase.from('agendamentos').update({ data_agendamento: newDate }).eq('id', agendamentoId);
    if (error) { toast.error('Erro ao remarcar: ' + error.message); return; }
    setShowConflictDialog(false);
    toast.success('Agendamento remarcado com sucesso!');
    loadData();
  }

  async function confirmarVenda(agendamento: Agendamento) {
    if (!agendamento.equipe_id) {
      toast.error('Atribua uma equipe ao agendamento antes de confirmar a venda.');
      return;
    }
    const dataConfirmacao = new Date().toISOString().split('T')[0];
    const dataLimpeza = ensureWeekday(new Date(Date.now() + 15 * 86400000));
    const dataLimpezaStr = dataLimpeza.toISOString().split('T')[0];

    const { error } = await supabase.from('agendamentos').update({
      data_confirmacao: dataConfirmacao,
      status: 'Confirmado',
    }).eq('id', agendamento.id);
    if (error) { toast.error('Erro: ' + error.message); return; }

    if (isLimpeza(agendamento.tipo) || agendamento.tipo === 'Limpeza Avulsa') {
      await supabase.from('agendamentos').insert({
        cliente_id: agendamento.cliente_id,
        tipo: agendamento.tipo.includes('Avulsa') ? 'Limpeza Avulsa' : 'Limpeza Preventiva',
        data_agendamento: dataLimpezaStr,
        hora: '08:00',
        observacoes: `Limpeza agendada automaticamente - 15 dias após confirmação da venda em ${formatDate(dataConfirmacao)}`,
        status: 'Agendado',
        equipe_id: null,
        venda_confirmada: true,
      });
    }

    toast.success('Venda confirmada! A IA designará a equipe ideal.');
    loadData();
    triggerRouteOptimizer();
  }

  async function updateStatus(id: string, status: string) {
    if (status === 'Concluído') {
      const ag = agendamentos.find(a => a.id === id);
      if (ag && !ag.assinatura_digital_url) {
        toast.error('Colete a assinatura do cliente antes de finalizar o serviço.');
        return;
      }
    }
    const { error } = await supabase.from('agendamentos').update({ status }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Status atualizado!');
    loadData();
  }

  async function handleCollectSignature() {
    if (!signDialog.agendamento || !assinaturaCliente) return;
    setSavingSign(true);
    try {
      const blob = await (await fetch(assinaturaCliente)).blob();
      const path = `${signDialog.agendamento.cliente_id}/${Date.now()}_assinatura.png`;
      const { error } = await supabase.storage.from('assinaturas').upload(path, blob, { contentType: 'image/png' });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path);
      await supabase.from('agendamentos').update({
        assinatura_digital_url: urlData.publicUrl,
      }).eq('id', signDialog.agendamento.id);
      toast.success('Assinatura coletada com sucesso!');
      setSignDialog({ open: false, agendamento: null });
      setAssinaturaCliente(null);
      loadData();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSavingSign(false);
    }
  }

  const [selectedDateForPdf, setSelectedDateForPdf] = useState('');

  function openEditDialog(ag: Agendamento) {
    setEditDialog({ open: true, agendamento: ag });
    setEditForm({
      data_agendamento: ag.data_agendamento,
      hora: ag.hora || '08:00',
      status: ag.status,
      equipe_id: ag.equipe_id || '',
      observacoes: ag.observacoes || '',
      prioridade: ag.prioridade || 'Normal',
    });
  }

  async function handleEditSave() {
    if (!editDialog.agendamento) return;
    const ag = editDialog.agendamento;

    if (!isWeekday(editForm.data_agendamento)) {
      toast.error('Agendamentos devem ser em dias de semana (segunda a sexta).');
      return;
    }

    if (ag.status === 'Concluído' && editForm.data_agendamento !== ag.data_agendamento) {
      toast.error('Não é possível alterar a data de serviços já realizados.');
      return;
    }

    if (!isAdmin) {
      const statusChanged = editForm.status !== ag.status;
      const dateChanged = editForm.data_agendamento !== ag.data_agendamento;
      if (statusChanged || dateChanged) {
        toast.error('Apenas administradores podem alterar status ou datas.');
        return;
      }
    }

    if (editForm.status === 'Concluído' && !ag.assinatura_digital_url) {
      toast.error('Colete a assinatura do cliente antes de finalizar o serviço.');
      return;
    }

    // Validate equipe capacity limits
    if (editForm.equipe_id && editForm.status !== 'Cancelado') {
      const dayAg = agendamentos.filter(a =>
        a.data_agendamento === editForm.data_agendamento &&
        a.equipe_id === editForm.equipe_id &&
        a.status !== 'Cancelado' &&
        a.id !== ag.id
      );
      const limits = getEquipeLimits(dayAg, editForm.equipe_id);

      if (isLimpeza(ag.tipo) && !limits.podeLimpeza) {
        setConflictingAgendamentos(dayAg);
        setShowConflictDialog(true);
        toast.warning(`Equipe atingiu o limite de ${limits.maxLimpezas} limpeza(s) no dia. Escolha outro agendamento para remanejamento inteligente.`);
        return;
      }
      if (isVT(ag.tipo) && !limits.podeVT) {
        setConflictingAgendamentos(dayAg);
        setShowConflictDialog(true);
        toast.warning(`Equipe atingiu o limite de V.T.s no dia (${limits.vts}/${limits.maxVTs}). Escolha outro agendamento para remanejamento inteligente.`);
        return;
      }
    }

    setEditSaving(true);
    const { error } = await supabase.from('agendamentos').update({
      data_agendamento: editForm.data_agendamento,
      hora: editForm.hora,
      status: editForm.status,
      observacoes: editForm.observacoes || null,
      equipe_id: editForm.equipe_id || null,
      prioridade: editForm.prioridade,
    }).eq('id', ag.id);
    setEditSaving(false);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Agendamento atualizado!');
    setEditDialog({ open: false, agendamento: null });
    loadData();
  }

  async function handleDeleteAgendamento() {
    if (!editDialog.agendamento) return;
    if (!isAdmin) { toast.error('Apenas administradores podem excluir agendamentos.'); return; }
    const { error } = await supabase.from('agendamentos').delete().eq('id', editDialog.agendamento.id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Agendamento excluído!');
    setEditDialog({ open: false, agendamento: null });
    loadData();
  }

  async function generateDailyPdf(dateStr: string) {
    if (!dateStr) { toast.error('Selecione uma data para gerar o PDF'); return; }
    const dayAg = agendamentos.filter(a => a.data_agendamento === dateStr && a.status !== 'Cancelado');
    if (dayAg.length === 0) { toast.error('Nenhum agendamento para esta data'); return; }
    const clienteIds = [...new Set(dayAg.map(a => a.cliente_id))];
    const { data: inversores } = await supabase.from('inversores').select('*').in('cliente_id', clienteIds);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text('AGENDA DE SERVIÇOS DO DIA', 148.5, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text(formatDate(dateStr), 148.5, 22, { align: 'center' });
    const rows = dayAg.map(a => {
      const cl = clientes.find(c => c.id === a.cliente_id);
      const end = cl ? `${cl.rua || ''}, ${cl.cidade || ''} - ${cl.uf || ''}` : '';
      const invs = (inversores || []).filter(inv => inv.cliente_id === a.cliente_id);
      const invNomes = invs.map(inv => inv.inversor || '-').join(', ') || '-';
      const placas = invs.length > 0 ? invs.reduce((s, inv) => s + (inv.quantidade_placas || 0), 0) : 0;
      const valor = a.valor_servico ? `R$ ${Number(a.valor_servico).toFixed(2)}` : '-';
      return [a.cliente_nome || '', end, a.equipe_nome || '-', invNomes, String(placas), a.observacoes || '', valor];
    });
    autoTable(doc, {
      startY: 28,
      head: [['Cliente', 'Endereço', 'Equipe', 'Inversor', 'N° Placas', 'Observações', 'Valor do Serviço']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 55 }, 4: { cellWidth: 20, halign: 'center' as const }, 6: { cellWidth: 30, halign: 'right' as const } },
    });
    doc.save(`agenda-servicos-${dateStr}.pdf`);
    toast.success('PDF gerado!');
  }


  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const calendarAgendamentos = useMemo(() => {
    return agendamentos.filter(a => {
      if (a.tipo_contrato && !a.venda_confirmada) return false;
      return true;
    });
  }, [agendamentos]);

  const agendamentosByDate = useMemo(() => {
    const map: Record<string, Agendamento[]> = {};
    calendarAgendamentos.forEach(a => {
      const key = a.data_agendamento;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [calendarAgendamentos]);

  const filteredAgendamentos = useMemo(() => {
    return agendamentos.filter(a => {
      if (filterStatus !== 'Todos' && a.status !== filterStatus) return false;
      if (filterTipo !== 'Todos' && a.tipo !== filterTipo) return false;
      return true;
    });
  }, [agendamentos, filterStatus, filterTipo]);


  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const statusColor = (status: string) => {
    switch (status) {
      case 'Pendente': return 'bg-solar-amber/15 text-solar-amber border-solar-amber/30';
      case 'Em Andamento': return 'bg-solar-info/15 text-solar-info border-solar-info/30';
      case 'Concluído': return 'bg-solar-success/15 text-solar-success border-solar-success/30';
      case 'Cancelado': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-2 sm:gap-3">
        <h2 className="font-display text-xl sm:text-2xl font-bold">Agenda</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Input type="date" className="w-auto text-xs sm:text-sm" value={selectedDateForPdf} onChange={e => setSelectedDateForPdf(e.target.value)} />
            <Button variant="outline" size="sm" onClick={() => generateDailyPdf(selectedDateForPdf)}>
              <FileDown className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">PDF do Dia</span>
            </Button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Falha ao carregar dados da agenda.</span>
          <Button variant="outline" size="sm" onClick={loadData}>Tentar novamente</Button>
        </div>
      )}

      {/* Roteirização e GPS das Equipes em Campo */}
      <div className="mb-5">
        <RotasDoDia />
      </div>

      {/* Calendar */}
      <div className="glass-card rounded-xl p-3 sm:p-5 mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month - 1))}><ChevronLeft className="w-5 h-5" /></Button>
          <h3 className="font-display font-semibold capitalize text-sm sm:text-base">{monthName}</h3>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month + 1))}><ChevronRight className="w-5 h-5" /></Button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-1 sm:py-2 sm:hidden">{d}</div>
          ))}
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 hidden sm:block">{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayAgendamentos = agendamentosByDate[dateStr] || [];
            const isToday = new Date().toISOString().slice(0, 10) === dateStr;
            return (
              <div
                key={dateStr}
                className={`min-h-[44px] sm:min-h-[60px] rounded-lg p-1 text-xs border transition-colors ${
                  isToday ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
                }`}
              >
                <span className={`font-medium text-[10px] sm:text-xs ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>{day}</span>
                {/* On mobile show accessible touch dots/chips */}
                <div className="sm:hidden flex flex-wrap gap-1 mt-0.5">
                  {dayAgendamentos.slice(0, 3).map(a => (
                    <button
                      key={a.id}
                      onClick={() => openEditDialog(a)}
                      className="p-1 -m-0.5 flex items-center justify-center rounded focus:outline-none"
                      title={`${a.cliente_nome} - ${a.tipo}`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full inline-block ${
                          a.prioridade === 'Urgente' ? 'bg-destructive ring-1 ring-destructive/40' :
                          a.prioridade === 'Alta' ? 'bg-orange-500' :
                          a.prioridade === 'Baixa' ? 'bg-emerald-500' :
                          a.status === 'Concluído' ? 'bg-solar-success' :
                          a.status === 'Cancelado' ? 'bg-destructive' :
                          'bg-primary'
                        }`}
                      />
                    </button>
                  ))}
                  {dayAgendamentos.length > 3 && (
                    <span className="text-[8px] font-mono text-muted-foreground self-center">+{dayAgendamentos.length - 3}</span>
                  )}
                </div>
                <div className="hidden sm:block">
                    {dayAgendamentos.map(a => (
                      <div
                        key={a.id}
                        onClick={() => openEditDialog(a)}
                        className={`mt-0.5 px-1 py-0.5 rounded text-[10px] truncate cursor-pointer hover:ring-1 hover:ring-primary/50 ${
                          a.prioridade === 'Urgente' ? 'bg-destructive/30 text-destructive font-bold' :
                          a.prioridade === 'Alta' ? 'bg-orange-500/20 text-orange-600 font-semibold' :
                          a.prioridade === 'Baixa' ? 'bg-emerald-500/20 text-emerald-600' :
                          a.status === 'Concluído' ? 'bg-solar-success/20 text-solar-success' :
                          a.status === 'Cancelado' ? 'bg-destructive/20 text-destructive' :
                          a.status === 'Confirmado' ? 'bg-solar-info/20 text-solar-info' :
                          !a.equipe_id ? 'bg-solar-amber/20 text-solar-amber' :
                          'bg-primary/20 text-primary'
                        }`}
                        title={`${a.prioridade && a.prioridade !== 'Normal' ? (a.prioridade === 'Urgente' ? '🔴 ' : a.prioridade === 'Alta' ? '🟠 ' : a.prioridade === 'Baixa' ? '🟢 ' : '') : ''}${!a.equipe_id ? '⏳ Aguardando equipe — ' : ''}${a.cliente_nome} - ${a.tipo}${a.equipe_nome ? ` (${a.equipe_nome})` : ''} — Clique para editar`}
                      >
                        {a.prioridade === 'Urgente' && '🔴'}{a.prioridade === 'Alta' && '🟠'}{a.prioridade === 'Baixa' && '🟢'}{!a.equipe_id && '⏳'}{a.cliente_nome?.split(' ')[0]}
                      </div>
                    ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* List with filters */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-2 sm:gap-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1 sm:flex-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1 sm:flex-none" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                <option value="Todos">Todos os tipos</option>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-xs text-muted-foreground ml-auto">{filteredAgendamentos.length} registro(s)</span>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden divide-y divide-border/50">
              {filteredAgendamentos.map(a => (
                <div key={a.id} className="p-3 hover:bg-muted/30 transition-colors" onClick={() => openEditDialog(a)}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{a.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.data_agendamento)} {a.hora} · {a.tipo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        a.status === 'Concluído' ? 'bg-solar-success/20 text-solar-success' :
                        a.status === 'Cancelado' ? 'bg-destructive/20 text-destructive' :
                        a.status === 'Confirmado' ? 'bg-solar-info/20 text-solar-info' :
                        'bg-primary/20 text-primary'
                      }`}>
                        {a.status}
                      </span>
                      {a.prioridade && a.prioridade !== 'Normal' && getPriorityBadge(a.prioridade)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {a.equipe_nome ? <span>🏷 {a.equipe_nome}</span> : <span className="text-solar-amber">⏳ Aguardando IA</span>}
                    {a.assinatura_digital_url && <span className="text-solar-info">✓ Assinado</span>}
                  </div>
                </div>
              ))}
              {filteredAgendamentos.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum agendamento encontrado</div>
              )}
            </div>

            {/* Desktop table view */}
            <table className="w-full text-sm hidden sm:table">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Equipe</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgendamentos.map(a => {
                  const cliente = clientes.find(c => c.id === a.cliente_id);
                  const endereco = cliente ? `${cliente.rua || ''}, ${cliente.cidade || ''} - ${cliente.uf || ''}` : '';
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-3">{formatDate(a.data_agendamento)} {a.hora}</td>
                      <td className="p-3 font-medium">{a.cliente_nome}</td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">
                        <span className="flex items-center gap-1.5">
                          {a.tipo}
                          {a.prioridade && a.prioridade !== 'Normal' && getPriorityBadge(a.prioridade)}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground hidden lg:table-cell">
                        {a.equipe_nome || <span className="text-solar-amber text-xs">⏳ Aguardando IA</span>}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'Concluído' ? 'bg-solar-success/20 text-solar-success' :
                          a.status === 'Cancelado' ? 'bg-destructive/20 text-destructive' :
                          a.status === 'Confirmado' ? 'bg-solar-info/20 text-solar-info' :
                          a.status === 'Orçamento Enviado' ? 'bg-solar-amber/20 text-solar-amber' :
                          'bg-primary/20 text-primary'
                        }`}>
                          {a.status === 'Pendente' && <Clock className="w-3 h-3" />}
                          {a.status}
                        </span>
                      </td>
                       <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(a)} title="Editar">
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          {isVT(a.tipo) && (
                            <ChecklistVT
                              clienteNome={a.cliente_nome || ''}
                              clienteEndereco={endereco}
                              dataVT={formatDate(a.data_agendamento)}
                              agendamentoId={a.id}
                              clienteId={a.cliente_id}
                            />
                          )}
                          {(a.status === 'Pendente' || a.status === 'Confirmado') && !a.assinatura_digital_url && (
                            <Button variant="outline" size="sm" onClick={() => { setSignDialog({ open: true, agendamento: a }); setAssinaturaCliente(null); }} title="Coletar Assinatura do Cliente">
                              <PenTool className="w-4 h-4 mr-1" />
                              <span className="hidden sm:inline text-xs">Assinatura</span>
                            </Button>
                          )}
                          {a.assinatura_digital_url && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-solar-info/20 text-solar-info">
                              <PenTool className="w-3 h-3" />Assinado
                            </span>
                          )}
                          {(a.status === 'Pendente' || a.status === 'Confirmado') && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => updateStatus(a.id, 'Concluído')} title="Concluir">
                                <Check className="w-4 h-4 text-solar-success" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => updateStatus(a.id, 'Cancelado')} title="Cancelar">
                                <X className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAgendamentos.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum agendamento encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => { if (!open) setEditDialog({ open: false, agendamento: null }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" />Editar Agendamento</DialogTitle>
          </DialogHeader>
          {editDialog.agendamento && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{editDialog.agendamento.cliente_nome}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">{editDialog.agendamento.tipo}</p>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={editForm.data_agendamento} onChange={e => setEditForm(p => ({ ...p, data_agendamento: e.target.value }))} disabled={editDialog.agendamento.status === 'Concluído'} />
                {editDialog.agendamento.status === 'Concluído' && (
                  <p className="text-xs text-muted-foreground mt-1">Não é possível alterar a data de serviços realizados.</p>
                )}
              </div>
              <div>
                <Label>Hora</Label>
                <Input type="time" value={editForm.hora} onChange={e => setEditForm(p => ({ ...p, hora: e.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} disabled={!isAdmin}>
                  <option value="Pendente">Pendente</option>
                  <option value="Agendado">Agendado</option>
                  <option value="Confirmado">Confirmado</option>
                  <option value="Concluído">Concluído (Realizado)</option>
                  <option value="Cancelado">Cancelado</option>
                  <option value="Reagendado">Reagendado</option>
                </select>
                {!isAdmin && <p className="text-xs text-muted-foreground mt-1">Apenas administradores podem alterar o status.</p>}
              </div>
              <div>
                <Label>Equipe</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.equipe_id} onChange={e => setEditForm(p => ({ ...p, equipe_id: e.target.value }))}>
                  <option value="">Selecione (IA designa automaticamente)</option>
                  {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">A IA otimiza as rotas automaticamente a cada novo agendamento.</p>
              </div>
              <div>
                <Label>Prioridade</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editForm.prioridade} onChange={e => setEditForm(p => ({ ...p, prioridade: e.target.value }))}>
                  <option value="Baixa">🟢 Baixa</option>
                  <option value="Normal">🔵 Normal</option>
                  <option value="Alta">🟠 Alta</option>
                  <option value="Urgente">🔴 Urgente</option>
                </select>
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={editForm.observacoes} onChange={e => setEditForm(p => ({ ...p, observacoes: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between pt-2">
                {isAdmin ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4 mr-1" />Excluir</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Essa ação não pode ser desfeita. O agendamento de <strong>{editDialog.agendamento.cliente_nome}</strong> será removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAgendamento} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditDialog({ open: false, agendamento: null })}>Cancelar</Button>
                  <Button onClick={handleEditSave} disabled={editSaving}>
                    {editSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={signDialog.open} onOpenChange={(open) => { if (!open) { setSignDialog({ open: false, agendamento: null }); setAssinaturaCliente(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PenTool className="w-5 h-5 text-primary" />Coletar Assinatura do Cliente</DialogTitle>
          </DialogHeader>
          {signDialog.agendamento && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{signDialog.agendamento.cliente_nome}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Serviço</p>
                <p className="font-medium">{signDialog.agendamento.tipo} - {formatDate(signDialog.agendamento.data_agendamento)}</p>
              </div>
              <SignaturePad label="Assinatura do Cliente" onSave={setAssinaturaCliente} />
              {assinaturaCliente && (
                <div className="space-y-1">
                  <img src={assinaturaCliente} alt="Assinatura" className="h-20 border rounded" />
                  <Button variant="ghost" size="sm" onClick={() => setAssinaturaCliente(null)} className="text-xs text-muted-foreground">Refazer</Button>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSignDialog({ open: false, agendamento: null })}>Cancelar</Button>
                <Button onClick={handleCollectSignature} disabled={!assinaturaCliente || savingSign}>
                  <PenTool className="w-4 h-4 mr-1" />{savingSign ? 'Salvando...' : 'Salvar Assinatura'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AgendaConflictDialog
        open={showConflictDialog}
        onClose={() => setShowConflictDialog(false)}
        conflictingAgendamentos={conflictingAgendamentos}
        allAgendamentos={agendamentos}
        equipeId=""
        onReschedule={handleRescheduleAndInsert}
        getEquipeLimits={getEquipeLimits}
        isLimpeza={isLimpeza}
        isVT={isVT}
      />
    </div>
  );
}
