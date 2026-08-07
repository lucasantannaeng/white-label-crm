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

    // Use verified user ID from JWT
    const userId = claimsData.claims.sub as string;

    const { image_base64, analysis_type } = await req.json();

    if (!image_base64) {
      return new Response(JSON.stringify({ error: "Imagem é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    if (analysis_type === "soiling") {
      systemPrompt = `Você é um especialista em análise de painéis solares. Analise a imagem enviada e:

1. Classifique o nível de sujeira (soiling) de 1 a 5:
   - 1: Muito limpo (quase novo)
   - 2: Levemente sujo (poeira fina)
   - 3: Moderadamente sujo (acúmulo visível)
   - 4: Muito sujo (camada espessa)
   - 5: Extremamente sujo (lodo, fezes de pássaros, musgo)

2. Se o nível for 1 ou 2, questione se a limpeza é realmente necessária.
3. Estime a perda de eficiência aproximada.

Responda em JSON com este formato:
{"nivel": <number>, "descricao": "<texto curto>", "perda_eficiencia": "<percentual estimado>", "recomendacao": "<ação sugerida>", "alerta_limpo": <boolean>}`;
    } else {
      systemPrompt = `Você é um especialista em qualidade de fotos técnicas de energia solar. Analise a imagem enviada e verifique:

1. A foto mostra o painel solar inteiro? (todas as fileiras visíveis)
2. O ângulo está adequado? (não está muito inclinado ou cortado)
3. A imagem está nítida? (não tremida ou desfocada)
4. Se for foto do inversor, ele está centralizado e legível?

Responda em JSON com este formato:
{"aprovada": <boolean>, "problemas": ["<lista de problemas encontrados>"], "sugestao": "<instrução para o técnico refazer se necessário>"}`;
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: analysis_type === "soiling" ? "Analise o nível de sujeira deste painel solar:" : "Verifique a qualidade desta foto técnica:" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
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
    let rawContent = aiData.choices?.[0]?.message?.content || "{}";

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    let result = {};
    try {
      result = JSON.parse(jsonMatch?.[0] || "{}");
    } catch {
      result = { raw: rawContent };
    }

    // Log using service role with verified user_id
    const supabaseService = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabaseService.from("ai_logs").insert({
      tipo: analysis_type === "soiling" ? "analise_sujeira" : "qualidade_foto",
      entrada: `image_analysis_${analysis_type}`,
      resposta: JSON.stringify(result),
      user_id: userId,
      metadata: { analysis_type },
    });

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
