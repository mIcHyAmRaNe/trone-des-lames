import type { APIRoute } from 'astro';
import { isAdmin, json, unauthorized } from '../../../lib/auth';
import {
  createEvent,
  deleteEvent,
  listEvents,
  parseEvent,
  updateEvent,
  type EventInput,
} from '../../../lib/events';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();
  return json({ events: await listEvents({ status: 'all' }) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const body = await request.json().catch(() => null);
  try {
    const input = parseEvent(body) as EventInput;
    // Admin-created events are published immediately.
    const event = await createEvent(input, 'approved');
    return json({ event }, 201);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Requête invalide' }, 400);
  }
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const body = await request.json().catch(() => null);
  const id = Number((body as { id?: unknown } | null)?.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Identifiant requis' }, 400);

  try {
    const patch = parseEvent(body, { partial: true });
    const event = await updateEvent(id, patch);
    if (!event) return json({ error: 'Événement introuvable' }, 404);
    return json({ event });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Requête invalide' }, 400);
  }
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Événement introuvable' }, 404);

  const ok = await deleteEvent(id);
  if (!ok) return json({ error: 'Événement introuvable' }, 404);
  return json({ ok: true });
};
