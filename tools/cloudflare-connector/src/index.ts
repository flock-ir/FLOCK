import { Agent, routeAgentRequest } from "agents";

const CLOUDFLARE_API_MCP = "https://mcp.cloudflare.com/mcp";
const SERVER_ID = "cloudflare-api";

type Env = {
  CloudflareConnectorAgent: DurableObjectNamespace<CloudflareConnectorAgent>;
};

export class CloudflareConnectorAgent extends Agent<Env> {
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/health") && request.method === "GET") {
      return Response.json({
        ok: true,
        connector: "flock-cloudflare-connector",
        cloudflareMcp: CLOUDFLARE_API_MCP,
      });
    }

    if (url.pathname.endsWith("/connect") && request.method === "POST") {
      const result = await this.addMcpServer(
        "Cloudflare API",
        CLOUDFLARE_API_MCP,
        {
          id: SERVER_ID,
          transport: { type: "streamable-http" },
        },
      );

      if (result.state === "authenticating") {
        return Response.json({
          status: "authorization_required",
          serverId: result.id,
          authUrl: result.authUrl,
        });
      }

      return Response.json({
        status: "connected",
        serverId: result.id,
      });
    }

    if (url.pathname.endsWith("/state") && request.method === "GET") {
      return Response.json(this.getMcpServers());
    }

    return new Response("Not found", { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routeAgentRequest(request, env, { cors: true })) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
