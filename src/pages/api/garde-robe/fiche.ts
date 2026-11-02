import type { APIRoute } from 'astro';
import { json } from '../../../lib/auth';
import { rkFiche } from '../../../lib/rk';
import { cacheFiche, cachedFiche, clearRkSession, readRkSession, setRkSession } from '../../../lib/rk-session';

const LOGIN_RE = /^[\p{L}\p{N} _-]+$/u;

export const GET: APIRoute = async ({ cookies, url }) => {
  const session = readRkSession(cookies);
  if (!session) return json({ error: 'Connexion requise' }, 401);

  const login = (url.searchParams.get('login') ?? '').trim();
  if (!login || login.length > 50 || !LOGIN_RE.test(login)) {
    return json({ error: 'Identifiant invalide' }, 400);
  }

  // La fiche d'un personnage est publique et identique pour tous : le cache
  // peut ignorer la session qui la demande.
  const hit = cachedFiche(login);
  if (hit) return json(hit);

  let out;
  try {
    out = await rkFiche(session.gameCookie, login);
  } catch {
    return json({ error: 'Le jeu est injoignable' }, 502);
  }

  if (out.kind === 'expired') {
    clearRkSession(cookies);
    return json({ expired: true }, 440);
  }
  if (out.kind === 'notFound') {
    return json({ notFound: true }, 404);
  }

  cacheFiche(login, out.avatar);
  // Expiration glissante : chaque consultation repousse la session d'une heure.
  setRkSession(cookies, session);
  return json(out.avatar);
};
