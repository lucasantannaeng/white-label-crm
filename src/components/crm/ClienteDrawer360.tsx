import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, MapPin, Phone, Mail, FileText, Zap, Sun, Clock, Calendar, 
  Shield, CheckCircle2, MessageSquare, ExternalLink, Download, Eye,
  Wrench, Layers, AlertTriangle, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate, maskCPFCNPJ, maskPhone, formatWhatsAppUrl } from '@/lib/formatters';
import type { Tables } from '@/integrations/supabase/types';

type Cliente = Tables<'clientes'>;
type Inversor = Tables<'inversores'>;
type Agendamento = Tables<'agendamentos'>;
type Documento = Tables<'documentos_cliente'>;

interface ClienteDrawer360Props {
  clienteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export default function ClienteDrawer360({
  clienteId,
  open,
  onOpenChange,
  isAdmin = true,
}: ClienteDrawer360Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clienteId && open) {
      loadClienteDetails(clienteId);
    }
  }, [clienteId, open]);

  async function loadClienteDetails(id: string) {
    setLoading(true);
    try {
      const [{ data: cData }, { data: invData }, { data: agData }, { data: docData }] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', id).single(),
        supabase.from('inversores').select('*').eq('cliente_id', id),
        supabase.from('agendamentos').select('*').eq('cliente_id', id).order('data_agendamento', { ascending: false }),
        supabase.from('documentos_cliente').select('*').eq('cliente_id', id).order('created_at', { ascending: false }),
      ]);

      setCliente(cData);
      setInversores(invData || []);
      setAgendamentos(agData || []);
      setDocumentos(docData || []);
    } catch (err) {
      console.error('Error loading cliente 360 details:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!cliente && !loading) return null;

  const phoneClean = cliente?.telefone?.replace(/\D/g, '') || '';
  const fullAddress = `${cliente?.rua || ''}, ${cliente?.numero || ''} ${cliente?.bairro ? `- ${cliente.bairro}` : ''}, ${cliente?.cidade || ''}/${cliente?.uf || ''} ${cliente?.cep ? `- CEP: ${cliente.cep}` : ''}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  function openWhatsApp(customText?: string) {
    if (!cliente?.telefone) return;
    const text = customText || `Olá ${cliente?.nome}, aqui é da equipe Solar Service! Tudo bem?`;
    const url = formatWhatsAppUrl(cliente.telefone, text);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto p-0 flex flex-col bg-background border-l border-border">
        {/* Header banner */}
        <div className="p-6 border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
          <SheetHeader className="text-left space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl solar-gradient flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {cliente?.nome?.charAt(0) || 'C'}
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                    {cliente?.nome}
                    <Badge variant={cliente?.ativo ? 'default' : 'secondary'} className="text-[10px]">
                      {cliente?.ativo ? 'Cliente Ativo' : 'Inativo'}
                    </Badge>
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground">
                    CPF/CNPJ: {cliente?.documento ? maskCPFCNPJ(cliente.documento) : 'Não informado'}
                  </p>
                </div>
              </div>

              {/* Quick WhatsApp CTA */}
              {phoneClean && (
                <Button 
                  size="sm" 
                  onClick={() => openWhatsApp()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-medium"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </Button>
              )}
            </div>
          </SheetHeader>
        </div>

        {/* Body content */}
        <div className="p-6 flex-1 space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="hud-metric-card p-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                <Zap className="w-3 h-3 text-primary" />
                Potência
              </span>
              <p className="hud-metric-value text-base text-primary">
                {cliente?.potencia_kwp ? `${cliente.potencia_kwp} kWp` : '0.0 kWp'}
              </p>
            </div>

            <div className="hud-metric-card p-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                <Sun className="w-3 h-3 text-amber-500" />
                Módulos
              </span>
              <p className="hud-metric-value text-base text-foreground">
                {cliente?.quantidade_placas || 0} <span className="text-xs font-normal text-muted-foreground">un</span>
              </p>
            </div>

            <div className="hud-metric-card p-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                <Layers className="w-3 h-3 text-sky-500" />
                Geração Est.
              </span>
              <p className="hud-metric-value text-base text-foreground">
                {cliente?.kwh_mensal ? `${cliente.kwh_mensal}` : '—'} <span className="text-xs font-normal text-muted-foreground">kWh</span>
              </p>
            </div>

            <div className="hud-metric-card p-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                Mensalidade
              </span>
              <p className="hud-metric-value text-base text-emerald-500">
                {formatCurrency(Number(cliente?.valor_mensal) || 0)}
              </p>
            </div>
          </div>

          {/* Tabs Section */}
          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid grid-cols-4 w-full h-9 bg-muted/60 p-1">
              <TabsTrigger value="geral" className="text-xs">Visão Geral</TabsTrigger>
              <TabsTrigger value="inversores" className="text-xs">Inversores ({inversores.length})</TabsTrigger>
              <TabsTrigger value="servicos" className="text-xs">Histórico ({agendamentos.length})</TabsTrigger>
              <TabsTrigger value="docs" className="text-xs">Documentos ({documentos.length})</TabsTrigger>
            </TabsList>

            {/* TAB: VISÃO GERAL */}
            <TabsContent value="geral" className="space-y-4 mt-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Informações de Contato & Localização
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="font-medium">{cliente?.telefone ? maskPhone(cliente.telefone) : 'Não informado'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">E-mail</p>
                      <p className="font-medium truncate">{cliente?.email || 'Não informado'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Endereço de Instalação</p>
                      <p className="font-medium text-xs leading-relaxed">{fullAddress || 'Endereço não cadastrado'}</p>
                      {cliente?.rua && (
                        <a 
                          href={mapsUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir rota no Google Maps / Waze
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contrato de Monitoramento */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ciclo de Contrato & Monitoramento
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Início:</span>
                    <p className="font-semibold text-foreground mt-0.5">{cliente?.inicio_contrato ? formatDate(cliente.inicio_contrato) : 'Pendente'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duração:</span>
                    <p className="font-semibold text-foreground mt-0.5">{cliente?.duracao_meses || 12} meses</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Término Previsto:</span>
                    <p className="font-semibold text-foreground mt-0.5">{cliente?.termino_contrato ? formatDate(cliente.termino_contrato) : 'Pendente'}</p>
                  </div>
                </div>
              </div>

              {/* WhatsApp Quick Actions */}
              {phoneClean && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    Ações Rápidas Omnichannel (WhatsApp)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-8"
                      onClick={() => openWhatsApp(`Olá ${cliente?.nome}, confirmamos nossa equipe técnica para atendimento do seu sistema solar. Qualquer dúvida estamos à disposição!`)}
                    >
                      Confirmar Visita Técnica
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-8"
                      onClick={() => openWhatsApp(`Olá ${cliente?.nome}, identificamos que já se aproxima o período da limpeza preventiva dos seus painéis solares para manter 100% da geração. Deseja agendar?`)}
                    >
                      Oferecer Limpeza Preventiva
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB: INVERSORES & USINA */}
            <TabsContent value="inversores" className="space-y-3 mt-4">
              {inversores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl p-6">
                  Nenhum inversor cadastrado para este cliente.
                </div>
              ) : (
                inversores.map((inv, idx) => (
                  <div key={inv.id || idx} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                        <Zap className="w-4 h-4 text-solar-orange" />
                        {inv.inversor || `Inversor #${idx + 1}`}
                      </h5>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {inv.potencia_kwp ? `${inv.potencia_kwp} kWp` : 'Potência N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Placas:</span>
                        <p className="font-medium text-foreground">{inv.quantidade_placas || 0} un ({inv.potencia_modulo_wp || '-'} Wp)</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Marca Módulos:</span>
                        <p className="font-medium text-foreground">{inv.marca_modulos || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nº Série:</span>
                        <p className="font-medium font-mono text-foreground">{inv.numero_serie || 'N/A'}</p>
                      </div>
                    </div>

                    {isAdmin && (inv.login_inversor || inv.senha_inversor) && (
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs flex items-center justify-between">
                        <div>
                          <span className="text-muted-foreground">Login Portal: </span>
                          <span className="font-mono font-medium">{inv.login_inversor || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Senha: </span>
                          <span className="font-mono font-medium">{inv.senha_inversor || '-'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB: HISTÓRICO DE SERVIÇOS & AGENDAMENTOS */}
            <TabsContent value="servicos" className="space-y-3 mt-4">
              {agendamentos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl p-6">
                  Nenhum agendamento registrado no histórico.
                </div>
              ) : (
                agendamentos.map((ag) => (
                  <div key={ag.id} className="rounded-xl border border-border bg-card p-3.5 text-xs flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {ag.tipo}
                        </Badge>
                        <span className="font-semibold text-foreground">
                          {formatDate(ag.data_agendamento)} {ag.hora ? `às ${ag.hora}` : ''}
                        </span>
                      </div>
                      {ag.observacoes && (
                        <p className="text-muted-foreground line-clamp-1 italic">{ag.observacoes}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <Badge className="text-[10px] uppercase" variant={ag.status === 'Concluído' ? 'default' : 'secondary'}>
                        {ag.status}
                      </Badge>
                      {ag.valor_servico ? (
                        <p className="font-bold text-foreground mt-1">{formatCurrency(Number(ag.valor_servico))}</p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB: DOCUMENTOS & VISTORIAS */}
            <TabsContent value="docs" className="space-y-3 mt-4">
              {documentos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl p-6">
                  Nenhum documento ou laudo anexado.
                </div>
              ) : (
                documentos.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-border bg-card p-3 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{doc.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(doc.created_at.split('T')[0])} · Tipo: {doc.tipo}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {doc.url && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs" 
                          onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Ver
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
