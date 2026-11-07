import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { McpServer } from "npm:@modelcontextprotocol/sdk@1.25.3/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@1.25.3/server/webStandardStreamableHttp.js";
import { Hono } from "npm:hono@^4.9.7";
import { z } from "npm:zod@^4.1.13";

type GatewayBody = Record<string, unknown>;

function projectUrl(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("server_configuration_error");
  return url.replace(/\/$/, "");
}

function mcpResourceUrl(): string {
  return `${projectUrl()}/functions/v1/chatgpt-mcp/mcp`;
}

function oauthResourceMetadataUrl(): string {
  return `${projectUrl()}/functions/v1/chatgpt-mcp/.well-known/oauth-protected-resource`;
}

function oauthResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [`${projectUrl()}/auth/v1`],
    bearer_methods_supported: ["header"],
  };
}

function unauthorizedResponse() {
  return Response.json(
    { error: "authentication_required" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "WWW-Authenticate": `Bearer resource_metadata="${oauthResourceMetadataUrl()}"`,
      },
    },
  );
}

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

async function gatewayCall(authHeader: string, body: GatewayBody) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("server_configuration_error");
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-operations-gateway`, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "apikey": publicKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ error: "invalid_gateway_response" }));
  if (!response.ok || data?.error) {
    throw new Error(String(data?.error || `gateway_http_${response.status}`));
  }
  return data;
}

async function validateUser(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return false;
  const client = createClient(supabaseUrl, publicKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return !error && Boolean(data.user);
}

function makeServer(authHeader: string) {
  const server = new McpServer(
    { name: "shooter-academy-admin", version: "1.0.0" },
    {
      instructions:
        "Use read-only summaries freely. For administrative changes, prepare the action first, show the preview to the user, and only execute after explicit confirmation. Never bypass role checks or the operations gateway.",
    },
  );

  server.registerTool(
    "get_operations_snapshot",
    {
      title: "Get academy operations snapshot",
      description: "Get a privacy-safe aggregate summary for the signed-in staff member.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      const data = await gatewayCall(authHeader, { mode: "snapshot" });
      return { structuredContent: data, content: [{ type: "text", text: JSON.stringify(data) }] };
    },
  );

  server.registerTool(
    "get_recent_admin_actions",
    {
      title: "Get recent administrative actions",
      description: "List the signed-in staff member's recent safe action requests and results.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      const data = await gatewayCall(authHeader, { mode: "history" });
      return { structuredContent: data, content: [{ type: "text", text: JSON.stringify(data) }] };
    },
  );

  const prepare = async (operation: string, params: Record<string, unknown>) => {
    const data = await gatewayCall(authHeader, { mode: "prepare", operation, params });
    return {
      structuredContent: data,
      content: [{ type: "text", text: "Prepared only. No business data was changed. Show this preview and obtain explicit user confirmation before execution.\n" + JSON.stringify(data) }],
    };
  };

  server.registerTool(
    "prepare_subscription_payment",
    {
      title: "Prepare subscription payment",
      description: "Prepare a subscription payment for preview. This does not mark the subscription paid.",
      inputSchema: {
        subscriptionId: z.string().min(1),
        paymentMethod: z.string().min(1),
        transactionDate: z.string().optional(),
        description: z.string().max(500).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => prepare("record_subscription_payment", args),
  );

  server.registerTool(
    "prepare_attendance",
    {
      title: "Prepare attendance entry",
      description: "Prepare an attendance entry for preview. This does not record attendance yet.",
      inputSchema: {
        playerId: z.string().min(1),
        sessionDate: z.string().min(10),
        sessionType: z.enum(["training", "match"]).default("training"),
        status: z.enum(["present", "absent", "excused"]).default("present"),
        notes: z.string().max(500).optional(),
        trainingId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => prepare("record_attendance", args),
  );

  server.registerTool(
    "prepare_evaluation_publish",
    {
      title: "Prepare player evaluation publish",
      description: "Prepare publishing a draft player evaluation. This does not publish it yet.",
      inputSchema: { evaluationId: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => prepare("publish_player_evaluation", args),
  );

  server.registerTool(
    "prepare_subscription_create",
    {
      title: "Prepare subscription creation",
      description: "Prepare a new unpaid subscription using academy-configured pricing.",
      inputSchema: {
        playerId: z.string().min(1),
        planType: z.enum(["monthly", "quarterly", "semi_annual", "annual"]),
        startDate: z.string().min(10),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => prepare("create_subscription", args),
  );

  server.registerTool(
    "prepare_registration_approval",
    {
      title: "Prepare registration approval",
      description: "Prepare approval of a registration application for preview.",
      inputSchema: { applicationId: z.string().min(1) },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => prepare("approve_registration", args),
  );

  server.registerTool(
    "prepare_registration_review",
    {
      title: "Prepare registration review decision",
      description: "Prepare a non-approval registration review decision for preview.",
      inputSchema: {
        applicationId: z.string().min(1),
        status: z.enum(["under_review", "needs_info", "rejected"]),
        notes: z.string().max(1000).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => prepare("review_registration", args),
  );

  server.registerTool(
    "execute_prepared_admin_action",
    {
      title: "Execute prepared administrative action",
      description: "Execute a previously prepared action only after the user has explicitly confirmed the shown preview.",
      inputSchema: {
        requestId: z.string().uuid(),
        confirm: z.literal(true),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ requestId }) => {
      const data = await gatewayCall(authHeader, { mode: "execute", requestId, confirm: true });
      return { structuredContent: data, content: [{ type: "text", text: JSON.stringify(data) }] };
    },
  );

  server.registerTool(
    "cancel_prepared_admin_action",
    {
      title: "Cancel prepared administrative action",
      description: "Cancel a pending prepared action without changing business data.",
      inputSchema: { requestId: z.string().uuid() },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ requestId }) => {
      const data = await gatewayCall(authHeader, { mode: "cancel", requestId });
      return { structuredContent: data, content: [{ type: "text", text: JSON.stringify(data) }] };
    },
  );

  return server;
}

const app = new Hono().basePath("/chatgpt-mcp");

app.get("/.well-known/oauth-protected-resource", () =>
  Response.json(oauthResourceMetadata(), {
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  }),
);

app.get("/oauth-protected-resource", () =>
  Response.json(oauthResourceMetadata(), {
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  }),
);

app.all("/mcp", async (c) => {
  const authHeader = c.req.header("authorization") || "";
  if (!authHeader.startsWith("Bearer ") || !(await validateUser(authHeader))) {
    return unauthorizedResponse();
  }

  const server = makeServer(authHeader);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});

Deno.serve((req) => {
  const pathname = new URL(req.url).pathname;
  if (pathname.endsWith("/chatgpt-mcp/health")) {
    return Response.json({
      status: "ok",
      service: "shooter-academy-admin-mcp",
      version: "1.0.0",
      authentication: "supabase-oauth",
      mutationFlow: "prepare-confirm-execute",
    }, {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
  return app.fetch(req);
});
