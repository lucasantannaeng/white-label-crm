import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { DollarSign, Save } from 'lucide-react';

interface FaixaPreco {
  id: string;
  tipo: string;
  faixa_inicio: number;
  faixa_fim: number | null;
  valor: number;
  label: string | null;
  ordem: number;
}

export default function GerenciarFaixasPreco() {
  const [faixasLimpeza, setFaixasLimpeza] = useState<FaixaPreco[]>([]);
  const [faixasMonitoramento, setFaixasMonitoramento] = useState<FaixaPreco[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadFaixas(); }, []);

  async function loadFaixas() {
    const { data } = await supabase
      .from('faixas_preco')
      .select('*')
      .order('ordem');
    if (data) {
      setFaixasLimpeza(data.filter(f => f.tipo === 'limpeza'));
      setFaixasMonitoramento(data.filter(f => f.tipo === 'monitoramento'));
    }
  }

  function updateValor(list: FaixaPreco[], setList: (v: FaixaPreco[]) => void, id: string, valor: number) {
    setList(list.map(f => f.id === id ? { ...f, valor } : f));
  }

  async function salvar() {
    setSaving(true);
    const all = [...faixasLimpeza, ...faixasMonitoramento];
    let hasError = false;

    for (const f of all) {
      const { error } = await supabase
        .from('faixas_preco')
        .update({ valor: f.valor })
        .eq('id', f.id);
      if (error) {
        hasError = true;
        toast.error('Erro ao salvar: ' + error.message);
        break;
      }
    }

    if (!hasError) {
      toast.success('Faixas de preço atualizadas!');
    }
    setSaving(false);
  }

  return (
    <div className="glass-card rounded-xl p-6 mb-6">
      <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        Faixas de Preço
      </h3>

      {/* Limpeza */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Limpeza de Módulos (preço por unidade)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {faixasLimpeza.map(f => (
            <div key={f.id} className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Módulos</p>
              <p className="text-sm font-semibold mb-2">{f.label}</p>
              <Label className="text-xs">R$/un</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={f.valor}
                onChange={e => updateValor(faixasLimpeza, setFaixasLimpeza, f.id, Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Monitoramento */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Monitoramento (valor mensal por faixa de kWh)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {faixasMonitoramento.map(f => (
            <div key={f.id} className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Faixa</p>
              <p className="text-sm font-semibold mb-2">{f.label}</p>
              <Label className="text-xs">R$/mês</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={f.valor}
                onChange={e => updateValor(faixasMonitoramento, setFaixasMonitoramento, f.id, Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={salvar} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Salvando...' : 'Salvar Faixas de Preço'}
      </Button>
    </div>
  );
}
