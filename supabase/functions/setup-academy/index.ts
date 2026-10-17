const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Cache-Control": "no-store",
};

// Retire the legacy reset/seed/account-provisioning endpoint permanently.
// Its table-wide deletes could remove every manager and academy settings, and
// partial failures could leave unrelated tables inconsistent. An environment
// flag or request confirmation must never re-enable those operations.
// Normal onboarding uses the reviewed parent/staff registration flows. Any
// future cleanup needs a verified restore and an approved, guarded ID manifest.
// Keep this handler free of database, Auth admin, Storage and network calls.
Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, Allow: "POST, OPTIONS", "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({ error: "destructive_setup_disabled" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
