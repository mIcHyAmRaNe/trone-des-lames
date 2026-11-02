// Catalog builder for the RK wardrobe.
//
//   node scripts/catalog.mjs bootstrap   # full catalog from the ryence.de player tool (public, ~1777 items)
//   node scripts/catalog.mjs refresh     # log in, crawl game pages, append anything new, rewrite the file
//
// Output: public/rk/catalog.json — consumed by the browser, and the seam a
// desktop app would read instead of scraping.
//
// `refresh` needs RK_USERNAME / RK_PASS in .env (gitignored). `bootstrap` does not.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/rk/catalog.json');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';
const SITE = 'https://www.renaissancekingdoms.com';
// The oxv CDN host, NOT www: www 302-redirects here and the redirect response
// has no Access-Control-Allow-Origin, which fails CORS in the browser.
const CDN = 'https://lesroyaumes.cdn.oxv.fr/images/personnages_midas/';
const RYENCE = 'https://www.ryence.de/RK/wardrobe/';

/** Game pages worth scraping. The arena (l=15) is the richest: ~1235 records in one request. */
const HARVEST_PAGES = [
  'EcranPrincipalAjax.php?l=15',
  'EcranPrincipalAjax.php?l=37',
  'EcranPrincipalAjax.php?l=3',
  'EcranPrincipalAjax.php?l=2',
  'EcranPrincipal.php',
  'FichePersonnage.php?login=Harvey_specture',
];

// --- item shape -------------------------------------------------------------
// One flat object per item. `zIndex` and `declinaisons` are numbers because
// midas.js interpolates them straight into image URLs.
function normalize(raw, names) {
  const id = String(raw.idItem);
  return {
    id,
    nom: raw.nom,
    slot: raw.slot,
    slotGardeRobe: raw.slotGardeRobe ?? null,
    miniature: raw.miniature ?? 'o',
    declinaisons: (raw.declinaisons ?? []).map(Number),
    zIndex: (raw.zIndexCalques ?? []).map(Number),
    dependCouleurPeau: !!raw.dependCouleurPeau,
    dependPostureMainG: !!raw.dependPostureMainG,
    dependPostureMainD: !!raw.dependPostureMainD,
    slotsMasques: raw.slotsMasques ?? [],
    nameEn: names.en?.[id] ?? null,
    nameFr: names.fr?.[id] ?? null,
  };
}

