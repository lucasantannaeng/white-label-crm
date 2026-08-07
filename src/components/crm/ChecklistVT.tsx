import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, PenTool, Camera, Upload, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SignaturePad from './SignaturePad';

interface ChecklistVTProps {
  clienteNome: string;
  clienteEndereco?: string;
  dataVT?: string;
  agendamentoId?: string;
  clienteId?: string;
}

const ITENS_CHECKLIST = [
  { categoria: 'Dados do Sistema', itens: [
    'Marca e modelo do inversor', 'Número de série do inversor', 'Potência nominal do inversor (kW)',
    'Marca e modelo dos módulos fotovoltaicos', 'Quantidade total de módulos', 'Potência de cada módulo (Wp)',
    'Potência total instalada (kWp)', 'Tipo de estrutura de fixação', 'Orientação dos módulos (azimute)', 'Inclinação dos módulos (graus)',
  ]},
  { categoria: 'Estado dos Módulos', itens: [
    'Presença de sujeira/poeira nos módulos', 'Existência de trincas ou micro-trincas', 'Vidro dos módulos sem danos visíveis',
    'Conectores MC4 em bom estado', 'Cabos sem danos ou exposição', 'Fixação dos módulos na estrutura (parafusos, grampos)',
  ]},
  { categoria: 'Estado do Inversor', itens: [
    'Inversor ligado e funcionando', 'Display sem erros ou alarmes', 'Ventilação adequada (sem obstruções)',
    'Cabos de entrada CC bem conectados', 'Cabo de saída CA bem conectado', 'Aterramento presente e conectado',
  ]},
  { categoria: 'Quadro Elétrico / String Box', itens: [
    'Disjuntores CC em bom estado', 'Disjuntor CA em bom estado', 'DPS (protetor contra surtos) instalado',
    'Fusíveis em bom estado (se aplicável)', 'Conexões elétricas sem sinais de aquecimento',
  ]},
  { categoria: 'Monitoramento', itens: [
    'Wi-Fi / conexão de rede funcionando', 'Login e senha do monitoramento coletados', 'Plataforma de monitoramento identificada',
    'Geração atual do sistema registrada (kWh)', 'Histórico de geração consultado',
  ]},
  { categoria: 'Telhado / Estrutura', itens: [
    'Tipo de telhado (cerâmico, metálico, fibrocimento, laje)', 'Estado geral do telhado',
    'Existência de infiltrações próximas', 'Calhas e rufos em bom estado', 'Acesso ao telhado seguro',
  ]},
  { categoria: 'Observações Gerais', itens: [
    'Sombreamento identificado? (árvores, construções)', 'Animais ou ninhos próximos aos equipamentos',
    'Necessidade de limpeza imediata?', 'Necessidade de manutenção corretiva?', 'Fotos registradas de todos os itens?',
  ]},
];

const CAMPOS_COLETA = [
  { label: 'Marca/Modelo do Inversor', key: 'inversor_modelo' },
  { label: 'Nº Série do Inversor', key: 'inversor_serie' },
  { label: 'Potência do Inversor (kW)', key: 'inversor_potencia' },
  { label: 'Marca/Modelo dos Módulos', key: 'modulos_modelo' },
  { label: 'Quantidade de Módulos', key: 'modulos_qtd' },
  { label: 'Potência por Módulo (Wp)', key: 'modulo_potencia' },
  { label: 'Potência Total (kWp)', key: 'potencia_total' },
  { label: 'Tipo de Estrutura', key: 'estrutura_tipo' },
  { label: 'Orientação (Azimute)', key: 'orientacao' },
  { label: 'Inclinação (graus)', key: 'inclinacao' },
  { label: 'Plataforma de Monitoramento', key: 'monitoramento_plataforma' },
  { label: 'Login do Monitoramento', key: 'monitoramento_login' },
  { label: 'Senha do Monitoramento', key: 'monitoramento_senha' },
  { label: 'Geração Atual (kWh)', key: 'geracao_atual' },
  { label: 'Tipo de Telhado', key: 'telhado_tipo' },
];

