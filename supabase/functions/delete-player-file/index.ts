import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeleteRequest {
  documentId?: string;
}

/** Verify the caller's JWT and return their email, or null. */
async function getCallerEmail(req: Request): Promise<string | null> {
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
  return userData.user.email?.toLowerCase() ?? null;
}

/** Escape LIKE/ILIKE wildcards so a user-supplied value matches literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

/** Check if the caller is an academy staff member. */
async function isAcademyMember(email: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // Case-insensitive but literal match. A raw ilike() would treat the caller's
  // own email as a LIKE pattern, so `%`/`_`/`\` must be escaped first.
  const { data } = await admin
    .from("staff")
    .select("role,status")
    .ilike("email", escapeLikePattern(email.toLowerCase()))
    .limit(1);
  const row = data?.[0];
  return !!row && row.status === "active" &&
    ["manager", "coach", "receptionist"].includes(row.role);
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
    const callerEmail = await getCallerEmail(req);
    if (!callerEmail) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Authorize: only academy staff can delete files ──
    const member = await isAcademyMember(callerEmail);
    if (!member) {
      console.warn(`[delete-player-file] denied for ${callerEmail} — not a staff member`);
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

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

    // 2. Defense-in-depth: reject if the file_path doesn't belong to its player.
    const expectedPrefix = `${row.player_id}/`;
    if (!row.file_path.startsWith(expectedPrefix)) {
      return new Response(
        JSON.stringify({ error: "Path does not match player" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Delete the storage object.
    const { error: storageErr } = await admin
      .storage
      .from("player-documents")
      .remove([row.file_path]);

    if (storageErr) {
      console.error("[delete-player-file] storage delete error:", storageErr.message);
    }

    // 4. Delete the database row.
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

    console.log(`[delete-player-file] ok for ${callerEmail} — doc ${documentId}`);

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
