import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Eye, Trash2, Printer, Search, FileText, Filter } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { escapeHtml } from '@/lib/escapeHtml';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Documento {
  id: string;
  cliente_id: string;
  agendamento_id: string | null;
  tipo: string;
  nome: string;
  url: string;
  assinatura_cliente_url: string | null;
  assinatura_tecnico_url: string | null;
  created_at: string;
  cliente_nome?: string;
}

const TIPO_LABELS: Record<string, string> = {
  checklist_vt_completo: 'Checklist V.T.',
  foto_vt: 'Foto V.T.',
  foto_vt_antes: 'Foto V.T. (Antes)',
  foto_vt_depois: 'Foto V.T. (Depois)',
  contrato: 'Contrato',
  assinatura: 'Assinatura',
};

const TIPO_FILTER_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'checklist_vt_completo', label: 'Checklist V.T.' },
  { value: 'foto_vt', label: 'Fotos V.T.' },
  { value: 'contrato', label: 'Contratos' },
];

export default function DocumentosPage() {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [previewDoc, setPreviewDoc] = useState<Documento | null>(null);
  const [previewJsonData, setPreviewJsonData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { loadDocumentos(); }, []);

  useEffect(() => {
    if (previewDoc && (previewDoc.tipo === 'checklist_vt_completo' || previewDoc.url?.endsWith('.json'))) {
      fetch(previewDoc.url)
        .then(res => res.json())
        .then(data => setPreviewJsonData(data))
        .catch(err => {
          console.error('Error fetching preview JSON:', err);
          setPreviewJsonData(null);
        });
    } else {
      setPreviewJsonData(null);
    }
  }, [previewDoc]);

  async function loadDocumentos() {
    setLoading(true);
    const [{ data: docs }, { data: clientes }] = await Promise.all([
      supabase.from('documentos_cliente').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nome'),
    ]);

    if (docs && clientes) {
      const clienteMap = new Map(clientes.map(c => [c.id, c.nome]));
      setDocumentos(docs.map(d => ({ ...d, cliente_nome: clienteMap.get(d.cliente_id) || 'Desconhecido' })));
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('documentos_cliente').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir: ' + error.message); return; }
    toast.success('Documento excluído');
    setDocumentos(prev => prev.filter(d => d.id !== id));
    setDeleteConfirm(null);
  }

  async function handlePrint(doc: Documento) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isImage = doc.url?.match(/\.(jpg|jpeg|png|gif|webp)/i);
    const isJsonVT = doc.tipo === 'checklist_vt_completo' || doc.url?.endsWith('.json');
    const nome = escapeHtml(doc.nome);
    const clienteNome = escapeHtml(doc.cliente_nome || '');
    const tipo = escapeHtml(TIPO_LABELS[doc.tipo] || doc.tipo);
    const data = escapeHtml(formatDate(doc.created_at.split('T')[0]));

    let extraHtml = '';
    if (isJsonVT && doc.url) {
      try {
        const res = await fetch(doc.url);
        const vtJson = await res.json();
        if (vtJson) {
          const dadosList = Object.entries(vtJson.dados || {})
            .map(([k, v]) => `<div style="padding:4px 0;border-bottom:1px dotted #eee"><strong>${escapeHtml(k)}:</strong> <span>${escapeHtml(String(v))}</span></div>`)
            .join('');
          const fotosAntes = ((vtJson.fotos_antes as string[]) || [])
            .map((u: string) => `<img src="${escapeHtml(u)}" style="width:170px;height:130px;object-fit:cover;border-radius:6px;border:1px solid #ddd" />`)
            .join('');
          const fotosDepois = ((vtJson.fotos_depois as string[]) || [])
            .map((u: string) => `<img src="${escapeHtml(u)}" style="width:170px;height:130px;object-fit:cover;border-radius:6px;border:1px solid #ddd" />`)
            .join('');

          extraHtml = `
            ${dadosList ? `<div style="margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px"><h3 style="color:#f97316;margin:0 0 10px;font-size:14px">Dados Coletados</h3>${dadosList}</div>` : ''}
            ${fotosAntes ? `<div style="margin:20px 0"><h3 style="color:#f97316;font-size:14px;border-bottom:1px solid #eee;padding-bottom:5px">📷 Fotos — Antes do Serviço</h3><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">${fotosAntes}</div></div>` : ''}
            ${fotosDepois ? `<div style="margin:20px 0"><h3 style="color:#f97316;font-size:14px;border-bottom:1px solid #eee;padding-bottom:5px">📷 Fotos — Depois do Serviço</h3><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">${fotosDepois}</div></div>` : ''}
            ${vtJson.observacoes ? `<div style="margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px"><h3 style="color:#f97316;font-size:14px;margin:0 0 5px">Observações</h3><p style="margin:0">${escapeHtml(vtJson.observacoes)}</p></div>` : ''}
          `;
        }
      } catch (err) {
        console.error('Error parsing VT json report for print:', err);
      }
    }

    printWindow.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8"><title>${nome}</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:30px;color:#1a1a2e}
        .header{text-align:center;border-bottom:3px solid #f97316;padding-bottom:15px;margin-bottom:20px}
        .header h1{color:#f97316;font-size:20px;margin:0 0 5px}
        .info{margin-bottom:20px;padding:10px;background:#f9fafb;border-radius:8px;font-size:13px}
        .info p{margin:4px 0}
        .sig-section{margin-top:30px;text-align:center}
        .sig-img{max-width:300px;max-height:150px;border:1px solid #ccc;border-radius:4px}
        img.doc-img{max-width:100%;border-radius:8px;margin:10px 0}
        @media print{body{padding:15px}}
      </style></head><body>
      <div class="header"><h1>📄 ${nome}</h1></div>
      <div class="info">
        <p><strong>Cliente:</strong> ${clienteNome}</p>
        <p><strong>Tipo:</strong> ${tipo}</p>
        <p><strong>Data:</strong> ${data}</p>
      </div>
      ${isImage ? `<img src="${escapeHtml(doc.url)}" class="doc-img" />` : ''}
      ${extraHtml}
      ${doc.assinatura_cliente_url ? `<div class="sig-section"><p><strong>Assinatura do Cliente:</strong></p><img src="${escapeHtml(doc.assinatura_cliente_url)}" class="sig-img" /></div>` : ''}
      ${doc.assinatura_tecnico_url ? `<div class="sig-section"><p><strong>Assinatura do Técnico:</strong></p><img src="${escapeHtml(doc.assinatura_tecnico_url)}" class="sig-img" /></div>` : ''}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
    };
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {}
    }, 1500);
  }

  const filtered = documentos.filter(d => {
    const matchSearch = !searchTerm || 
      d.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.cliente_nome || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = !tipoFilter || d.tipo.startsWith(tipoFilter);
    return matchSearch && matchTipo;
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-display text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Documentos
        </h2>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou cliente..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tipoFilter}
              onChange={e => setTipoFilter(e.target.value)}
            >
              {TIPO_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {filtered.length} documento(s) encontrado(s)
        </div>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando documentos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhum documento encontrado</div>
        ) : filtered.map(doc => (
          <div key={doc.id} className="mobile-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{doc.cliente_nome}</p>
                <p className="text-xs text-muted-foreground truncate">{doc.nome}</p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                doc.tipo === 'checklist_vt_completo' ? 'bg-primary/20 text-primary' :
                doc.tipo.startsWith('foto_vt') ? 'bg-solar-info/20 text-solar-info' :
                'bg-muted text-muted-foreground'
              }`}>
                {TIPO_LABELS[doc.tipo] || doc.tipo}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{formatDate(doc.created_at.split('T')[0])}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setPreviewDoc(doc)} title="Visualizar">
                  <Eye className="w-4 h-4 text-solar-info" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handlePrint(doc)} title="Imprimir">
                  <Printer className="w-4 h-4 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(doc.id)} title="Excluir">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="glass-card rounded-xl overflow-hidden hidden sm:block">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando documentos...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Nome</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Assinatura</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-xs">{formatDate(doc.created_at.split('T')[0])}</td>
                  <td className="p-3 font-medium">{doc.cliente_nome}</td>
                  <td className="p-3 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      doc.tipo === 'checklist_vt_completo' ? 'bg-primary/20 text-primary' :
                      doc.tipo.startsWith('foto_vt') ? 'bg-solar-info/20 text-solar-info' :
                      doc.tipo === 'contrato' ? 'bg-solar-success/20 text-solar-success' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {TIPO_LABELS[doc.tipo] || doc.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{doc.nome}</td>
                  <td className="p-3 hidden md:table-cell">
                    {doc.assinatura_cliente_url ? (
                      <span className="text-xs text-solar-success font-medium">✓ Assinado</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setPreviewDoc(doc)} title="Visualizar">
                        <Eye className="w-4 h-4 text-solar-info" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handlePrint(doc)} title="Imprimir">
                        <Printer className="w-4 h-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(doc.id)} title="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum documento encontrado</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewDoc?.nome}</DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="font-medium text-muted-foreground">Cliente:</span> {previewDoc.cliente_nome}</p>
                <p><span className="font-medium text-muted-foreground">Tipo:</span> {TIPO_LABELS[previewDoc.tipo] || previewDoc.tipo}</p>
                <p><span className="font-medium text-muted-foreground">Data:</span> {formatDate(previewDoc.created_at.split('T')[0])}</p>
              </div>
              {previewDoc.url && previewDoc.url.match(/\.(jpg|jpeg|png|gif|webp)/i) && (
                <img src={previewDoc.url} alt={previewDoc.nome} className="w-full rounded-lg border" />
              )}
              {previewJsonData && (
                <div className="space-y-3 p-3 bg-muted/40 rounded-lg border text-xs">
                  <h4 className="font-semibold text-primary">Laudo da Vistoria Técnica</h4>
                  {previewJsonData.dados && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(previewJsonData.dados).map(([k, v]) => (
                        <div key={k} className="p-1.5 rounded bg-background border">
                          <span className="font-medium text-muted-foreground block text-[10px] uppercase">{k}</span>
                          <span className="font-mono">{String(v || '-')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {previewJsonData.fotos_antes?.length > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Fotos (Antes):</span>
                      <div className="grid grid-cols-2 gap-2">
                        {previewJsonData.fotos_antes.map((url: string, idx: number) => (
                          <img key={idx} src={url} alt={`Antes ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                        ))}
                      </div>
                    </div>
                  )}
                  {previewJsonData.fotos_depois?.length > 0 && (
                    <div>
                      <span className="font-medium text-muted-foreground block mb-1">Fotos (Depois):</span>
                      <div className="grid grid-cols-2 gap-2">
                        {previewJsonData.fotos_depois.map((url: string, idx: number) => (
                          <img key={idx} src={url} alt={`Depois ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {previewDoc.url && !previewDoc.url.match(/\.(jpg|jpeg|png|gif|webp)/i) && !previewJsonData && previewDoc.url !== '' && (
                <a href={previewDoc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Abrir documento</a>
              )}
              {previewDoc.assinatura_cliente_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Assinatura do Cliente:</p>
                  <img src={previewDoc.assinatura_cliente_url} alt="Assinatura" className="h-20 border rounded" />
                </div>
              )}
              {previewDoc.assinatura_tecnico_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Assinatura do Técnico:</p>
                  <img src={previewDoc.assinatura_tecnico_url} alt="Assinatura" className="h-20 border rounded" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
