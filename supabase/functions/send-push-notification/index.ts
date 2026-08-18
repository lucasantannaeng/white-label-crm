import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// VAPID keys (public key matches the one in the frontend)
const VAPID_PUBLIC_KEY = "BHnJanU-CKj1B8EkdPC4PoIw0Rz_3igSfMNaJqSFmiIMayclrYm4E6gz8UKQhSkAbBsBtrLFH1lFQ5GDqBMsMPk";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado: Token ausente" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: userError } = await authClient.auth.getUser();
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado: Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { user_ids, titulo, mensagem, tipo = "info", metadata = {} } = await req.json();

    if (!user_ids?.length || !titulo || !mensagem) {
      return new Response(JSON.stringify({ error: "user_ids, titulo and mensagem are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Insert in-app notifications for all target users
    const notifications = user_ids.map((uid: string) => ({
      user_id: uid,
      titulo,
      mensagem,
      tipo,
      metadata,
    }));

    const { error: insertError } = await supabase.from("notificacoes").insert(notifications);
    if (insertError) {
      console.error("Insert notification error:", insertError);
    }

    // 2. Send Web Push notifications (if VAPID key is configured)
    let pushCount = 0;
    if (VAPID_PRIVATE_KEY) {
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("user_id", user_ids);

      if (subscriptions?.length) {
        for (const sub of subscriptions) {
          try {
            // Use web-push compatible fetch
            const payload = JSON.stringify({
              title: titulo,
              body: mensagem,
              icon: "/pwa-icon-192.png",
              data: { tipo, ...metadata },
            });

            // Simple push via fetch to endpoint
            const response = await fetch(sub.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "TTL": "86400",
              },
              body: payload,
            });

            if (response.ok) pushCount++;
            else if (response.status === 410) {
              // Subscription expired, clean up
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            }
          } catch (err) {
            console.error("Push send error:", err);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      notifications_created: user_ids.length,
      push_sent: pushCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
