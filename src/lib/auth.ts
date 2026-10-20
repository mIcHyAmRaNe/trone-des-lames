import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { APIContext } from 'astro';

const COOKIE = 'tdl_admin';
const MAX_AGE = 60 * 60 * 12;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000;

function secret() {
  const s = process.env.ADMIN_SECRET;
  if (s) return s;
  if (import.meta.env.PROD) throw new Error('ADMIN_SECRET non défini');
  return 'dev-secret-change-me';
}

function password() {
  const p = process.env.ADMIN_PASSWORD;
  if (p) return p;
  if (import.meta.env.PROD) throw new Error('ADMIN_PASSWORD non défini');
  return 'trone';
}

/** Part of the cookie signature, so changing the password logs everyone out. */
function fingerprint() {
  return createHash('sha256').update(password()).digest('hex').slice(0, 16);
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

/** Constant-time compare that also hides the length of the expected value. */
function sameSecret(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}

export function issueCookie(c: APIContext['cookies']) {
  const exp = String(Date.now() + MAX_AGE * 1000);
  c.set(COOKIE, `${exp}.${sign(`${exp}.${fingerprint()}`)}`, {
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
  return sameSecret(sig, sign(`${exp}.${fingerprint()}`));
}

export function checkPassword(input: string) {
  return sameSecret(input, password());
}

/**
 * Best-effort brute-force brake. Vercel overwrites both headers, so the IP
 * cannot be spoofed there; on another host this is only an approximation.
 */
export function clientIp(request: Request) {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'local'
  );
}

/** In-memory per instance: a global limit would need the WAF or a shared store. */
const attempts = new Map<string, { n: number; reset: number }>();

export function loginBlocked(ip: string): boolean {
  const a = attempts.get(ip);
  if (!a) return false;
  if (Date.now() > a.reset) {
    attempts.delete(ip);
    return false;
  }
  return a.n >= MAX_ATTEMPTS;
}

export function noteLoginFailure(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now > a.reset) {
    if (attempts.size > 1000) attempts.clear();
    attempts.set(ip, { n: 1, reset: now + ATTEMPT_WINDOW });
    return;
  }
  a.n += 1;
}

export function noteLoginSuccess(ip: string) {
  attempts.delete(ip);
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
