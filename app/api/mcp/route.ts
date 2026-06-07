// Seeder MCP endpoint — a single stateless Streamable HTTP server, bundled into
// the app so every self-hosted fork exposes it at https://<domain>/api/mcp.
// Auth is a personal access token (Authorization: Bearer seed_pat_…) → the same
// Viewer the web app uses, plus a read|readwrite scope. The route owns auth +
// transport + the stateless-per-request lifecycle; lib/mcp/server.ts owns the
// tool registration.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { getViewerFromToken } from "@/lib/auth-token";
import { serverEnv } from "@/lib/env";
import { buildServer } from "@/lib/mcp/server";

// Reads headers/body → never prerender or cache.
export const dynamic = "force-dynamic";
// Do NOT set runtime = "edge": OpenNext runs route handlers in the Worker with
// nodejs_compat, where Web Crypto + Buffer are available.

function unauthorized(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message:
          "Unauthorized: provide a valid Seeder personal access token as 'Authorization: Bearer seed_pat_…'.",
      },
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="seeder-mcp"',
      },
    },
  );
}

function forbidden(message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message } }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}

// DNS-rebinding protection. A present Origin must be allow-listed; an absent
// Origin (typical for non-browser MCP clients) passes. When MCP_ALLOWED_ORIGINS
// is unset the check is a no-op — token auth still gates every request.
function originAllowed(request: Request): boolean {
  const allowed = serverEnv.mcpAllowedOrigins;
  if (allowed.length === 0) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return allowed.includes(origin);
}

async function handle(request: Request): Promise<Response> {
  if (!originAllowed(request)) {
    return forbidden("Origin not allowed.");
  }
  // Bearer-token auth ONLY — never fall back to the cookie session.
  const auth = await getViewerFromToken(request);
  if (!auth) return unauthorized();

  // Stateless JSON mode: fresh server + transport per request, no session id,
  // no SSE, no Redis — any Worker isolate can serve any request.
  const server = buildServer(auth);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;

// In stateless JSON mode there is no server-initiated notification stream, so
// the transport's GET handler would return a text/event-stream that is never
// written to and never closed — a hung, billable Worker connection. Answer GET
// deterministically with a JSON-RPC "method not allowed" instead.
export function GET(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Method not allowed; use POST." },
    }),
    {
      status: 405,
      headers: { "content-type": "application/json", allow: "POST" },
    },
  );
}
