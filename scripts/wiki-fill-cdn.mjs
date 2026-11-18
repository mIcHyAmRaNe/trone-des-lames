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
  // Pages qui listent les variantes d'un objet, pas un objet unique
  'Foulard du teinturier', 'Tenue du teinturier',
  'Foulards du teinturier', 'Tenues du teinturier',
  'Les foulards du teinturier', 'Les tenues du teinturier',
  'Panoplie Troubadour', "Panoplie 'Troubadour'", 'Troubadour set',
  'Troubadour - 1', 'Troubadour - 2', 'Troubadour - 3',
  'Panoplie Mariage', "Panoplie 'Mariage'", 'Wedding set',
  'Mariage - 1', 'Mariage - 2', 'Mariage - 3',
  // Catégories wiki parentes qui listent des sous-objets (pas des items)
  'Cats', 'Chick', 'Clam',                      // EN category pages
  'Chats', 'Poussin', 'Palourde',               // FR category pages (si existants)
  'Pets', 'Familiers',                          // catégories génériques
  // Pages de catégorie EN qui ne sont pas des items (listent les vrais items)
  'Duck', 'Jousting horses', 'Jousting horse',  // EN category pages (pas d'assets directs)
  'Doodled background', 'Doodled',              // EN category pages
  // Pages EN qui sont des catégories de groupe
  'Common duck', 'Rare duck', 'Epic duck', 'Duck family',  // listées dans Category:Pet
  'Jousting horse', 'Jousting horse (bay)', 'Jousting horse (white)', 
  'Jousting horse (isabelline)', 'Jousting horse (jet black)',  // variantes listées
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

/** Champ de template pouvant tenir sur plusieurs lignes (les emplacements
 *  listent souvent un sexe par ligne). */
const templateFieldRaw = (text, field) => {
  const lines = `${text ?? ''}`.split('\n');
  const re = new RegExp(`^\\s*\\|?\\s*${field}\\s*=(.*)$`, 'i');
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return '';
  const out = [lines[i].replace(re, '$1')];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\s*(?:\||\}\})/.test(lines[j]) || /^\s*[a-z][\w ]*\s*=/i.test(lines[j])) break;
    out.push(lines[j]);
  }
  return out.join('\n');
};

/** Extrait le sexe depuis le champ vetementGenre du template FR.
 *  Retourne 'M', 'F', 'MF' (les deux), ou null si non trouvé. */
function extractSexFromTemplate(text) {
  const genre = templateField(text, 'vetementGenre');
  if (!genre) return null;
  const g = genre.toLowerCase();
  if (g.includes('homme') && !g.includes('femme')) return 'M';
  if (g.includes('femme') && !g.includes('homme')) return 'F';
  if (g.includes('homme') && g.includes('femme')) return 'MF';
  if (g.includes('mixte') || g.includes('les deux') || g.includes('both')) return 'MF';
  return null;
}

