import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Upload, Palette, Download, Percent } from 'lucide-react';
import GerenciarUsuarios from './GerenciarUsuarios';
import GerenciarFaixasPreco from './GerenciarFaixasPreco';
import GerenciarPresetsModulos from './GerenciarPresetsModulos';
import { saveAs } from 'file-saver';

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [corInput, setCorInput] = useState('#f97316');
  const [nomeEmpresa, setNomeEmpresa] = useState('Solar Service');
  const [comissaoPercentual, setComissaoPercentual] = useState(10);
  const [exportando, setExportando] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    const { data } = await supabase.from('configuracoes').select('*').limit(1).single();
    if (data) {
      setConfig(data);
      setNomeEmpresa(data.nome_empresa || 'Solar Service');
      setComissaoPercentual(Number(data.comissao_percentual) || 10);
      // Convert HSL string to hex for color picker
      const hsl = data.cor_primaria || '25 95% 53%';
      setCorInput(hslStringToHex(hsl));
    }
  }

  function hslStringToHex(hslStr: string): string {
    try {
      const parts = hslStr.replace(/%/g, '').split(/\s+/).map(Number);
      if (parts.length < 3) return '#f97316';
      const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
      const a2 = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    } catch { return '#f97316'; }
  }

  function hexToHslString(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
        case g: h = ((b - r) / d + 2) * 60; break;
        case b: h = ((r - g) / d + 4) * 60; break;
      }
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const fileName = `logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error('Erro no upload: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(fileName);

    if (config?.id) {
      await supabase.from('configuracoes').update({ logo_url: urlData.publicUrl }).eq('id', config.id);
    }

    toast.success('Logo atualizada!');
    setUploading(false);
    loadConfig();
    e.target.value = '';
  }

  async function salvarConfiguracoes() {
    if (!config?.id) return;
    const hslColor = hexToHslString(corInput);
    const { error } = await supabase.from('configuracoes').update({
      cor_primaria: hslColor,
      nome_empresa: nomeEmpresa,
      comissao_percentual: comissaoPercentual,
    }).eq('id', config.id);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }

    // Apply theme immediately
    document.documentElement.style.setProperty('--primary', hslColor);
    document.documentElement.style.setProperty('--accent', hslColor);
    document.documentElement.style.setProperty('--ring', hslColor);
    document.documentElement.style.setProperty('--sidebar-primary', hslColor);
    document.documentElement.style.setProperty('--sidebar-ring', hslColor);
    document.documentElement.style.setProperty('--solar-orange', hslColor);

    toast.success('Configurações salvas!');
    loadConfig();
  }

  async function exportarCSV() {
    setExportando(true);
    try {
      const { data: clientes } = await supabase.from('clientes').select('*');
      const { data: agendamentos } = await supabase.from('agendamentos').select('*');

      if (clientes && clientes.length > 0) {
        const headers = Object.keys(clientes[0]);
        const csv = [
          headers.join(';'),
          ...clientes.map(c => headers.map(h => String((c as any)[h] ?? '')).join(';'))
        ].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        saveAs(blob, `clientes_${new Date().toISOString().slice(0, 10)}.csv`);
      }

      if (agendamentos && agendamentos.length > 0) {
        const headers = Object.keys(agendamentos[0]);
        const csv = [
          headers.join(';'),
          ...agendamentos.map(a => headers.map(h => String((a as any)[h] ?? '')).join(';'))
        ].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        saveAs(blob, `agendamentos_${new Date().toISOString().slice(0, 10)}.csv`);
      }

      toast.success('Arquivos CSV exportados!');
    } catch (err: any) {
      toast.error('Erro na exportação: ' + err.message);
    }
    setExportando(false);
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
        <Settings className="w-6 h-6 text-primary" />
        Configurações
      </h2>

      {/* Identidade Visual */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          Identidade Visual (White-Label)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo */}
          <div>
            <Label>Logo da Empresa</Label>
            <div className="mt-2 border-2 border-dashed border-border rounded-lg p-4 text-center">
              {config?.logo_url ? (
                <div className="space-y-3">
                  <img src={config.logo_url} alt="Logo" className="max-h-16 mx-auto object-contain" />
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                    <Button variant="outline" size="sm" asChild>
                      <span><Upload className="w-4 h-4 mr-1" />{uploading ? 'Enviando...' : 'Trocar Logo'}</span>
                    </Button>
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Envie sua logo</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                  <Button variant="outline" size="sm" asChild>
                    <span>{uploading ? 'Enviando...' : 'Upload Logo'}</span>
                  </Button>
                </label>
              )}
            </div>
          </div>

          {/* Cor e Nome */}
          <div className="space-y-4">
            <div>
              <Label>Nome da Empresa</Label>
              <Input value={nomeEmpresa} onChange={e => setNomeEmpresa(e.target.value)} />
            </div>
            <div>
              <Label>Cor Principal</Label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="color"
                  value={corInput}
                  onChange={e => setCorInput(e.target.value)}
                  className="w-12 h-10 rounded-md border border-input cursor-pointer"
                />
                <Input value={corInput} onChange={e => setCorInput(e.target.value)} className="flex-1" />
                <div className="w-10 h-10 rounded-md" style={{ backgroundColor: corInput }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comissão */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Percent className="w-5 h-5 text-primary" />
          Configuração de Comissão
        </h3>
        <div className="max-w-xs">
          <Label>Percentual de Comissão (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={comissaoPercentual}
            onChange={e => setComissaoPercentual(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">Aplicado sobre o primeiro valor mensal do contrato.</p>
        </div>
      </div>

      <Button onClick={salvarConfiguracoes} className="mb-6">Salvar Configurações</Button>

      {/* Faixas de Preço */}
      <GerenciarFaixasPreco />

      {/* Presets de Módulos */}
      <GerenciarPresetsModulos />

      {/* Gerenciar Usuários */}
      <div className="mb-6">
        <GerenciarUsuarios />
      </div>

      {/* Backup */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          Backup e Exportação
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Exporte todos os dados de clientes e agendamentos em formato CSV.
        </p>
        <Button onClick={exportarCSV} disabled={exportando} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          {exportando ? 'Exportando...' : 'Exportar Base de Dados (CSV)'}
        </Button>
      </div>
    </div>
  );
}
