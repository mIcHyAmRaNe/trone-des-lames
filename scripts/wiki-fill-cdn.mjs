// Remplit les URL CDN manquantes du catalogue à partir des catégories du wiki.
//
//   node scripts/wiki-fill-cdn.mjs            # dry-run
//   node scripts/wiki-fill-cdn.mjs --write    # écrit public/rk/catalog.json
//
// Parcourt les catégories wiki (Accessoire, Apparence, Arme, Cadre, Decor,
// Familier, Panoplie, Tatouage, Vêtement événementiel), suit chaque objet
// jusqu'aux pages Fichier: qui portent les URL CDN, puis :
//   - renseigne `cdn` (chemins CDN exacts) sur les fiches du catalogue,
//   - complète les fiches sans nom d'asset,
//   - corrige les fiches dont l'URL calculée renvoie un 404,
//   - ajoute les objets du wiki absents du catalogue.
//
// Le z-index n'est pas sur le wiki : il n'est écrit que pour les catégories
// qui n'ont qu'une seule valeur dans le catalogue (fonds, cadres, barbes…).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'public/rk/catalog.json');
const CACHE = join(ROOT, '.cache/wiki-fill');
const WIKI = 'https://wiki.renaissancekingdoms.com';
const API_FR = `${WIKI}/fr/api.php`;
const API_EN = `${WIKI}/en/api.php`;
const CDN_ROOT = 'https://lesroyaumes.cdn.oxv.fr/images/personnages_midas/';
const UA = 'trone-des-lames-cdn-fill/1.0';
const WRITE = process.argv.includes('--write');

const CATEGORIES_FR = [
  { wiki: 'Accessoire', category: 'Accessoires' },
  { wiki: 'Apparence', category: null },
  { wiki: 'Arme', category: 'Armes' },
  { wiki: 'Cadre', category: 'Cadres' },
  { wiki: 'Decor', category: 'Fonds' },
  { wiki: 'Familier', category: 'Familiers' },
  { wiki: 'Panoplie', category: 'Panoplies' },
  { wiki: 'Tatouage', category: 'Tatouages' },
  { wiki: 'Vêtement événementiel', category: 'Evenementiels' },
  { wiki: 'Vêtement', category: null },
  { wiki: 'Objet spécial', category: null },
];

const CATEGORIES_EN = [
  { wiki: 'Accessory', category: 'Accessoires' },
  { wiki: 'Appearance', category: null },
  { wiki: 'Weapon', category: 'Armes' },
  { wiki: 'Frame', category: 'Cadres' },
  { wiki: 'Background', category: 'Fonds' },
  { wiki: 'Pet', category: 'Familiers' },
  { wiki: 'Outfit', category: 'Panoplies' },
  { wiki: 'Tattoo', category: 'Tatouages' },
  { wiki: 'Event_clothing', category: 'Evenementiels' },
  // Parent categories for asset lookup (no catalog entries created)
  { wiki: 'Clothing', category: null },
  { wiki: 'Special_object', category: null },
];

// Titres wiki à ne jamais importer (en-têtes de section, redirections vides, etc.)
const BLACKLIST = new Set([
  'arme', 'lac', 'pecher', 'verger',           // slugs canoniques
  'Arme', 'Lac', 'Pêcher', 'Verger',           // titres FR exacts
  'Weapon', 'Lake', 'Fishing', 'Orchard',      // titres EN exacts
]);

const CDN_RE = /https?:\/\/[^\s"'<>)\]]*personnages_midas\/[^\s"'<>)\]]+\.(?:png|webp|gif|jpg)/gi;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cached(key, load) {
  const file = join(CACHE, createHash('sha1').update(key).digest('hex'));
  try {
    return await readFile(file, 'utf8');
  } catch {
    /* cache miss */
  }
  const text = await load();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, text);
  return text;
}

