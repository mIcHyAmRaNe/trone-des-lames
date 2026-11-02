// Session de garde-robe, sans base : le cookie du jeu est chiffré (AES-256-GCM)
// dans un cookie httpOnly signé par le secret de l'application. Le mot de passe
// n'est jamais conservé. Indispensable sur Vercel, où une Map en mémoire ne
// survit pas d'une invocation à l'autre.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { APIContext } from 'astro';

const COOKIE = 'tdl_rk';
export const RK_SESSION_SECONDS = 60 * 60;

export type RkSession = {
  login: string;
  /** Cookie de session Renaissance Kingdoms, tel que renvoyé par le jeu. */
  gameCookie: string;
};

function secret(): string {
  const s = process.env.ADMIN_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_SECRET non défini');
  return 'dev-secret-change-me';
}

// Clé dérivée : ADMIN_SECRET sert aussi à signer l'admin, mais les deux usages
// ne partagent jamais la même clé.
function key(): Uint8Array {
  return createHash('sha256').update(`garde-robe:${secret()}`).digest();
}

export function setRkSession(cookies: APIContext['cookies'], session: RkSession): void {
  const exp = Math.floor(Date.now() / 1000) + RK_SESSION_SECONDS;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify({ login: session.login, game: session.gameCookie, exp }), 'utf8'),
    cipher.final(),
  ]);
  const value = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  cookies.set(COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: RK_SESSION_SECONDS,
  });
}

export function readRkSession(cookies: APIContext['cookies']): RkSession | null {
  const raw = cookies.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, 'base64url');
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    const json = JSON.parse(
      Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'),
    ) as { login?: unknown; game?: unknown; exp?: unknown };
    if (typeof json.exp !== 'number' || json.exp * 1000 < Date.now()) return null;
    if (typeof json.login !== 'string' || typeof json.game !== 'string') return null;
    return { login: json.login, gameCookie: json.game };
  } catch {
    return null;
  }
}

export function clearRkSession(cookies: APIContext['cookies']): void {
  cookies.delete(COOKIE, { path: '/' });
}

/** Cache mémoire par instance : évite de re-solliciter le jeu à chaque rendu. */
const fiches = new Map<string, { at: number; data: unknown }>();
const FICHE_TTL = 5 * 60 * 1000;

export function cachedFiche(login: string): unknown | null {
  const c = fiches.get(login);
  if (!c) return null;
  if (Date.now() - c.at > FICHE_TTL) {
    fiches.delete(login);
    return null;
  }
  return c.data;
}

export function cacheFiche(login: string, data: unknown): void {
  if (fiches.size > 500) fiches.clear();
  fiches.set(login, { at: Date.now(), data });
}
