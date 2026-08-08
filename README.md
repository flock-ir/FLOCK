# Flock

A visually-driven security incident management platform for CSIRTs.

## v0.2 baseline

- Cyber incident lifecycle: New → Triage → Investigation → Containment → Eradication → Recovery → Monitoring → Post Incident Review → Closed.
- Bidirectional phase movement from either the incident workspace or drag-and-drop workflow board.
- Every phase transition creates an audit event with actor, timestamp, previous phase, new phase and reason.
- Neutral two-word incident call signs (for example `purple-flock`) that do not encode severity, threat type, customer, region or classification.
- Phase-specific guidance/checklists.
- PR3TACK context placeholder ready for API integration.
- Browser persistence for prototype data; Worker/D1 persistence is the next backend milestone.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Vite outputs the production site to `dist/`.

## Cloudflare Pages from GitHub

Connect the GitHub repository to Cloudflare Pages and use:

- Framework preset: **Vite**
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: current LTS

No secrets are required for this frontend baseline.

## Next architecture milestone

The frontend is intended to move from browser storage to:

- Cloudflare Worker API
- Cloudflare D1 for incidents, tasks, audit and configuration
- Cloudflare R2 for evidence/files
- Cloudflare Access or organisation SSO for responder identity

Audit events should become append-only server-side records once the Worker/D1 layer is added.