function normalizeName(value) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/,?\s*appel\w*\s+aussi.*$/, '')
    .replace(/^(?:l'|le |la |les |un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Nom FR affiché : tel que sur le wiki, sans article initial ajouté. */
const wikiDisplayName = (value) => {
  const bare = `${value ?? ''}`
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/^(?:l['’]|le |la |les |un |une |des |du |de |d')/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return bare ? bare[0].toUpperCase() + bare.slice(1) : '';
};

/** Ramène un chemin CDN relevé sur le wiki à la forme attendue par la cabine
 *  d'essayage : séparateurs simples et suffixe _@1X (le rendu Midas est en X1). */
function normalizeCdnPath(path) {
  return path.replace(/\/{2,}/g, '/').replace(/_@\d+X(\.\w+)$/i, '_@1X$1');
}

/**
 * Décompose une URL CDN en chemin, nom d'asset et variantes.
 * `vetements/gantMineur_m0_n0_d1_0_@1X.webp` -> nom `gantMineur`, flags main G/D.
 */
function assetInfo(url) {
  const path = normalizeCdnPath(
    decodeURIComponent(url.slice(url.indexOf('personnages_midas/') + 'personnages_midas/'.length)),
  );
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
    // `_dN_F` : F est le numéro d'image (frame), pas une déclinaison. Le figer
    // à 0 garde un seul nom d'asset pour toutes les URL du même objet.
    withoutDecl = bare.replace(/_d\d+_\d+$/i, '0').replace(/_d\d+(?:_|$)/i, '');
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

// L'emplacement du template wiki (« III.a : Braies », « XII. : Outfits ») est
// la source de vérité pour la catégorie de garde-robe. Les catégories wiki
// (« Accessoire », « Vêtement événementiel ») sont trop larges et produisent
// des fiches « Autres ».
const EMPLACEMENT_CATEGORY = {
  chapeaux: 'Chapeaux', casques: 'Casques', coiffures: 'Coiffures', barbes: 'Barbes',
  tabliers: 'Tabliers', gilets: 'Gilets', mantels: 'Mantels', capes: 'Capes',
  braies: 'Braies', jupes: 'Jupes', chemises: 'Chemises', bustiers: 'Bustiers',
  chaussures: 'Chaussures', 'bas et dessous': 'BasDessous', basdessous: 'BasDessous',
  panoplies: 'Panoplies', outfits: 'Panoplies', bijoux: 'Bijoux', cou: 'Cou',
  ceintures: 'Ceintures', yeux: 'Yeux', gants: 'Gants', gloves: 'Gants',
  'main gauche': 'MainGauche', 'main droite': 'MainDroite', fonds: 'Fonds',
  cadres: 'Cadres', familiers: 'Familiers', barque: 'Outils_barque',
  'filet de peche': 'Outils_filet', echelle: 'Outils_echelle',
  armes: 'Armes', boucliers: 'Boucliers',
};
/** Catégories déduites de l'emplacement wiki, par sexe quand il est précisé
 *  (`(homme) : III.a : Braies` / `(femme) : III.b Jupes`). */
function categoriesFromEmplacement(text) {
  const out = { M: null, F: null, any: null };
  for (const line of `${text ?? ''}`.replace(/<br\s*\/?>/gi, '\n').split('\n')) {
    if (!line.trim()) continue;
    const hasM = /\bhommes?\b/i.test(line);
    const hasF = /\bfemmes?\b/i.test(line);
    const sex = hasM === hasF ? null : hasM ? 'M' : 'F';
    const label = (line.split(':').pop() ?? '')
      .replace(/\([^)]*\)/g, ' ')
      .trim()
      .replace(/^[ivx]+\.?\s*[a-z]?\.?(?=\s|$)\s*/i, '') // numéro de section (III.b, X.b…)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z ]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const category = EMPLACEMENT_CATEGORY[label] ?? null;
    if (category) out[sex ?? 'any'] = category;
  }
  return out;
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
  // Une page de panoplie porte les sprites de ses éléments (`elementPano > 1`) :
  // ses assets ne doivent jamais être proposés aux fiches de ces éléments.
  if (Number(templateField(item.text ?? '', 'elementPano')) > 1) continue;
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
    // Une page générique (« Colliers en pierre fine ») porte les sprites de
    // toutes ses variantes : ne garder que l'asset de la clé pour éviter de
    // recopier les CDN d'une couleur dans une autre.
    if (!byAsset.has(key))
      byAsset.set(key, { item, infos: infos.filter((i) => i.nom.toLowerCase() === key) });
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

/** Le wiki liste souvent le même sprite en .webp et en .png (l'une des URL
 *  portant un `//` dédoublé). Une seule forme par asset ; le .png est préféré
 *  quand il répond, comme l'URL que l'appli recalcule sans champ cdn. */
function dedupeCdnPaths(paths) {
  const byAsset = new Map();
  for (const p of paths) {
    const key = p.replace(/\.\w+$/, '');
    const prev = byAsset.get(key);
    if (!prev || /\.png$/i.test(p)) byAsset.set(key, p);
  }
  return [...byAsset.values()];
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
    const assetHit = it.nom ? byAsset.get(it.nom.toLowerCase()) : undefined;
    const hit = named?.infos.length ? named : (assetHit ?? named);
    // Un rapprochement par asset ne prouve pas que la page wiki est celle de
    // l'objet : elle peut lister plusieurs variantes. Dans ce cas on ne touche
    // pas au libellé, sinon « Collier (ambre) » redevient « Colliers en pierre fine ».
    const nameHit = named?.infos.length ? named : null;
    if (!hit) continue;
    // Pour les sprites, l'appariement par nom d'asset est plus sûr que la page
    // trouvée par libellé : une page générique liste toutes les variantes.
    const infos = assetHit?.infos.length ? assetHit.infos : hit.infos;
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
    const unique = dedupeCdnPaths(usable);
    if (unique.length !== usable.length) {
      usable.length = 0;
      usable.push(...unique);
    }

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
      // `_dN_F` : le chiffre final est une frame, pas une teinte.
      if (/_d\d+/i.test(p)) continue;
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

    // Mettre à jour les noms FR/EN depuis le wiki si disponibles
    const wikiItem = nameHit?.item;
    if (wikiItem) {
      // Le `text` d'une page de variante peut avoir été remplacé par celui de
      // la page générique lors de la fusion FR/EN : le nom du template perd
      // alors son qualificatif (« (ambre) »). Le titre le garde. Ne jamais
      // prendre un titre EN pour un libellé FR.
      let frNom = wikiItem.lang === 'fr' ? templateField(wikiItem.text ?? '', 'nom') : '';
      const variant = `${wikiItem.title ?? ''}`.match(/\([^)]+\)/)?.[0];
      const sameVariant = variant && `${it.nameFr ?? ''}`.includes(variant);
      if (sameVariant && frNom && !frNom.includes(variant)) frNom = wikiItem.title;
      const forced = NAME_OVERRIDES.get(normalizeName(wikiItem.title));
      if (forced) frNom = forced;
      const wikiNameFr = frNom ? wikiDisplayName(frNom) : '';
      const wikiNameEn = templateField(wikiItem.textEn ?? '', 'nom') || templateField(wikiItem.textEn ?? '', 'anNom');
      if (wikiNameFr && wikiNameFr !== it.nameFr) {
        it.nameFr = wikiNameFr;
        corrected.push(`${sex} ${it.nameFr} : nom FR mis à jour depuis le wiki`);
      }
      if (wikiNameEn && wikiNameEn !== it.nameEn) {
        it.nameEn = wikiNameEn;
        corrected.push(`${sex} ${it.nameFr} : nom EN mis à jour depuis le wiki`);
      }
      // L'emplacement wiki est plus précis que la catégorie « Accessoire » /
      // « Événementiel » utilisée à l'import (ex. Chapeaux/Cou selon le sexe).
      const emplacement =
        templateFieldRaw(wikiItem.text ?? '', 'emplacement') ||
        templateFieldRaw(wikiItem.textEn ?? '', 'emplacement');
      const cats = categoriesFromEmplacement(emplacement);
      const category = cats[sex] ?? cats.any;
      if (category && !it.slot && it.slotGardeRobe !== category) {
        it.slotGardeRobe = category;
        corrected.push(`${sex} ${it.nameFr} : catégorie -> ${category}`);
      }
    }
  }
}

// --- 3.5. correction du sexe des fiches existantes selon le wiki ------------
// Le wiki étiquette parfois le sprite du bon sexe avec le mauvais dossier CDN
// (`Item819f.png` -> `hommes/...`) : on garde ces cas explicites.
const SEX_OVERRIDES = new Map([['renardpolaire', ['M', 'F']]]);
// Certaines pages ont un champ `nom` erroné : le titre de la page fait foi.
const NAME_OVERRIDES = new Map([['coiffuredanslevent', 'Coiffure dans le vent']]);
// Construit une map nom -> sexes corrects depuis les données wiki
const correctSexes = new Map();
for (const item of wikiItemsByName.values()) {
  const infos = assetsByItem.get(item.title) ?? [];
  const name = templateField(item.text ?? '', 'nom') || item.title;
  const templateSex = extractSexFromTemplate(item.text ?? '');
  let sexes;
  if (templateSex === 'M') sexes = ['M'];
  else if (templateSex === 'F') sexes = ['F'];
  else if (templateSex === 'MF') sexes = ['M', 'F'];
  else if (infos.length) {
    sexes = [...new Set(infos.map((i) => i.sex).filter(Boolean))];
    if (!sexes.length) continue;
  } else continue; // ni genre déclaré ni asset : on ne devine pas le sexe
  correctSexes.set(normalizeName(name), sexes);
}

// Applique les sexes corrects aux fiches du catalogue existantes
const sexCorrected = [];
for (const sex of ['M', 'F']) {
  const list = catalog.sexes[sex];
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i];
    const key = normalizeName(it.nameFr) || normalizeName(it.nameEn);
    const correct = (it.id.startsWith('wiki:') && SEX_OVERRIDES.get(key)) || correctSexes.get(key);
    if (!correct) continue;
    const hasM = correct.includes('M');
    const hasF = correct.includes('F');
    const inM = sex === 'M';
    const inF = sex === 'F';
    
    // Si le sexe actuel n'est pas dans les sexes corrects, on déplace l'entrée
    if ((inM && !hasM) || (inF && !hasF)) {
      const targetSex = hasM ? 'M' : 'F';
      if (targetSex !== sex) {
        const moved = list.splice(i, 1)[0];
        catalog.sexes[targetSex].push(moved);
        sexCorrected.push(`${sex} ${it.nameFr} -> ${targetSex} (wiki: ${correct.join(',')})`);
      }
    }
    // Si l'entrée devrait exister dans les deux sexes mais n'est que dans un,
    // on la copie dans l'autre (cas rare, mais pour complétude)
    else if (correct.length === 2 && ((inM && !hasF) || (inF && !hasM))) {
      // L'entrée existe déjà dans ce sexe, on la copie dans l'autre si absent
      const otherSex = sex === 'M' ? 'F' : 'M';
      const existsInOther = catalog.sexes[otherSex].some(
        (o) => normalizeName(o.nameFr) === key || normalizeName(o.nameEn) === key
      );
      if (!existsInOther) {
        const copy = { ...it };
        catalog.sexes[otherSex].push(copy);
        sexCorrected.push(`${sex} ${it.nameFr} -> copié vers ${otherSex} (wiki: MF)`);
      }
    }
  }
}

