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

function roundRobinFallback(
  agendamentos: any[],
  equipes: any[]
): Assignment[] {
  if (!equipes.length) return [];

  const groups: Record<string, any[]> = {};
  for (const ag of agendamentos) {
    const cidade = ag.clientes?.cidade || 'N/A';
    const key = `${ag.data_agendamento}_${cidade}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ag);
  }

  const assignments: Assignment[] = [];
  let eqIndex = 0;

  for (const key of Object.keys(groups).sort()) {
    const group = groups[key];
    const equipe = equipes[eqIndex % equipes.length];
    for (const ag of group) {
      assignments.push({
        agendamento_id: ag.id,
        equipe_id: equipe.id,
        motivo: `Distribuição inteligente regional: ${key}`,
      });
    }
    eqIndex++;
  }

  return assignments;
}

function getProviderEndpoint(provider: string, customEndpoint?: string | null): string {
  switch (provider) {
    case "openai": return "https://api.openai.com/v1/chat/completions";
    case "openrouter": return "https://openrouter.ai/api/v1/chat/completions";
    case "groq": return "https://api.groq.com/openai/v1/chat/completions";
    case "deepseek": return "https://api.deepseek.com/v1/chat/completions";
    case "custom": return customEndpoint || "http://localhost:11434/v1/chat/completions";
    case "gemini":
    default:
      return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  }
}

function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai": return "gpt-4o-mini";
    case "openrouter": return "google/gemini-2.5-flash";
    case "groq": return "llama-3.3-70b-versatile";
    case "deepseek": return "deepseek-chat";
    case "gemini":
    default:
      return "gemini-2.5-flash";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth guard
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Read AI config from database
    const { data: config } = await supabase
      .from("configuracoes")
      .select("ai_provider, ai_api_key, ai_api_key_secondary, ai_model, ai_custom_endpoint, ai_fallback_enabled, ai_fallback_provider, ai_fallback_model, ai_fallback_key")
      .limit(1)
      .maybeSingle();

    const provider = config?.ai_provider || Deno.env.get("AI_PROVIDER") || "gemini";
    const primaryKey = config?.ai_api_key || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENROUTER_API_KEY") || "";
    const secondaryKey = config?.ai_api_key_secondary || "";
    const model = config?.ai_model || getDefaultModel(provider);
    const customEndpoint = config?.ai_custom_endpoint || Deno.env.get("AI_CUSTOM_ENDPOINT");
    const fallbackProvider = config?.ai_fallback_provider || "groq";
    const fallbackModel = config?.ai_fallback_model || getDefaultModel(fallbackProvider);
    const fallbackKey = config?.ai_fallback_key || "";

    const today = new Date().toISOString().split("T")[0];

    const { data: agendamentos, error: agErr } = await supabase
      .from("agendamentos")
      .select("id, data_agendamento, tipo, status, hora, prioridade, cliente_id, equipe_id, clientes(nome, cidade, rua, uf)")
      .in("status", ["Pendente", "Confirmado", "Aguardando Confirmação"])
      .gte("data_agendamento", today)
      .order("data_agendamento", { ascending: true })
      .limit(100);

    if (agErr) throw agErr;

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
Designe a equipe ideal para cada agendamento agrupando pela mesma cidade e respeitando os limites operacionais (máx 2 limpezas por equipe/dia).
Retorne a chamada de função assign_teams.`;

    const userPrompt = `Equipes disponíveis: ${JSON.stringify(equipes.map(e => ({ id: e.id, nome: e.nome })))}
Agendamentos: ${JSON.stringify(agendamentos.map(a => ({
  id: a.id,
  data: a.data_agendamento,
  tipo: a.tipo,
  cidade: (a as any).clientes?.cidade || 'N/A',
})))}`;

    const candidates = [
      { url: getProviderEndpoint(provider, customEndpoint), key: primaryKey, model },
      { url: getProviderEndpoint(provider, customEndpoint), key: secondaryKey, model },
      { url: getProviderEndpoint(fallbackProvider), key: fallbackKey, model: fallbackModel },
    ].filter(c => Boolean(c.key));

    let assignments: Assignment[] | null = null;
    let usedFallback = false;

    for (const cand of candidates) {
      try {
        const aiResponse = await fetch(cand.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${cand.key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: cand.model,
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

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed.assignments?.length > 0) {
              assignments = parsed.assignments;
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`Route optimizer candidate ${cand.model} failed:`, err);
      }
    }

    // Fallback if AI calls failed
    if (!assignments || assignments.length === 0) {
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
    }

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
    return new Response(JSON.stringify({ error: e.message || "Erro no otimizador", applied: 0 }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
