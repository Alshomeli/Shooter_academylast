import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Legacy registration endpoint, permanently retired (410). It still receives
// probe traffic from old clients, so keep CORS honest: reflect an allowlisted
// Origin and fall back to the canonical production origin rather than to the
// deprecated Bolt staging domain. This mirrors parent-account-invite.
const ALLOWED_ORIGINS = new Set([
  "https://shooter.academy",
  "https://www.shooter.academy",
  "https://shooter-academy-new-1vvk.bolt.host",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://shooter.academy",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Vary": "Origin",
});

Deno.serve((req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  return new Response(JSON.stringify({
    error: "legacy_registration_endpoint_disabled",
    message: "Use the reviewed registration application flow.",
  }), {
    status: 410,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});