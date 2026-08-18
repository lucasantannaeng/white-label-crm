import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Wrench, Plus, X, Check, Clock, Search, Lightbulb, UserPlus } from 'lucide-react';
import { triggerRouteOptimizer } from '@/hooks/useRouteOptimizer';
import { isWeekday } from '@/lib/dateUtils';
import NovoClienteDialog from './NovoClienteDialog';

interface ServicoExtra {
  id: string;
  cliente_id: string;
  tipo_servico: string;
  descricao: string;
  valor: number;
  status: string;
  data_solicitacao: string;
  data_conclusao: string | null;
  observacoes: string | null;
  cliente_nome?: string;
}

const TIPOS_SERVICO = [
  'Limpeza Preventiva', 'Limpeza Avulsa', 'Vistoria Técnica',
  'Manutenção Corretiva', 'Inspeção', 'Troca de Inversor',
  'Troca de Módulo', 'Reparo Elétrico', 'Extensão de Cabeamento',
  'Instalação de Monitoramento', 'Outro',
];

function isLimpeza(tipo: string) {
  return tipo.toLowerCase().includes('limpeza');
}

function isServicoExtra(tipo: string) {
  const extras = ['Troca de Inversor', 'Troca de Módulo', 'Reparo Elétrico', 'Extensão de Cabeamento', 'Instalação de Monitoramento', 'Outro'];
  return extras.includes(tipo);
}

