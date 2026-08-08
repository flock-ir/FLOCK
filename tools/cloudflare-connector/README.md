# Flock Cloudflare Connector

This Worker is the bootstrap connector between Flock tooling and Cloudflare's official API MCP server.

## What v0.1 does

- Runs as a Cloudflare Agent/Worker.
- Connects to Cloudflare's official API MCP endpoint at `https://mcp.cloudflare.com/mcp`.
- Uses Streamable HTTP transport.
- Returns Cloudflare's OAuth authorization URL when account authorization is required.
- Persists the MCP connection in the Agent's Durable Object storage.
- Exposes connection state so we can confirm the authenticated Cloudflare account/tools before enabling write operations.

No Cloudflare mutation/deployment tools are exposed by this bootstrap version.

## Endpoints

After deployment, the Agent instance path is:

`/agents/cloudflare-connector-agent/default`

Health:

```bash
curl https://<worker-host>/agents/cloudflare-connector-agent/default/health
```

Start/restore the Cloudflare API MCP connection:

```bash
curl -X POST https://<worker-host>/agents/cloudflare-connector-agent/default/connect
```

If Cloudflare authorization is required, the response contains `authUrl`. Open that URL and authorize the intended Cloudflare account.

Inspect MCP connection state and discovered tools:

```bash
curl https://<worker-host>/agents/cloudflare-connector-agent/default/state
```

## Local development

```bash
npm install
npm run check
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Security plan

The next version should expose a narrow allowlist of high-level operations rather than passing through the entire Cloudflare API. Initial candidates:

- account identity / account selection
- list Workers
- deploy/update a Worker
- create/list D1 databases
- execute approved D1 migration operations
- create/list R2 buckets
- deployment status

Destructive operations should require explicit confirmation and should be auditable.
