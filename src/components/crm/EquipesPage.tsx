import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UsersRound, Plus, Trash2, Edit2, Save, X, Wrench, ArrowRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';

interface Equipe {
  id: string;
  nome: string;
  membros: string[];
  ativo: boolean;
  created_at: string;
}

interface TecnicoInfo {
  user_id: string;
  nome: string;
  email: string;
  equipe_ids: string[];
  equipe_nomes: string[];
}

interface ManagedUser {
  id: string;
  email: string;
  nome: string;
  role: string;
  created_at: string;
}

type MemberNames = Record<string, string>;

async function callManageUsers(action: string, body: Record<string, unknown> = {}) {
  const res = await supabase.functions.invoke('manage-users', {
    body: { action, ...body },
  });

  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export default function EquipesPage() {
  const { isMaster, isAdmin } = useAuth();
  const canManageTecnicos = isMaster || isAdmin;
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [memberNames, setMemberNames] = useState<MemberNames>({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '' });
  const [tecnicos, setTecnicos] = useState<TecnicoInfo[]>([]);

  useEffect(() => {
    void loadEquipes();
  }, []);

  useEffect(() => {
    if (canManageTecnicos) {
      void loadTecnicos();
    }
  }, [canManageTecnicos, equipes]);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const normalizeMembers = (membros: string[] = []) =>
    Array.from(new Set(
      membros.map(m => m?.trim()).filter(m => m && UUID_RE.test(m)) as string[]
    ));

  async function loadMemberNames(allMembros: string[]) {
    const uuids = Array.from(new Set(allMembros.filter(m => /^[0-9a-f]{8}-/i.test(m))));
    if (uuids.length === 0) return;

    const { data } = await supabase.from('profiles').select('id, nome').in('id', uuids);
    if (data) {
      const map: MemberNames = {};
      data.forEach(profile => {
        if (profile.nome?.trim()) map[profile.id] = profile.nome.trim();
      });
      setMemberNames(prev => ({ ...prev, ...map }));
    }
  }

  async function loadEquipes() {
    const { data, error } = await supabase.from('equipes').select('*').order('nome');
    if (error) {
      toast.error('Erro ao carregar equipes: ' + error.message);
      return;
    }

    const nextEquipes = ((data || []) as Equipe[]).map(equipe => ({
      ...equipe,
      membros: normalizeMembers(equipe.membros || []),
    }));

    // Auto-clean: persist sanitized members back to DB if different
    for (const eq of nextEquipes) {
      const original = (data as any[])?.find((d: any) => d.id === eq.id);
      const originalMembros = original?.membros || [];
      if (JSON.stringify(originalMembros) !== JSON.stringify(eq.membros)) {
        await supabase.from('equipes').update({ membros: eq.membros }).eq('id', eq.id);
      }
    }

    setEquipes(nextEquipes);
    void loadMemberNames(nextEquipes.flatMap(eq => eq.membros || []));
  }

  async function loadTecnicos() {
    try {
      const users = (await callManageUsers('list')) as ManagedUser[];
      const tecnicosList = users.filter(user => user.role === 'tecnico');

      const mappedNames: MemberNames = {};
      const nextTecnicos: TecnicoInfo[] = tecnicosList.map(user => {
        const nomeExibicao = user.nome?.trim() || user.email || user.id;
        mappedNames[user.id] = nomeExibicao;

        const equipesDoTecnico = equipes.filter(eq => (eq.membros || []).includes(user.id));
        return {
          user_id: user.id,
          nome: nomeExibicao,
          email: user.email || '',
          equipe_ids: equipesDoTecnico.map(eq => eq.id),
          equipe_nomes: equipesDoTecnico.map(eq => eq.nome),
        };
      });

      setMemberNames(prev => ({ ...prev, ...mappedNames }));
      setTecnicos(nextTecnicos);
    } catch (error: any) {
      toast.error('Erro ao carregar técnicos: ' + error.message);
      setTecnicos([]);
    }
  }

  function getMemberLabel(member: string) {
    const normalizedMember = member.trim();
    if (!normalizedMember) return null;

    const resolvedName = memberNames[normalizedMember]?.trim();
    return resolvedName || null;
  }

  function getUniqueMemberLabels(membros: string[]) {
    const seen = new Set<string>();

    return normalizeMembers(membros).reduce<string[]>((acc, member) => {
      const label = getMemberLabel(member);
      if (!label) return acc;

      const key = label.toLowerCase();
      if (seen.has(key)) return acc;
      seen.add(key);
      acc.push(label);
      return acc;
    }, []);
  }

  async function assignTecnicoToEquipe(tecnicoUserId: string, newEquipeId: string) {
    const tecnico = tecnicos.find(t => t.user_id === tecnicoUserId);
    if (!tecnico) {
      toast.error('Técnico não encontrado');
      return;
    }

    const normalizedNome = tecnico.nome.trim().toLowerCase();
    const normalizedEmail = tecnico.email.trim().toLowerCase();
    const shouldRemoveMember = (member: string) => {
      const normalizedMember = member.trim().toLowerCase();
      return (
        member === tecnicoUserId ||
        (!!normalizedNome && normalizedMember === normalizedNome) ||
        (!!normalizedEmail && normalizedMember === normalizedEmail)
      );
    };

    const updates = equipes
      .filter(eq => (eq.membros || []).some(shouldRemoveMember) || eq.id === newEquipeId)
      .map(async eq => {
        const cleanedMembers = (eq.membros || []).filter(member => !shouldRemoveMember(member));
        const nextMembers = eq.id === newEquipeId && newEquipeId !== 'none'
          ? [...cleanedMembers, tecnicoUserId]
          : cleanedMembers;

        const { error } = await supabase.from('equipes').update({ membros: nextMembers }).eq('id', eq.id);
        if (error) throw error;
      });

    try {
      await Promise.all(updates);
      await Promise.all([loadEquipes(), loadTecnicos()]);
      toast.success('Técnico atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar técnico: ' + error.message);
    }
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error('Informe o nome da equipe');
      return;
    }

    if (editingId) {
      const { error } = await supabase.from('equipes').update({ nome: form.nome.trim() }).eq('id', editingId);
      if (error) {
        toast.error('Erro: ' + error.message);
        return;
      }
      toast.success('Equipe atualizada!');
    } else {
      const { error } = await supabase.from('equipes').insert({ nome: form.nome.trim(), membros: [] });
      if (error) {
        toast.error('Erro: ' + error.message);
        return;
      }
      toast.success('Equipe criada!');
    }

    setShowForm(false);
    setEditingId(null);
    setForm({ nome: '' });
    await loadEquipes();
  }

  function startEdit(equipe: Equipe) {
    setEditingId(equipe.id);
    setForm({ nome: equipe.nome });
    setShowForm(true);
  }

  async function toggleAtivo(equipe: Equipe) {
    const { error } = await supabase.from('equipes').update({ ativo: !equipe.ativo }).eq('id', equipe.id);
    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }

    toast.success(equipe.ativo ? 'Equipe desativada' : 'Equipe ativada');
    await loadEquipes();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('equipes').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
      return;
    }

    toast.success('Equipe excluída');
    await loadEquipes();
  }

  const equipesAtivas = useMemo(() => equipes.filter(e => e.ativo), [equipes]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <UsersRound className="w-6 h-6 text-primary" />
          Equipes
        </h2>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ nome: '' }); }}>
          {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showForm ? 'Cancelar' : 'Nova Equipe'}
        </Button>
      </div>

      <div className="glass-card rounded-xl p-4 mb-6 bg-muted/30">
        <h4 className="text-sm font-semibold mb-2 text-foreground">Regras de Agendamento por Equipe/Dia</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Máximo de <strong className="text-foreground">2 limpezas</strong> por equipe no mesmo dia</li>
          <li>• <strong className="text-foreground">0 limpezas</strong> no dia → até 4 V.T.s</li>
          <li>• <strong className="text-foreground">1 limpeza</strong> no dia → até 2 V.T.s</li>
          <li>• <strong className="text-foreground">2 limpezas</strong> no dia → 0 V.T.s</li>
        </ul>
      </div>

      {showForm && (
        <div className="glass-card rounded-xl p-6 mb-6 space-y-4">
          <div>
            <Label>Nome da Equipe</Label>
            <Input value={form.nome} onChange={e => setForm({ nome: e.target.value })} placeholder="Ex: Equipe Alpha" />
          </div>
          <p className="text-xs text-muted-foreground">
            A vinculação de técnicos é feita exclusivamente na seção de designação abaixo.
          </p>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />{editingId ? 'Atualizar' : 'Criar'} Equipe
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipes.map(eq => {
          const uniqueMemberLabels = getUniqueMemberLabels(eq.membros || []);

          return (
            <div key={eq.id} className={`glass-card rounded-xl p-5 ${!eq.ativo ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-foreground">{eq.nome}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${eq.ativo ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {eq.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-1">Membros ({uniqueMemberLabels.length})</p>
                {uniqueMemberLabels.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {uniqueMemberLabels.map(label => (
                      <span key={label} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{label}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sem membros</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(eq)}>
                  <Edit2 className="w-3.5 h-3.5 mr-1" />Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleAtivo(eq)}>
                  {eq.ativo ? 'Desativar' : 'Ativar'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(eq.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        {equipes.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Nenhuma equipe cadastrada
          </div>
        )}
      </div>

      {canManageTecnicos && (
        <div className="mt-10">
          <h3 className="font-display text-xl font-bold flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-primary" />
            Designação de Técnicos
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Gestão operacional de alocação de técnicos por equipe ativa.
          </p>

          {tecnicos.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
              Nenhum técnico cadastrado no sistema
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tecnicos.map(tec => (
                <div key={tec.user_id} className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{tec.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{tec.email || 'Sem e-mail cadastrado'}</p>
                    {tec.equipe_nomes.length > 0 ? (
                      <p className="text-xs text-primary mt-1">Atual: {tec.equipe_nomes.join(', ')}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">Sem equipe</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
                    <Select
                      value={tec.equipe_ids[0] || 'none'}
                      onValueChange={(val) => assignTecnicoToEquipe(tec.user_id, val)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Selecionar equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem equipe</SelectItem>
                        {equipesAtivas.map(eq => (
                          <SelectItem key={eq.id} value={eq.id}>{eq.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
