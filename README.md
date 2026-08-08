# Flock

**Framework for Linked Operations, Cases & Knowledge**

Flock is a Cloudflare-native security incident management platform for CSIRTs. The application, API, database and evidence storage all run on Cloudflare.

## Architecture

- **Cloudflare Worker** — API and application runtime
- **Workers Static Assets** — React/Vite frontend
- **Cloudflare D1** — incidents, phase tasks, audit history and evidence metadata
- **Cloudflare R2** — incident evidence and file objects
- **Cloudflare Access** — optional identity protection for production deployments

The runtime has no external database or application server dependency.

## Deploy from GitHub to Cloudflare

This repository is configured as a Cloudflare Workers application. Import the repository from **Workers & Pages → Create → Import a repository** and select `flock-ir/flock`.

Cloudflare should detect the project configuration from `wrangler.jsonc`. Use the repository root as the root directory.

Recommended build/deploy settings:

- Build command: `npm run build`
- Deploy command: `npm run deploy`
- Production branch: `main`

The deployment uses Wrangler automatic provisioning. On the first deployment Cloudflare will create and bind the required D1 database and R2 bucket. The deploy script then applies the D1 migrations.

No API keys or application secrets are required for the baseline deployment.

## One-command deployment

With Node.js and Wrangler authentication available:

```bash
npm install
npx wrangler login
npm run deploy
```

The deploy script builds the React application, deploys the Worker/static assets, provisions the Cloudflare bindings when required, and applies D1 migrations.

## Local development

Install dependencies:

```bash
npm install
```

Apply the local D1 schema:

```bash
npm run db:migrate:local
```

Start the Worker and frontend locally:

```bash
npm run dev
```

## Persistence model

The application bootstraps incident state from `/api/incidents` before loading the existing React UI. The UI's existing browser persistence is transparently synchronised back to D1 through the Worker API, so the v0.2 interface remains intact while Cloudflare becomes the source of truth.

If the D1 database is empty on first launch, the existing baseline incidents are written to D1 automatically when the UI performs its first state save. If the Cloudflare API backend cannot be reached during development, the UI continues to operate using browser storage.

Audit events are append-only at the API layer: existing audit rows are never updated or deleted by normal incident synchronisation.

## Evidence storage

R2-backed evidence endpoints are available now for the next UI milestone:

- `GET /api/incidents/:incidentId/evidence`
- `POST /api/incidents/:incidentId/evidence`
- `GET /api/evidence/:evidenceId`

Uploads use the request body as the evidence object and accept the original filename through the `X-Filename` header. Evidence metadata is recorded in D1 and the object itself is stored in R2.

## Authentication

The Worker recognises Cloudflare Access identity through the `Cf-Access-Authenticated-User-Email` header and records that identity for evidence uploads. The baseline can be deployed without Access for testing.

Before production use, place the Flock hostname behind **Cloudflare Access** and restrict it to your responder population. This keeps authentication entirely within Cloudflare while allowing the application to remain independent of a custom identity provider.

## API

- `GET /api/health` — Worker, D1 and R2 health
- `GET /api/session` — current Cloudflare Access identity, when present
- `GET /api/incidents` — retrieve incidents with tasks and audit history
- `PUT /api/incidents` — synchronise incident records
- `PUT /api/incidents/:id` — update one incident

## Incident lifecycle

Flock currently uses:

`New → Triage → Investigation → Containment → Eradication → Recovery → Monitoring → Post Incident Review → Closed`

Phase movement is bidirectional. Each transition creates an audit event containing actor, timestamp, prior phase, new phase and reason.

## Current release

**v0.3 — Cloudflare-native baseline**

This release converts the v0.2 browser prototype into a single Cloudflare application while retaining the existing incident workflow UI.
