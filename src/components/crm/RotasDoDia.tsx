import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Clock, Users, Route, ChevronDown, ChevronUp, Navigation, MessageSquare, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPriorityBadge } from './AgendaConflictDialog';
import { formatWhatsAppUrl } from '@/lib/formatters';

interface AgendamentoRota {
  id: string;
  tipo: string;
  hora: string | null;
  status: string;
  prioridade: string;
  cliente_nome: string;
  cidade: string;
  rua: string;
  numero: string;
  bairro: string;
  telefone: string;
}

interface EquipeRota {
  id: string;
  nome: string;
  agendamentos: AgendamentoRota[];
}

export default function RotasDoDia() {
  const [equipeRotas, setEquipeRotas] = useState<EquipeRota[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    loadRotas();
  }, []);

  async function loadRotas() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [{ data: agendamentos }, { data: equipes }] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('id, tipo, hora, status, prioridade, equipe_id, clientes(nome, cidade, rua, numero, bairro, telefone)')
          .eq('data_agendamento', today)
          .not('status', 'eq', 'Cancelado')
          .not('equipe_id', 'is', null)
          .order('hora', { ascending: true }),
        supabase.from('equipes').select('id, nome').eq('ativo', true),
      ]);

      if (!agendamentos || !equipes) { setLoading(false); return; }

      const rotaMap = new Map<string, EquipeRota>();
      for (const eq of equipes) {
        rotaMap.set(eq.id, { id: eq.id, nome: eq.nome, agendamentos: [] });
      }

      for (const ag of agendamentos) {
        const eqId = ag.equipe_id as string;
        const rota = rotaMap.get(eqId);
        if (!rota) continue;
        const cl = (ag as any).clientes;
        rota.agendamentos.push({
          id: ag.id,
          tipo: ag.tipo,
          hora: ag.hora,
          status: ag.status,
          prioridade: ag.prioridade,
          cliente_nome: cl?.nome || 'N/A',
          cidade: cl?.cidade || 'N/A',
          rua: cl?.rua || '',
          numero: cl?.numero || '',
          bairro: cl?.bairro || '',
          telefone: cl?.telefone || '',
        });
      }

      // Only show teams that have agendamentos today
      setEquipeRotas(
        Array.from(rotaMap.values()).filter(r => r.agendamentos.length > 0)
      );
    } catch (err) {
      console.error('Error loading rotas:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;
  if (equipeRotas.length === 0) return null;

  const totalServicos = equipeRotas.reduce((s, r) => s + r.agendamentos.length, 0);

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-2"
      >
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Route className="w-5 h-5 text-primary" />
          Rotas do Dia
          <span className="text-xs font-normal text-muted-foreground ml-2">
            {equipeRotas.length} equipe(s) · {totalServicos} serviço(s)
          </span>
        </h3>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {equipeRotas.map((equipe) => (
            <div key={equipe.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <Users className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{equipe.nome}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {equipe.agendamentos.length} serviço(s)
                </span>
              </div>

              <div className="space-y-2">
                {equipe.agendamentos.map((ag, idx) => {
                  const isLast = idx === equipe.agendamentos.length - 1;
                  return (
                    <div key={ag.id} className="relative pl-6">
                      {/* Timeline connector */}
                      <div className="absolute left-2 top-0 bottom-0 flex flex-col items-center">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full border-2 z-10",
                          ag.status === 'Concluído' ? 'bg-solar-success border-solar-success' :
                          ag.status === 'Confirmado' ? 'bg-primary border-primary' :
                          'bg-muted border-muted-foreground/30'
                        )} />
                        {!isLast && (
                          <div className="w-0.5 flex-1 bg-border mt-0.5" />
                        )}
                      </div>

                      <div className="pb-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">{ag.hora || '08:00'}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {ag.tipo.replace('Preventiva', 'Prev.').replace('Corretiva', 'Corr.').replace('Vistoria Técnica', 'V.T.')}
                          </span>
                          {ag.prioridade !== 'Normal' && (
                            <span className="text-xs">{getPriorityBadge(ag.prioridade)}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium mt-0.5">{ag.cliente_nome}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {ag.cidade}{ag.rua ? ` · ${ag.rua}` : ''}
                        </div>
                        
                        {/* Field Technician Actions: GPS Navigation & WhatsApp */}
                        <div className="flex items-center gap-2 mt-2 pt-1 border-t border-border/40">
                          {ag.rua && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${ag.rua}, ${ag.numero || ''}, ${ag.bairro || ''}, ${ag.cidade}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                              title="Abrir rota no Google Maps / Waze"
                            >
                              <Navigation className="w-3 h-3" />
                              Navegar GPS
                            </a>
                          )}
                          {ag.telefone && (
                            <a
                              href={formatWhatsAppUrl(ag.telefone, `Olá ${ag.cliente_nome}, nossa equipe técnica da Solar Service está a caminho para o atendimento hoje!`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline font-medium ml-auto"
                              title="Avisar cliente no WhatsApp"
                            >
                              <MessageSquare className="w-3 h-3" />
                              Avisar no WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
