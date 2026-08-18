import { useEffect, useState } from 'react';
import { triggerRouteOptimizer } from '@/hooks/useRouteOptimizer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, maskPhone, maskCPFCNPJ, maskCEP } from '@/lib/formatters';
import { gerarContratoLimpezaDocx } from '@/lib/contractUtils';
import { SprayCan, FileText, Download, User, UserPlus, TrendingDown, Percent, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Cliente = Tables<'clientes'>;
type ClienteMode = 'cadastrado' | 'prospect';
type DescontoTipo = 'percentual' | 'fixo';

interface ProspectData {
  nome: string;
  telefone: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  documento: string;
}

interface FaixaPreco {
  id: string;
  faixa_inicio: number;
  faixa_fim: number | null;
  valor: number;
  label: string | null;
  ordem: number;
}

export default function CalculadoraPage() {
  const { isAdmin, role } = useAuth();
  const isTecnico = role === 'tecnico';
  const [modulos, setModulos] = useState<number>(0);
  const [resultado, setResultado] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteMode, setClienteMode] = useState<ClienteMode>('cadastrado');
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [prospect, setProspect] = useState<ProspectData>({ nome: '', telefone: '', rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '', documento: '' });
  const [templates, setTemplates] = useState<Tables<'templates_contrato'>[]>([]);
  const [faixasLimpeza, setFaixasLimpeza] = useState<FaixaPreco[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [descontoTipo, setDescontoTipo] = useState<DescontoTipo>('percentual');
  const [descontoValor, setDescontoValor] = useState<number>(0);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoadError(false);
      const [{ data: c, error: e1 }, { data: t, error: e2 }, { data: f, error: e3 }] = await Promise.all([
        supabase.from('clientes').select('*').eq('ativo', true).order('nome'),
        supabase.from('templates_contrato').select('*').eq('ativo', true).eq('tipo', 'limpeza'),
        supabase.from('faixas_preco').select('*').eq('tipo', 'limpeza').order('ordem'),
      ]);
      if (e1 || e2 || e3) throw new Error('Erro ao carregar dados');
      if (c) setClientes(c);
      if (t) setTemplates(t);
      if (f) setFaixasLimpeza(f);
    } catch {
      setLoadError(true);
      toast.error('Erro ao carregar dados. Verifique sua conexão.');
    }
  }

  const selectedCliente = clientes.find(c => c.id === selectedClienteId);
  const clienteNome = clienteMode === 'cadastrado' ? selectedCliente?.nome || '' : prospect.nome;
  const clienteTelefone = clienteMode === 'cadastrado' ? selectedCliente?.telefone || '' : prospect.telefone;

  async function calcular() {
    if (modulos <= 0) { toast.error('Informe a quantidade de módulos'); return; }
    if (clienteMode === 'cadastrado' && !selectedClienteId) { toast.error('Selecione um cliente'); return; }
    if (clienteMode === 'prospect' && !prospect.nome) { toast.error('Informe o nome do prospect'); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('calcular_preco_limpeza', { p_quantidade_modulos: modulos });
    setLoading(false);
    if (error) { toast.error('Erro ao calcular: ' + error.message); return; }
    setResultado(data as number);
  }

  const safeDescontoValor = Math.max(0, Number(descontoValor) || 0);
  const descontoCalculado = resultado !== null
    ? descontoTipo === 'percentual'
      ? resultado * (Math.min(100, safeDescontoValor) / 100)
      : Math.min(resultado, safeDescontoValor)
    : 0;
  const resultadoComDesconto = resultado !== null ? Math.max(0, resultado - descontoCalculado) : null;
  const valorMedio = resultadoComDesconto !== null && modulos > 0 ? resultadoComDesconto / modulos : 0;
  const precoMaximo = modulos * (faixasLimpeza[0]?.valor || 50);
  const economia = resultadoComDesconto !== null ? precoMaximo - resultadoComDesconto : 0;

  async function salvarOrcamento() {
    if (resultadoComDesconto === null) return;
    const descontoInfo = descontoValor > 0 ? ` (Desconto: ${descontoTipo === 'percentual' ? `${descontoValor}%` : formatCurrency(descontoValor)})` : '';
    const obs = `Limpeza de ${modulos} módulos - ${formatCurrency(resultadoComDesconto)}${descontoInfo} (${clienteMode === 'prospect' ? `Prospect: ${prospect.nome} / ${prospect.telefone}` : `Cliente: ${clienteNome}`})`;
    
    let targetClienteId = selectedClienteId;

    if (clienteMode === 'prospect') {
      if (!prospect.nome.trim()) {
        toast.error('Informe ao menos o nome do prospect para salvar.');
        return;
      }

      const { data: newLead, error: leadErr } = await supabase.from('clientes').insert({
        nome: prospect.nome.trim(),
        documento: prospect.documento.trim() || `LEAD-${Date.now().toString().slice(-6)}`,
        telefone: prospect.telefone.trim() || null,
        rua: prospect.rua.trim() || null,
        numero: prospect.numero.trim() || null,
        bairro: prospect.bairro.trim() || null,
        cidade: prospect.cidade.trim() || null,
        uf: prospect.uf.trim() || null,
        cep: prospect.cep.trim() || null,
        quantidade_placas: modulos,
        observacoes: `Lead capturado via Calculadora Comercial (${new Date().toLocaleDateString('pt-BR')})`,
        ativo: true,
      }).select('id').single();

      if (leadErr || !newLead) {
        toast.error('Erro ao registrar lead do prospect: ' + (leadErr?.message || 'Erro'));
        return;
      }
      targetClienteId = newLead.id;
      setSelectedClienteId(newLead.id);
      loadData();
    }

    if (targetClienteId) {
      const { error } = await supabase.from('agendamentos').insert({
        cliente_id: targetClienteId,
        tipo: 'Limpeza Avulsa',
        data_agendamento: new Date().toISOString().split('T')[0],
        status: 'Aguardando Confirmação',
        observacoes: obs,
        venda_confirmada: false,
        tipo_contrato: 'limpeza',
        valor_servico: resultadoComDesconto,
      });
      if (error) { toast.error('Erro ao salvar proposta: ' + error.message); return; }
      triggerRouteOptimizer();
    }
    toast.success('Orçamento e Lead registrados com sucesso!');
  }

  async function gerarOrcamentoPDF() {
    if (resultado === null) { toast.error('Calcule o orçamento primeiro'); return; }
    await salvarOrcamento();
    const now = new Date();
    const validade = new Date(now); validade.setDate(validade.getDate() + 15);
    const faixasAplicadas = calcularFaixasFromDB(modulos, faixasLimpeza);

    const nome = clienteNome;
    const doc = clienteMode === 'prospect' ? prospect.documento : selectedCliente?.documento || 'Não informado';
    const tel = clienteTelefone || 'Não informado';
    const endereco = clienteMode === 'prospect'
      ? `${prospect.rua}, ${prospect.numero} - ${prospect.bairro}, ${prospect.cidade}/${prospect.uf} - ${prospect.cep}`
      : `${selectedCliente?.rua || ''}, ${selectedCliente?.numero || ''} - ${selectedCliente?.bairro || ''}, ${selectedCliente?.cidade || ''}/${selectedCliente?.uf || ''}`;

    const pdf = new jsPDF();
    const orange = [249, 115, 22] as const;
    const pageW = pdf.internal.pageSize.getWidth();

    // Header
    pdf.setFontSize(22);
    pdf.setTextColor(...orange);
    pdf.text('Solar Service', pageW / 2, 25, { align: 'center' });
    pdf.setFontSize(11);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Proposta Comercial - Limpeza de Módulos Fotovoltaicos', pageW / 2, 33, { align: 'center' });
    pdf.setDrawColor(...orange);
    pdf.setLineWidth(1);
    pdf.line(20, 38, pageW - 20, 38);

    // Client data
    let y = 48;
    pdf.setFontSize(13);
    pdf.setTextColor(...orange);
    pdf.text('Dados do Cliente', 20, y); y += 8;
    pdf.setFontSize(10);
    pdf.setTextColor(30, 30, 30);
    const fields = [
      ['Nome', nome], ['Documento', doc], ['Telefone', tel], ['Endereço', endereco],
      ['Data', now.toLocaleDateString('pt-BR')], ['Validade', `${validade.toLocaleDateString('pt-BR')} (15 dias)`],
    ];
    for (const [label, value] of fields) {
      pdf.setFont('helvetica', 'bold'); pdf.text(`${label}: `, 20, y);
      pdf.setFont('helvetica', 'normal'); pdf.text(value, 20 + pdf.getTextWidth(`${label}: `), y);
      y += 6;
    }

    // Table
    y += 6;
    pdf.setFontSize(13);
    pdf.setTextColor(...orange);
    pdf.text('Detalhamento do Serviço', 20, y); y += 4;

    autoTable(pdf, {
      startY: y,
      head: [['Faixa', 'Qtd', 'Subtotal']],
      body: faixasAplicadas.map(f => [f.faixa, String(f.qtd), formatCurrency(f.subtotal)]),
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10 },
      margin: { left: 20, right: 20 },
    });

    // Total
    y = (pdf as any).lastAutoTable.finalY + 12;

    // Show discount if applied
    if (descontoValor > 0 && resultado !== null) {
      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Subtotal: ${formatCurrency(resultado)}`, pageW / 2, y, { align: 'center' });
      y += 7;
      pdf.setTextColor(220, 50, 50);
      pdf.text(`Desconto: -${formatCurrency(descontoCalculado)} (${descontoTipo === 'percentual' ? `${descontoValor}%` : 'valor fixo'})`, pageW / 2, y, { align: 'center' });
      y += 10;
    }

    pdf.setFillColor(255, 247, 237);
    pdf.roundedRect(20, y - 6, pageW - 40, 22, 4, 4, 'F');
    pdf.setFontSize(16);
    pdf.setTextColor(...orange);
    pdf.text(`Valor Total: ${formatCurrency(resultadoComDesconto!)}`, pageW / 2, y + 8, { align: 'center' });
    y += 28;

    // Economy
    if (economia > 0) {
      pdf.setFillColor(240, 253, 244);
      pdf.roundedRect(20, y - 6, pageW - 40, 14, 4, 4, 'F');
      pdf.setFontSize(11);
      pdf.setTextColor(22, 163, 106);
      pdf.text(`Economia de ${formatCurrency(economia)} em relação ao preço unitário máximo!`, pageW / 2, y + 3, { align: 'center' });
    }

    // Footer
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text('Solar Service CRM - Proposta gerada automaticamente', pageW / 2, 280, { align: 'center' });
    pdf.text('Este orçamento é válido por 15 dias a partir da data de emissão.', pageW / 2, 285, { align: 'center' });

    pdf.save(`Orcamento_Limpeza_${clienteNome.replace(/\s+/g, '_')}.pdf`);
    toast.success('Orçamento PDF gerado com sucesso!');
  }

  // A8 FIX: Use shared contract utility
  async function gerarContratoLimpeza() {
    if (resultadoComDesconto === null) { toast.error('Calcule o orçamento primeiro'); return; }
    if (templates.length === 0) { toast.error('Nenhum template de contrato de limpeza configurado'); return; }
    await salvarOrcamento();
    try {
      const clienteData = clienteMode === 'prospect'
        ? { nome: prospect.nome, rua: prospect.rua, numero: prospect.numero, bairro: prospect.bairro, cidade: prospect.cidade, uf: prospect.uf, cep: prospect.cep, documento: prospect.documento }
        : { nome: selectedCliente?.nome || '', rua: selectedCliente?.rua || '', numero: selectedCliente?.numero || '', bairro: selectedCliente?.bairro || '', cidade: selectedCliente?.cidade || '', uf: selectedCliente?.uf || '', cep: selectedCliente?.cep || '', documento: selectedCliente?.documento || '' };
      await gerarContratoLimpezaDocx({
        cliente: clienteData,
        qtdModulos: modulos,
        valorTotal: resultadoComDesconto,
        valorMedio,
        templateUrl: templates[0].url,
      });
      toast.success('Contrato de limpeza gerado!');
    } catch (err: any) { toast.error('Erro ao gerar contrato: ' + err.message); }
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
        <SprayCan className="w-6 h-6 text-primary" />
        Limpeza de Módulos
      </h2>

      {/* C7 FIX: Error feedback */}
      {loadError && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
          <span>Falha ao carregar dados.</span>
          <Button variant="outline" size="sm" onClick={loadData}>Tentar novamente</Button>
        </div>
      )}

      {/* Tabela de Preços - só visível para admins */}
      {isAdmin && faixasLimpeza.length > 0 && (
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-display font-semibold mb-4">Tabela de Preços por Módulo</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {faixasLimpeza.map(f => (
              <div key={f.id} className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Módulos</p>
                <p className="font-semibold text-sm">{f.label}</p>
                <p className="text-xs text-primary font-medium mt-1">{formatCurrency(f.valor)}/un</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seleção de Cliente / Prospect */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <h3 className="font-display font-semibold mb-4">Identificação</h3>
        <div className="flex gap-2 mb-4">
          <Button variant={clienteMode === 'cadastrado' ? 'default' : 'outline'} size="sm" onClick={() => setClienteMode('cadastrado')}>
            <User className="w-4 h-4 mr-1" />Cliente Cadastrado
          </Button>
          <Button variant={clienteMode === 'prospect' ? 'default' : 'outline'} size="sm" onClick={() => setClienteMode('prospect')}>
            <UserPlus className="w-4 h-4 mr-1" />Prospect
          </Button>
        </div>
        {clienteMode === 'cadastrado' ? (
          <div>
            <Label>Selecionar Cliente</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedClienteId} onChange={e => setSelectedClienteId(e.target.value)}
            >
              <option value="">-- Selecione --</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} - {c.documento}</option>)}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Nome do Prospect</Label><Input value={prospect.nome} onChange={e => setProspect(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" /></div>
            <div><Label>Telefone</Label><Input value={prospect.telefone} onChange={e => setProspect(p => ({ ...p, telefone: maskPhone(e.target.value) }))} placeholder="(22) 99999-9999" maxLength={15} /></div>
            <div><Label>CPF / CNPJ</Label><Input value={prospect.documento} onChange={e => setProspect(p => ({ ...p, documento: maskCPFCNPJ(e.target.value) }))} placeholder="000.000.000-00" maxLength={18} /></div>
            <div><Label>CEP</Label><Input value={prospect.cep} onChange={e => setProspect(p => ({ ...p, cep: maskCEP(e.target.value) }))} placeholder="00000-000" maxLength={9} /></div>
            <div className="sm:col-span-2"><Label>Rua</Label><Input value={prospect.rua} onChange={e => setProspect(p => ({ ...p, rua: e.target.value }))} placeholder="Rua / Av." /></div>
            <div><Label>Número</Label><Input value={prospect.numero} onChange={e => setProspect(p => ({ ...p, numero: e.target.value }))} placeholder="Nº" /></div>
            <div><Label>Bairro</Label><Input value={prospect.bairro} onChange={e => setProspect(p => ({ ...p, bairro: e.target.value }))} placeholder="Bairro" /></div>
            <div><Label>Cidade</Label><Input value={prospect.cidade} onChange={e => setProspect(p => ({ ...p, cidade: e.target.value }))} placeholder="Cidade" /></div>
            <div><Label>UF</Label><Input value={prospect.uf} onChange={e => setProspect(p => ({ ...p, uf: e.target.value.toUpperCase() }))} placeholder="RJ" maxLength={2} /></div>
          </div>
        )}
      </div>

      {/* Cálculo */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <h3 className="font-display font-semibold mb-4">Cálculo</h3>
        <div className="flex items-end gap-4 mb-6">
          <div className="flex-1">
            <Label>Quantidade de Módulos</Label>
            <Input type="number" min={1} value={modulos || ''} onChange={e => { setModulos(parseInt(e.target.value) || 0); setResultado(null); }} placeholder="Ex: 31" />
          </div>
          <Button onClick={calcular} disabled={loading}><SprayCan className="w-4 h-4 mr-2" />Calcular</Button>
        </div>

        {resultado !== null && !isTecnico && (
          <div className="bg-muted/30 rounded-xl p-4 mb-4 border border-border/50">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />Desconto
            </h4>
            <div className="flex items-end gap-3">
              <div className="flex gap-1">
                <Button
                  variant={descontoTipo === 'percentual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setDescontoTipo('percentual'); setDescontoValor(0); }}
                >
                  <Percent className="w-3 h-3 mr-1" />%
                </Button>
                <Button
                  variant={descontoTipo === 'fixo' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setDescontoTipo('fixo'); setDescontoValor(0); }}
                >
                  <DollarSign className="w-3 h-3 mr-1" />R$
                </Button>
              </div>
              <div className="flex-1">
                <Label>{descontoTipo === 'percentual' ? 'Percentual (%)' : 'Valor Fixo (R$)'}</Label>
                <Input
                  type="number"
                  min={0}
                  max={descontoTipo === 'percentual' ? 100 : resultado}
                  step={descontoTipo === 'percentual' ? 1 : 0.01}
                  value={descontoValor || ''}
                  onChange={e => setDescontoValor(parseFloat(e.target.value) || 0)}
                  placeholder={descontoTipo === 'percentual' ? 'Ex: 10' : 'Ex: 50.00'}
                />
              </div>
              {descontoValor > 0 && (
                <div className="text-sm text-destructive font-medium whitespace-nowrap pb-2">
                  -{formatCurrency(descontoCalculado)}
                </div>
              )}
            </div>
          </div>
        )}

        {resultado !== null && (
          <div className="space-y-4">
            {!isTecnico && (
              <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-4`}>
                <div className="bg-muted/50 rounded-xl p-5 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
                  <p className="text-2xl font-display font-bold solar-gradient-text">{formatCurrency(resultadoComDesconto!)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{modulos} módulos{descontoValor > 0 ? ` • Desc. ${descontoTipo === 'percentual' ? `${descontoValor}%` : formatCurrency(descontoValor)}` : ''}</p>
                </div>
                {isAdmin && (
                  <>
                    <div className="bg-muted/50 rounded-xl p-5 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Valor Médio / Módulo</p>
                      <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(valorMedio)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-5 text-center border border-solar-success/30">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                        <TrendingDown className="w-3 h-3" />Economia Gerada
                      </p>
                      <p className="text-2xl font-display font-bold" style={{ color: 'hsl(var(--solar-success))' }}>{formatCurrency(economia)}</p>
                      <p className="text-xs text-muted-foreground mt-1">vs. {formatCurrency(faixasLimpeza[0]?.valor || 50)}/módulo</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {isTecnico && (
              <div className="bg-muted/50 rounded-xl p-5 text-center">
                <p className="text-xs text-muted-foreground mb-1">Cálculo realizado</p>
                <p className="text-lg font-display font-semibold text-foreground">{modulos} módulos</p>
                <p className="text-xs text-muted-foreground mt-1">Orçamento registrado com sucesso</p>
              </div>
            )}

            {!isTecnico && (
              <div className="flex flex-wrap gap-3 pt-2">
                <Button onClick={gerarOrcamentoPDF} variant="outline"><Download className="w-4 h-4 mr-2" />Gerar Orçamento</Button>
                <Button onClick={gerarContratoLimpeza} disabled={templates.length === 0}><FileText className="w-4 h-4 mr-2" />Gerar Contrato de Serviço</Button>
              </div>
            )}
            {!isTecnico && templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Para gerar contratos, adicione um template na aba Contratos com as tags: {'{qtd_modulos}'}, {'{valor_total}'}, {'{valor_por_modulo}'}, {'{data_extenso}'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function calcularFaixasFromDB(modulos: number, faixas: FaixaPreco[]) {
  const result: { faixa: string; qtd: number; preco: number; subtotal: number }[] = [];
  let restante = modulos;
  for (const f of faixas) {
    if (restante <= 0) break;
    const faixaMax = f.faixa_fim === null ? restante : f.faixa_fim - f.faixa_inicio + 1;
    const qtd = Math.min(restante, faixaMax);
    result.push({ faixa: f.label || `${f.faixa_inicio}+`, qtd, preco: f.valor, subtotal: qtd * f.valor });
    restante -= qtd;
  }
  return result;
}
