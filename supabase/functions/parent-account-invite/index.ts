import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Mode = "prepare" | "execute";

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const reply = (origin: string | null, status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

function publicKey(): string {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const first = parsed.default || Object.values(parsed)[0];
      if (first) return String(first);
    } catch {}
  }
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (!legacy) throw new Error("publishable_key_unavailable");
  return legacy;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}•••@${domain}`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return reply(origin, 401, { error: "authentication_required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return reply(origin, 500, { error: "server_configuration_error" });

  let body: { mode?: Mode; parentId?: string; confirm?: boolean };
  try { body = await req.json(); } catch { return reply(origin, 400, { error: "invalid_json" }); }

  const userClient = createClient(supabaseUrl, publicKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return reply(origin, 401, { error: "invalid_session" });

  const { data: staff, error: staffError } = await userClient
    .from("staff")
    .select("id,role,status")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (staffError || !staff || staff.status !== "active" || staff.role !== "manager") {
    return reply(origin, 403, { error: "manager_required" });
  }

  const parentId = String(body.parentId || "").trim();
  if (!parentId || parentId.length > 100) return reply(origin, 400, { error: "parent_id_required" });

  const { data: parent, error: parentError } = await userClient
    .from("parents")
    .select("id,email,user_id,status")
    .eq("id", parentId)
    .maybeSingle();
  if (parentError || !parent) return reply(origin, 404, { error: "parent_not_found" });

  const email = String(parent.email || "").trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (parent.status !== "active") return reply(origin, 409, { error: "parent_inactive" });
  if (!validEmail) return reply(origin, 409, { error: "valid_parent_email_required" });

  const mode: Mode = body.mode === "execute" ? "execute" : "prepare";
  if (mode === "prepare") {
    return reply(origin, 200, {
      parentId: parent.id,
      maskedEmail: maskEmail(email),
      alreadyLinked: Boolean(parent.user_id),
      canInvite: !parent.user_id,
    });
  }

  if (body.confirm !== true) return reply(origin, 400, { error: "explicit_confirmation_required" });
  if (parent.user_id) return reply(origin, 409, { error: "parent_already_linked" });

  const { data: usersPage, error: listError } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    console.error("Parent invite user lookup failed", listError.message);
    return reply(origin, 500, { error: "auth_lookup_failed" });
  }

  const existing = (usersPage.users || []).filter((user) => String(user.email || "").trim().toLowerCase() === email);
  if (existing.length > 1) return reply(origin, 409, { error: "duplicate_auth_email" });

  let authUserId: string;
  let outcome: "linked_existing" | "invited";

  if (existing.length === 1) {
    const candidate = existing[0];
    const { count: staffCount, error: staffLinkError } = await serverClient
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("user_id", candidate.id);
    if (staffLinkError) return reply(origin, 500, { error: "staff_link_check_failed" });
    if ((staffCount || 0) > 0) return reply(origin, 409, { error: "auth_user_is_staff" });
    authUserId = candidate.id;
    outcome = "linked_existing";
  } else {
    const { data: invited, error: inviteError } = await serverClient.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invited.user) {
      console.error("Parent account invite failed", inviteError?.message || "missing_user");
      return reply(origin, 409, { error: "invite_failed" });
    }
    authUserId = invited.user.id;
    outcome = "invited";
  }

  const { data: linked, error: linkError } = await serverClient
    .from("parents")
    .update({ user_id: authUserId })
    .eq("id", parent.id)
    .is("user_id", null)
    .select("id")
    .maybeSingle();

  if (linkError || !linked) {
    console.error("Parent account link failed", linkError?.code || "state_mismatch");
    return reply(origin, 409, { error: "parent_link_failed" });
  }

  const { error: auditError } = await userClient.rpc("record_audit_log", {
    p_action: outcome === "invited" ? "PARENT_ACCOUNT_INVITED" : "PARENT_ACCOUNT_LINKED",
    p_details: JSON.stringify({ parentId: parent.id }),
  });
  if (auditError) console.error("Parent account audit failed", auditError.code);

  return reply(origin, 200, {
    parentId: parent.id,
    status: outcome,
    maskedEmail: maskEmail(email),
    auditLogged: !auditError,
  });
});
