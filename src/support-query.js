// Version and OS filters describe one user message, not a tenant or an identity.
export function environmentFilter(url) {
  const fields = ['appVersion', 'appBuild', 'osName', 'osVersion'];
  const clauses = [], args = [];
  for (const field of fields) {
    if (!url.searchParams.has(field)) continue;
    const value = url.searchParams.get(field);
    if (value.length > 80 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('invalid_filter');
    clauses.push(`json_extract(f.client_context,'$.${field}') IS ?`);
    args.push(value === '' ? null : value);
  }
  return { clause: clauses.length ? `EXISTS (SELECT 1 FROM messages f WHERE f.thread_id=t.id AND f.sender='user' AND ${clauses.join(' AND ')})` : null, args };
}

export async function supportSettings(db, app) {
  const releases = await db.prepare(`SELECT json_extract(m.client_context,'$.appVersion') AS version,
    json_extract(m.client_context,'$.appBuild') AS build FROM messages m
    JOIN threads t ON t.id=m.thread_id JOIN installations i ON i.id=t.installation_id
    WHERE m.sender='user' AND i.app_id=? GROUP BY version,build ORDER BY max(m.created_at) DESC,version,build`)
    .bind(app.id).all();
  const systems = await db.prepare(`SELECT json_extract(m.client_context,'$.osName') AS name,
    json_extract(m.client_context,'$.osVersion') AS version FROM messages m
    JOIN threads t ON t.id=m.thread_id JOIN installations i ON i.id=t.installation_id
    WHERE m.sender='user' AND i.app_id=? GROUP BY name,version ORDER BY max(m.created_at) DESC,name,version`)
    .bind(app.id).all();
  return { app, releases: releases.results, systems: systems.results };
}