console.log(`sexe corrigé : ${sexCorrected.length}`);
for (const s of sexCorrected) console.log(`  ~ ${s}`);

// --- 4. objets du wiki absents du catalogue ----------------------------------
const known = new Set();
for (const sex of ['M', 'F']) {
  for (const it of catalog.sexes[sex]) {
    if (it.nom) {
      known.add(`${it.nom.toLowerCase()}|${sex}`);
      // `concours16_m0` (wiki) et `concours16` (catalogue) sont le même asset.
      known.add(`${it.nom.toLowerCase().replace(/_[mn]\d+$/, '')}|${sex}`);
      // Deux objets peuvent partager le même nom d'asset avec des teintes
      // différentes (etole_d2 = Divin, etole_d3 = Écarlate).
      for (const d of it.declinaisons ?? []) known.add(`${it.nom.toLowerCase()}_d${d}|${sex}`);
    }
    known.add(`${normalizeName(it.nameFr)}|${sex}`);
    known.add(`${normalizeName(it.nameEn)}|${sex}`);
  }
}

/** Fiche complète du même objet, pour l'autre sexe (fonds, cadres…). */
function twinOf(sex, name) {
  const other = sex === 'M' ? 'F' : 'M';
  const key = normalizeName(name);
  if (!key) return null;
  return (
    catalog.sexes[other].find((it) => it.nom && it.zIndex.length && normalizeName(it.nameFr) === key) ??
    catalog.sexes[other].find((it) => it.nom && it.zIndex.length && normalizeName(it.nameEn) === key)
  );
}

