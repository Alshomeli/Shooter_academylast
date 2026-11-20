import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://shooter.academy",
  "https://www.shooter.academy",
  "https://shooter-academy-new-1vvk.bolt.host",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const corsHeadersFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin":
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://shooter.academy",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Vary": "Origin",
});

interface DeleteRequest {
  documentId?: string;
}

interface StaffMember {
  id: string;
  role: string;
  status: string;
}

/** Verify the caller's JWT and return their user id, or null. */
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

/** Resolve the caller to an active staff member by user id, or null. */
async function getActiveStaffMember(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<StaffMember | null> {
  const { data } = await admin
    .from("staff")
    .select("id,role,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  if (!["manager", "coach", "receptionist"].includes(data.role)) return null;
  return data as StaffMember;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = corsHeadersFor(origin);

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Authorize: only active academy staff can delete files ──
    const staff = await getActiveStaffMember(admin, callerUserId);
    if (!staff) {
      console.warn(`[delete-player-file] denied for user ${callerUserId} — not an active staff member`);
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { documentId } = (await req.json()) as DeleteRequest;
    if (!documentId || typeof documentId !== "string") {
      return new Response(
        JSON.stringify({ error: "documentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Fetch the row (service role bypasses RLS).
    const { data: row, error: fetchErr } = await admin
      .from("player_documents")
      .select("id, file_path, player_id")
      .eq("id", documentId)
      .maybeSingle();

    if (fetchErr) {
      console.error("[delete-player-file] db lookup error:", fetchErr.message);
      return new Response(
        JSON.stringify({ error: "Database lookup failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!row) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Coaches may only delete documents of players on their own team.
    if (staff.role === "coach") {
      const { data: player } = await admin
        .from("players")
        .select("team_id")
        .eq("id", row.player_id)
        .maybeSingle();
      const teamId = player?.team_id;
      if (!teamId) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: team } = await admin
        .from("teams")
        .select("id")
        .eq("id", teamId)
        .eq("coach_id", staff.id)
        .maybeSingle();
      if (!team) {
        return new Response(
          JSON.stringify({ error: "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // 3. Defense-in-depth: the file_path must belong to its player and
    //    must not contain path traversal segments.
    const expectedPrefix = `${row.player_id}/`;
    if (!row.file_path.startsWith(expectedPrefix) || row.file_path.includes("..")) {
      return new Response(
        JSON.stringify({ error: "Path does not match player" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Delete the storage object.
    const { error: storageErr } = await admin
      .storage
      .from("player-documents")
      .remove([row.file_path]);

    if (storageErr) {
      console.error("[delete-player-file] storage delete error:", storageErr.message);
    }

    // 5. Delete the database row.
    const { error: rowErr } = await admin
      .from("player_documents")
      .delete()
      .eq("id", documentId);

    if (rowErr) {
      return new Response(
        JSON.stringify({ error: "Failed to delete document record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[delete-player-file] ok for user ${callerUserId} — doc ${documentId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error(`[delete-player-file] ${message}`);
    return new Response(
      JSON.stringify({ error: "Failed to delete file" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
