import type { APIRoute } from 'astro';
import {
  checkPassword,
  clearCookie,
  clientIp,
  isAdmin,
  issueCookie,
  json,
  loginBlocked,
  noteLoginFailure,
  noteLoginSuccess,
  unauthorized,
} from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const ip = clientIp(request);
  if (loginBlocked(ip)) {
    return json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }, 429);
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide' }, 400);
  }
  if (!body.password || !checkPassword(body.password)) {
    noteLoginFailure(ip);
    return json({ error: 'Mot de passe incorrect' }, 401);
  }
  noteLoginSuccess(ip);
  issueCookie(cookies);
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  clearCookie(cookies);
  return json({ ok: true });
};

export const GET: APIRoute = async ({ cookies }) => {
  return isAdmin(cookies) ? json({ ok: true }) : unauthorized();
};
