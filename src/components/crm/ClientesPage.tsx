import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, Search, PlusCircle, MinusCircle, Eye, EyeOff, MessageSquare, Layers } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import MaskedInput from './MaskedInput';
import ClienteDrawer360 from './ClienteDrawer360';
import { maskCPFCNPJ, maskPhone, maskCEP, formatCurrency, formatWhatsAppUrl } from '@/lib/formatters';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

type Cliente = Tables<'clientes'>;

interface Inversor {
  id?: string;
  inversor: string;
  login_inversor: string;
  senha_inversor: string;
  potencia_kwp: number;
  quantidade_placas: number;
  kwh_mensal: number;
  numero_serie: string;
  marca_modulos: string;
  potencia_modulo_wp: number;
  observacoes: string;
}

const UF_OPTIONS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const emptyForm = {
  nome: '', documento: '', telefone: '', email: '',
  rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '',
  login_internet: '', senha_internet: '',
  valor_mensal_manual: null as number | null,
  duracao_meses: 12, observacoes: '',
  ativo: true,
};

const emptyInversor: Inversor = {
  inversor: '', login_inversor: '', senha_inversor: '',
  potencia_kwp: 0, quantidade_placas: 0, kwh_mensal: 0,
  numero_serie: '', marca_modulos: '', potencia_modulo_wp: 0, observacoes: '',
};

interface PresetModulo {
  id: string;
  potencia_wp: number;
  geracao_estimada_kwh: number;
}

interface ClientesPageProps {
  role?: string | null;
}

