import type { APIRoute } from 'astro';
import { clientIp, json } from '../../../lib/auth';
import { rkLogin } from '../../../lib/rk';
import { setRkSession } from '../../../lib/rk-session';

const LOGIN_RE = /^[\p{L}\p{N} _-]+$/u;

/** Frein local par instance, comme le formulaire de proposition d'animation. */
const attempts = new Map<string, { n: number; reset: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW = 10 * 60 * 1000;

function blocked(ip: string): boolean {
  const a = attempts.get(ip);
  return !!a && Date.now() <= a.reset && a.n >= MAX_ATTEMPTS;
}

function noteFailure(ip: string): void {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now > a.reset) {
    if (attempts.size > 1000) attempts.clear();
    attempts.set(ip, { n: 1, reset: now + WINDOW });
    return;
  }
  a.n += 1;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const ip = clientIp(request);
  if (blocked(ip)) {
    return json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, 429);
  }

  let body: { login?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide' }, 400);
  }

  const login = typeof body.login === 'string' ? body.login.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!login || !password) return json({ error: 'Identifiant et mot de passe requis' }, 400);
  if (login.length > 50 || !LOGIN_RE.test(login)) {
    return json({ error: 'Identifiant invalide' }, 400);
  }

  try {
    const { cookie } = await rkLogin(login, password);
    setRkSession(cookies, { login, gameCookie: cookie });
    attempts.delete(ip);
    return json({ ok: true, login });
  } catch (e) {
    const status = (e as { status?: number }).status === 401 ? 401 : 502;
    if (status === 401) noteFailure(ip);
    return json(
      { error: status === 401 ? 'Identifiant ou mot de passe incorrect' : 'Le jeu est injoignable' },
      status,
    );
  }
};
