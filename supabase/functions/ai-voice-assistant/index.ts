import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    // Use verified user ID from JWT, not from request body
    const userId = claimsData.claims.sub as string;

    const { query } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente técnico especializado em energia solar, focado em ajudar técnicos em campo.

CONHECIMENTO DE INVERSORES:

**Goodwe:**
- Erro 01: Falha de isolação. Desligue o disjuntor CC, verifique isolação dos cabos e conectores MC4.
- Erro 02: Sobretensão na rede. Verifique a tensão da rede com multímetro. Se estiver acima de 240V, contate a concessionária.
- Erro 03: Subtensão na rede. Verifique disjuntor CA e conexões do quadro de distribuição.
- Erro 04: Frequência da rede fora do range. Geralmente problema da concessionária, aguarde normalizar.
- Erro 08: Falha de GFCI. Desligue CC e CA, aguarde 5 min, religue. Se persistir, pode ser infiltração.
- Erro 23: Temperatura alta. Verifique ventilação do inversor, limpe filtros e verifique exposição solar direta.
- Erro 24: Corrente CC alta. Verifique se strings estão conectadas corretamente e não há curto-circuito.
- Erro 25: Corrente de fuga alta. Verifique isolação dos cabos, possível infiltração nos conectores.
- Erro 30: Falha de comunicação interna. Passo 1: Desligue o disjuntor CA. Passo 2: Verifique os cabos de comunicação. Passo 3: Aguarde 2 min e religue.
- Erro 99: Erro interno do processador. Reinicie o inversor (CC e CA desligados por 5 min).

**SAJ:**
- Erro E001: Falha na rede elétrica. Verifique conexão CA e disjuntores.
- Erro E002: Sobretensão CC. Verifique número de painéis por string (pode estar acima do limite).
- Erro E003: Subtensão CC. Painéis podem estar sujos ou sombreados. Verifique geração.
- Erro E010: Sobretemperatura. Melhore ventilação, verifique se está em local confinado.
- Erro E013: Falha de comunicação WiFi. Reinicie o stick WiFi, verifique sinal do roteador.
- Erro E018: Corrente residual alta. Verifique aterramento e isolação dos cabos CC.

**Fronius:**
- Erro 102: Sobretensão CA. Rede acima do limite, contate concessionária.
- Erro 301: Corrente de fuga. Verifique isolação, possível umidade nos cabos.
- Erro 306: Subtensão CC. String com baixa geração, verifique sombreamento/sujeira.
- Erro 307: Sobretensão CC. Muitos painéis em série, reconfigure strings.
- Erro 401: Sobretemperatura. Ventilação insuficiente.
- Erro 502: Falha de comunicação. Verifique cabo Ethernet ou WiFi card.
- Erro 516: Arc Fault (AFCI). PERIGO: Possível arco elétrico. Desligue TUDO e inspecione todas as conexões CC.

REGRAS DE RESPOSTA:
- Seja CURTO e DIRETO. O técnico está no telhado.
- Numere os passos de ação.
- Se envolver risco elétrico, SEMPRE alerte sobre segurança primeiro.
- Se não souber o erro exato, sugira os diagnósticos mais prováveis.
- Responda sempre em português brasileiro.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error: " + status);
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || "Sem resposta da IA.";

    // Log using service role to bypass RLS, with verified user_id
    const supabaseService = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabaseService.from("ai_logs").insert({
      tipo: "assistente_tecnico",
      entrada: query,
      resposta: answer,
      user_id: userId,
    });

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
