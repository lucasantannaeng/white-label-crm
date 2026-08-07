import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Assignment {
  agendamento_id: string;
  equipe_id: string;
  motivo: string;
}

/**
 * Round-robin fallback: assigns teams evenly across unassigned agendamentos,
 * grouping by city when possible.
 */
function roundRobinFallback(
  agendamentos: any[],
  equipes: any[]
): Assignment[] {
  if (!equipes.length) return [];

  // Group agendamentos by date+city for smarter round-robin
  const groups: Record<string, any[]> = {};
  for (const ag of agendamentos) {
    const cidade = ag.clientes?.cidade || 'N/A';
    const key = `${ag.data_agendamento}_${cidade}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ag);
  }

  const assignments: Assignment[] = [];
  let eqIndex = 0;

  // Assign each group to the same team, rotating between teams
  for (const key of Object.keys(groups).sort()) {
    const group = groups[key];
    const equipe = equipes[eqIndex % equipes.length];
    for (const ag of group) {
      assignments.push({
        agendamento_id: ag.id,
        equipe_id: equipe.id,
        motivo: `Fallback round-robin: ${key}`,
      });
    }
    eqIndex++;
  }

  return assignments;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth guard
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date().toISOString().split("T")[0];

    const { data: agendamentos, error: agErr } = await supabase
      .from("agendamentos")
      .select("id, data_agendamento, tipo, status, hora, prioridade, cliente_id, equipe_id, clientes(nome, cidade, rua, uf)")
      .in("status", ["Pendente", "Confirmado", "Aguardando Confirmação"])
      .gte("data_agendamento", today)
      .order("data_agendamento", { ascending: true })
      .limit(100);

    if (agErr) { console.error("Error fetching agendamentos:", agErr); throw agErr; }

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nenhum agendamento ativo.", applied: 0, assignments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: equipes } = await supabase.from("equipes").select("id, nome, membros").eq("ativo", true);

    if (!equipes || equipes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Nenhuma equipe ativa cadastrada.", applied: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um otimizador de rotas para uma empresa de energia solar.
Você receberá TODOS os agendamentos ativos (com e sem equipe já designada).
Sua tarefa é designar a equipe IDEAL para CADA agendamento, otimizando as rotas do dia.
Mesmo agendamentos que já possuem equipe podem ser re-designados se isso melhorar a rota geral.

Regras OBRIGATÓRIAS:
1. Agrupe clientes da mesma CIDADE no mesmo dia para a mesma equipe.
2. Cada equipe pode fazer no máximo 2 limpezas por dia.
3. Se a equipe tem 1 limpeza, pode fazer até 2 V.T.s. Se tem 2 limpezas, 0 V.T.s. Se 0 limpezas, até 4 V.T.s.
4. Distribua o trabalho igualitariamente entre as equipes quando possível.
5. TODOS os agendamentos DEVEM receber uma equipe. Nenhum pode ficar sem designação.
6. Use a função assign_teams para retornar as designações.

REGRAS DE PRIORIDADE:
- 🔴 Urgente: DEVE ser atendido no dia agendado.
- 🟠 Alta: Atender no dia agendado sempre que possível.
- 🔵 Normal: Distribuir normalmente.
- 🟢 Baixa: Pode ser adiado se necessário.

Priorize: Urgente > Alta > Normal > Baixa.`;

    const userPrompt = `Equipes disponíveis: ${JSON.stringify(equipes.map(e => ({ id: e.id, nome: e.nome })))}

TODOS os agendamentos ativos (otimize as rotas para todos):
${JSON.stringify(agendamentos.map(a => ({
  id: a.id,
  data: a.data_agendamento,
  tipo: a.tipo,
  status: a.status,
  prioridade: a.prioridade || 'Normal',
  equipe_atual: a.equipe_id || 'SEM EQUIPE',
  cidade: (a as any).clientes?.cidade || 'N/A',
  cliente: (a as any).clientes?.nome || 'N/A',
})))}

Designe CADA agendamento a uma equipe, otimizando as rotas por cidade/dia.`;

    // Retry logic: up to 2 attempts with AI, then fallback to round-robin
    const MAX_RETRIES = 2;
    let assignments: Assignment[] | null = null;
    let usedFallback = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "assign_teams",
                description: "Assign equipe to each agendamento",
                parameters: {
                  type: "object",
                  properties: {
                    assignments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          agendamento_id: { type: "string" },
                          equipe_id: { type: "string" },
                          motivo: { type: "string" },
                        },
                        required: ["agendamento_id", "equipe_id", "motivo"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["assignments"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "assign_teams" } },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`AI attempt ${attempt} error:`, aiResponse.status, errText);

          // Non-retryable errors
          if (aiResponse.status === 402) {
            return new Response(JSON.stringify({ error: "Créditos de IA insuficientes.", applied: 0 }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (attempt < MAX_RETRIES) {
            // Wait before retry (exponential: 2s, 4s)
            await new Promise(r => setTimeout(r, attempt * 2000));
            continue;
          }
          // All retries exhausted, will fallback below
          break;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.error(`AI attempt ${attempt} no tool call:`, JSON.stringify(aiData));
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, attempt * 2000));
            continue;
          }
          break;
        }

        const parsed = JSON.parse(toolCall.function.arguments);
        if (parsed.assignments?.length > 0) {
          assignments = parsed.assignments;
          break; // Success
        }

        console.warn(`AI attempt ${attempt} returned empty assignments`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
      } catch (aiErr) {
        console.error(`AI attempt ${attempt} exception:`, aiErr);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
      }
    }

    // Fallback: round-robin if AI failed
    if (!assignments || assignments.length === 0) {
      console.warn("AI failed after retries, using round-robin fallback");
      assignments = roundRobinFallback(agendamentos, equipes);
      usedFallback = true;
    }

    const validAgIds = new Set(agendamentos.map(a => a.id));
    const validEqIds = new Set(equipes.map(e => e.id));

    let applied = 0;
    for (const a of assignments) {
      if (!validAgIds.has(a.agendamento_id) || !validEqIds.has(a.equipe_id)) continue;
      const { error } = await supabase.from("agendamentos").update({ equipe_id: a.equipe_id }).eq("id", a.agendamento_id);
      if (!error) applied++;
      else console.error("Update error:", a.agendamento_id, error);
    }

    await supabase.from("ai_logs").insert({
      tipo: "route_optimizer",
      entrada: userPrompt.substring(0, 500),
      resposta: JSON.stringify(assignments).substring(0, 1000),
      metadata: { total: agendamentos.length, applied, usedFallback },
    });

    return new Response(JSON.stringify({
      success: true,
      applied,
      total: assignments.length,
      usedFallback,
      assignments,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Route optimizer error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal server error", applied: 0 }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
