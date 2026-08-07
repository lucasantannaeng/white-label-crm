import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: caller }, error: userError } = await userClient.auth.getUser();

    if (userError || !caller) {
      console.error("Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = caller.id;

    // Check admin role
    const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", callerId).in("role", ["admin", "master"]).limit(1);
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem gerenciar usuários" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, ...body } = await req.json();

    // Helper to insert audit log
    const audit = async (actionName: string, targetUserId: string | null, details: Record<string, unknown>) => {
      await adminClient.from("audit_logs").insert({
        actor_id: callerId,
        action: actionName,
        target_user_id: targetUserId,
        details,
      });
    };

    if (action === "list") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers();
      if (error) throw error;

      const { data: allRoles } = await adminClient.from("user_roles").select("user_id, role");
      const { data: profiles } = await adminClient.from("profiles").select("id, nome");

      const roleMap: Record<string, string> = {};
      allRoles?.forEach((r: any) => { roleMap[r.user_id] = r.role; });
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { nameMap[p.id] = p.nome; });

      const result = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        nome: nameMap[u.id] || u.user_metadata?.nome || "",
        role: roleMap[u.id] || "viewer",
        created_at: u.created_at,
      }));

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const { email, password, nome, role } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: newUser, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome: nome || "" },
      });
      if (error) throw error;

      if (role && role !== "viewer") {
        await adminClient.from("user_roles").update({ role }).eq("user_id", newUser.user.id);
      }

      await audit("user_created", newUser.user.id, { email, nome, role: role || "viewer" });

      return new Response(JSON.stringify({ success: true, id: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_role") {
      const { user_id, role } = body;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id e role são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Você não pode alterar seu próprio papel" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: updated, error } = await adminClient.from("user_roles").update({ role }).eq("user_id", user_id).select();
      if (error) throw error;

      if (!updated || updated.length === 0) {
        const { error: insertErr } = await adminClient.from("user_roles").insert({ user_id, role });
        if (insertErr) throw insertErr;
      }

      await audit("role_updated", user_id, { role });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_profile") {
      const { user_id, nome, email } = body as { user_id?: string; nome?: string; email?: string };
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const nomeTrim = typeof nome === "string" ? nome.trim() : undefined;
      const emailTrim = typeof email === "string" ? email.trim() : undefined;

      const { data: authUserData, error: authUserErr } = await adminClient.auth.admin.getUserById(user_id);
      if (authUserErr || !authUserData?.user) throw new Error("Usuário não encontrado");

      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("nome, email")
        .eq("id", user_id)
        .maybeSingle();

      const finalNome = nomeTrim ?? existingProfile?.nome ?? (authUserData.user.user_metadata as any)?.nome ?? "";
      const finalEmail = emailTrim ?? authUserData.user.email ?? existingProfile?.email ?? null;

      const authUpdates: Record<string, unknown> = {};
      if (emailTrim) authUpdates.email = emailTrim;
      if (nomeTrim !== undefined) {
        authUpdates.user_metadata = {
          ...(authUserData.user.user_metadata || {}),
          nome: nomeTrim,
        };
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authUpdateErr } = await adminClient.auth.admin.updateUserById(user_id, authUpdates);
        if (authUpdateErr) throw authUpdateErr;
      }

      const { error: profileErr } = await adminClient
        .from("profiles")
        .upsert({ id: user_id, nome: finalNome, email: finalEmail }, { onConflict: "id" });
      if (profileErr) throw profileErr;

      const vendedorUpdate: Record<string, unknown> = {};
      if (nomeTrim !== undefined) vendedorUpdate.nome = finalNome;
      if (emailTrim) vendedorUpdate.email = finalEmail;

      if (Object.keys(vendedorUpdate).length > 0) {
        const { data: vendRows, error: vendErr } = await adminClient
          .from("vendedores")
          .update(vendedorUpdate)
          .eq("user_id", user_id)
          .select("id")
          .limit(1);
        if (vendErr) throw vendErr;

        if (!vendRows || vendRows.length === 0) {
          const { error: vendInsertErr } = await adminClient.from("vendedores").insert({
            user_id,
            nome: finalNome,
            email: finalEmail,
          });
          if (vendInsertErr) throw vendInsertErr;
        }
      }

      await audit("profile_updated", user_id, { nome: finalNome, email: finalEmail });

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "user_id e password são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if ((password as string).length < 6) {
        return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await adminClient.auth.admin.updateUserById(user_id as string, { password: password as string });
      if (error) throw error;

      await audit("password_changed", user_id, {});

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Você não pode excluir sua própria conta" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      await audit("user_deleted", user_id, {});

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("manage-users error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
