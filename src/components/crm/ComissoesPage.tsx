import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DollarSign, Check, X, ChevronDown, ChevronRight,
  Crown, Shield, UserCheck, Loader2, RefreshCw,
} from 'lucide-react';

/* ───────── types ───────── */

interface Pessoa {
  user_id: string;
  nome: string;
  email: string;
  role: string;
  vendedor_id: string | null;
}

interface ClienteContrato {
  id: string;
  nome: string;
  valor_mensal: number;
  duracao_meses: number;
  inicio_contrato: string | null;
  tipo_contrato: string | null; // from agendamentos
}

interface Parcela {
  id: string | null; // null = not yet persisted
  cliente_id: string;
  vendedor_id: string;
  parcela_num: number;
  total_parcelas: number;
  valor: number;
  pago: boolean;
  data_pagamento: string | null;
}

/* ───────── helpers ───────── */

function getRoleBadge(role: string) {
  switch (role) {
    case 'master':
      return <Badge variant="default" className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]"><Crown className="w-3 h-3 mr-1" />Master</Badge>;
    case 'admin':
      return <Badge variant="default" className="bg-primary/20 text-primary border-primary/30 text-[10px]"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    case 'vendedor':
      return <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 text-[10px]"><UserCheck className="w-3 h-3 mr-1" />Vendedor</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">{role}</Badge>;
  }
}

/* ───────── main component ───────── */

