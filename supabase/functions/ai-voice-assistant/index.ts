import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ERROR_KNOWLEDGE: Record<string, string> = {
  "goodwe": "Diagnóstico Goodwe:\n1. Erro 01 (Isolação): Desligue CC, teste conectores MC4 e cabos com megômetro.\n2. Erro 02/03 (Tensão de Rede): Meça CA com multímetro (tensão fora dos limites 220V/380V).\n3. Erro 30 (Comunicação): Desligue CA, aguarde 2 minutos e religue.",
  "saj": "Diagnóstico SAJ:\n1. Erro E001 (Rede CA): Verifique disjuntor do quadro e conexões CA.\n2. Erro E002 (Sobretensão CC): Verifique se a string excede a tensão máxima do MPPT.\n3. Erro E013 (WiFi): Reinicie o stick de monitoramento e confira sinal 2.4GHz.",
  "fronius": "Diagnóstico Fronius:\n1. Erro 516 (AFCI / Arco Elétrico): PERIGO! Desligue tudo imediatamente e verifique aperto dos bornes CC.\n2. Erro 102 (Sobretensão CA): Verifique a tensão da concessionária.\n3. Erro 301 (Fuga de Corrente): Inspecione isolação dos módulos e caixas de junção.",
};

function getLocalKnowledgeFallback(query: string): string {
  const q = query.toLowerCase();
  for (const [brand, info] of Object.entries(ERROR_KNOWLEDGE)) {
    if (q.includes(brand)) return info;
  }
  return "Diagnóstico Geral de Campo (Modo de Resiliência):\n1. Desligue os disjuntores CA e a chave seccionadora CC.\n2. Aguarde 5 minutos para descarga completa dos capacitores.\n3. Inspecione conexões MC4, aterramento e aperte os bornes.\n4. Religue primeiro a chave CC e em seguida o disjuntor CA.";
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
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth guard
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub as string;
    const { query } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read AI configuration from database
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: config } = await supabaseService
      .from("configuracoes")
      .select("ai_provider, ai_api_key, ai_api_key_secondary, ai_model, ai_custom_endpoint, ai_fallback_enabled, ai_fallback_provider, ai_fallback_model, ai_fallback_key")
      .limit(1)
      .maybeSingle();

    const provider = config?.ai_provider || Deno.env.get("AI_PROVIDER") || "gemini";
    const primaryKey = config?.ai_api_key || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY") || Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("GROQ_API_KEY") || "";
    const secondaryKey = config?.ai_api_key_secondary || "";
    const model = config?.ai_model || getDefaultModel(provider);
    const customEndpoint = config?.ai_custom_endpoint || Deno.env.get("AI_CUSTOM_ENDPOINT");
    const fallbackEnabled = config?.ai_fallback_enabled ?? true;
    const fallbackProvider = config?.ai_fallback_provider || "groq";
    const fallbackModel = config?.ai_fallback_model || getDefaultModel(fallbackProvider);
    const fallbackKey = config?.ai_fallback_key || "";

    const systemPrompt = `Você é um assistente técnico especializado em energia solar, focado em ajudar técnicos em campo.
REGRAS:
- Seja CURTO e DIRETO. O técnico está no telhado.
- Numere os passos de ação.
- Se envolver risco elétrico, SEMPRE alerte sobre segurança primeiro.
- Responda sempre em português brasileiro.`;

    const candidates = [
      { url: getProviderEndpoint(provider, customEndpoint), key: primaryKey, model },
      { url: getProviderEndpoint(provider, customEndpoint), key: secondaryKey, model },
      { url: getProviderEndpoint(fallbackProvider), key: fallbackKey, model: fallbackModel },
    ].filter(c => Boolean(c.key));

    let answer = "";

    for (const cand of candidates) {
      try {
        const aiResponse = await fetch(cand.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cand.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: cand.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: query },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          answer = aiData.choices?.[0]?.message?.content || "";
          if (answer) break;
        } else {
          console.warn(`Candidate ${cand.model} returned HTTP ${aiResponse.status}`);
        }
      } catch (err) {
        console.warn(`Candidate ${cand.model} request failed:`, err);
      }
    }

    // Fallback if AI call failed or no API key configured
    if (!answer && fallbackEnabled) {
      answer = getLocalKnowledgeFallback(query);
    } else if (!answer) {
      return new Response(JSON.stringify({ error: "Chave de IA não configurada ou cota esgotada em todas as chaves." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log to ai_logs
    await supabaseService.from("ai_logs").insert({
      tipo: "assistente_tecnico",
      entrada: query,
      resposta: answer,
      user_id: userId,
    });

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