export default function ChecklistVT({ clienteNome, clienteEndereco, dataVT, agendamentoId, clienteId }: ChecklistVTProps) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [dados, setDados] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState('');
  const [dataAssinatura, setDataAssinatura] = useState(dataVT || new Date().toISOString().split('T')[0]);
  const [assinaturaCliente, setAssinaturaCliente] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fotosAntes, setFotosAntes] = useState<string[]>([]);
  const [fotosDepois, setFotosDepois] = useState<string[]>([]);
  const fileInputAntesRef = useRef<HTMLInputElement>(null);
  const fileInputDepoisRef = useRef<HTMLInputElement>(null);

  function toggleCheck(key: string) {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function updateDado(key: string, value: string) {
    setDados(prev => ({ ...prev, [key]: value }));
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>, tipo: 'antes' | 'depois') {
    const files = e.target.files;
    if (!files || !clienteId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${clienteId}/vt/${agendamentoId || 'sem-agendamento'}/${tipo}_${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('documentos-clientes').upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('documentos-clientes').getPublicUrl(path);
        if (tipo === 'antes') {
          setFotosAntes(prev => [...prev, urlData.publicUrl]);
        } else {
          setFotosDepois(prev => [...prev, urlData.publicUrl]);
        }
        await supabase.from('documentos_cliente').insert({
          cliente_id: clienteId, agendamento_id: agendamentoId || null,
          tipo: `foto_vt_${tipo}`, nome: `${tipo}_${file.name}`, url: urlData.publicUrl,
        });
      }
      toast.success('Foto(s) enviada(s)!');
    } catch (err: any) {
      toast.error('Erro ao enviar foto: ' + err.message);
    } finally {
      setUploading(false);
      if (tipo === 'antes' && fileInputAntesRef.current) fileInputAntesRef.current.value = '';
      if (tipo === 'depois' && fileInputDepoisRef.current) fileInputDepoisRef.current.value = '';
    }
  }

  function removeFoto(tipo: 'antes' | 'depois', index: number) {
    if (tipo === 'antes') setFotosAntes(prev => prev.filter((_, i) => i !== index));
    else setFotosDepois(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!clienteId) { toast.error('Cliente não identificado'); return; }
    if (!assinaturaCliente) { toast.error('Colete a assinatura do cliente antes de salvar.'); return; }
    setUploading(true);
    try {
      let assinaturaUrl: string | null = null;

      if (assinaturaCliente) {
        const blob = await (await fetch(assinaturaCliente)).blob();
        const path = `${clienteId}/assinaturas/${agendamentoId || 'geral'}/cliente_vt_${Date.now()}.png`;
        const { error } = await supabase.storage.from('documentos-clientes').upload(path, blob, { contentType: 'image/png' });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('documentos-clientes').getPublicUrl(path);
        assinaturaUrl = urlData.publicUrl;
      }

      await supabase.from('documentos_cliente').insert({
        cliente_id: clienteId,
        agendamento_id: agendamentoId || null,
        tipo: 'checklist_vt_completo',
        nome: `Checklist VT - ${clienteNome} - ${dataAssinatura}`,
        url: assinaturaUrl || '',
        assinatura_cliente_url: assinaturaUrl,
      });

      await autoFillClienteFromVT();

      toast.success('Checklist V.T. salvo com sucesso!');
      setOpen(false);
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function autoFillClienteFromVT() {
    if (!clienteId) return;
    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
    if (!cliente) return;

    const updates: Record<string, any> = {};
    if (!cliente.inversor && dados['inversor_modelo']) updates.inversor = dados['inversor_modelo'];
    if (!cliente.login_inversor && dados['monitoramento_login']) updates.login_inversor = dados['monitoramento_login'];
    if (!cliente.senha_inversor && dados['monitoramento_senha']) updates.senha_inversor = dados['monitoramento_senha'];
    if ((!cliente.potencia_kwp || Number(cliente.potencia_kwp) === 0) && dados['potencia_total']) {
      updates.potencia_kwp = parseFloat(dados['potencia_total']) || 0;
    }
    if ((!cliente.quantidade_placas || cliente.quantidade_placas === 0) && dados['modulos_qtd']) {
      updates.quantidade_placas = parseInt(dados['modulos_qtd']) || 0;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('clientes').update(updates).eq('id', clienteId);
    }

    const { data: existingInv } = await supabase.from('inversores').select('*').eq('cliente_id', clienteId).limit(1) as any;
    const inversorData: any = {
      cliente_id: clienteId,
      inversor: dados['inversor_modelo'] || null,
      numero_serie: dados['inversor_serie'] || null,
      login_inversor: dados['monitoramento_login'] || null,
      senha_inversor: dados['monitoramento_senha'] || null,
      potencia_kwp: parseFloat(dados['potencia_total']) || null,
      quantidade_placas: parseInt(dados['modulos_qtd']) || 0,
      marca_modulos: dados['modulos_modelo'] || null,
      potencia_modulo_wp: parseFloat(dados['modulo_potencia']) || null,
    };

    if (existingInv && existingInv.length > 0) {
      const inv = existingInv[0];
      const invUpdates: any = {};
      for (const [key, val] of Object.entries(inversorData)) {
        if (key === 'cliente_id') continue;
        if ((!inv[key] || inv[key] === 0) && val) invUpdates[key] = val;
      }
      if (Object.keys(invUpdates).length > 0) {
        await supabase.from('inversores').update(invUpdates).eq('id', inv.id);
      }
    } else {
      await supabase.from('inversores').insert(inversorData);
    }
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const dadosHtml = CAMPOS_COLETA.map(c =>
      `<div class="dado-item"><span class="dado-label">${escapeHtml(c.label)}:</span> <span>${escapeHtml(dados[c.key] || '_______________')}</span></div>`
    ).join('');

    const fotosAntesHtml = fotosAntes.length > 0
      ? `<div class="fotos-section"><h3>📷 Fotos — Antes do Serviço</h3><div class="fotos-grid">${fotosAntes.map((url, i) => `<img src="${url}" alt="Antes ${i + 1}" />`).join('')}</div></div>`
      : '';
    const fotosDepoisHtml = fotosDepois.length > 0
      ? `<div class="fotos-section"><h3>📷 Fotos — Depois do Serviço</h3><div class="fotos-grid">${fotosDepois.map((url, i) => `<img src="${url}" alt="Depois ${i + 1}" />`).join('')}</div></div>`
      : '';

    const safeClienteNome = escapeHtml(clienteNome);
    const safeEndereco = escapeHtml(clienteEndereco || '');
    const safeData = escapeHtml(dataAssinatura);
    const safeObs = observacoes ? escapeHtml(observacoes) : '';

    printWindow.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>Checklist V.T. - ${safeClienteNome}</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:30px;color:#1a1a2e;font-size:13px}
        .header{text-align:center;border-bottom:3px solid #f97316;padding-bottom:15px;margin-bottom:20px}
        .header h1{color:#f97316;font-size:22px;margin:0 0 5px}.header p{color:#666;margin:2px 0}
        .info{display:flex;gap:30px;margin-bottom:20px;padding:10px;background:#f9fafb;border-radius:8px}
        .info div{flex:1}.info label{font-weight:bold;font-size:11px;color:#666;display:block}.info span{font-size:13px}
        .categoria{margin-bottom:15px}.categoria h3{color:#f97316;font-size:14px;border-bottom:1px solid #eee;padding-bottom:5px;margin:0 0 8px}
        .item{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px dotted #eee}
        .checkbox{width:16px;height:16px;border:2px solid #ccc;border-radius:3px;flex-shrink:0}
        .checked{background:#f97316;border-color:#f97316}
        .dados-section{margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px}
        .dado-item{padding:4px 0;border-bottom:1px dotted #eee;font-size:12px}
        .dado-label{font-weight:bold;color:#666}
        .sig-img{max-width:200px;max-height:100px;border:1px solid #ccc;border-radius:4px}
        .fotos-section{margin:20px 0;page-break-inside:avoid}
        .fotos-section h3{color:#f97316;font-size:14px;border-bottom:1px solid #eee;padding-bottom:5px;margin:0 0 10px}
        .fotos-grid{display:flex;flex-wrap:wrap;gap:10px}
        .fotos-grid img{width:180px;height:140px;object-fit:cover;border-radius:6px;border:1px solid #ddd}
        .footer{text-align:center;color:#999;font-size:11px;margin-top:30px;border-top:1px solid #eee;padding-top:10px}
        @media print{body{padding:15px}.fotos-grid img{width:150px;height:120px}}
      </style></head><body>
      <div class="header"><h1>☀️ Checklist de Vistoria Técnica</h1><p>Inspeção de Sistema Fotovoltaico</p></div>
      <div class="info"><div><label>Cliente</label><span>${safeClienteNome}</span></div><div><label>Endereço</label><span>${safeEndereco}</span></div><div><label>Data</label><span>${safeData}</span></div></div>
      <div class="dados-section"><h3 style="color:#f97316;margin:0 0 10px">Dados Coletados</h3>${dadosHtml}</div>
      ${ITENS_CHECKLIST.map(cat => `<div class="categoria"><h3>${escapeHtml(cat.categoria)}</h3>${cat.itens.map((item, ii) => {
        const key = `${ITENS_CHECKLIST.indexOf(cat)}-${ii}`;
        return `<div class="item"><div class="checkbox ${checked[key] ? 'checked' : ''}"></div><span>${escapeHtml(item)}</span></div>`;
      }).join('')}</div>`).join('')}
      ${safeObs ? `<div class="dados-section"><h3 style="color:#f97316;margin:0 0 10px">Informações Adicionais</h3><p>${safeObs}</p></div>` : ''}
      ${fotosAntesHtml}
      ${fotosDepoisHtml}
      <div style="margin-top:40px;display:flex;justify-content:space-between">
        <div style="text-align:center">${assinaturaCliente ? `<img src="${assinaturaCliente}" class="sig-img" /><br/>` : ''}<div style="border-top:1px solid #333;width:200px;padding-top:5px">Assinatura do Cliente</div></div>
      </div>
      <div class="footer"><p>Solar Service CRM - Checklist de Vistoria Técnica</p></div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><PenTool className="w-4 h-4 mr-1" />Checklist V.T.</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checklist V.T. — {clienteNome}</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">{clienteEndereco}</div>

        <div className="mb-4">
          <Label>Data da V.T. / Assinatura</Label>
          <Input type="date" value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)} />
        </div>

        {/* Dados coletados */}
        <div className="mb-4">
          <h4 className="font-semibold text-sm text-primary mb-2">Dados Coletados</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CAMPOS_COLETA.map(campo => (
              <div key={campo.key}>
                <Label className="text-xs">{campo.label}</Label>
                <Input value={dados[campo.key] || ''} onChange={e => updateDado(campo.key, e.target.value)} placeholder={campo.label} className="h-8 text-sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-4">
          {ITENS_CHECKLIST.map((cat, ci) => (
            <div key={ci}>
              <h4 className="font-semibold text-sm text-primary mb-1">{cat.categoria}</h4>
              {cat.itens.map((item, ii) => {
                const key = `${ci}-${ii}`;
                return (
                  <label key={key} className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-muted/30 rounded px-1">
                    <input type="checkbox" checked={!!checked[key]} onChange={() => toggleCheck(key)} className="rounded" />
                    <span className={checked[key] ? 'line-through text-muted-foreground' : ''}>{item}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        {/* Observações */}
        <div className="mt-4">
          <Label>Informações Adicionais</Label>
          <textarea className="w-full border rounded-lg p-2 text-sm mt-1 min-h-[80px] bg-background border-input" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Informações adicionais coletadas em campo..." />
        </div>

        {/* Fotos ANTES */}
        <div className="mt-4 p-3 rounded-lg border border-border bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">📷 Fotos — Antes do Serviço</span>
          </div>
          <input ref={fileInputAntesRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => handleFotoUpload(e, 'antes')} />
          <Button variant="outline" size="sm" onClick={() => fileInputAntesRef.current?.click()} disabled={uploading || !clienteId}>
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Enviar Fotos (Antes)
          </Button>
          {fotosAntes.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {fotosAntes.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`Antes ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border" />
                  <button onClick={() => removeFoto('antes', i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fotos DEPOIS */}
        <div className="mt-3 p-3 rounded-lg border border-border bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">📷 Fotos — Depois do Serviço</span>
          </div>
          <input ref={fileInputDepoisRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={e => handleFotoUpload(e, 'depois')} />
          <Button variant="outline" size="sm" onClick={() => fileInputDepoisRef.current?.click()} disabled={uploading || !clienteId}>
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Enviar Fotos (Depois)
          </Button>
          {fotosDepois.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {fotosDepois.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={`Depois ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border" />
                  <button onClick={() => removeFoto('depois', i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assinatura */}
        <div className="mt-4 space-y-2">
          <SignaturePad label="Assinatura do Cliente" onSave={setAssinaturaCliente} />
          {assinaturaCliente && (
            <div className="space-y-1">
              <img src={assinaturaCliente} alt="Assinatura Cliente" className="h-16 border rounded" />
              <Button variant="ghost" size="sm" onClick={() => setAssinaturaCliente(null)} className="text-xs text-muted-foreground">Refazer assinatura</Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
          <Button onClick={handleSave} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <PenTool className="w-4 h-4 mr-1" />}
            Salvar Checklist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
