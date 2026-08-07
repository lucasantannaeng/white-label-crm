import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, X } from 'lucide-react';

interface NovoClienteDialogProps {
  open: boolean;
  onClose: () => void;
  onClienteCriado: (id: string, nome: string) => void;
}

const EMPTY = { nome: '', documento: '', telefone: '', email: '', rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' };

export default function NovoClienteDialog({ open, onClose, onClienteCriado }: NovoClienteDialogProps) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.documento.trim()) { toast.error('Documento (CPF/CNPJ) é obrigatório'); return; }

    setSaving(true);
    const { data, error } = await supabase.from('clientes').insert({
      nome: form.nome.trim(),
      documento: form.documento.trim(),
      telefone: form.telefone || null,
      email: form.email || null,
      rua: form.rua || null,
      numero: form.numero || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      uf: form.uf || null,
      cep: form.cep || null,
    }).select('id, nome').single();
    setSaving(false);

    if (error) { toast.error('Erro ao cadastrar cliente: ' + error.message); return; }
    toast.success('Cliente cadastrado com sucesso!');
    setForm(EMPTY);
    onClienteCriado(data.id, data.nome);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" /> Cadastrar Novo Cliente
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input value={form.nome} onChange={set('nome')} placeholder="Nome completo" />
            </div>
            <div>
              <Label>CPF/CNPJ <span className="text-destructive">*</span></Label>
              <Input value={form.documento} onChange={set('documento')} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={set('telefone')} placeholder="(00) 00000-0000" />
            </div>
            <div className="sm:col-span-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" />
            </div>
            <div className="sm:col-span-2">
              <Label>Rua</Label>
              <Input value={form.rua} onChange={set('rua')} placeholder="Endereço" />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={form.numero} onChange={set('numero')} placeholder="Nº" />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={set('bairro')} placeholder="Bairro" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={set('cidade')} placeholder="Cidade" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>UF</Label>
                <Input value={form.uf} onChange={set('uf')} placeholder="SP" maxLength={2} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={form.cep} onChange={set('cep')} placeholder="00000-000" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              <UserPlus className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Cadastrar'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