async function api(params, lang = 'fr') {
  const base = lang === 'fr' ? API_FR : API_EN;
  const body = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  return JSON.parse(
    await cached(`${lang} POST ${base}?${body}`, async () => {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (res.ok) return res.text();
        if (attempt >= 3) throw new Error(`${lang} API ${res.status}`);
        await sleep(1000 * (attempt + 1));
      }
    }),
  );
}

async function categoryMembers(title, lang = 'fr') {
  const out = [];
  let cont = {};
  for (;;) {
    const res = await api({
      action: 'query',
      list: 'categorymembers',
      cmtitle: lang === 'fr' ? `Catégorie:${title}` : `Category:${title}`,
      cmnamespace: '0',
      cmlimit: '500',
      ...cont,
    }, lang);
    out.push(...(res.query?.categorymembers ?? []).map((m) => m.title));
    if (!res.continue) break;
    cont = res.continue;
  }
  return out;
}

async function inBatches(titles, params, pick, lang = 'fr') {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const res = await api({ ...params, titles: titles.slice(i, i + 50).join('|') }, lang);
    out.push(...(res.query?.pages ?? []).map(pick));
    if (i % 500 === 0) process.stderr.write(`\r${lang} ${i}/${titles.length}`);
  }
  return out;
}

const clean = (value) =>
  `${value ?? ''}`
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')
    .replace(/[\[\]|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const templateField = (text, field) => {
  const m = text.match(new RegExp(`\\|\\s*${field}\\s*=\\s*([^|\\n]*)`, 'i'));
  return m ? clean(m[1]) : '';
};

function normalizeName(value) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/,?\s*appel\w*\s+aussi.*$/, '')
    .replace(/^(?:l'|le |la |les |un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Décompose une URL CDN en chemin, nom d'asset et variantes.
 * `vetements/gantMineur_m0_n0_d1_0_@1X.webp` -> nom `gantMineur`, flags main G/D.
 */
function assetInfo(url) {
  const path = decodeURIComponent(url.slice(url.indexOf('personnages_midas/') + 'personnages_midas/'.length));
  const parts = path.split('/');
  const sexFolder = parts[0];
  const sub = parts.length > 2 ? parts[1] : null;
  const file = parts[parts.length - 1];
  const sex = sexFolder === 'hommes' ? 'M' : sexFolder === 'femmes' ? 'F' : null;
  // Strip extension and @1X/@2X suffix
  const bare = file.replace(/\.\w+$/, '').replace(/_@\d+X$/i, '');
  // Standard format: asset_dN_0  -> decl = N
  const declStandard = bare.match(/_d(\d+)(?:_|$)/i);
  // Wiki format: asset_N_@1X (no _d, no _0 frame) -> decl = N
  const declWiki = !declStandard ? bare.match(/_(\d+)$/) : null;
  // Remove decl part to get asset name
  let withoutDecl = bare;
  let decl = null;
  if (declStandard) {
    withoutDecl = bare.replace(/_d\d+(?:_|$)/i, '');
    decl = Number(declStandard[1]);
  } else if (declWiki) {
    const n = Number(declWiki[1]);
    // Toujours retirer le suffixe _N (même pour _0), mais ne mettre decl que si N > 0
    withoutDecl = bare.replace(/_\d+$/, '');
    if (n > 0) decl = n;
  } else {
    withoutDecl = bare.replace(/_0$/, ''); // strip frame _0
  }

  const beard = withoutDecl.match(/^barbe_(\d+)/i);
  if (beard) {
    // Pour les barbes, la teinte est dans _cN (ex: barbe_14_c3)
    const colorMatch = withoutDecl.match(/_c(\d+)$/);
    const cdecl = colorMatch ? Number(colorMatch[1]) : null;
    return { path, sex, nom: `barbe${beard[1]}`, kind: 'corps', decl: cdecl, flags: {} };
  }

  const hair = withoutDecl.match(/^cheveux(?:Avants|Arrieres|Intermediaires)_(\d+)/i);
  if (hair) {
    // Pour les coiffures, la teinte est dans _cN (ex: cheveuxAvants_37_c1)
    const colorMatch = withoutDecl.match(/_c(\d+)$/);
    const cdecl = colorMatch ? Number(colorMatch[1]) : null;
    return { path, sex, nom: `coiffure${hair[1]}`, kind: 'corps', decl: cdecl, flags: {} };
  }

  const flags = {};
  let nom = withoutDecl;
  if (/_p\d+$/.test(nom)) {
    flags.peau = true;
    nom = nom.replace(/_p\d+$/, '');
  }
  const posture = nom.match(/_(m\d+_n\d+|n\d+_m\d+)$/);
  if (posture) {
    flags.mainG = posture[1].includes('m');
    flags.mainD = posture[1].includes('n');
    nom = nom.replace(posture[1], '');
  }
  const kind = sub === 'corps' ? 'corps' : sexFolder === 'fonds' || sexFolder === 'cadres' ? 'decor' : 'vetement';
  return { path, sex, nom, kind, decl, flags };
}

/** Catégorie de garde-robe déduite de l'asset (cheveux, barbe…). */
function categoryOfAsset(info) {
  if (info.kind === 'corps') return info.nom.startsWith('barbe') ? 'Barbes' : 'Coiffures';
  return null;
}

// --- 1. crawl des catégories (FR + EN) ---------------------------------------
const wikiItems = new Map();

async function crawlCategories(categories, lang) {
  for (const cat of categories) {
    const titles = await categoryMembers(cat.wiki, lang);
    process.stderr.write(`${lang.toUpperCase()} ${cat.wiki}: ${titles.length} pages\n`);
    for (const title of titles) {
      if (BLACKLIST.has(title)) continue;
      const entry = wikiItems.get(title) ?? { title, lang, categories: [], names: new Set(), texts: {} };
      entry.categories.push(cat);
      entry.texts[lang] = '';
      wikiItems.set(title, entry);
    }
  }
}

await crawlCategories(CATEGORIES_FR, 'fr');
await crawlCategories(CATEGORIES_EN, 'en');

const titles = [...wikiItems.keys()];
const pickPage = (p) => ({
  title: p.title,
  text: p.revisions?.[0]?.slots?.main?.content ?? '',
  files: (p.images ?? []).map((im) => im.title).filter((t) => /\.(png|gif|jpe?g|webp)$/i.test(t)),
});

// Fetch pages from both languages
const pagesFr = await inBatches(
  titles,
  { action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content', rvslots: 'main' },
  pickPage,
  'fr',
);
const pagesEn = await inBatches(
  titles,
  { action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content', rvslots: 'main' },
  pickPage,
  'en',
);

// Merge pages by title, keeping both texts and files
const pageByTitle = new Map();
for (const p of [...pagesFr, ...pagesEn]) {
  const existing = pageByTitle.get(p.title);
  if (existing) {
    existing.files = [...new Set([...existing.files, ...p.files])];
    existing.text = existing.text || p.text; // prefer FR text
    existing.textEn = p.text;
  } else {
    pageByTitle.set(p.title, { ...p, textEn: p.text === p.text ? '' : '' }); // will set below
  }
}

// Ensure textEn is set for EN pages
for (const p of pagesEn) {
  const existing = pageByTitle.get(p.title);
  if (existing) existing.textEn = p.text;
}

// Redirect handling
const redirectTarget = (text) =>
  (text.match(/^\s*#(?:REDIRECTION|REDIRECT)\s*:?\s*\[\[\s*([^\]|#]+)/i) ?? [])[1]?.trim() ?? null;

const targets = [...new Set(
  [...pagesFr, ...pagesEn].map((p) => redirectTarget(p.text)).filter(Boolean)
)].filter((t) => !pageByTitle.has(t));

const targetPagesFr = targets.length
  ? await inBatches(targets, { action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content', rvslots: 'main' }, pickPage, 'fr')
  : [];
const targetPagesEn = targets.length
  ? await inBatches(targets, { action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content', rvslots: 'main' }, pickPage, 'en')
  : [];

for (const p of [...targetPagesFr, ...targetPagesEn]) {
  const existing = pageByTitle.get(p.title);
  if (existing) {
    existing.files = [...new Set([...existing.files, ...p.files])];
    if (!existing.text) existing.text = p.text;
    existing.textEn = p.text;
  } else {
    pageByTitle.set(p.title, { ...p, textEn: '' });
  }
}
for (const p of targetPagesEn) {
  const existing = pageByTitle.get(p.title);
  if (existing) existing.textEn = p.text;
}

// --- Merge FR/EN pages by template name (nom/anNom) ---
// Some items have different page titles in FR/EN (e.g. "Coiffure radieuse" vs "Radiant hairstyle")
// but the same template 'nom' field. Merge them to combine file lists.
const pageByName = new Map();
for (const [title, page] of pageByTitle) {
  const names = [];
  // Extract nom from FR text
  const nomFr = templateField(page.text, 'nom');
  if (nomFr) names.push(nomFr);
  // Extract anNom from FR text (English name in FR template)
  const anNomFr = templateField(page.text, 'anNom');
  if (anNomFr) names.push(anNomFr);
  // Extract nom from EN text
  const nomEn = templateField(page.textEn, 'nom');
  if (nomEn) names.push(nomEn);
  // Extract anNom from EN text
  const anNomEn = templateField(page.textEn, 'anNom');
  if (anNomEn) names.push(anNomEn);

  // If no template names found, use the page title as fallback
  if (names.length === 0) {
    names.push(title);
  }

  for (const name of names) {
    const key = normalizeName(name);
    if (!key) continue;
    const existing = pageByName.get(key);
    if (existing) {
      // Merge files
      existing.files = [...new Set([...existing.files, ...page.files])];
      // Keep texts: prefer existing FR text (has template fields), only add EN text
      if (!existing.text && page.text) existing.text = page.text;
      if (page.textEn) existing.textEn = page.textEn;
    } else {
      pageByName.set(key, { ...page, files: [...page.files] });
    }
  }
}

// Use merged pages for file fetching

// Use merged pages for file fetching
const mergedPages = [...pageByName.values()];

const fileTitles = [...new Set(
  mergedPages.flatMap((p) => p.files)
)];
process.stderr.write(`\n${fileTitles.length} fichiers\n`);

// Fetch file pages from both languages
const fileAssets = new Map();
for (const lang of ['fr', 'en']) {
  const batch = await inBatches(fileTitles, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main' }, (p) => ({
    title: p.title,
    infos: [...(p.revisions?.[0]?.slots?.main?.content ?? '').matchAll(CDN_RE)].map((m) => assetInfo(m[0])),
  }), lang);
  for (const f of batch) {
    const existing = fileAssets.get(f.title) ?? [];
    const merged = [...existing, ...f.infos];
    const unique = [];
    const seen = new Set();
    for (const info of merged) {
      if (!seen.has(info.path)) {
        seen.add(info.path);
        unique.push(info);
      }
    }
    fileAssets.set(f.title, unique);
  }
}

const assetsByItem = new Map();
// Track which original titles map to which merged page
const titleToMerged = new Map();
for (const page of mergedPages) {
  const title = page.title;
  const source = pageByTitle.get(redirectTarget(page.text) ?? page.title) ?? page;
  const infos = [];
  // Use the merged page's files directly (includes EN files from merge)
  for (const file of page.files) {
    const fileInfos = fileAssets.get(file) ?? [];
    infos.push(...fileInfos);
  }
  assetsByItem.set(title, infos);
  // Map all original titles that were merged into this page
  for (const name of [page.text, page.textEn].filter(Boolean)) {
    for (const value of [
      templateField(name, 'nom'),
      templateField(name, 'anNom'),
    ]) {
      if (value) titleToMerged.set(normalizeName(value), title);
    }
  }
  titleToMerged.set(normalizeName(title), title);
  const item = wikiItems.get(title);
  if (!item) continue;
  item.text = source.text;
  const texts = [source.text, source.textEn].filter(Boolean);
  for (const text of texts) {
    for (const value of [
      templateField(text, 'nom'),
      templateField(text, 'anNom'),
      title,
      source.title,
    ]) {
      if (value) item.names.add(value);
    }
  }
}

// Propagate merged assets to all original titles (using original titles as keys)
for (const [origTitle, origPage] of pageByTitle) {
  // Find which merged page this original title belongs to
  const origNames = [normalizeName(origTitle)];
  for (const text of [origPage.text, origPage.textEn].filter(Boolean)) {
    for (const value of [
      templateField(text, 'nom'),
      templateField(text, 'anNom'),
    ]) {
      if (value) origNames.push(normalizeName(value));
    }
  }
  // Find the merged title for this original title
  let mergedTitle = null;
  for (const n of origNames) {
    const merged = titleToMerged.get(n);
    if (merged) {
      mergedTitle = merged;
      break;
    }
  }
  if (mergedTitle && assetsByItem.has(mergedTitle)) {
    assetsByItem.set(origTitle, assetsByItem.get(mergedTitle));
  }
}

// Also merge wikiItems by name for phase 4 (new items)
// This ensures items with different titles but same name are treated as one
const wikiItemsByName = new Map();
for (const item of wikiItems.values()) {
  for (const name of item.names) {
    const key = normalizeName(name);
    if (!key) continue;
    const existing = wikiItemsByName.get(key);
    if (!existing || (item.infos?.length ?? 0) > (existing.infos?.length ?? 0)) {
      wikiItemsByName.set(key, item);
    }
  }
}

// --- 2. index des objets wiki ------------------------------------------------
const byName = new Map();
const byAsset = new Map();
for (const item of wikiItems.values()) {
  const infos = assetsByItem.get(item.title) ?? [];
  for (const name of item.names) {
    const key = normalizeName(name);
    if (!key) continue;
    const current = byName.get(key);
    if (!current || (!current.infos.length && infos.length)) byName.set(key, { item, infos });
  }
  // Par nom d'asset : les fiches du catalogue sans libellé (« barbe1 ») sont
  // ainsi rapprochées de l'objet wiki malgré tout.
  for (const info of infos) {
    const key = info.nom.toLowerCase();
    if (!byAsset.has(key)) byAsset.set(key, { item, infos });
  }
}

// --- 3. catalogue ------------------------------------------------------------
const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));

/** URL calculée par l'appli (pour savoir si lasset existe). */
function computedUrl(item, sex, nom = item.nom, flags = {}, declinaison = 0) {
  if (!nom) return null;
  const cat = item.slot || item.slotGardeRobe || '';
  let name = nom;
  if (declinaison > 0) name += `_d${declinaison}`;
  if (flags.peau) name += '_p0';
  if (flags.mainG) name += '_m0';
  if (flags.mainD) name += '_n0';
  const dir = sex === 'F' ? 'femmes' : 'hommes';
  if (cat === 'Fonds') return `${CDN_ROOT}fonds/${name}_0_@1X.png`;
  if (cat === 'Cadres') return `${CDN_ROOT}cadres/${name}_0_@1X.png`;
  // Les sprites de corps portent la teinte dans `_c<teinte>`.
  if (cat === 'Barbes') return `${CDN_ROOT}hommes/corps/${nom.replace(/^barbe/, 'barbe_')}_c${declinaison}_e0_@1X.png`;
  if (cat === 'Coiffures') return `${CDN_ROOT}${dir}/corps/cheveuxAvants_${nom.replace(/^coiffure/, '')}_c${declinaison}_@1X.png`;
  return `${CDN_ROOT}${dir}/vetements/${name}_0_@1X.png`;
}

/**
 * Applique un asset du wiki à une fiche : nom d'asset et variantes
 * (peau / posture) sont retenues seulement si l'URL reconstruite répond 200.
 */
async function applyAsset(item, sex, infos) {
  const ofSex = infos.filter((i) => !i.sex || i.sex === sex);
  // Un objet de panoplie regroupe plusieurs assets : celui qui porte le même
  // nom que la fiche passe d'abord, sinon on risquerait de la renommer.
  const current = (item.nom ?? '').toLowerCase();
  const candidates = [...ofSex].sort(
    (a, b) => Number(b.nom.toLowerCase() === current) - Number(a.nom.toLowerCase() === current),
  );
  for (const info of candidates) {
    for (const flags of [info.flags, {}]) {
      if (!info.nom) continue;
      const url = computedUrl(item, sex, info.nom, flags);
      if (!(await exists(url))) continue;
      const changed = item.nom !== info.nom;
      item.nom = info.nom;
      item.dependCouleurPeau = !!flags.peau;
      item.dependPostureMainG = !!flags.mainG;
      item.dependPostureMainD = !!flags.mainD;
      return changed;
    }
  }
  return false;
}

const checked = new Map();
async function exists(url) {
  if (!url) return false;
  if (checked.has(url)) return checked.get(url);
  let ok = false;
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'user-agent': UA } });
    ok = res.status === 200;
    await res.arrayBuffer().catch(() => {});
  } catch {
    ok = false;
  }
  checked.set(url, ok);
  return ok;
}

const filled = [];
const corrected = [];
const added = [];
const unresolved = [];

/** Chemins CDN (relatifs) d'un objet wiki pour un sexe donné. */
function pathsFor(infos, sex) {
  const paths = infos.filter((i) => !i.sex || i.sex === sex).map((i) => i.path);
  return [...new Set(paths)];
}

for (const sex of ['M', 'F']) {
  const list = catalog.sexes[sex];
  for (const it of list) {
    const cat = it.slot || it.slotGardeRobe || '';
    // Les teintes des sprites de corps (barbe, cheveux) sont dans `_cN` et le
    // wiki ne les liste pas toujours : on sonde le CDN, même sans fiche wiki.
    if (!it.declinaisons.length && it.nom && (cat === 'Barbes' || cat === 'Coiffures')) {
      const probe = [];
      for (let d = 0; d <= 9; d++) {
        if (await exists(computedUrl(it, sex, it.nom, {}, d))) probe.push(d);
      }
      if (probe.length) it.declinaisons = probe;
    }

    const key = normalizeName(it.nameFr) || normalizeName(it.nameEn);
    const named = byName.get(key);
    // Une page d'objet sans image (les fichiers vivent sur la page de la
    // panoplie) ne doit pas bloquer le repli par nom d'asset.
    const hit = named?.infos.length
      ? named
      : ((it.nom ? byAsset.get(it.nom.toLowerCase()) : undefined) ?? named);
    if (!hit) continue;
    const infos = hit.infos;
    if (!infos.length) {
      if (!it.nom) unresolved.push(`${sex} ${it.nameFr ?? it.id} (${it.id})`);
      continue;
    }
    const sameName = it.nom ? infos.filter((i) => i.nom.toLowerCase() === it.nom.toLowerCase()) : [];
    const paths = pathsFor(sameName.length ? sameName : infos, sex);
    if (!paths.length) continue;

    // Une URL exacte du wiki vaut mieux qu'une URL calculée : on la stocke.
    const usable = [];
    for (const p of paths) {
      if (await exists(CDN_ROOT + p)) usable.push(p);
    }
    if (!usable.length) continue;

    const asset = infos.find((i) => i.sex === sex) ?? infos[0];

    const beforeNom = it.nom;
    if (!(await exists(computedUrl(it, sex)))) {
      const changed = await applyAsset(it, sex, infos);
      if (changed) {
        if (!beforeNom) filled.push(`${sex} ${it.nameFr} -> ${it.nom}`);
        else corrected.push(`${sex} ${it.nameFr} : ${beforeNom} -> ${it.nom}`);
      }
    }

    // Une teinte peut manquer alors que la teinte 0 répond (`capePillard_1`
    // s'écrit sans `_d`) : dès qu'une variante casse, on fige les chemins exacts.
    const flags = {
      peau: it.dependCouleurPeau,
      mainG: it.dependPostureMainG,
      mainD: it.dependPostureMainD,
    };
    let broken = !(await exists(computedUrl(it, sex)));
    for (const d of broken ? [] : it.declinaisons) {
      if (!(await exists(computedUrl(it, sex, it.nom, flags, d)))) broken = true;
    }
    if (broken) it.cdn = usable;

    // Re-détecter les déclinaisons depuis le wiki si celui-ci en a plus
    // que la fiche actuelle (ex: capeNoel2020 a 0,1,2 sur le wiki mais 0,1 en base)
    // On déduit les déclinaisons depuis les URLs `usable` (plus fiable que i.decl
    // car decl 0 n'est pas capturé par assetInfo pour les URLs wiki _0_@1X.png)
    const usableDecls = [];
    for (const p of usable) {
      const m = p.match(/_(\d+)_@1X\.png$/);
      if (m) usableDecls.push(Number(m[1]));
    }
    const uniqueUsableDecls = [...new Set(usableDecls)].sort((a, b) => a - b);
    if (uniqueUsableDecls.length > it.declinaisons.length) {
      it.declinaisons = uniqueUsableDecls;
      it.cdn = usable;
    }

    if (!it.declinaisons.length && cat !== 'Barbes' && cat !== 'Coiffures') {
      // Vêtements : la teinte vient du `_dN` documenté sur le wiki, retenue
      // seulement si le fichier correspondant existe.
      const decls = [...new Set(infos.map((i) => i.decl).filter((d) => d != null))].sort((a, b) => a - b);
      const valid = [];
      for (const d of decls) {
        const url = `${CDN_ROOT}${sex === 'F' ? 'femmes' : 'hommes'}/vetements/${it.nom}${d ? `_d${d}` : ''}_0_@1X.png`;
        if (await exists(url)) valid.push(d);
      }
      if (valid.length) it.declinaisons = valid;
    }
  }
}

// --- 4. objets du wiki absents du catalogue ----------------------------------
const known = new Set();
for (const sex of ['M', 'F']) {
  for (const it of catalog.sexes[sex]) {
    if (it.nom) {
      known.add(`${it.nom.toLowerCase()}|${sex}`);
      // `concours16_m0` (wiki) et `concours16` (catalogue) sont le même asset.
      known.add(`${it.nom.toLowerCase().replace(/_[mn]\d+$/, '')}|${sex}`);
    }
    known.add(`${normalizeName(it.nameFr)}|${sex}`);
    known.add(`${normalizeName(it.nameEn)}|${sex}`);
  }
}

/** Fiche complète du même objet, pour l'autre sexe (fonds, cadres…). */
function twinOf(sex, name) {
  const other = sex === 'M' ? 'F' : 'M';
  const key = normalizeName(name);
  return (
    catalog.sexes[other].find((it) => it.nom && it.zIndex.length && normalizeName(it.nameFr) === key) ??
    catalog.sexes[other].find((it) => it.nom && it.zIndex.length && normalizeName(it.nameEn) === key)
  );
}

for (const item of wikiItemsByName.values()) {
  if (BLACKLIST.has(item.title)) continue;
  const infos = assetsByItem.get(item.title) ?? [];
  if (!infos.length) continue;
  const name = templateField(item.text ?? '', 'nom') || item.title;
  const nameEn = templateField(item.text ?? '', 'anNom') || null;
  const sexes = [...new Set(infos.map((i) => i.sex).filter(Boolean))];
  if (!sexes.length) sexes.push('M', 'F');
  // Une page de pack (`elementPano` > 1) liste les sprites de ses éléments,
  // qui ont chacun leur fiche : elle ne doit pas créer d'objet.
  if (Number(templateField(item.text ?? '', 'elementPano')) > 1) continue;
  // Seules les catégories d'objets explicites créent des fiches : les
  // catégories parentes ne servent qu'à retrouver des fichiers.
  const category = item.categories.find((c) => c.category)?.category ?? categoryOfAsset(infos[0]);
  if (!category) continue;
  const slug = normalizeName(item.title).replace(/[^a-z0-9]+/g, '-') || 'objet';
  for (const sex of sexes) {
    const asset = infos.find((i) => i.sex === sex) ?? infos[0];
    if (!asset) continue;

    // Fiche déjà présente pour ce sexe : si elle est incomplète et qu'un
    // jumeau complet existe pour l'autre sexe, on la remplace par sa copie.
    const existingIdx = catalog.sexes[sex].findIndex((it) => normalizeName(it.nameFr) === normalizeName(name));
    const twin = twinOf(sex, name);
    if (existingIdx >= 0) {
      const existing = catalog.sexes[sex][existingIdx];
      if (!existing.zIndex.length && twin) {
        catalog.sexes[sex][existingIdx] = { ...twin, cdn: existing.cdn?.length ? existing.cdn : twin.cdn };
        added.push(`${sex} ${name} -> copie de ${twin.id} (${twin.nom})`);
      }
      continue;
    }

    if (known.has(`${asset.nom.toLowerCase().replace(/_[mn]\d+$/, '')}|${sex}`)) continue;
    if (known.has(`${normalizeName(name)}|${sex}`)) continue;
    const paths = pathsFor(infos, sex);
    const usable = [];
    for (const p of paths) if (await exists(CDN_ROOT + p)) usable.push(p);
    if (!usable.length) continue;
    const decls = [...new Set(infos.map((i) => i.decl).filter((d) => d != null))].sort((a, b) => a - b);

    // Même objet déjà complet pour l'autre sexe : on recopie l'entrée (même
    // idItem, même z-index) au lieu de créer une fiche à moitié vide.
    if (twin) {
      const copy = { ...twin, cdn: usable.length ? usable : twin.cdn };
      catalog.sexes[sex].push(copy);
      known.add(`${asset.nom.toLowerCase()}|${sex}`);
      known.add(`${normalizeName(name)}|${sex}`);
      added.push(`${sex} ${name} -> copie de ${twin.id} (${twin.nom})`);
      continue;
    }

    const entry = {
      id: `wiki:${slug}`,
      nom: asset.nom,
      cdn: usable,
      slot: '',
      slotGardeRobe: category,
      miniature: 'o',
      declinaisons: decls,
      zIndex: [],
      dependCouleurPeau: !!asset.flags.peau,
      dependPostureMainG: !!asset.flags.mainG,
      dependPostureMainD: !!asset.flags.mainD,
      slotsMasques: [],
      nameEn,
      nameFr: name,
    };
    catalog.sexes[sex].push(entry);
    known.add(`${asset.nom.toLowerCase()}|${sex}`);
    known.add(`${normalizeName(name)}|${sex}`);
    added.push(`${sex} ${name} -> ${asset.nom}`);
  }
}

console.log(`remplis : ${filled.length}`);
for (const f of filled) console.log(`  + ${f}`);
console.log(`corrigés : ${corrected.length}`);
for (const c of corrected) console.log(`  ~ ${c}`);
console.log(`ajoutés : ${added.length}`);
for (const a of added) console.log(`  * ${a}`);
console.log(`sans CDN trouvé sur le wiki : ${unresolved.length}`);
for (const u of unresolved) console.log(`  ? ${u}`);

if (WRITE) {
  // Le catalogue est modifié : les dates affichées dans la garde-robe doivent
  // le refléter.
  const now = new Date().toISOString();
  catalog.refreshedAt = now;
  catalog.wikiUpdatedAt = now;
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log('catalog.json réécrit');
} else {
  console.log('dry-run : relancer avec --write');
}
