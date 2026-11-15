import type { APIRoute } from 'astro';
import { isAdmin } from '../../lib/auth.js';
import { resolvePlayer } from '../../lib/rk-session.js';
import { listSubmissions, createSubmission } from '../../lib/catalog-store.js';
import type { SubmissionRequest, SubmissionError } from '../../lib/catalog-submit.js';
import type { Lang } from '../../i18n/index.js';

/** Même règle que la route `fiche` : lettres, chiffres, espaces, `_` et `-`. */
const LOGIN_RE = /^[\p{L}\p{N} _-]+$/u;

function errorResponse(err: SubmissionError): Response {
  switch (err.error) {
    case 'bot':
    case 'invalid item':
    case 'unknown-player':
      return Response.json(err, { status: 400 });
    case 'unchanged':
    case 'duplicate-pending':
    case 'already-exists':
      return Response.json(err, { status: 409 });
    case 'rate-limited':
      return Response.json(err, { status: 429 });
    case 'rk-unavailable':
      return Response.json(err, { status: 502 });
  }
}

export const GET: APIRoute = async ({ cookies, url }) => {
  // Admin: liste toutes les soumissions (avec filtre status optionnel)
  if (!isAdmin(cookies)) return Response.json({ error: 'forbidden' }, { status: 403 });
  const status = url.searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
  const all = await listSubmissions(status ?? undefined);
  return Response.json(all);
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const lang: Lang = (locals as { lang?: Lang }).lang ?? 'fr';
  let body: SubmissionRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !body.item) {
    return Response.json({ error: 'invalid item' }, { status: 400 });
  }

  // Filtres anti-robot avant tout appel au jeu.
  if (body.website && body.website.trim() !== '') {
    return Response.json({ error: 'bot' }, { status: 400 });
  }
  if (typeof body.elapsedMs === 'number' && body.elapsedMs < 1200) {
    return Response.json({ error: 'bot' }, { status: 400 });
  }

  // Le pseudo remplace la connexion : il doit exister côté jeu.
  const login = (body.login ?? '').trim();
  if (!login || login.length > 50 || !LOGIN_RE.test(login)) {
    return Response.json(
      {
        error: 'invalid item',
        fields: { login: lang === 'fr' ? 'Pseudo invalide.' : 'Invalid player name.' },
      },
      { status: 400 },
    );
  }
  let player: string | null;
  try {
    player = await resolvePlayer(cookies, login);
  } catch {
    return Response.json({ error: 'rk-unavailable' }, { status: 502 });
  }
  if (!player) return Response.json({ error: 'unknown-player', login }, { status: 400 });

  const result = await createSubmission(player, body, lang);
  if ('error' in result) return errorResponse(result);
  return Response.json({ ok: true, id: result.id, player });
};