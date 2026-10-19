import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIContext } from 'astro';

const COOKIE = 'tdl_admin';
const MAX_AGE = 60 * 60 * 12;

function secret() {
  const s = process.env.ADMIN_SECRET;
  if (s) return s;
  if (import.meta.env.PROD) throw new Error('ADMIN_SECRET non défini');
  return 'dev-secret-change-me';
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export function issueCookie(c: APIContext['cookies']) {
  const exp = String(Date.now() + MAX_AGE * 1000);
  c.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearCookie(c: APIContext['cookies']) {
  c.delete(COOKIE, { path: '/' });
}

export function isAdmin(c: APIContext['cookies']): boolean {
  const raw = c.get(COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    // Fail closed in production: a default password would expose admin rights.
    if (import.meta.env.PROD) throw new Error('ADMIN_PASSWORD non défini');
    return input === 'trone';
  }
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Non autorisé' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
