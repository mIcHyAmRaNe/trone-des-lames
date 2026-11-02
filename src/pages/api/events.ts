import type { APIRoute } from 'astro';
import { clientIp, json } from '../../lib/auth';
import { createEvent, listEvents, parseEvent, type EventInput } from '../../lib/events';

export const prerender = false;

/** In-memory per instance, like the login brake in lib/auth. */
const submissions = new Map<string, { n: number; reset: number }>();
const MAX_PER_HOUR = 20;
const HOUR = 60 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const a = submissions.get(ip);
  if (!a || now > a.reset) {
    if (submissions.size > 1000) submissions.clear();
    submissions.set(ip, { n: 1, reset: now + HOUR });
    return false;
  }
  a.n += 1;
  return a.n > MAX_PER_HOUR;
}

export const GET: APIRoute = async () => {
  return json({ events: await listEvents({ status: 'approved' }) });
};

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return json({ error: 'Requête invalide' }, 400);

  // Honeypot: bots fill hidden fields; answer success without inserting.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true }, 201);
  }

  if (rateLimited(clientIp(request))) {
    return json({ error: 'Trop de propositions. Réessayez plus tard.' }, 429);
  }

  // A player submission is always pending; the status is never client-supplied.
  delete body.status;
  try {
    const input = parseEvent(body) as EventInput;
    await createEvent(input, 'pending');
    return json({ ok: true }, 201);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Requête invalide' }, 400);
  }
};
