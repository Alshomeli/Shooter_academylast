import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TABLES = [
  "notifications", "audit_logs", "login_audit_logs", "videos", "tournaments",
  "transactions", "trainings", "matches", "attendance", "subscriptions",
  "parents", "players", "teams", "staff", "academy_settings",
];

const SEED_ORDER = [
  "staff", "teams", "players", "parents", "subscriptions",
  "attendance", "matches", "trainings", "transactions",
  "tournaments", "videos", "audit_logs", "academy_settings",
];

interface SetupRequest {
  reset?: boolean;
  confirm_reset?: boolean;
  createUsers?: boolean;
  staff?: Array<{ email: string; name: string; role: string }>;
  [key: string]: unknown;
}

/** Verify the caller's JWT and return the authenticated user id, or null. */
async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error } = await client.auth.getUser(token);
  if (error || !userData.user) return null;
  return userData.user.id;
}

/** Check if the caller is an active academy manager bound to this auth user id. */
async function isAcademyAdmin(userId: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await admin
    .from("staff")
    .select("role,status")
    .eq("user_id", userId)
    .limit(1);
  return data?.[0]?.role === "manager" && data?.[0]?.status === "active";
}

/** Generate a strong random one-time password for a provisioned account. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // ── Authenticate ──
    const callerUserId = await getCallerUserId(req);
    if (!callerUserId) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Authorize: only academy admins can reset/seed ──
    const admin = await isAcademyAdmin(callerUserId);
    if (!admin) {
      console.warn("[setup-academy] denied — authenticated user is not an active manager");
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json()) as SetupRequest;
    const reset = body.reset === true;

    // Production launch guard: setup/reset/seeding is an operator-only emergency
    // path and is disabled unless explicitly enabled as a server secret.
    // Normal users must onboard through reviewed parent/staff application flows.
    if (Deno.env.get("ALLOW_DESTRUCTIVE_SETUP") !== "true") {
      return new Response(
        JSON.stringify({ error: "destructive_setup_disabled" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (reset && body.confirm_reset !== true) {
      return new Response(
        JSON.stringify({ error: "Reset confirmation required. Set confirm_reset=true to proceed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (reset) {
      for (const table of TABLES) {
        const { error } = await adminClient.from(table).delete().neq("id", "__impossible__");
        if (error) throw new Error(`Failed to clear ${table}`);
      }
    }

    const { count } = await adminClient.from("staff").select("*", { count: "exact", head: true });
    const isEmpty = !count || count === 0;

    let seeded = false;
    if (isEmpty) {
      for (const table of SEED_ORDER) {
        const rows = body[table];
        if (Array.isArray(rows) && rows.length > 0) {
          const { error } = await adminClient.from(table).insert(rows);
          if (error) throw new Error(`Failed to insert ${table}`);
        }
      }
      seeded = true;
    }

    let usersCreated = 0;
    const temporaryPasswords: Array<{ email: string; password: string }> = [];
    if ((reset || body.createUsers) && Array.isArray(body.staff)) {
      for (const s of body.staff) {
        if (!s.email || !s.name) continue;
        await adminClient.auth.admin.deleteUserByEmail(s.email).catch(() => {});
        const password = generatePassword();
        const { error } = await adminClient.auth.admin.createUser({
          email: s.email,
          password,
          email_confirm: true,
          user_metadata: { name: s.name },
        });
        if (!error) {
          usersCreated++;
          temporaryPasswords.push({ email: s.email, password });
        }
      }
    }

    console.log(`[setup-academy] ok — seeded=${seeded} reset=${reset} usersCreated=${usersCreated}`);

    return new Response(
      JSON.stringify({ success: true, seeded, usersCreated, reset, temporaryPasswords }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[setup-academy] ${message}`);
    return new Response(
      JSON.stringify({ error: "Setup failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