for (const item of wikiItemsByName.values()) {
  if (BLACKLIST.has(item.title)) continue;
  const infos = assetsByItem.get(item.title) ?? [];
  if (!infos.length) continue;
  
  // nameFr: depuis le template FR (nom), fallback titre
  // nameEn: depuis le template EN (nom ou anNom), fallback nameFr
  const frNom = item.lang === 'fr' ? templateField(item.text ?? '', 'nom') : '';
  // Une page EN ne fournit pas de libellé FR : lui donner son titre anglais
  // créerait une fiche concurrente de la page FR du même objet.
  const nameFr = item.lang === 'fr' ? wikiDisplayName(frNom || item.title) : null;
  const nameEn =
    templateField(item.textEn ?? '', 'nom') ||
    templateField(item.textEn ?? '', 'anNom') ||
    (item.lang === 'en' ? item.title : null);
  
  // Nom d'affichage principal (FR prioritaire)
  const name = nameFr;
  
  // Déterminer le sexe depuis le template FR (vetementGenre) en priorité,
  // sinon depuis les assets, sinon défaut MF.
  const templateSex = extractSexFromTemplate(item.text ?? '');
  let sexes;
  if (templateSex === 'M') sexes = ['M'];
  else if (templateSex === 'F') sexes = ['F'];
  else if (templateSex === 'MF') sexes = ['M', 'F'];
  else {
    sexes = [...new Set(infos.map((i) => i.sex).filter(Boolean))];
    if (!sexes.length) sexes.push('M', 'F');
  }
  
  // Une page de pack (`elementPano` > 1) liste les sprites de ses éléments,
  // qui ont chacun leur fiche : elle ne doit pas créer d'objet.
  if (Number(templateField(item.text ?? '', 'elementPano')) > 1) continue;
  // Seules les catégories d'objets explicites créent des fiches : les
  // catégories parentes ne servent qu'à retrouver des fichiers.
  const emplacement =
    templateFieldRaw(item.text ?? '', 'emplacement') || templateFieldRaw(item.textEn ?? '', 'emplacement');
  const categories = categoriesFromEmplacement(emplacement);
  const fallbackCategory =
    item.categories.find((c) => c.category)?.category ?? categoryOfAsset(infos[0]);
  const slug = normalizeName(item.title).replace(/[^a-z0-9]+/g, '-') || 'objet';
  for (const sex of sexes) {
    const category = categories[sex] ?? categories.any ?? fallbackCategory;
    if (!category) continue;
    const asset = infos.find((i) => i.sex === sex) ?? infos[0];
    if (!asset) continue;

    // Fiche déjà présente pour ce sexe : si elle est incomplète et qu'un
    // jumeau complet existe pour l'autre sexe, on la remplace par sa copie.
    // Même objet sous un autre id (fiche du jeu ou page wiki FR/EN) : ne pas
    // créer un doublon. Deux objets peuvent partager le même asset avec des
    // teintes différentes (etole_d2 Divin / etole_d3 Écarlate) : la clé d'asset
    // doit donc inclure la déclinaison quand elle est connue.
    const incoming = [name, nameEn].map(normalizeName).filter(Boolean);
    if (asset?.nom) {
      const assetNorm = normalizeName(asset.nom);
      incoming.push(asset.decl != null ? `${assetNorm}_d${asset.decl}` : assetNorm);
    }
    const existingIdx = incoming.length
      ? catalog.sexes[sex].findIndex((it) => {
          const keys = [it.nameFr, it.nameEn, it.nom].map(normalizeName).filter(Boolean);
          if (it.nom) for (const d of it.declinaisons ?? []) keys.push(`${normalizeName(it.nom)}_d${d}`);
          return keys.some((key) => incoming.includes(key));
        })
      : -1;
    const twin = twinOf(sex, name);
    if (existingIdx >= 0) {
      const existing = catalog.sexes[sex][existingIdx];
      if (!existing.zIndex.length && twin) {
        catalog.sexes[sex][existingIdx] = { ...twin, cdn: existing.cdn?.length ? existing.cdn : twin.cdn };
        added.push(`${sex} ${name} -> copie de ${twin.id} (${twin.nom})`);
      }
      continue;
    }

    const assetKey = asset.decl != null
      ? `${asset.nom.toLowerCase()}_d${asset.decl}`
      : asset.nom.toLowerCase().replace(/_[mn]\d+$/, '');
    if (known.has(`${assetKey}|${sex}`)) continue;
    if (known.has(`${normalizeName(name)}|${sex}`)) continue;
    const paths = pathsFor(infos, sex);
    const usable = [];
    for (const p of paths) if (await exists(CDN_ROOT + p)) usable.push(p);
    if (!usable.length) continue;
    const unique = dedupeCdnPaths(usable);
    if (unique.length !== usable.length) {
      usable.length = 0;
      usable.push(...unique);
    }
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
      nameFr,
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
