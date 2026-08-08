const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});

function actorFromRequest(request) {
  return request.headers.get('cf-access-authenticated-user-email') ||
    request.headers.get('x-flock-actor') ||
    'Current responder';
}

function safeName(name = 'evidence.bin') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'evidence.bin';
}

async function getIncidents(env) {
  const { results = [] } = await env.DB.prepare(`
    SELECT id, codename, title, severity, phase, owner, source, created_at, summary, tags_json
    FROM incidents ORDER BY created_at DESC
  `).all();

  if (!results.length) return [];

  const incidents = [];
  for (const row of results) {
    const tasks = await env.DB.prepare(`
      SELECT label, done FROM incident_tasks WHERE incident_id = ? ORDER BY sort_order, id
    `).bind(row.id).all();
    const audit = await env.DB.prepare(`
      SELECT id, at, actor, type, message, from_phase, to_phase, reason
      FROM audit_events WHERE incident_id = ? ORDER BY at DESC
    `).bind(row.id).all();

    incidents.push({
      id: row.id,
      codename: row.codename,
      title: row.title,
      severity: row.severity,
      phase: row.phase,
      owner: row.owner,
      source: row.source,
      createdAt: row.created_at,
      summary: row.summary,
      tags: JSON.parse(row.tags_json || '[]'),
      tasks: (tasks.results || []).map(t => ({ label: t.label, done: Boolean(t.done) })),
      audit: (audit.results || []).map(a => ({
        id: a.id,
        at: a.at,
        actor: a.actor,
        type: a.type,
        message: a.message,
        from: a.from_phase || undefined,
        to: a.to_phase || undefined,
        reason: a.reason || undefined,
      })),
    });
  }
  return incidents;
}

async function upsertIncident(env, incident) {
  await env.DB.prepare(`
    INSERT INTO incidents (id, codename, title, severity, phase, owner, source, created_at, summary, tags_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      codename = excluded.codename,
      title = excluded.title,
      severity = excluded.severity,
      phase = excluded.phase,
      owner = excluded.owner,
      source = excluded.source,
      summary = excluded.summary,
      tags_json = excluded.tags_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    incident.id,
    incident.codename,
    incident.title,
    incident.severity,
    incident.phase,
    incident.owner,
    incident.source,
    incident.createdAt,
    incident.summary || '',
    JSON.stringify(incident.tags || []),
  ).run();

  await env.DB.prepare('DELETE FROM incident_tasks WHERE incident_id = ?').bind(incident.id).run();
  for (const [index, task] of (incident.tasks || []).entries()) {
    await env.DB.prepare(`
      INSERT INTO incident_tasks (incident_id, label, done, sort_order) VALUES (?, ?, ?, ?)
    `).bind(incident.id, task.label, task.done ? 1 : 0, index).run();
  }

  for (const event of (incident.audit || [])) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO audit_events
      (id, incident_id, at, actor, type, message, from_phase, to_phase, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.id,
      incident.id,
      event.at,
      event.actor || 'Flock',
      event.type || 'event',
      event.message || '',
      event.from || null,
      event.to || null,
      event.reason || null,
    ).run();
  }
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (url.pathname === '/api/health') {
    const db = await env.DB.prepare('SELECT 1 AS ok').first();
    return json({ ok: true, service: 'flock', database: db?.ok === 1, evidence: Boolean(env.EVIDENCE) });
  }

  if (url.pathname === '/api/session' && method === 'GET') {
    return json({ actor: actorFromRequest(request), accessProtected: Boolean(request.headers.get('cf-access-authenticated-user-email')) });
  }

  if (url.pathname === '/api/incidents' && method === 'GET') {
    return json({ incidents: await getIncidents(env) });
  }

  if (url.pathname === '/api/incidents' && method === 'PUT') {
    const body = await request.json();
    if (!Array.isArray(body.incidents)) return json({ error: 'incidents must be an array' }, 400);
    for (const incident of body.incidents) await upsertIncident(env, incident);
    return json({ ok: true, count: body.incidents.length });
  }

  const incidentMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)$/);
  if (incidentMatch && method === 'PUT') {
    const incident = await request.json();
    if (!incident?.id || incident.id !== decodeURIComponent(incidentMatch[1])) return json({ error: 'incident id mismatch' }, 400);
    await upsertIncident(env, incident);
    return json({ ok: true });
  }

  const evidenceListMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/evidence$/);
  if (evidenceListMatch && method === 'GET') {
    const incidentId = decodeURIComponent(evidenceListMatch[1]);
    const { results = [] } = await env.DB.prepare(`
      SELECT id, filename, content_type, size, uploaded_at, uploaded_by
      FROM evidence WHERE incident_id = ? ORDER BY uploaded_at DESC
    `).bind(incidentId).all();
    return json({ evidence: results });
  }

  if (evidenceListMatch && method === 'POST') {
    const incidentId = decodeURIComponent(evidenceListMatch[1]);
    const filename = safeName(request.headers.get('x-filename') || 'evidence.bin');
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const id = crypto.randomUUID();
    const key = `${incidentId}/${id}-${filename}`;
    const body = await request.arrayBuffer();
    await env.EVIDENCE.put(key, body, { httpMetadata: { contentType } });
    await env.DB.prepare(`
      INSERT INTO evidence (id, incident_id, object_key, filename, content_type, size, uploaded_at, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(id, incidentId, key, filename, contentType, body.byteLength, actorFromRequest(request)).run();
    return json({ ok: true, id, filename, size: body.byteLength }, 201);
  }

  const evidenceMatch = url.pathname.match(/^\/api\/evidence\/([^/]+)$/);
  if (evidenceMatch && method === 'GET') {
    const id = decodeURIComponent(evidenceMatch[1]);
    const record = await env.DB.prepare(`
      SELECT object_key, filename, content_type FROM evidence WHERE id = ?
    `).bind(id).first();
    if (!record) return json({ error: 'Evidence not found' }, 404);
    const object = await env.EVIDENCE.get(record.object_key);
    if (!object) return json({ error: 'Evidence object missing' }, 404);
    return new Response(object.body, {
      headers: {
        'content-type': record.content_type || 'application/octet-stream',
        'content-disposition': `attachment; filename="${safeName(record.filename)}"`,
        'cache-control': 'private, no-store',
      },
    });
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: 'Internal server error', detail: String(error?.message || error) }, 500);
    }
  },
};
