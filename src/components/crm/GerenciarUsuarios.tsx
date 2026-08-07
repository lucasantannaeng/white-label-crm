import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Users, UserPlus, Trash2, Shield, Loader2, Crown, Wrench, UserCheck, Pencil, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type AppRoleOption = 'admin' | 'vendedor' | 'tecnico' | 'viewer';

interface ManagedUser {
  id: string;
  email: string;
  nome: string;
  role: string;
  created_at: string;
}

async function callManageUsers(action: string, body: Record<string, unknown> = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...body }),
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || `Erro ${response.status}`);
  if (data?.error) throw new Error(data.error);
  return data;
}

function getRoleBadge(role: string) {
  switch (role) {
    case 'master': return <Badge variant="default" className="bg-amber-500/20 text-amber-600 border-amber-500/30"><Crown className="w-3 h-3 mr-1" />Master</Badge>;
    case 'admin': return <Badge variant="default" className="bg-primary/20 text-primary border-primary/30"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    case 'vendedor': return <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30"><UserCheck className="w-3 h-3 mr-1" />Vendedor</Badge>;
    case 'tecnico': return <Badge variant="default" className="bg-blue-500/20 text-blue-600 border-blue-500/30"><Wrench className="w-3 h-3 mr-1" />Técnico</Badge>;
    case 'viewer': return <Badge variant="secondary"><Eye className="w-3 h-3 mr-1" />Visualizador</Badge>;
    default: return <Badge variant="secondary">{role}</Badge>;
  }
}

export default function GerenciarUsuarios() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newRole, setNewRole] = useState<AppRoleOption>('viewer');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await callManageUsers('list');
      setUsers(data);
    } catch (err: any) {
      toast.error('Erro ao carregar usuários: ' + err.message);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await callManageUsers('create', { email: newEmail, password: newPassword, nome: newNome, role: newRole });
      toast.success('Usuário criado com sucesso!');
      setDialogOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewNome('');
      setNewRole('tecnico');
      loadUsers();
    } catch (err: any) {
      toast.error('Erro ao criar: ' + err.message);
    }
    setCreating(false);
  }

  async function handleRoleChange(userId: string, role: string) {
    try {
      await callManageUsers('update_role', { user_id: userId, role });
      toast.success('Papel atualizado!');
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete(userId: string) {
    try {
      await callManageUsers('delete', { user_id: userId });
      toast.success('Usuário excluído!');
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function openEdit(u: ManagedUser) {
    setEditUser(u);
    setEditNome(u.nome);
    setEditEmail(u.email);
    setEditPassword('');
  }

  async function handleEditSave() {
    if (!editUser) return;
    setSaving(true);
    try {
      const updates: Record<string, string> = { user_id: editUser.id };
      if (editNome.trim() !== (editUser.nome || '').trim()) updates.nome = editNome.trim();
      if (editEmail.trim() !== (editUser.email || '').trim()) updates.email = editEmail.trim();
      
      const hasProfileChanges = Object.keys(updates).length > 1;
      const hasPasswordChange = editPassword.trim().length > 0;

      if (!hasProfileChanges && !hasPasswordChange) {
        toast.info('Nenhuma alteração detectada.');
        setEditUser(null);
        setSaving(false);
        return;
      }

      if (hasProfileChanges) {
        await callManageUsers('update_profile', updates);
      }

      if (hasPasswordChange) {
        if (editPassword.trim().length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres');
          setSaving(false);
          return;
        }
        await callManageUsers('update_password', { user_id: editUser.id, password: editPassword.trim() });
      }

      toast.success('Informações atualizadas!');
      setEditUser(null);
      loadUsers();
    } catch (err: any) {
      console.error('update error:', err);
      toast.error(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Gerenciar Usuários
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="w-4 h-4 mr-1" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome completo" required />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" required />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
              </div>
              <div>
                <Label>Papel</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRoleOption)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">👁️ Visualizador</SelectItem>
                    <SelectItem value="tecnico">🔧 Técnico</SelectItem>
                    <SelectItem value="vendedor">🤝 Vendedor</SelectItem>
                    <SelectItem value="admin">🛡️ Administrador</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Admin:</strong> acesso total (exceto Configurações). <strong>Vendedor:</strong> agenda, clientes, contratos. <strong>Técnico:</strong> agenda, clientes e calculadora.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Criando...</> : 'Criar Usuário'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome || '—'}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {u.role === 'master' ? (
                    getRoleBadge('master')
                  ) : (
                    <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                      <SelectTrigger className="w-[160px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">👁️ Visualizador</SelectItem>
                        <SelectItem value="tecnico">🔧 Técnico</SelectItem>
                        <SelectItem value="vendedor">🤝 Vendedor</SelectItem>
                        <SelectItem value="admin">🛡️ Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {u.role !== 'master' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação é irreversível. O usuário <strong>{u.email}</strong> será permanentemente removido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Nova Senha <span className="text-muted-foreground font-normal">(deixe em branco para manter)</span></Label>
              <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
            <Button className="w-full" onClick={handleEditSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Salvando...</> : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
