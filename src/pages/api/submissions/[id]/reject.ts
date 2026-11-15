import type { APIRoute } from 'astro';
import { isAdmin } from '../../../../lib/auth.js';
import { decideSubmission } from '../../../../lib/catalog-store.js';

export const POST: APIRoute = async ({ cookies, params, request }) => {
  if (!isAdmin(cookies)) return Response.json({ error: 'forbidden' }, { status: 403 });
  let note: string | undefined;
  try {
    const body = await request.json();
    if (typeof body.note === 'string') note = body.note.trim() || undefined;
  } catch { /* non-JSON or empty */ }
  const s = await decideSubmission(params.id!, 'rejected', 'admin', note);
  if (!s) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true });
};