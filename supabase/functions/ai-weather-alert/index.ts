import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rawCity = "Cabo Frio";
    try {
      const body = await req.json();
      if (body?.city && typeof body.city === "string") rawCity = body.city;
    } catch {
      // empty body fallback
    }

    const city = rawCity.replace(/[^a-zA-Z0-9À-ÿ\s\-\/\.]/g, "").slice(0, 50).trim() || "Região";

    // Read AI config from database
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: config } = await supabaseService
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

    // Telemetria climática em tempo real via Open-Meteo API aberta
    const weatherRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-22.88&longitude=-42.02&daily=precipitation_probability_max&timezone=America%2FSao_Paulo");
    const weatherData = await weatherRes.json();
    const probabilityTomorrow = weatherData?.daily?.precipitation_probability_max?.[1] || 0;

    let alert: string | null = null;
    if (probabilityTomorrow >= 75) {
      const candidates = [
        { url: getProviderEndpoint(provider, customEndpoint), key: primaryKey, model },
        { url: getProviderEndpoint(provider, customEndpoint), key: secondaryKey, model },
        { url: getProviderEndpoint(fallbackProvider), key: fallbackKey, model: fallbackModel },
      ].filter(c => Boolean(c.key));

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
                {
                  role: "system",
                  content: "Você é um despachante de operações de energia solar. Gere um alerta conciso de 1 frase recomendando remarcar limpezas por previsão de chuva.",
                },
                {
                  role: "user",
                  content: `Previsão de ${probabilityTomorrow}% de chuva amanhã em ${city}.`,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            alert = aiData.choices?.[0]?.message?.content || null;
            if (alert) break;
          }
        } catch (err) {
          console.warn(`Weather candidate ${cand.model} failed:`, err);
        }
      }

      // Fallback local se nenhuma chave responder
      if (!alert) {
        alert = `Previsão de ${probabilityTomorrow}% de chuva amanhã em ${city}. Recomendado remarcar vistorias e limpezas pendentes.`;
      }
    }

    return new Response(JSON.stringify({ probabilityTomorrow, alert }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