export default function ComissoesPage() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [comissaoPercentual, setComissaoPercentual] = useState(10);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [contratos, setContratos] = useState<ClienteContrato[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingParcela, setSavingParcela] = useState<string | null>(null);

  /* ── Load people with admin/master/vendedor roles ── */
  const loadPessoas = useCallback(async () => {
    setLoading(true);
    try {
      // Get users with relevant roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'master', 'vendedor']);

      if (!roles || roles.length === 0) { setPessoas([]); setLoading(false); return; }

      const userIds = roles.map(r => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', userIds);

      // Get vendedores linked to these users
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('id, user_id')
        .in('user_id', userIds);

      const roleMap: Record<string, string> = {};
      roles.forEach(r => { roleMap[r.user_id] = r.role; });
      const vendMap: Record<string, string> = {};
      vendedores?.forEach(v => { if (v.user_id) vendMap[v.user_id] = v.id; });

      const profileMap: Record<string, { nome: string; email: string }> = {};
      profiles?.forEach(p => { profileMap[p.id] = { nome: p.nome || '', email: p.email || '' }; });

      // For users without profiles, try to get info from manage-users edge function
      const missingProfileIds = userIds.filter(uid => !profileMap[uid]);
      if (missingProfileIds.length > 0) {
        try {
          const { data: resp } = await supabase.functions.invoke('manage-users', {
            body: { action: 'list' },
          });
          if (resp?.users) {
            for (const u of resp.users) {
              if (missingProfileIds.includes(u.id)) {
                profileMap[u.id] = { nome: u.nome || u.email || '', email: u.email || '' };
              }
            }
          }
        } catch { /* fallback to truncated id */ }
      }

      const result: Pessoa[] = userIds.map(uid => ({
        user_id: uid,
        nome: profileMap[uid]?.nome || profileMap[uid]?.email || uid.slice(0, 8),
        email: profileMap[uid]?.email || '',
        role: roleMap[uid] || 'vendedor',
        vendedor_id: vendMap[uid] || null,
      }));

      result.sort((a, b) => {
        const order: Record<string, number> = { master: 0, admin: 1, vendedor: 2 };
        return (order[a.role] ?? 3) - (order[b.role] ?? 3);
      });

      setPessoas(result);

      // Load config
      const { data: cfg } = await supabase.from('configuracoes').select('comissao_percentual').limit(1).single();
      if (cfg) setComissaoPercentual(Number(cfg.comissao_percentual) || 10);
    } catch (err: any) {
      toast.error('Erro ao carregar: ' + err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPessoas(); }, [loadPessoas]);

  /* ── Load contracts for a specific person ── */
  async function loadContratos(pessoa: Pessoa) {
    if (expandedUser === pessoa.user_id) {
      setExpandedUser(null);
      return;
    }

    setExpandedUser(pessoa.user_id);
    setLoadingDetail(true);

    try {
      let vendedorId = pessoa.vendedor_id;

      // Auto-create vendedor if missing
      if (!vendedorId) {
        const { data: newVend, error: vendErr } = await supabase
          .from('vendedores')
          .insert({ nome: pessoa.nome || pessoa.email, email: pessoa.email, user_id: pessoa.user_id })
          .select('id')
          .single();
        if (vendErr || !newVend) {
          toast.error('Erro ao criar vínculo de vendedor');
          setContratos([]);
          setParcelas([]);
          setLoadingDetail(false);
          return;
        }
        vendedorId = newVend.id;
        // Update local state
        setPessoas(prev => prev.map(p => p.user_id === pessoa.user_id ? { ...p, vendedor_id: vendedorId } : p));
      }

      // Get clients linked to this vendedor
      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nome, valor_mensal, duracao_meses, inicio_contrato')
        .eq('vendedor_id', vendedorId)
        .eq('ativo', true)
        .order('nome');

      // Get agendamentos to determine contract type
      const clienteIds = (clientes || []).map(c => c.id);
      let tipoMap: Record<string, string> = {};
      if (clienteIds.length > 0) {
        const { data: agendamentos } = await supabase
          .from('agendamentos')
          .select('cliente_id, tipo_contrato')
          .in('cliente_id', clienteIds)
          .not('tipo_contrato', 'is', null);
        agendamentos?.forEach(a => {
          if (a.tipo_contrato) tipoMap[a.cliente_id] = a.tipo_contrato;
        });
      }

      const clienteContratos: ClienteContrato[] = (clientes || []).map(c => ({
        id: c.id,
        nome: c.nome,
        valor_mensal: Number(c.valor_mensal) || 0,
        duracao_meses: Number(c.duracao_meses) || 12,
        inicio_contrato: c.inicio_contrato,
        tipo_contrato: tipoMap[c.id] || null,
      }));

      setContratos(clienteContratos);

      // Load existing parcelas
      const { data: existingParcelas } = await supabase
        .from('comissao_parcelas')
        .select('*')
        .eq('vendedor_id', vendedorId);

      // Build parcela list: for each client, determine if it's monitoramento (installments) or single
      const allParcelas: Parcela[] = [];

      clienteContratos.forEach(c => {
        const isMonitoramento = (tipoMap[c.id] || '').toLowerCase().includes('monitoramento')
          || c.duracao_meses > 1;
        const totalParcelas = isMonitoramento ? c.duracao_meses : 1;
        const valorParcela = c.valor_mensal * (comissaoPercentual / 100);

        for (let i = 1; i <= totalParcelas; i++) {
          const existing = (existingParcelas || []).find(
            ep => ep.cliente_id === c.id && ep.parcela_num === i
          );

          allParcelas.push({
            id: existing?.id || null,
            cliente_id: c.id,
            vendedor_id: vendedorId!,
            parcela_num: i,
            total_parcelas: totalParcelas,
            valor: valorParcela,
            pago: existing?.pago || false,
            data_pagamento: existing?.data_pagamento || null,
          });
        }
      });

      setParcelas(allParcelas);
    } catch (err: any) {
      toast.error('Erro ao carregar contratos: ' + err.message);
    }
    setLoadingDetail(false);
  }

  /* ── Toggle parcela payment ── */
  async function toggleParcela(parcela: Parcela) {
    const key = `${parcela.cliente_id}-${parcela.parcela_num}`;
    setSavingParcela(key);

    try {
      const newPago = !parcela.pago;

      if (parcela.id) {
        // Update existing
        await supabase.from('comissao_parcelas').update({
          pago: newPago,
          data_pagamento: newPago ? new Date().toISOString() : null,
        }).eq('id', parcela.id);
      } else {
        // Insert new
        const { data } = await supabase.from('comissao_parcelas').insert({
          vendedor_id: parcela.vendedor_id,
          cliente_id: parcela.cliente_id,
          parcela_num: parcela.parcela_num,
          total_parcelas: parcela.total_parcelas,
          valor: parcela.valor,
          pago: newPago,
          data_pagamento: newPago ? new Date().toISOString() : null,
        }).select('id').single();

        // Update local state with new id
        if (data) {
          parcela.id = data.id;
        }
      }

      // Update local state
      setParcelas(prev => prev.map(p =>
        p.cliente_id === parcela.cliente_id && p.parcela_num === parcela.parcela_num
          ? { ...p, pago: newPago, data_pagamento: newPago ? new Date().toISOString() : null, id: parcela.id }
          : p
      ));

      toast.success(newPago ? 'Parcela marcada como paga' : 'Parcela desmarcada');
    } catch (err: any) {
      toast.error(err.message);
    }
    setSavingParcela(null);
  }

  /* ── Computed stats per person ── */
  function getStats(pessoa: Pessoa) {
    if (!pessoa.vendedor_id) return { totalContratos: 0, totalComissao: 0, totalPago: 0 };
    // We only have full data for the expanded user, so provide summary from contratos
    return null; // will be calculated inline
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Comissões
        </h2>
        <Button variant="outline" size="sm" onClick={loadPessoas}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Taxa de comissão: <strong>{comissaoPercentual}%</strong> sobre o valor mensal do contrato.
        Clique no nome para ver e gerenciar os contratos.
      </p>

      {pessoas.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          Nenhum usuário com papel Admin, Master ou Vendedor encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {pessoas.map(pessoa => {
            const isExpanded = expandedUser === pessoa.user_id;

            // Compute summary for expanded user
            const pessoaContratos = isExpanded ? contratos : [];
            const pessoaParcelas = isExpanded ? parcelas : [];
            const totalComissao = pessoaContratos.reduce(
              (sum, c) => sum + c.valor_mensal * (comissaoPercentual / 100) * (c.duracao_meses > 1 ? c.duracao_meses : 1),
              0
            );
            const totalPago = pessoaParcelas.filter(p => p.pago).reduce((s, p) => s + p.valor, 0);

            return (
              <div key={pessoa.user_id} className="glass-card rounded-xl overflow-hidden">
                {/* Person row */}
                <button
                  onClick={() => loadContratos(pessoa)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{pessoa.nome || pessoa.email}</span>
                      {getRoleBadge(pessoa.role)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{pessoa.email}</p>
                  </div>
                  {!pessoa.vendedor_id && (
                    <span className="text-xs text-muted-foreground italic">Sem vínculo de vendedor</span>
                  )}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4">
                    {loadingDetail ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : !pessoa.vendedor_id ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Este usuário não possui vínculo com a tabela de vendedores. Sem contratos associados.
                      </p>
                    ) : contratos.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhum contrato ativo vinculado a este vendedor.
                      </p>
                    ) : (
                      <>
                        {/* Summary */}
                        <div className="flex gap-4 py-3 text-sm flex-wrap">
                          <div>
                            <span className="text-muted-foreground">Contratos:</span>{' '}
                            <strong>{contratos.length}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Comissão total:</span>{' '}
                            <strong className="text-primary">{formatCurrency(totalComissao)}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pago:</span>{' '}
                            <strong className="text-emerald-600">{formatCurrency(totalPago)}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pendente:</span>{' '}
                            <strong className="text-destructive">{formatCurrency(totalComissao - totalPago)}</strong>
                          </div>
                        </div>

                        {/* Contract list */}
                        <div className="space-y-3 mt-2">
                          {contratos.map(contrato => {
                            const contratoParcelas = parcelas.filter(p => p.cliente_id === contrato.id);
                            const pagasCount = contratoParcelas.filter(p => p.pago).length;
                            const totalCount = contratoParcelas.length;
                            const isMonitoramento = totalCount > 1;

                            return (
                              <div key={contrato.id} className="border border-border rounded-lg p-3">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <p className="font-medium text-sm">{contrato.nome}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Valor mensal: {formatCurrency(contrato.valor_mensal)} •
                                      Comissão: {formatCurrency(contrato.valor_mensal * (comissaoPercentual / 100))}/parcela
                                      {isMonitoramento && ` • ${contrato.duracao_meses} parcelas`}
                                    </p>
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                    pagasCount === totalCount
                                      ? 'bg-emerald-500/20 text-emerald-600'
                                      : pagasCount > 0
                                        ? 'bg-amber-500/20 text-amber-600'
                                        : 'bg-destructive/20 text-destructive'
                                  }`}>
                                    {pagasCount === totalCount ? (
                                      <><Check className="w-3 h-3 inline mr-1" />Quitado</>
                                    ) : (
                                      `${pagasCount}/${totalCount} pago(s)`
                                    )}
                                  </span>
                                </div>

                                {/* Installments */}
                                {isMonitoramento ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 mt-2">
                                    {contratoParcelas.map(parcela => {
                                      const parcelaKey = `${parcela.cliente_id}-${parcela.parcela_num}`;
                                      const isSaving = savingParcela === parcelaKey;

                                      return (
                                        <button
                                          key={parcelaKey}
                                          disabled={isSaving}
                                          onClick={() => toggleParcela(parcela)}
                                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs border transition-all ${
                                            parcela.pago
                                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                                              : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                                          } ${isSaving ? 'opacity-50' : ''}`}
                                        >
                                          <Checkbox
                                            checked={parcela.pago}
                                            className="pointer-events-none h-3.5 w-3.5"
                                          />
                                          <span>Parcela {parcela.parcela_num}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  /* Single payment */
                                  contratoParcelas.map(parcela => {
                                    const parcelaKey = `${parcela.cliente_id}-${parcela.parcela_num}`;
                                    const isSaving = savingParcela === parcelaKey;

                                    return (
                                      <Button
                                        key={parcelaKey}
                                        variant={parcela.pago ? 'default' : 'outline'}
                                        size="sm"
                                        className="mt-1"
                                        disabled={isSaving}
                                        onClick={() => toggleParcela(parcela)}
                                      >
                                        {parcela.pago ? (
                                          <><Check className="w-3 h-3 mr-1" />Pago</>
                                        ) : (
                                          <><X className="w-3 h-3 mr-1" />Marcar como Pago</>
                                        )}
                                      </Button>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