export default function ClientesPage({ role }: ClientesPageProps) {
  const isAdmin = role === 'admin' || role === 'master';
  const isTecnico = role === 'tecnico';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [inversores, setInversores] = useState<Inversor[]>([{ ...emptyInversor }]);
  const [search, setSearch] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [presetsModulos, setPresetsModulos] = useState<PresetModulo[]>([]);
  const [selectedClienteId360, setSelectedClienteId360] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadClientes = useCallback(async () => {
    let result: Cliente[] = [];
    if (isAdmin) {
      const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
      if (data) result = data;
    } else {
      const { data } = await supabase.rpc('get_clientes_for_tecnico');
      if (data) result = (data as unknown as Cliente[]).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    setClientes(result);
  }, [isAdmin]);

  useEffect(() => { loadClientes(); }, [loadClientes]);

  useEffect(() => {
    supabase.from('presets_modulos').select('*').order('potencia_wp').then(({ data }) => {
      if (data) setPresetsModulos(data as PresetModulo[]);
    });
  }, []);

  function updateField(key: string, value: string | number | null) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function updateInversor(index: number, key: keyof Inversor, value: string | number) {
    setInversores(prev => prev.map((inv, i) => {
      if (i !== index) return inv;
      const updated = { ...inv, [key]: value };
      // Auto-calculate kwh_mensal when potencia_modulo_wp or quantidade_placas changes
      if (key === 'potencia_modulo_wp' || key === 'quantidade_placas') {
        const wp = key === 'potencia_modulo_wp' ? Number(value) : Number(updated.potencia_modulo_wp);
        const placas = key === 'quantidade_placas' ? Number(value) : Number(updated.quantidade_placas);
        const preset = presetsModulos.find(p => p.potencia_wp === wp);
        if (preset && placas > 0) {
          updated.kwh_mensal = Math.round(preset.geracao_estimada_kwh * placas * 100) / 100;
        }
      }
      return updated;
    }));
  }

  function addInversor() {
    setInversores(prev => [...prev, { ...emptyInversor }]);
  }

  function removeInversor(index: number) {
    if (inversores.length <= 1) { toast.error('É necessário pelo menos um inversor'); return; }
    setInversores(prev => prev.filter((_, i) => i !== index));
  }

  function togglePassword(key: string) {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!form.nome || !form.documento) {
      toast.error('Nome e CPF/CNPJ são obrigatórios');
      return;
    }

    // Sum totals from all inverters for the main client record
    const totalPlacas = inversores.reduce((s, inv) => s + (inv.quantidade_placas || 0), 0);
    const totalKwp = inversores.reduce((s, inv) => s + (inv.potencia_kwp || 0), 0);
    const totalKwh = inversores.reduce((s, inv) => s + (inv.kwh_mensal || 0), 0);

    // Use first inverter data for legacy fields
    const firstInv = inversores[0] || emptyInversor;

    // For técnicos editing: only allow filling blank fields, not overwriting existing data
    if (isTecnico && editingId) {
      const existing = clientes.find(c => c.id === editingId);
      if (existing) {
        const buildTecnicoUpdate = (fields: Record<string, any>, existingObj: Record<string, any>) => {
          const result: Record<string, any> = {};
          for (const [key, value] of Object.entries(fields)) {
            const existingVal = existingObj[key];
            // Only allow setting if current DB value is null/empty/0
            if (existingVal === null || existingVal === undefined || existingVal === '' || existingVal === 0) {
              result[key] = value;
            }
          }
          return result;
        };

        const fieldsToUpdate = buildTecnicoUpdate({
          telefone: form.telefone || null,
          email: form.email || null,
          rua: form.rua || null,
          numero: form.numero || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          uf: form.uf || null,
          cep: form.cep || null,
          inversor: firstInv.inversor || null,
          potencia_kwp: totalKwp,
          quantidade_placas: totalPlacas,
          kwh_mensal: totalKwh,
          observacoes: form.observacoes || null,
        }, existing as Record<string, any>);

        if (Object.keys(fieldsToUpdate).length === 0) {
          toast.info('Nenhum campo novo para preencher.');
          return;
        }

        const { error } = await supabase.from('clientes').update(fieldsToUpdate).eq('id', editingId);
        if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
        toast.success('Informações complementadas com sucesso!');
        resetForm();
        loadClientes();
        return;
      }
    }

    const clienteData: any = {
      nome: form.nome, documento: form.documento,
      telefone: form.telefone || null, email: form.email || null,
      rua: form.rua || null, numero: form.numero || null,
      bairro: form.bairro || null, cidade: form.cidade || null,
      uf: form.uf || null, cep: form.cep || null,
      login_internet: form.login_internet || null,
      senha_internet: form.senha_internet || null,
      inversor: firstInv.inversor || null,
      login_inversor: firstInv.login_inversor || null,
      senha_inversor: firstInv.senha_inversor || null,
      potencia_kwp: totalKwp, quantidade_placas: totalPlacas, kwh_mensal: totalKwh,
      valor_mensal_manual: form.valor_mensal_manual || null,
      duracao_meses: form.duracao_meses, observacoes: form.observacoes || null,
      ativo: form.ativo,
    };

    let clienteId = editingId;

    if (editingId) {
      const { error } = await supabase.from('clientes').update(clienteData).eq('id', editingId);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }

      // C1 FIX: Log deactivation before deleting agendamentos
      if (!form.ativo) {
        // Log which agendamentos will be removed for audit trail
        const { data: pendingAg } = await supabase.from('agendamentos')
          .select('id, tipo, data_agendamento, status')
          .eq('cliente_id', editingId)
          .in('status', ['Pendente', 'Orçamento Enviado']);
        
        if (pendingAg && pendingAg.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('ai_logs').insert({
            tipo: 'auditoria',
            entrada: `Cliente ${form.nome} (${editingId}) inativado. ${pendingAg.length} agendamento(s) removidos.`,
            resposta: JSON.stringify(pendingAg),
            metadata: { action: 'client_deactivation', client_id: editingId },
            user_id: user?.id || null,
          });
          await supabase.from('agendamentos').delete().eq('cliente_id', editingId).in('status', ['Pendente', 'Orçamento Enviado']);
        }
      }
    } else {
      const { data, error } = await supabase.from('clientes').insert(clienteData).select('id').single();
      if (error) { toast.error('Erro ao cadastrar: ' + error.message); return; }
      clienteId = data.id;
    }

    // Save inversores
    if (clienteId) {
      if (inversores.length === 0) {
        await supabase.from('inversores').delete().eq('cliente_id', clienteId);
      } else {
        const inversoresData = inversores.map(inv => ({
          ...(inv.id ? { id: inv.id } : {}),
          cliente_id: clienteId!,
          inversor: inv.inversor || null,
          login_inversor: inv.login_inversor || null,
          senha_inversor: inv.senha_inversor || null,
          potencia_kwp: inv.potencia_kwp || null,
          quantidade_placas: inv.quantidade_placas || 0,
          kwh_mensal: inv.kwh_mensal || 0,
          numero_serie: inv.numero_serie || null,
          marca_modulos: inv.marca_modulos || null,
          potencia_modulo_wp: inv.potencia_modulo_wp || null,
          observacoes: inv.observacoes || null,
        }));

        await supabase.from('inversores').delete().eq('cliente_id', clienteId);
        const { error: invError } = await supabase.from('inversores').insert(inversoresData as any);
        if (invError) {
          console.error('Error saving inverters:', invError);
          toast.error('Erro ao salvar inversores: ' + invError.message);
        }
      }
    }

    toast.success(editingId ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
    resetForm();
    loadClientes();
  }

  async function handleEdit(c: Cliente) {
    setForm({
      nome: c.nome, documento: c.documento, telefone: c.telefone || '',
      email: c.email || '', rua: c.rua || '', numero: c.numero || '',
      bairro: c.bairro || '', cidade: c.cidade || '', uf: c.uf || '', cep: c.cep || '',
      login_internet: (c as any).login_internet || '',
      senha_internet: (c as any).senha_internet || '',
      valor_mensal_manual: (c as any).valor_mensal_manual || null,
      duracao_meses: c.duracao_meses || 12, observacoes: c.observacoes || '',
      ativo: c.ativo !== false,
    });
    setEditingId(c.id);

    // Load inversores for this client
    const { data: invData } = await supabase.from('inversores').select('*').eq('cliente_id', c.id).order('created_at') as any;
    if (invData && invData.length > 0) {
      setInversores(invData.map((inv: any) => ({
        id: inv.id,
        inversor: inv.inversor || '',
        login_inversor: inv.login_inversor || '',
        senha_inversor: inv.senha_inversor || '',
        potencia_kwp: Number(inv.potencia_kwp) || 0,
        quantidade_placas: inv.quantidade_placas || 0,
        kwh_mensal: Number(inv.kwh_mensal) || 0,
        numero_serie: inv.numero_serie || '',
        marca_modulos: inv.marca_modulos || '',
        potencia_modulo_wp: Number(inv.potencia_modulo_wp) || 0,
        observacoes: inv.observacoes || '',
      })));
    } else {
      // Fallback: use legacy fields from client
      setInversores([{
        inversor: c.inversor || '', login_inversor: c.login_inversor || '',
        senha_inversor: c.senha_inversor || '', potencia_kwp: Number(c.potencia_kwp) || 0,
        quantidade_placas: c.quantidade_placas || 0, kwh_mensal: Number(c.kwh_mensal) || 0,
        numero_serie: '', marca_modulos: '', potencia_modulo_wp: 0, observacoes: '',
      }]);
    }

    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setInversores([{ ...emptyInversor }]);
    setShowPasswords({});
  }

  // C2 FIX: Handled via AlertDialog in the JSX below instead of confirm()
  async function handleDelete(id: string) {
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Cliente excluído');
    loadClientes();
  }

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.documento.includes(search)
  );

  if (showForm) {
    return (
      <div className="animate-fade-in max-w-4xl">
         <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold">{editingId ? (isTecnico ? 'Completar Dados do Cliente' : 'Editar Cliente') : 'Novo Cliente'}</h2>
           <Button variant="ghost" size="icon" onClick={resetForm}><X className="w-5 h-5" /></Button>
         </div>

        {isTecnico && editingId && (
          <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-300">
            Como técnico, você pode apenas preencher campos que ainda não foram preenchidos. Campos já preenchidos ficam bloqueados.
          </div>
        )}

         <div className="space-y-6">
           {/* Dados Pessoais */}
           <div className="glass-card rounded-xl p-5">
             <h3 className="font-display font-semibold text-foreground mb-4">Dados Pessoais</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={e => updateField('nome', e.target.value)} disabled={isTecnico && editingId && !!clientes.find(c => c.id === editingId)?.nome} /></div>
              <div><Label>CPF/CNPJ *</Label><MaskedInput maskFn={maskCPFCNPJ} maxRaw={14} value={form.documento} onChange={v => updateField('documento', v)} disabled={isTecnico && editingId && !!clientes.find(c => c.id === editingId)?.documento} /></div>
              <div><Label>Telefone</Label><MaskedInput maskFn={maskPhone} maxRaw={11} value={form.telefone} onChange={v => updateField('telefone', v)} disabled={isTecnico && editingId && !!clientes.find(c => c.id === editingId)?.telefone} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} disabled={isTecnico && editingId && !!clientes.find(c => c.id === editingId)?.email} /></div>
            </div>
          </div>

          {/* Endereço */}
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => { const ec = isTecnico && editingId ? clientes.find(c => c.id === editingId) : null; return (<>
              <div className="md:col-span-2"><Label>Rua</Label><Input value={form.rua} onChange={e => updateField('rua', e.target.value)} disabled={!!ec?.rua} /></div>
              <div><Label>Nº</Label><Input value={form.numero} onChange={e => updateField('numero', e.target.value)} disabled={!!ec?.numero} /></div>
              <div><Label>Bairro</Label><Input value={form.bairro} onChange={e => updateField('bairro', e.target.value)} disabled={!!ec?.bairro} /></div>
              <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => updateField('cidade', e.target.value)} disabled={!!ec?.cidade} /></div>
               <div>
                 <Label>UF</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" value={form.uf} onChange={e => updateField('uf', e.target.value)} disabled={!!ec?.uf}>
                   <option value="">Selecione</option>
                   {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                 </select>
               </div>
              <div><Label>CEP</Label><MaskedInput maskFn={maskCEP} maxRaw={8} value={form.cep} onChange={v => updateField('cep', v)} disabled={!!ec?.cep} /></div>
              </>); })()}
            </div>
          </div>

          {/* Dados de Acesso Internet - Admin only */}
          {isAdmin && (
           <div className="glass-card rounded-xl p-5">
             <h3 className="font-display font-semibold text-foreground mb-4">Acesso à Internet do Cliente</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div><Label>Login Wi-Fi / Rede</Label><Input value={form.login_internet} onChange={e => updateField('login_internet', e.target.value)} /></div>
               <div>
                 <Label>Senha Wi-Fi / Rede</Label>
                 <div className="relative">
                   <Input type={showPasswords['internet'] ? 'text' : 'password'} className="pr-10" value={form.senha_internet} onChange={e => updateField('senha_internet', e.target.value)} />
                   <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => togglePassword('internet')}>
                     {showPasswords['internet'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                   </button>
                 </div>
               </div>
             </div>
           </div>
          )}

          {/* Inversores (múltiplos) */}
          {inversores.map((inv, index) => {
            // For técnicos editing, check which inversor fields already have data
            const existingCliente = isTecnico && editingId ? clientes.find(c => c.id === editingId) : null;
            // If técnico is editing, lock fields that already have values loaded from DB
            const isInvFieldLocked = (field: keyof Inversor) => {
              if (!isTecnico || !editingId) return false;
              const val = inv[field];
              // The field was loaded with data — lock it if it has a non-empty/non-zero value
              // We compare against the original loaded value (form was populated via handleEdit)
              return val !== '' && val !== 0 && val !== null && val !== undefined;
            };
            // Special check: if the inversor had an id, it existed in DB already
            const isExistingInversor = !!inv.id;
            const lockIfExisting = (field: keyof Inversor) => isTecnico && editingId && isExistingInversor && isInvFieldLocked(field);

            return (
            <div key={index} className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-foreground">
                  Dados Técnicos — Inversor {inversores.length > 1 ? `#${index + 1}` : ''}
                </h3>
                {inversores.length > 1 && !isTecnico && (
                  <Button variant="ghost" size="sm" onClick={() => removeInversor(index)} className="text-destructive hover:text-destructive">
                    <MinusCircle className="w-4 h-4 mr-1" />Remover
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Inversor</Label><Input value={inv.inversor} onChange={e => updateInversor(index, 'inversor', e.target.value)} disabled={lockIfExisting('inversor')} /></div>
                <div><Label>Nº Série</Label><Input value={inv.numero_serie} onChange={e => updateInversor(index, 'numero_serie', e.target.value)} disabled={lockIfExisting('numero_serie')} /></div>
                <div><Label>Marca/Modelo Módulos</Label><Input value={inv.marca_modulos} onChange={e => updateInversor(index, 'marca_modulos', e.target.value)} disabled={lockIfExisting('marca_modulos')} /></div>
                {isAdmin && (
                  <>
                    <div><Label>Login Monitoramento</Label><Input value={inv.login_inversor} onChange={e => updateInversor(index, 'login_inversor', e.target.value)} /></div>
                    <div>
                      <Label>Senha Monitoramento</Label>
                      <div className="relative">
                        <Input type={showPasswords[`inv_${index}`] ? 'text' : 'password'} className="pr-10" value={inv.senha_inversor} onChange={e => updateInversor(index, 'senha_inversor', e.target.value)} />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => togglePassword(`inv_${index}`)}>
                          {showPasswords[`inv_${index}`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div><Label>Potência (kWp)</Label><Input type="number" value={inv.potencia_kwp || 0} onChange={e => updateInversor(index, 'potencia_kwp', parseFloat(e.target.value) || 0)} disabled={lockIfExisting('potencia_kwp')} /></div>
                <div>
                  <Label>Modelo do Módulo (Wp)</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={inv.potencia_modulo_wp || ''}
                    onChange={e => updateInversor(index, 'potencia_modulo_wp', parseInt(e.target.value) || 0)}
                    disabled={lockIfExisting('potencia_modulo_wp')}
                  >
                    <option value="">Selecione o módulo</option>
                    {presetsModulos.map(p => (
                      <option key={p.id} value={p.potencia_wp}>{p.potencia_wp} Wp — {p.geracao_estimada_kwh} kWh/placa</option>
                    ))}
                  </select>
                </div>
                <div><Label>Qtd. Placas</Label><Input type="number" value={inv.quantidade_placas || 0} onChange={e => updateInversor(index, 'quantidade_placas', parseInt(e.target.value) || 0)} disabled={lockIfExisting('quantidade_placas')} /></div>
                <div>
                  <Label>kWh Mensal</Label>
                  <Input type="number" value={inv.kwh_mensal || 0} onChange={e => updateInversor(index, 'kwh_mensal', parseFloat(e.target.value) || 0)} disabled={lockIfExisting('kwh_mensal')} />
                  {inv.potencia_modulo_wp > 0 && inv.quantidade_placas > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Calculado automaticamente pelo preset. Edite se necessário.</p>
                  )}
                </div>
              </div>
            </div>
            );
          })}

          {!isTecnico && (
            <Button variant="outline" className="w-full" onClick={addInversor}>
              <PlusCircle className="w-4 h-4 mr-2" />Adicionar Outro Inversor
            </Button>
          )}

          {/* Contrato - Admin only */}
          {isAdmin && (
           <div className="glass-card rounded-xl p-5">
             <h3 className="font-display font-semibold text-foreground mb-4">Contrato</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div><Label>Duração (meses)</Label><Input type="number" value={form.duracao_meses || 12} onChange={e => updateField('duracao_meses', parseInt(e.target.value) || 12)} /></div>
               <div>
                 <Label>Valor Mensal Manual (R$)</Label>
                 <Input type="number" placeholder="Deixe vazio para calcular automaticamente" value={form.valor_mensal_manual ?? ''} onChange={e => updateField('valor_mensal_manual', e.target.value ? parseFloat(e.target.value) : null)} />
                 <p className="text-xs text-muted-foreground mt-1">Se preenchido, sobrescreve o valor calculado por faixa</p>
               </div>
               <div><Label>Observações</Label><Input value={form.observacoes} onChange={e => updateField('observacoes', e.target.value)} /></div>
             </div>
           </div>
          )}

          {/* Observações - for técnicos */}
          {isTecnico && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="font-display font-semibold text-foreground mb-4">Observações</h3>
              <Input value={form.observacoes} onChange={e => updateField('observacoes', e.target.value)} placeholder="Adicione observações..." />
            </div>
          )}

          {/* Status Ativo/Inativo (apenas admin na edição) */}
          {editingId && isAdmin && (
             <div className="glass-card rounded-xl p-5">
               <h3 className="font-display font-semibold text-foreground mb-4">Status do Cliente</h3>
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-sm font-medium">{form.ativo ? 'Cliente Ativo' : 'Cliente Inativo'}</p>
                   <p className="text-xs text-muted-foreground mt-1">
                     {form.ativo
                       ? 'O cliente está ativo e aparece nos cálculos do dashboard.'
                       : 'O cliente está inativo. Todos os agendamentos pendentes serão cancelados e excluídos.'}
                   </p>
                 </div>
                 <Switch checked={form.ativo} onCheckedChange={(checked) => updateField('ativo', checked as any)} />
               </div>
             </div>
          )}

          <Button onClick={handleSave} className="w-full">{editingId ? (isTecnico ? 'Salvar Informações' : 'Atualizar') : 'Cadastrar'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="font-display text-xl sm:text-2xl font-bold">Clientes</h2>
        {isAdmin && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Novo </span>Cliente</Button>}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou documento..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {filtered.map(c => (
          <div key={c.id} className="mobile-card cursor-pointer" onClick={() => { setSelectedClienteId360(c.id); setDrawerOpen(true); }}>
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.documento}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {c.ativo === false && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">Inativo</span>
                )}
                {c.telefone && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-emerald-600 hover:text-emerald-700" 
                    title="Conversar no WhatsApp"
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = formatWhatsAppUrl(c.telefone, `Olá ${c.nome}, tudo bem? Aqui é da equipe Solar Service.`);
                      if (url) window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" title="Editar" onClick={(e) => { e.stopPropagation(); handleEdit(c); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              {c.telefone && <span>{c.telefone}</span>}
              <span>{c.quantidade_placas || 0} placas</span>
              {isAdmin && <span className="text-primary font-medium">{formatCurrency(Number(c.valor_mensal) || 0)}</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhum cliente encontrado</div>
        )}
      </div>

      {/* Desktop table view */}
      <div className="glass-card rounded-xl overflow-hidden hidden sm:block border border-border/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="text-left p-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Nome da Usina / Cliente</th>
              <th className="text-left p-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Documento</th>
              <th className="text-left p-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hidden md:table-cell">Telefone</th>
              <th className="text-left p-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Placas</th>
              {isAdmin && <th className="text-left p-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Valor Mensal</th>}
              <th className="text-right p-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-border/40 hover:bg-muted/25 transition-colors">
                <td className="p-3 font-medium">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button 
                      onClick={() => { setSelectedClienteId360(c.id); setDrawerOpen(true); }}
                      className="hover:text-primary hover:underline text-left font-semibold text-foreground"
                      title="Abrir Cockpit 360° do Cliente"
                    >
                      {c.nome}
                    </button>
                    {c.ativo !== false ? (
                      <span className="hud-badge-online">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        ATIVO
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                        INATIVO
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{c.documento || '—'}</td>
                <td className="p-3 text-muted-foreground hidden md:table-cell font-mono text-xs">
                  {c.telefone ? (
                    <div className="flex items-center gap-1.5">
                      <span>{c.telefone}</span>
                      <button
                        onClick={() => {
                          const num = c.telefone?.replace(/\D/g, '') || '';
                          const fullNum = num.startsWith('55') ? num : `55${num}`;
                          window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(`Olá ${c.nome}, tudo bem? Aqui é da equipe Solar Service.`)}`, '_blank', 'noopener,noreferrer');
                        }}
                        className="text-emerald-500 hover:text-emerald-400 inline-flex items-center transition-colors"
                        title="Enviar mensagem no WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : '—'}
                </td>
                <td className="p-3 hidden lg:table-cell font-mono text-xs font-semibold text-foreground">{c.quantidade_placas || 0}</td>
                {isAdmin && <td className="p-3 hidden lg:table-cell font-mono text-xs font-bold text-primary">{formatCurrency(Number(c.valor_mensal) || 0)}</td>}
                <td className="p-3 text-right space-x-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Abrir Cockpit 360°" 
                    onClick={() => { setSelectedClienteId360(c.id); setDrawerOpen(true); }}
                    className="text-primary hover:text-primary"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Excluir"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita. O cliente <strong>{c.nome}</strong> e todos os seus dados serão removidos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cockpit 360 Drawer */}
      <ClienteDrawer360 
        clienteId={selectedClienteId360} 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
        isAdmin={isAdmin} 
      />
    </div>
  );
}
