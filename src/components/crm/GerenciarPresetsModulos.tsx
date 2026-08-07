import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Cpu, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

interface Preset {
  id: string;
  potencia_wp: number;
  geracao_estimada_kwh: number;
}

export default function GerenciarPresetsModulos() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ potencia_wp: 0, geracao_estimada_kwh: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ potencia_wp: 0, geracao_estimada_kwh: 0 });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('presets_modulos').select('*').order('potencia_wp');
    if (data) setPresets(data as Preset[]);
  }

  async function handleAdd() {
    if (!addForm.potencia_wp || !addForm.geracao_estimada_kwh) {
      toast.error('Preencha todos os campos');
      return;
    }
    const { error } = await supabase.from('presets_modulos').insert({
      potencia_wp: addForm.potencia_wp,
      geracao_estimada_kwh: addForm.geracao_estimada_kwh,
    });
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Preset adicionado!');
    setAddForm({ potencia_wp: 0, geracao_estimada_kwh: 0 });
    setShowAdd(false);
    load();
  }

  async function handleEdit(id: string) {
    const { error } = await supabase.from('presets_modulos').update({
      potencia_wp: editForm.potencia_wp,
      geracao_estimada_kwh: editForm.geracao_estimada_kwh,
    }).eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Preset atualizado!');
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('presets_modulos').delete().eq('id', id);
    if (error) { toast.error('Erro: ' + error.message); return; }
    toast.success('Preset excluído!');
    load();
  }

  return (
    <div className="glass-card rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          Presets de Geração por Módulo
        </h3>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showAdd ? 'Cancelar' : 'Adicionar'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Defina a geração estimada (kWh/mês) por unidade de módulo para cada potência (Wp). Esses valores serão usados para calcular automaticamente o kWh mensal ao cadastrar clientes.
      </p>

      {showAdd && (
        <div className="flex items-end gap-3 mb-4 p-3 rounded-lg bg-muted/50">
          <div className="flex-1">
            <Label className="text-xs">Potência (Wp)</Label>
            <Input type="number" min={1} value={addForm.potencia_wp || ''} onChange={e => setAddForm(p => ({ ...p, potencia_wp: parseInt(e.target.value) || 0 }))} placeholder="Ex: 550" />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Geração Estimada (kWh)</Label>
            <Input type="number" min={0} step="0.1" value={addForm.geracao_estimada_kwh || ''} onChange={e => setAddForm(p => ({ ...p, geracao_estimada_kwh: parseFloat(e.target.value) || 0 }))} placeholder="Ex: 65" />
          </div>
          <Button size="sm" onClick={handleAdd}><Check className="w-4 h-4" /></Button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left p-2.5 font-medium text-muted-foreground">Módulo (Wp)</th>
              <th className="text-left p-2.5 font-medium text-muted-foreground">Geração (kWh/mês)</th>
              <th className="text-right p-2.5 font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {presets.map(p => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                {editingId === p.id ? (
                  <>
                    <td className="p-2"><Input type="number" className="h-8" value={editForm.potencia_wp} onChange={e => setEditForm(f => ({ ...f, potencia_wp: parseInt(e.target.value) || 0 }))} /></td>
                    <td className="p-2"><Input type="number" step="0.1" className="h-8" value={editForm.geracao_estimada_kwh} onChange={e => setEditForm(f => ({ ...f, geracao_estimada_kwh: parseFloat(e.target.value) || 0 }))} /></td>
                    <td className="p-2 text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(p.id)}><Check className="w-3.5 h-3.5 text-solar-success" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5" /></Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-2.5 font-medium">{p.potencia_wp} Wp</td>
                    <td className="p-2.5">{p.geracao_estimada_kwh} kWh</td>
                    <td className="p-2.5 text-right space-x-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(p.id); setEditForm({ potencia_wp: p.potencia_wp, geracao_estimada_kwh: p.geracao_estimada_kwh }); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {presets.length === 0 && (
              <tr><td colSpan={3} className="p-4 text-center text-muted-foreground text-xs">Nenhum preset cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
