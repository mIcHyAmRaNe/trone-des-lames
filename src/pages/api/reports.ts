import type { APIRoute } from 'astro';
import { isAdmin, clientIp } from '../../lib/auth.js';
import { createReport, listReports } from '../../lib/catalog-store.js';
import type { ReportRequest } from '../../lib/catalog-submit.js';
import type { Lang } from '../../i18n/index.js';

/** Plafond par instance, comme le frein de connexion admin : 10 signalements / heure / IP. */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) hits.clear();
  return true;
}

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return Response.json({ error: 'forbidden' }, { status: 403 });
  const status = url.searchParams.get('status') === 'closed' ? 'closed' : 'open';
  return Response.json(await listReports(status));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const lang: Lang = (locals as { lang?: Lang }).lang ?? 'fr';
  let body: ReportRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || !body.itemId) {
    return Response.json({ error: 'invalid item' }, { status: 400 });
  }
  if (!allow(clientIp(request))) {
    return Response.json({ error: 'rate-limited' }, { status: 429 });
  }

  const result = await createReport(body, lang);
  if ('error' in result) {
    const status = result.error === 'bot' || result.error === 'invalid item' ? 400 : 409;
    return Response.json(result, { status });
  }
  return Response.json({ ok: true, id: result.id });
};