// --- bootstrap: ryence.de ---------------------------------------------------
// Their metadata files assign straight onto a global, so the payload is the
// bracketed array. Parsed verbatim — no transformation beyond normalize().
async function fromRyence() {
  const grab = async (p) => {
    const res = await fetch(RYENCE + p, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${p} -> HTTP ${res.status}`);
    return res.text();
  };
  // The ryence files are hand-maintained JS literals: they end in `};` and carry
  // a trailing comma before the closing brace. Neither is legal JSON.
  const loose = (src, open, close) =>
    JSON.parse(
      src
        .slice(src.indexOf(open), src.lastIndexOf(close) + 1)
        .replace(/,(\s*[}\]])/g, '$1'),
    );
  const table = (src) => loose(src, '{', '}');

  const [names, sexes] = await Promise.all([
    Promise.all([grab('js/translations/equipment-en.js'), grab('js/translations/equipment-fr.js')]).then(
      ([en, fr]) => ({ en: table(en), fr: table(fr) }),
    ),
    Promise.all([
      grab('js/metadata/male.js').then((s) => ['M', loose(s, '[', ']')]),
      grab('js/metadata/female.js').then((s) => ['F', loose(s, '[', ']')]),
    ]),
  ]);

  return {
    source: 'ryence.de/RK/wardrobe',
    sexes: Object.fromEntries(sexes.map(([sex, arr]) => [sex, arr.map((raw) => normalize(raw, names))])),
  };
}

// --- refresh: live game pages ----------------------------------------------
// Game HTML embeds item records escaped inside a JSON payload. Unescape, then
// pair each `equipement` array with the nearest preceding `"sexe":"M|F"`.
function harvest(html) {
  const text = html.replaceAll('\\\\"', '"').replaceAll('\\"', '"');
  const found = [];
  const marker = '"equipement":[';
  let at = text.indexOf(marker);
  while (at !== -1) {
    const start = at + marker.length - 1;
    // Brace-match the array; the records themselves contain no nested arrays.
    let depth = 0;
    let end = start;
    for (; end < text.length; end++) {
      if (text[end] === '[' || text[end] === '{') depth++;
      else if (text[end] === ']' || text[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const before = text.slice(Math.max(0, at - 4000), at);
    const sexes = [...before.matchAll(/"sexe"\s*:\s*"(M|F)"/g)];
    const sex = sexes.length ? sexes[sexes.length - 1][1] : null;
    if (sex) {
      try {
        for (const raw of JSON.parse(text.slice(start, end + 1))) found.push([sex, raw]);
      } catch {
        /* truncated page or non-item array — skip */
      }
    }
    at = text.indexOf(marker, end);
  }
  return found;
}

// Minimal cookie jar. Duplicated from src/lib/rk.ts on purpose: that one is
// TypeScript inside the app, this is a standalone build script. ~20 lines is
// cheaper than a shared .mjs/.ts boundary.
// ponytail: name-only matching, single host, no expiry math. RK sets four
// cookies on login and rotates nothing mid-session. Add a real jar if a page
// ever starts dropping one.
async function jarFetch(jar, url, init = {}, maxRedirects = 10) {
  let cur = url;
  let opts = { ...init, redirect: 'manual' };
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const headers = { 'user-agent': UA, ...(opts.headers ?? {}) };
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.cookie = cookie;
    const res = await fetch(cur, { ...opts, headers });
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const pair = sc.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (![301, 302, 303, 307, 308].includes(res.status)) return res;
    const loc = res.headers.get('location');
    if (!loc) return res;
    await res.arrayBuffer().catch(() => null);
    cur = new URL(loc, cur).toString();
    if ([301, 302, 303].includes(res.status) && (opts.method ?? 'GET') !== 'GET') {
      opts = { method: 'GET', headers: opts.headers };
    }
  }
  throw new Error('too many redirects');
}

async function loadEnv() {
  try {
    const raw = await readFile(join(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env — bootstrap mode does not need one */
  }
}

async function fromGame() {
  const user = process.env.RK_USERNAME;
  const pass = process.env.RK_PASS;
  if (!user || !pass) throw new Error('RK_USERNAME / RK_PASS missing from .env');

  const jar = new Map();
  const html = { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'fr-FR,fr;q=0.9' };
  await jarFetch(jar, `${SITE}/`, { headers: html });

  const res = await jarFetch(jar, `${SITE}/ConnexionKC.php`, {
    method: 'POST',
    headers: { ...html, 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${SITE}/`, Origin: SITE },
    body: new URLSearchParams({ login: user, password: pass }),
  });
  const body = await res.text();
  if (!/deconnexion|ecranprincipal/i.test(body)) throw new Error('login refused — check RK_USERNAME / RK_PASS');
  console.log(`logged in as ${user}`);

  const records = [];
  for (const page of HARVEST_PAGES) {
    // Per-character pages: fetch any login the pages hand us, capped so a
    // redirect loop can't run away with it.
    let target = `${SITE}/${page}`;
    if (page.includes('login=')) target = `${SITE}/FichePersonnage.php?login=${user}`;
    const r = await jarFetch(jar, target, { headers: { ...html, Referer: `${SITE}/EcranPrincipal.php` } });
    const pageHtml = await r.text();
    const got = harvest(pageHtml);
    records.push(...got);
    console.log(`  ${page.padEnd(42)} ${String(r.status).padEnd(4)} ${got.length} records`);
    for (const m of pageHtml.matchAll(/FichePersonnage\.php\?login=([A-Za-z0-9_]+)/g)) {
      if (HARVEST_PAGES.length > 12) break;
      HARVEST_PAGES.push(`FichePersonnage.php?login=${m[1]}`);
    }
  }
  const sexes = { M: [], F: [] };
  for (const [sex, raw] of records) sexes[sex].push(raw);
  return { source: `${SITE} (authenticated)`, sexes };
}

// --- merge ------------------------------------------------------------------
async function load() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

const mode = process.argv[2] ?? 'bootstrap';
if (mode !== 'bootstrap') await loadEnv();

let catalog = await load();
if (!catalog || mode === 'bootstrap') {
  catalog = { ...(await fromRyence()), generatedAt: new Date().toISOString() };
} else {
  const live = await fromGame();
  const names = { en: {}, fr: {} };
  for (const sex of ['M', 'F']) for (const it of catalog.sexes[sex]) {
    if (it.nameEn) names.en[it.id] = it.nameEn;
    if (it.nameFr) names.fr[it.id] = it.nameFr;
  }
  let added = 0;
  for (const sex of ['M', 'F']) {
    const have = new Set(catalog.sexes[sex].map((it) => it.id));
    for (const raw of live.sexes[sex]) {
      if (have.has(String(raw.idItem))) continue;
      catalog.sexes[sex].push(normalize(raw, names));
      have.add(String(raw.idItem));
      added++;
    }
  }
  catalog.refreshedAt = new Date().toISOString();
  console.log(`\n+${added} new items merged`);
}

const total = Object.values(catalog.sexes).reduce((n, a) => n + a.length, 0);
const slots = new Set(Object.values(catalog.sexes).flat().map((it) => it.slot));
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(catalog));
console.log(`catalog: ${total} items (M ${catalog.sexes.M.length} / F ${catalog.sexes.F.length}), ${slots.size} slots`);
console.log(`-> ${OUT}`);
console.log(`CDN root: ${CDN}`);