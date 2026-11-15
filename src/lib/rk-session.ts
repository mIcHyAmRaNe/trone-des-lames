// Session de garde-robe, sans base : le cookie du jeu est chiffré (AES-256-GCM)
// dans un cookie httpOnly signé par le secret de l'application. Le mot de passe
// n'est jamais conservé. Indispensable sur Vercel, où une Map en mémoire ne
// survit pas d'une invocation à l'autre.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { APIContext } from 'astro';
// Extension explicite : les tests chargent ce fichier directement avec Node.
import { rkLogin, rkFiche } from './rk.ts';

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

/**
 * Astro charge `.env` dans `import.meta.env` (pas dans `process.env`) en dev ;
 * sur Vercel, les variables sont dans `process.env` à l'exécution. On lit les
 * deux, le runtime d'abord pour qu'un changement d'env prod ne demande pas de
 * reconstruction.
 */
function serviceEnv(name: string): string | undefined {
  const runtime = process.env[name];
  if (runtime) return runtime;
  const vite = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return vite?.[name]?.trim() || undefined;
}

/** Cache mémoire par instance du cookie du compte de service : 15 minutes. */
const SERVICE_TTL = 15 * 60 * 1000;
let service: { at: number; gameCookie: string } | null = null;

/**
 * Session de jeu ouverte avec le compte de service du site (RK_USERNAME /
 * RK_PASS) : le visiteur n'a jamais à saisir d'identifiants.
 */
export async function openRkSession(
  cookies: APIContext['cookies'],
  force = false,
): Promise<RkSession> {
  if (!force) {
    const existing = readRkSession(cookies);
    if (existing) return existing;
  }
  const login = serviceEnv('RK_USERNAME');
  const password = serviceEnv('RK_PASS');
  if (!login || !password) {
    throw new Error('RK_USERNAME et RK_PASS doivent être définis pour ouvrir une session de jeu');
  }
  // Force = la session de jeu a expiré : le cache mémoire l'est aussi.
  if (!force && service && Date.now() - service.at < SERVICE_TTL) {
    const session: RkSession = { login, gameCookie: service.gameCookie };
    setRkSession(cookies, session);
    return session;
  }
  const { cookie } = await rkLogin(login, password);
  service = { at: Date.now(), gameCookie: cookie };
  const session: RkSession = { login, gameCookie: cookie };
  setRkSession(cookies, session);
  return session;
}

/** Cache mémoire par instance : évite de re-solliciter le jeu à chaque rendu. */
const fiches = new Map<string, { at: number; data: unknown }>();
const FICHE_TTL = 5 * 60 * 1000;

/**
 * Résout un pseudo saisi vers son orthographe officielle côté jeu, avec le
 * compte de service. `null` si le personnage n'existe pas ; lève si le jeu est
 * injoignable (la route renvoie alors 502).
 */
const players = new Map<string, { at: number; login: string | null }>();
export async function resolvePlayer(
  cookies: APIContext['cookies'],
  login: string,
): Promise<string | null> {
  const cached = players.get(login.toLowerCase());
  if (cached && Date.now() - cached.at < FICHE_TTL) return cached.login;

  let session = await openRkSession(cookies);
  let out = await rkFiche(session.gameCookie, login);
  if (out.kind === 'expired') {
    clearRkSession(cookies);
    session = await openRkSession(cookies, true);
    out = await rkFiche(session.gameCookie, login);
  }
  if (out.kind === 'expired') throw new Error('session de jeu expirée');

  const name = out.kind === 'ok' ? out.avatar.login : null;
  if (players.size > 500) players.clear();
  players.set(login.toLowerCase(), { at: Date.now(), login: name });
  return name;
}

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
