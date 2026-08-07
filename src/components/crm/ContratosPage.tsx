import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileText, Download, Upload, Trash2, AlertTriangle, Eye, PenTool, CheckCircle, CalendarDays } from 'lucide-react';
import { formatCurrency, formatDate, dataExtenso } from '@/lib/formatters';
import { gerarContratoLimpezaDocx, gerarContratoMonitoramentoDocx } from '@/lib/contractUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Tables } from '@/integrations/supabase/types';
import SignaturePad from './SignaturePad';
import { triggerRouteOptimizer } from '@/hooks/useRouteOptimizer';
import { ensureWeekday } from '@/lib/dateUtils';

type Cliente = Tables<'clientes'>;
type Categoria = 'monitoramento' | 'limpeza';

interface ContratoResumo {
  cliente: Cliente;
  tipo: Categoria;
  valores: Record<string, string>;
}

interface ContratoAgendamento {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  tipo: string;
  tipo_contrato: string | null;
  status: string;
  venda_confirmada: boolean;
  data_agendamento: string;
  valor_servico: number | null;
  observacoes: string | null;
  assinatura_digital_url: string | null;
  created_at: string;
}

export default function ContratosPage() {
  const { isAdmin, role } = useAuth();
  const isTecnico = role === 'tecnico';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [categoria, setCategoria] = useState<Categoria>('monitoramento');
  const [uploading, setUploading] = useState(false);
  const [resumo, setResumo] = useState<ContratoResumo | null>(null);
  const [contratos, setContratos] = useState<ContratoAgendamento[]>([]);
  const [filtroContrato, setFiltroContrato] = useState<'todos' | 'monitoramento' | 'limpeza'>('todos');
  const [equipes, setEquipes] = useState<{ id: string; nome: string }[]>([]);
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([]);

  // Confirm sale dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; contrato: ContratoAgendamento | null }>({ open: false, contrato: null });
  const [dataLimpeza, setDataLimpeza] = useState('');
  const [equipeIdConfirm, setEquipeIdConfirm] = useState('');
  const [vendedorIdConfirm, setVendedorIdConfirm] = useState('');

  // Contract generation vendedor
  const [vendedorIdContrato, setVendedorIdContrato] = useState('');

  // Signature dialog state
  const [signDialog, setSignDialog] = useState<{ open: boolean; cliente: Cliente | null }>({ open: false, cliente: null });
  const [signDate, setSignDate] = useState('');
  const [assinaturaCliente, setAssinaturaCliente] = useState<string | null>(null);
  const [savingSign, setSavingSign] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: c }, { data: t }, { data: ag }, { data: eq }, { data: vend }] = await Promise.all([
      supabase.from('clientes').select('*').eq('ativo', true).order('nome'),
      supabase.from('templates_contrato').select('*').eq('ativo', true),
      supabase.from('agendamentos').select('*').not('tipo_contrato', 'is', null).order('created_at', { ascending: false }),
      supabase.from('equipes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('vendedores').select('id, nome').eq('ativo', true).order('nome'),
    ]);
    if (c) setClientes(c);
    if (t) setTemplates(t);
    if (eq) setEquipes(eq);
    if (vend) setVendedores(vend);
    if (ag && c) {
      const mapped = (ag as any[]).map(a => ({
        ...a,
        cliente_nome: c.find(cl => cl.id === a.cliente_id)?.nome || 'Desconhecido',
        venda_confirmada: a.venda_confirmada ?? false,
      }));
      setContratos(mapped);
    }
  }

  const templateAtual = templates.find(t => t.tipo === categoria);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) { toast.error('Apenas arquivos .docx são aceitos'); return; }
    setUploading(true);
    const fileName = categoria === 'monitoramento' ? 'modelo-monitoramento.docx' : 'modelo-limpeza.docx';
    const { error: uploadError } = await supabase.storage.from('contratos').upload(fileName, file, { upsert: true });
    if (uploadError) { toast.error('Erro no upload: ' + uploadError.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('contratos').getPublicUrl(fileName);
    if (templateAtual) {
      await supabase.from('templates_contrato').update({ url: urlData.publicUrl, nome: fileName }).eq('id', templateAtual.id);
    } else {
      await supabase.from('templates_contrato').insert({ nome: fileName, url: urlData.publicUrl, tipo: categoria });
    }
    toast.success('Template enviado com sucesso!');
    setUploading(false);
    loadData();
    e.target.value = '';
  }

  async function removeTemplate() {
    if (!templateAtual) return;
    const fileName = categoria === 'monitoramento' ? 'modelo-monitoramento.docx' : 'modelo-limpeza.docx';
    await supabase.storage.from('contratos').remove([fileName]);
    await supabase.from('templates_contrato').delete().eq('id', templateAtual.id);
    toast.success('Template removido');
    loadData();
  }

  function validarCliente(cliente: Cliente): string | null {
    if (!cliente.documento) return 'Cliente sem CPF/CNPJ cadastrado. Atualize o cadastro antes de gerar o contrato.';
    if (!cliente.rua || !cliente.cidade || !cliente.uf) return 'Cliente sem endereço completo cadastrado. Preencha o endereço antes de gerar o contrato.';
    if (!cliente.cep) return 'Cliente sem CEP cadastrado. Preencha o CEP antes de gerar o contrato.';
    if (categoria === 'limpeza' && (!cliente.quantidade_placas || cliente.quantidade_placas <= 0)) {
      return 'Cliente sem quantidade de módulos/placas cadastrada. Atualize os dados técnicos antes de gerar o contrato.';
    }
    return null;
  }

  function mostrarResumo(cliente: Cliente) {
    const erro = validarCliente(cliente);
    if (erro) { toast.error(erro, { icon: <AlertTriangle className="w-4 h-4" /> }); return; }
    if (!templateAtual) { toast.error('Nenhum template configurado para esta categoria'); return; }
    const valores: Record<string, string> = {};
    if (categoria === 'monitoramento') {
      valores['Tipo'] = 'Monitoramento Mensal';
      valores['Valor Mensal'] = formatCurrency(Number(cliente.valor_mensal) || 0);
      valores['Duração'] = `${cliente.duracao_meses || 12} meses`;
      valores['Início'] = cliente.inicio_contrato ? new Date(cliente.inicio_contrato).toLocaleDateString('pt-BR') : '-';
      valores['Término'] = cliente.termino_contrato ? new Date(cliente.termino_contrato).toLocaleDateString('pt-BR') : '-';
    } else {
      valores['Tipo'] = 'Limpeza Avulsa';
      valores['Módulos'] = String(cliente.quantidade_placas || 0);
      valores['Valor'] = 'Calculado na aba Limpeza de Módulos';
    }
    valores['Data'] = dataExtenso(new Date());
    setResumo({ cliente, tipo: categoria, valores });
  }

  async function confirmarGeracaoContrato() {
    if (!resumo || !templateAtual) return;
    const { cliente } = resumo;
    try {
      const clienteData = {
        nome: cliente.nome, rua: cliente.rua || '', numero: cliente.numero || '',
        bairro: cliente.bairro || '', cidade: cliente.cidade || '', uf: cliente.uf || '',
        cep: cliente.cep || '', documento: cliente.documento,
      };

      // A8 FIX: Use shared contract utilities
      if (categoria === 'monitoramento') {
        await gerarContratoMonitoramentoDocx({
          cliente: clienteData,
          valorMensal: Number(cliente.valor_mensal) || 0,
          duracaoMeses: cliente.duracao_meses || 12,
          templateUrl: templateAtual.url,
        });
      } else {
        const qtd = cliente.quantidade_placas || 0;
        const { data: valorTotal } = await supabase.rpc('calcular_preco_limpeza', { p_quantidade_modulos: qtd });
        const total = Number(valorTotal) || 0;
        await gerarContratoLimpezaDocx({
          cliente: clienteData,
          qtdModulos: qtd,
          valorTotal: total,
          valorMedio: qtd > 0 ? total / qtd : 0,
          templateUrl: templateAtual.url,
        });
      }

      const now = new Date();

      // Update vendedor on client if selected
      if (vendedorIdContrato) {
        await supabase.from('clientes').update({ vendedor_id: vendedorIdContrato }).eq('id', cliente.id);
      }

      await supabase.from('agendamentos').insert({
        cliente_id: cliente.id,
        tipo: categoria === 'monitoramento' ? 'Monitoramento' : 'Limpeza Avulsa',
        data_agendamento: now.toISOString().split('T')[0],
        status: 'Aguardando Confirmação',
        venda_confirmada: false,
        tipo_contrato: categoria,
        observacoes: `Contrato de ${categoria} gerado em ${now.toLocaleDateString('pt-BR')}${vendedorIdContrato ? ` | Vendedor: ${vendedores.find(v => v.id === vendedorIdContrato)?.nome || ''}` : ''}`,
        valor_servico: categoria === 'monitoramento' ? (Number(cliente.valor_mensal) || 0) : 0,
      });

      toast.success('Contrato gerado! Registro criado na aba Contratos.');
      setResumo(null);
      loadData();
      triggerRouteOptimizer();
    } catch (err: any) {
      toast.error('Erro ao gerar contrato: ' + err.message);
    }
  }

  // Confirmar Venda
  function openConfirmDialog(contrato: ContratoAgendamento) {
    setConfirmDialog({ open: true, contrato });
    const defaultDate = new Date();
    // Limpeza avulsa: 15 dias após a venda; Monitoramento: 7 dias (VT inicial)
    if (contrato.tipo_contrato === 'limpeza') {
      defaultDate.setDate(defaultDate.getDate() + 15);
    } else {
      defaultDate.setDate(defaultDate.getDate() + 7);
    }
    const weekdayDate = ensureWeekday(defaultDate);
    setDataLimpeza(weekdayDate.toISOString().split('T')[0]);
    setEquipeIdConfirm('');
  }

  async function handleConfirmarVenda() {
    if (!confirmDialog.contrato || !dataLimpeza) { toast.error('Informe a data do serviço'); return; }
    const contrato = confirmDialog.contrato;

    // Validate weekday
    const selectedDay = new Date(dataLimpeza + 'T12:00:00').getDay();
    if (selectedDay === 0 || selectedDay === 6) {
      toast.error('Agendamentos devem ser em dias de semana (segunda a sexta).');
      return;
    }

    const { error } = await supabase.from('agendamentos').update({
      venda_confirmada: true,
      status: 'Confirmado',
      data_confirmacao: new Date().toISOString().split('T')[0],
      data_agendamento: dataLimpeza,
      equipe_id: equipeIdConfirm || null,
    }).eq('id', contrato.id);

    if (error) { toast.error('Erro: ' + error.message); return; }

    // Update vendedor on client if selected
    if (vendedorIdConfirm) {
      await supabase.from('clientes').update({ vendedor_id: vendedorIdConfirm }).eq('id', contrato.cliente_id);
    }

    const dataConfirmacao = new Date().toISOString().split('T')[0];

    if (contrato.tipo_contrato === 'monitoramento') {
      const dataVT = ensureWeekday(new Date(Date.now() + 7 * 86400000));
      const dataLimpPrev = ensureWeekday((() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return d; })());
      await Promise.all([
        supabase.from('agendamentos').insert({
          cliente_id: contrato.cliente_id, tipo: 'Vistoria Técnica',
          data_agendamento: dataVT.toISOString().split('T')[0],
          hora: '08:00', status: 'Agendado', venda_confirmada: true,
          equipe_id: null,
          observacoes: `V.T. automática — 7 dias após cadastro/confirmação em ${formatDate(dataConfirmacao)}.`,
        }),
        supabase.from('agendamentos').insert({
          cliente_id: contrato.cliente_id, tipo: 'Limpeza Preventiva',
          data_agendamento: dataLimpPrev.toISOString().split('T')[0],
          hora: '08:00', status: 'Agendado', venda_confirmada: true,
          equipe_id: null,
          observacoes: `1ª Limpeza Preventiva — 3 meses após assinatura de contrato em ${formatDate(dataConfirmacao)}.`,
        }),
      ]);
    }

    triggerRouteOptimizer();

    toast.success(`Venda confirmada! A IA designará a equipe ideal. Serviço em ${formatDate(dataLimpeza)}`);
    setConfirmDialog({ open: false, contrato: null });
    loadData();
  }

  // Signature
  function openSignDialog(cliente: Cliente) {
    setSignDialog({ open: true, cliente });
    setSignDate(new Date().toISOString().split('T')[0]);
    setAssinaturaCliente(null);
  }

  async function handleSaveContractSignature() {
    if (!signDialog.cliente || !assinaturaCliente) return;
    setSavingSign(true);
    try {
      const blob = await (await fetch(assinaturaCliente)).blob();
      const path = `${signDialog.cliente.id}/contratos/assinatura_${categoria}_${Date.now()}.png`;
      const { error } = await supabase.storage.from('documentos-clientes').upload(path, blob, { contentType: 'image/png' });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('documentos-clientes').getPublicUrl(path);
      await supabase.from('documentos_cliente').insert({
        cliente_id: signDialog.cliente.id,
        tipo: `contrato_${categoria}_assinado`,
        nome: `Assinatura Contrato ${categoria} - ${signDialog.cliente.nome} - ${signDate}`,
        url: urlData.publicUrl,
        assinatura_cliente_url: urlData.publicUrl,
      });
      toast.success('Assinatura do contrato salva com sucesso!');
      setSignDialog({ open: false, cliente: null });
      setAssinaturaCliente(null);
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSavingSign(false);
    }
  }

  const tagsMonitoramento = ['{nome_cliente}', '{rua}', '{numero}', '{bairro}', '{cidade}', '{uf}', '{cep}', '{documento}', '{valor_mensal}', '{duracao_meses}', '{valor_extenso}', '{duracao_extenso}', '{data_extenso}'];
  const tagsLimpeza = ['{nome_cliente}', '{rua}', '{numero}', '{bairro}', '{cidade}', '{uf}', '{cep}', '{documento}', '{qtd_modulos}', '{valor_total_limpeza}', '{valor_por_modulo}', '{forma_pagamento}', '{data_extenso}'];
  const tagsAtuais = categoria === 'monitoramento' ? tagsMonitoramento : tagsLimpeza;

  // Filter contratos
  const contratosFiltrados = contratos.filter(c => {
    if (filtroContrato === 'todos') return true;
    return c.tipo_contrato === filtroContrato;
  });

  function getStatusColor(contrato: ContratoAgendamento) {
    if (contrato.assinatura_digital_url && contrato.status === 'Concluído') return 'bg-blue-500/20 text-blue-600';
    if (contrato.venda_confirmada) return 'bg-emerald-500/20 text-emerald-600';
    return 'bg-muted text-muted-foreground';
  }

  function getStatusLabel(contrato: ContratoAgendamento) {
    if (contrato.assinatura_digital_url && contrato.status === 'Concluído') return 'Finalizado c/ Assinatura';
    if (contrato.venda_confirmada) return 'Venda Confirmada';
    return 'Proposta';
  }

  // For técnicos: only show limpeza contracts that need signature
  if (isTecnico) {
    const limpezaContratos = contratos.filter(c => c.tipo_contrato === 'limpeza' && c.venda_confirmada && !c.assinatura_digital_url);
    return (
      <div className="animate-fade-in">
        <h2 className="font-display text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Contratos de Limpeza — Assinatura</h2>
        <p className="text-sm text-muted-foreground mb-4">Contratos de limpeza aguardando assinatura do cliente após a conclusão do serviço.</p>
        {limpezaContratos.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">Nenhum contrato de limpeza pendente de assinatura.</div>
        ) : (
          <div className="space-y-3">
            {limpezaContratos.map(c => {
              const cliente = clientes.find(cl => cl.id === c.cliente_id);
              return (
                <div key={c.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.cliente_nome}</p>
                    <p className="text-xs text-muted-foreground">Limpeza · {formatDate(c.data_agendamento)}</p>
                  </div>
                  {cliente && (
                    <Button variant="outline" size="sm" onClick={() => openSignDialog(cliente)}>
                      <PenTool className="w-4 h-4 mr-1" />Coletar Assinatura
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Signature Dialog */}
        <Dialog open={signDialog.open} onOpenChange={(open) => { setSignDialog({ open, cliente: open ? signDialog.cliente : null }); if (!open) setAssinaturaCliente(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assinatura do Contrato de Limpeza</DialogTitle>
            </DialogHeader>
            {signDialog.cliente && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{signDialog.cliente.nome}</p>
                </div>
                <div>
                  <Label>Data da Assinatura</Label>
                  <Input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} />
                </div>
                <SignaturePad label="Assinatura do Cliente" onSave={setAssinaturaCliente} />
                {assinaturaCliente && (
                  <div className="space-y-1">
                    <img src={assinaturaCliente} alt="Assinatura" className="h-20 border rounded" />
                    <Button variant="ghost" size="sm" onClick={() => setAssinaturaCliente(null)} className="text-xs text-muted-foreground">Refazer assinatura</Button>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSignDialog({ open: false, cliente: null })}>Cancelar</Button>
                  <Button onClick={handleSaveContractSignature} disabled={!assinaturaCliente || savingSign}>
                    <PenTool className="w-4 h-4 mr-1" />{savingSign ? 'Salvando...' : 'Salvar Assinatura'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
     <div className="animate-fade-in">
       <h2 className="font-display text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Contratos</h2>

       {/* Sub-abas para gerar contratos */}
       <div className="flex gap-1 mb-4 sm:mb-6 bg-muted/50 rounded-lg p-1 w-fit overflow-x-auto">
         <button onClick={() => { setCategoria('monitoramento'); setResumo(null); }}
           className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${categoria === 'monitoramento' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
           Monitoramento
         </button>
         <button onClick={() => { setCategoria('limpeza'); setResumo(null); }}
           className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${categoria === 'limpeza' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
           Limpeza Avulsa
         </button>
       </div>

      {/* Template management - Admin only */}
      {isAdmin && (
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-display font-semibold mb-4">
            Template: {categoria === 'monitoramento' ? 'Monitoramento' : 'Limpeza Avulsa'}
          </h3>
          {templateAtual ? (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">{templateAtual.nome}</p>
                  <p className="text-xs text-muted-foreground">Template ativo</p>
                </div>
              </div>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept=".docx" className="hidden" onChange={handleUpload} disabled={uploading} />
                  <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />Substituir</span></Button>
                </label>
                <Button variant="outline" size="sm" onClick={removeTemplate}><Trash2 className="w-4 h-4 mr-1" />Remover</Button>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">Envie o arquivo <strong>{categoria === 'monitoramento' ? 'modelo-monitoramento.docx' : 'modelo-limpeza.docx'}</strong></p>
              <label className="cursor-pointer">
                <input type="file" accept=".docx" className="hidden" onChange={handleUpload} disabled={uploading} />
                <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />{uploading ? 'Enviando...' : 'Enviar Template'}</span></Button>
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">Tags suportadas: {tagsAtuais.join(', ')}</p>
        </div>
      )}

      {/* Resumo / Preview - Admin only */}
      {isAdmin && resumo && (
        <div className="glass-card rounded-xl p-6 mb-6 border-2 border-primary/30">
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />Resumo do Contrato
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div><p className="text-xs text-muted-foreground">Cliente</p><p className="font-medium">{resumo.cliente.nome}</p></div>
           {Object.entries(resumo.valores).map(([k, v]) => (
              <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium text-sm">{v}</p></div>
            ))}
          </div>
          <div className="mb-4">
            <Label>Vendedor Responsável</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={vendedorIdContrato} onChange={e => setVendedorIdContrato(e.target.value)}>
              <option value="">Sem vendedor</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <Button onClick={confirmarGeracaoContrato}><Download className="w-4 h-4 mr-2" />Confirmar e Baixar</Button>
            <Button variant="outline" onClick={() => setResumo(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista de clientes para gerar contratos */}
      {isAdmin && (
        <div className="glass-card rounded-xl overflow-hidden mb-8">
          <div className="p-3 border-b border-border bg-muted/30">
            <h3 className="font-display font-semibold text-sm">Gerar Novo Contrato</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Documento</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">
                  {categoria === 'monitoramento' ? 'Valor Mensal' : 'Módulos'}
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{c.nome}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{c.documento}</td>
                  <td className="p-3 hidden md:table-cell">
                    {categoria === 'monitoramento' ? formatCurrency(Number(c.valor_mensal) || 0) : `${c.quantidade_placas || 0} placas`}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="outline" size="sm" onClick={() => mostrarResumo(c)} disabled={!templateAtual}>
                        <Download className="w-4 h-4 mr-1" />Gerar Contrato
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openSignDialog(c)}>
                        <PenTool className="w-4 h-4 mr-1" />Assinar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nenhum cliente ativo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lista unificada de contratos gerados */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <h3 className="font-display font-semibold text-sm sm:text-base">Contratos Gerados</h3>
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto">
            {(['todos', 'monitoramento', 'limpeza'] as const).map(f => (
              <button key={f} onClick={() => setFiltroContrato(f)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${filtroContrato === f ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {f === 'todos' ? 'Todos' : f === 'monitoramento' ? 'Monitoramento' : 'Limpeza'}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden divide-y divide-border/50">
          {contratosFiltrados.map(c => (
            <div key={c.id} className="p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{c.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground capitalize">{c.tipo_contrato || '-'} · {formatDate(c.created_at.split('T')[0])}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${getStatusColor(c)}`}>
                  {getStatusLabel(c)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.valor_servico ? formatCurrency(c.valor_servico) : '-'}</span>
                {!c.venda_confirmada && isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => openConfirmDialog(c)} className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 text-xs h-7">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />Confirmar
                  </Button>
                )}
              </div>
            </div>
          ))}
          {contratosFiltrados.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhum contrato gerado</div>
          )}
        </div>

        {/* Desktop table view */}
        <table className="w-full text-sm hidden sm:table">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
              <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Valor</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contratosFiltrados.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="p-3 text-muted-foreground">{formatDate(c.created_at.split('T')[0])}</td>
                <td className="p-3 font-medium">{c.cliente_nome}</td>
                <td className="p-3 text-muted-foreground hidden md:table-cell capitalize">{c.tipo_contrato || '-'}</td>
                <td className="p-3 hidden md:table-cell">{c.valor_servico ? formatCurrency(c.valor_servico) : '-'}</td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(c)}`}>
                    {getStatusLabel(c)}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {!c.venda_confirmada && isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => openConfirmDialog(c)} className="text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                      <CheckCircle className="w-4 h-4 mr-1" />Confirmar Venda
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {contratosFiltrados.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum contrato gerado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm Sale Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) setConfirmDialog({ open: false, contrato: null }); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary" />Confirmar Venda</DialogTitle>
          </DialogHeader>
          {confirmDialog.contrato && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{confirmDialog.contrato.cliente_nome}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium capitalize">{confirmDialog.contrato.tipo_contrato}</p>
              </div>
              <div>
                <Label>Data do Serviço {confirmDialog.contrato.tipo_contrato === 'limpeza' ? '(15 dias após a venda)' : '(1ª visita — D+7)'}</Label>
                <Input type="date" value={dataLimpeza} onChange={e => setDataLimpeza(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                {confirmDialog.contrato.tipo_contrato === 'monitoramento' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ao confirmar, serão criados automaticamente: VT em 7 dias e Limpeza Preventiva em 3 meses.
                  </p>
                )}
              </div>
              <div>
                <Label>Equipe Responsável <span className="text-destructive">*</span></Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={equipeIdConfirm}
                  onChange={e => setEquipeIdConfirm(e.target.value)}
                >
                  <option value="">Selecione uma equipe</option>
                  {equipes.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                </select>
                {!equipeIdConfirm && <p className="text-xs text-destructive mt-1">Obrigatório</p>}
              </div>
              <div>
                <Label>Vendedor</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={vendedorIdConfirm}
                  onChange={e => setVendedorIdConfirm(e.target.value)}
                >
                  <option value="">Sem vendedor</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={handleConfirmarVenda}>
                  <CheckCircle className="w-4 h-4 mr-1" />Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={signDialog.open} onOpenChange={(open) => { setSignDialog({ open, cliente: open ? signDialog.cliente : null }); if (!open) setAssinaturaCliente(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assinatura do Contrato</DialogTitle>
          </DialogHeader>
          {signDialog.cliente && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{signDialog.cliente.nome}</p>
              </div>
              <div>
                <Label>Data da Assinatura</Label>
                <Input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} />
              </div>
              <SignaturePad label="Assinatura do Cliente" onSave={setAssinaturaCliente} />
              {assinaturaCliente && (
                <div className="space-y-1">
                  <img src={assinaturaCliente} alt="Assinatura" className="h-20 border rounded" />
                  <Button variant="ghost" size="sm" onClick={() => setAssinaturaCliente(null)} className="text-xs text-muted-foreground">Refazer assinatura</Button>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSignDialog({ open: false, cliente: null })}>Cancelar</Button>
                <Button onClick={handleSaveContractSignature} disabled={!assinaturaCliente || savingSign}>
                  <PenTool className="w-4 h-4 mr-1" />{savingSign ? 'Salvando...' : 'Salvar Assinatura'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