export default function ServicosExtrasPage() {
  const [servicos, setServicos] = useState<ServicoExtra[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [filtro, setFiltro] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState({
    cliente_id: '', tipo: TIPOS_SERVICO[0], descricao: '', valor: '',
    observacoes: '', data_agendamento: '', hora: '08:00',
    prioridade: 'Normal',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoadingData(true);
    const [{ data: cl, error: clientesError }, { data: sv, error: servicosError }] = await Promise.all([
      supabase.from('clientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('servicos_extras').select('*, clientes(nome)').order('data_solicitacao', { ascending: false }),
    ]);

    if (clientesError) toast.error('Erro ao carregar clientes: ' + clientesError.message);
    if (servicosError) toast.error('Erro ao carregar serviços: ' + servicosError.message);

    setClientes(cl || []);
    setServicos((sv || []).map((item: any) => ({
      ...item,
      cliente_nome: item.clientes?.nome || 'Desconhecido',
    })));
    setLoadingData(false);
  }

  function resetForm() {
    setForm({
      cliente_id: '', tipo: TIPOS_SERVICO[0], descricao: '', valor: '',
      observacoes: '', data_agendamento: '', hora: '08:00',
      prioridade: 'Normal',
    });
    setShowForm(false);
  }

  function handleToggleForm() {
    if (showForm) {
      setShowForm(false);
      return;
    }

    setShowForm(true);
    if (!loadingData && clientes.length === 0) {
      setShowNovoCliente(true);
      toast.info('Cadastre o primeiro cliente para continuar o agendamento.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente_id) { toast.error('Selecione um cliente'); return; }
    if (!form.data_agendamento) { toast.error('Selecione uma data'); return; }

    const today = new Date().toISOString().split('T')[0];
    if (form.data_agendamento < today) {
      toast.error('Não é possível agendar para uma data passada.');
      return;
    }
    if (!isWeekday(form.data_agendamento)) {
      toast.error('Agendamentos devem ser em dias de semana (segunda a sexta).');
      return;
    }

    const valor = Number(form.valor) || 0;
    const extra = isServicoExtra(form.tipo);

    // Se for serviço extra, registra na tabela servicos_extras também
    if (extra) {
      const { data: servico, error } = await supabase.from('servicos_extras').insert({
        cliente_id: form.cliente_id,
        tipo_servico: form.tipo,
        descricao: form.descricao || form.tipo,
        valor,
        observacoes: form.observacoes || null,
      }).select().single();

      if (error) { toast.error('Erro ao criar serviço: ' + error.message); return; }

      const { error: agError } = await supabase.from('agendamentos').insert({
        cliente_id: form.cliente_id,
        tipo: `Serviço Extra: ${form.tipo}`,
        data_agendamento: form.data_agendamento,
        hora: form.hora,
        status: 'Pendente',
        equipe_id: null,
        prioridade: form.prioridade,
        observacoes: `Serviço Extra #${servico?.id?.slice(0, 8)} - ${form.descricao || form.tipo}`,
        valor_servico: valor,
      });

      if (agError) toast.error('Serviço criado, mas erro ao agendar: ' + agError.message);
      else toast.success('Serviço registrado e agendado! A IA designará a equipe automaticamente.');
    } else {
      // Agendamento simples (limpeza, vistoria, etc.)
      const { error } = await supabase.from('agendamentos').insert({
        cliente_id: form.cliente_id,
        tipo: form.tipo,
        data_agendamento: form.data_agendamento,
        hora: form.hora,
        observacoes: form.observacoes || null,
        prioridade: form.prioridade,
        equipe_id: null,
        valor_servico: valor,
      });

      if (error) { toast.error('Erro: ' + error.message); return; }
      const prioridadeMsg = form.prioridade === 'Urgente' ? '🔴 ' : form.prioridade === 'Alta' ? '🟠 ' : '';
      toast.success(`${prioridadeMsg}Agendamento criado! A IA designará a equipe automaticamente.`);
    }

    resetForm();
    loadData();
    triggerRouteOptimizer();
  }

  async function updateStatus(id: string, status: string) {
    const update: any = { status };
    if (status === 'Concluído') update.data_conclusao = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('servicos_extras').update(update).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }

    // Synchronize corresponding agendamento record
    const serviceRef = `Serviço Extra #${id.slice(0, 8)}`;
    let agStatus = 'Agendado';
    if (status === 'Concluído') agStatus = 'Concluído';
    else if (status === 'Cancelado') agStatus = 'Cancelado';
    else if (status === 'Pendente') agStatus = 'Pendente';
    else if (status === 'Em Andamento') agStatus = 'Em Andamento';

    await supabase.from('agendamentos')
      .update({ status: agStatus })
      .ilike('observacoes', `%${serviceRef}%`);

    toast.success(`Status atualizado para ${status}`);
    loadData();
  }

  async function handleDelete(id: string) {
    const serviceRef = `Serviço Extra #${id.slice(0, 8)}`;
    await supabase.from('agendamentos')
      .delete()
      .ilike('observacoes', `%${serviceRef}%`);

    const { error } = await supabase.from('servicos_extras').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir serviço'); return; }
    toast.success('Serviço excluído');
    loadData();
  }

  const filtrados = useMemo(() => {
    return servicos.filter(s =>
      s.cliente_nome?.toLowerCase().includes(filtro.toLowerCase()) ||
      s.tipo_servico.toLowerCase().includes(filtro.toLowerCase()) ||
      s.status.toLowerCase().includes(filtro.toLowerCase())
    );
  }, [servicos, filtro]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'Pendente': return 'bg-solar-amber/15 text-solar-amber border-solar-amber/30';
      case 'Em Andamento': return 'bg-solar-info/15 text-solar-info border-solar-info/30';
      case 'Concluído': return 'bg-solar-success/15 text-solar-success border-solar-success/30';
      case 'Cancelado': return 'bg-destructive/15 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const mostrarDescricao = isServicoExtra(form.tipo);

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Novos Serviços</h2>

      {/* Botão único */}
      <div className="mb-4">
        <Button size="sm" onClick={handleToggleForm}>
          {showForm ? <X className="w-4 h-4 mr-1 sm:mr-2" /> : <Plus className="w-4 h-4 mr-1 sm:mr-2" />}
          {showForm ? 'Cancelar' : 'Novo Agendamento'}
        </Button>
      </div>

      {/* Formulário unificado */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-4 sm:p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
            <div>
              <Label>Cliente <span className="text-destructive">*</span></Label>
              {clientes.length > 0 ? (
                <div className="flex gap-2">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.cliente_id} onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))}>
                    <option value="">Selecione</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowNovoCliente(true)} title="Cadastrar novo cliente">
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNovoCliente(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />Cadastrar primeiro cliente
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Tipo de Serviço <span className="text-destructive">*</span></Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                {TIPOS_SERVICO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: e.target.value }))}>
                <option value="Baixa">🟢 Baixa</option>
                <option value="Normal">🔵 Normal</option>
                <option value="Alta">🟠 Alta</option>
                <option value="Urgente">🔴 Urgente</option>
              </select>
            </div>
            <div>
              <Label>Data <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.data_agendamento} onChange={e => setForm(p => ({ ...p, data_agendamento: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={form.hora} onChange={e => setForm(p => ({ ...p, hora: e.target.value }))} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
            </div>
            {mostrarDescricao && (
              <div className="sm:col-span-2 lg:col-span-3">
                <Label>Descrição do Serviço</Label>
                <Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Descreva o serviço a ser realizado..." />
              </div>
            )}
          </div>
          <div className="mb-4">
            <Label>Observações</Label>
            <Input value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Observações adicionais..." />
          </div>
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
            A equipe será designada automaticamente pela IA.
          </p>
          <Button type="submit"><Wrench className="w-4 h-4 mr-2" />Agendar</Button>
        </form>
      )}

      {/* Histórico de serviços extras */}
      <h3 className="font-display text-base sm:text-lg font-semibold text-foreground mb-3">Histórico de Serviços Extras</h3>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por cliente, tipo ou status..." className="pl-10" />
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {filtrados.map(s => (
          <div key={s.id} className="mobile-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{s.cliente_nome}</p>
                <p className="text-xs text-muted-foreground">{s.tipo_servico}</p>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${statusColor(s.status)}`}>{s.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {formatDate(s.data_solicitacao)} · {formatCurrency(s.valor)}
              </div>
              <div className="flex gap-1">
                {s.status === 'Pendente' && (
                  <Button variant="outline" size="sm" onClick={() => updateStatus(s.id, 'Em Andamento')} title="Iniciar"><Clock className="w-3.5 h-3.5" /></Button>
                )}
                {(s.status === 'Pendente' || s.status === 'Em Andamento') && (
                  <Button variant="outline" size="sm" onClick={() => updateStatus(s.id, 'Concluído')} title="Concluir"><Check className="w-3.5 h-3.5" /></Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleDelete(s.id)} title="Excluir"><X className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
        ))}
        {filtrados.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">{servicos.length === 0 ? 'Nenhum serviço extra registrado' : 'Nenhum resultado encontrado'}</div>
        )}
      </div>

      {/* Desktop table view */}
      <div className="glass-card rounded-xl overflow-hidden hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Valor</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Data</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(s => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium text-foreground">{s.cliente_nome}</td>
                <td className="p-3 text-foreground">{s.tipo_servico}</td>
                <td className="p-3 hidden md:table-cell text-foreground">{formatCurrency(s.valor)}</td>
                <td className="p-3 hidden lg:table-cell text-muted-foreground">{formatDate(s.data_solicitacao)}</td>
                <td className="p-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(s.status)}`}>{s.status}</span>
                </td>
                <td className="p-3 text-right">
                  <div className="flex gap-1 justify-end">
                    {s.status === 'Pendente' && (
                      <Button variant="outline" size="sm" onClick={() => updateStatus(s.id, 'Em Andamento')} title="Iniciar"><Clock className="w-3.5 h-3.5" /></Button>
                    )}
                    {(s.status === 'Pendente' || s.status === 'Em Andamento') && (
                      <Button variant="outline" size="sm" onClick={() => updateStatus(s.id, 'Concluído')} title="Concluir"><Check className="w-3.5 h-3.5" /></Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleDelete(s.id)} title="Excluir"><X className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{servicos.length === 0 ? 'Nenhum serviço extra registrado' : 'Nenhum resultado encontrado'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <NovoClienteDialog
        open={showNovoCliente}
        onClose={() => setShowNovoCliente(false)}
        onClienteCriado={(id, nome) => {
          setClientes(prev => [...prev, { id, nome }].sort((a, b) => a.nome.localeCompare(b.nome)));
          setForm(p => ({ ...p, cliente_id: id }));
          setShowNovoCliente(false);
        }}
      />
    </div>
  );
}
