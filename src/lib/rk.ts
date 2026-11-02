// Accès au jeu Renaissance Kingdoms côté serveur : connexion + fiche publique.
// Le navigateur ne parle jamais au jeu directement — le cookie de session du
// jeu reste sur le serveur (chiffré dans le cookie du visiteur, voir rk-session.ts).
import type { Avatar } from './wardrobe';

const BASE = 'https://www.renaissancekingdoms.com';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const ACCEPT_HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
const ACCEPT_LANG = 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7';
const REFERER = BASE + '/';
// Une fonction Vercel expire bien avant 30 s ; le jeu répond en général en < 3 s.
const TIMEOUT_MS = 12_000;

const DOC_FETCH: Record<string, string> = {
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

class Jar {
  private map = new Map<string, string>();
  static from(header: string): Jar {
    const j = new Jar();
    for (const p of header.split(';')) {
      const eq = p.indexOf('=');
      if (eq > 0) j.map.set(p.slice(0, eq).trim(), p.slice(eq + 1).trim());
    }
    return j;
  }
  store(headers: Headers): void {
    for (const c of getSetCookies(headers)) {
      const semi = c.indexOf(';');
      const pair = (semi < 0 ? c : c.slice(0, semi)).trim();
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      const attrs = (semi < 0 ? '' : c.slice(semi + 1)).toLowerCase();
      if (!v || /deleted|expired/.test(v) || /max-age=0/.test(attrs)) this.map.delete(k);
      else this.map.set(k, v); // dernier gagnant, ordre conservé comme un vrai pot
    }
  }
  header(): string {
    return [...this.map].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

function getSetCookies(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const single = headers.get('set-cookie');
  return single ? single.split(/,(?=[^;,=]+=[^;,]*)/) : [];
}

// Boucle de redirection manuelle : les `set-cookie` intermédiaires doivent être
// capturés, ce que `redirect: 'follow'` jette.
async function jarFetch(jar: Jar, url: string, init: RequestInit, maxRedirects = 10): Promise<Response> {
  let cur = url;
  let opts: RequestInit = { ...init, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) };
  for (let i = 0; i <= maxRedirects; i++) {
    const headers: Record<string, string> = { ...((opts.headers as Record<string, string>) ?? {}) };
    const cookies = jar.header();
    if (cookies) headers.Cookie = cookies;
    const res = await fetch(cur, { ...opts, headers });
    jar.store(res.headers);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      await res.arrayBuffer().catch(() => null);
      if (!loc) return res;
      cur = new URL(loc, cur).toString();
      if ([301, 302, 303].includes(res.status) && (opts.method ?? 'GET') !== 'GET') {
        opts = { ...opts, method: 'GET', body: undefined };
        delete (opts.headers as Record<string, string>)['Content-Type'];
      }
      continue;
    }
    return res;
  }
  throw new Error('trop de redirections');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export class RkLoginError extends Error {
  status = 401;
}

export async function rkLogin(login: string, password: string): Promise<{ cookie: string }> {
  const jar = new Jar();
  // 1. Initialisation de session (le jeu pose ses cookies sur l'accueil).
  await jarFetch(jar, BASE + '/', {
    headers: {
      'User-Agent': UA,
      Accept: ACCEPT_HTML,
      'Accept-Language': ACCEPT_LANG,
      Referer: REFERER,
      'Sec-Fetch-Site': 'none',
      ...DOC_FETCH,
    },
  });
  // 2. Connexion (formulaire login + password).
  const res = await jarFetch(jar, BASE + '/ConnexionKC.php', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Accept: ACCEPT_HTML,
      'Accept-Language': ACCEPT_LANG,
      Referer: REFERER,
      Origin: BASE,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Sec-Fetch-Site': 'same-origin',
      ...DOC_FETCH,
    },
    body: new URLSearchParams({ login, password }),
  });
  const body = await res.text();
  if (!res.ok || !/deconnexion|ecranprincipal/i.test(body)) {
    throw new RkLoginError('Identifiant ou mot de passe incorrect');
  }
  // Le pot contient maintenant KC / KC2 / Glup / PHPSESSID : toute la session.
  return { cookie: jar.header() };
}

export type FicheOutcome =
  | { kind: 'ok'; avatar: Avatar }
  | { kind: 'expired' }
  | { kind: 'notFound' };

export async function rkFiche(gameCookie: string, loginName: string): Promise<FicheOutcome> {
  const jar = Jar.from(gameCookie);
  const res = await jarFetch(jar, BASE + '/FichePersonnage.php?login=' + encodeURIComponent(loginName), {
    headers: {
      'User-Agent': UA,
      Accept: ACCEPT_HTML,
      'Accept-Language': ACCEPT_LANG,
      Referer: REFERER,
      'Sec-Fetch-Site': 'same-origin',
      ...DOC_FETCH,
    },
  });
  if (!res.ok) return { kind: 'expired' };
  const body = await res.text();
  if (/ConnexionKC|name=["']password["']|se connecter/i.test(body) && !body.includes('apercu_personnage_rar')) {
    return { kind: 'expired' };
  }
  const m = body.match(/class="apercu_personnage_rar"[^>]*>([\s\S]*?)<\//);
  // Connecté mais aucun portrait : le personnage n'existe pas ou n'a rien de visible.
  if (!m) return { kind: 'notFound' };
  try {
    return { kind: 'ok', avatar: JSON.parse(decodeEntities(m[1]).trim()) as Avatar };
  } catch {
    return { kind: 'notFound' };
  }
}
