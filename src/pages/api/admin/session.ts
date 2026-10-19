import type { APIRoute } from 'astro';
import { checkPassword, clearCookie, issueCookie, isAdmin, json, unauthorized } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide' }, 400);
  }
  if (!body.password || !checkPassword(body.password)) {
    return json({ error: 'Mot de passe incorrect' }, 401);
  }
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
