// Regénère les données du catalogue depuis le wiki officiel RK.
//
//   node scripts/catalog-from-wiki.mjs
//
// Sortie : data/wiki-catalog-raw.json — une fiche par objet et par sexe, avec
// noms, catégories, sexes, CDN et dépendances. Les champs que le wiki ne
// contient pas (id, zIndex, slotsMasques, slot technique) sont ajoutés ensuite
// par catalog-wiki-join.mjs. Ne pas importer les autres scripts : ils ont des
// effets de bord au chargement ; les helpers utiles sont recopiés ci-dessous.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache/wiki-audit');
const OUT = join(ROOT, 'data/wiki-catalog-raw.json');
const WIKI = 'https://wiki.renaissancekingdoms.com';
const API = `${WIKI}/fr/api.php`;
const UA = 'trone-des-lames-catalog-rebuild/1.0';

// Pages de section ou de catégorie qui listent des objets sans être des items.
const BLACKLIST = new Set([
  'arme', 'lac', 'pecher', 'verger', 'Arme', 'Lac', 'Pêcher', 'Verger',
  'Weapon', 'Lake', 'Fishing', 'Orchard',
  'Panoplie Troubadour', "Panoplie 'Troubadour'", 'Troubadour set',
  'Troubadour - 1', 'Troubadour - 2', 'Troubadour - 3',
  'Panoplie Mariage', "Panoplie 'Mariage'", 'Wedding set',
  'Mariage - 1', 'Mariage - 2', 'Mariage - 3',
  'Cats', 'Chick', 'Clam', 'Chats', 'Poussin', 'Palourde',
  'Pets', 'Familiers', 'Duck', 'Jousting horses', 'Jousting horse',
  'Doodled background', 'Doodled',
  'Common duck', 'Rare duck', 'Epic duck', 'Duck family',
  'Jousting horse (bay)', 'Jousting horse (white)',
  'Jousting horse (isabelline)', 'Jousting horse (jet black)',
]);

// Toute URL Midas, y compris fonds/ et cadres/ (la regex de wiki-audit ne
// couvrait que vetements/ et perdait ~110 décors).
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

async function get(url) {
  return cached(url, async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (res.ok) return res.text();
      if (attempt >= 3) throw new Error(`${url} -> HTTP ${res.status}`);
      await sleep(1000 * (attempt + 1));
    }
  });
}

async function api(params) {
  const body = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  return JSON.parse(
    await cached(`POST ${API}?${body}`, async () => {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (res.ok) return res.text();
        if (attempt >= 3) throw new Error(`API ${res.status}`);
        await sleep(1000 * (attempt + 1));
      }
    }),
  );
}

async function inBatches(titles, params, pick) {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const res = await api({ ...params, titles: titles.slice(i, i + 50).join('|') });
    out.push(...(res.query?.pages ?? []).map(pick));
    if (i % 500 === 0) process.stderr.write(`\r  ${i}/${titles.length}`);
  }
  if (titles.length > 500) process.stderr.write('\r');
  return out;
}

const text = (html) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

const ENTITIES = { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decodeEntities(value) {
  return `${value}`
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? m);
}

function cleanWikiName(value) {
  return `${value ?? ''}`
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')
    .replace(/\[\[|\]\]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wikiDisplayName(value) {
  return cleanWikiName(value)
    .replace(/^(?:l['’]|le |la |les |un |une |des |du |de |d')/i, '')
    .trim();
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

const templateField = (text, field) => {
  const m = `${text ?? ''}`.match(new RegExp(`\\|\\s*${field}\\s*=\\s*([^|\\n]*)`, 'i'));
  return m ? cleanWikiName(m[1]) : '';
};

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

function extractSexFromTemplate(wikitext) {
  const genre = templateField(wikitext, 'vetementGenre').toLowerCase();
  if (!genre) return null;
  if (genre.includes('homme') && !genre.includes('femme')) return 'M';
  if (genre.includes('femme') && !genre.includes('homme')) return 'F';
  if (genre.includes('mixte') || genre.includes('les deux') || genre.includes('both')) return 'MF';
  if (genre.includes('homme') && genre.includes('femme')) return 'MF';
  return null;
}

function normalizeCdnPath(path) {
  return path.replace(/\/{2,}/g, '/').replace(/_@\d+X(\.\w+)$/i, '_@1X$1');
}

/** URL CDN -> { path, sex, nom, kind, decl, flags }, copié de wiki-fill-cdn. */
function assetInfo(url) {
  const path = normalizeCdnPath(
    decodeURIComponent(url.slice(url.indexOf('personnages_midas/') + 'personnages_midas/'.length)),
  );
  const parts = path.split('/');
  const sexFolder = parts[0];
  const sub = parts.length > 2 ? parts[1] : null;
  const file = parts[parts.length - 1];
  const sex = sexFolder === 'hommes' ? 'M' : sexFolder === 'femmes' ? 'F' : null;
  const bare = file.replace(/\.\w+$/, '').replace(/_@\d+X$/i, '');
  const declStandard = bare.match(/_d(\d+)(?:_|$)/i);
  const declWiki = !declStandard ? bare.match(/_(\d+)$/) : null;
  let withoutDecl = bare;
  let decl = null;
  if (declStandard) {
    withoutDecl = bare.replace(/_d\d+_\d+$/i, '0').replace(/_d\d+(?:_|$)/i, '');
    decl = Number(declStandard[1]);
  } else if (declWiki) {
    const n = Number(declWiki[1]);
    withoutDecl = bare.replace(/_\d+$/, '');
    if (n > 0) decl = n;
  } else {
    withoutDecl = bare.replace(/_0$/, '');
  }
  const beard = withoutDecl.match(/^barbe_(\d+)/i);
  if (beard) {
    const c = withoutDecl.match(/_c(\d+)$/);
    return { path, sex, nom: `barbe${beard[1]}`, kind: 'corps', decl: c ? Number(c[1]) : null, flags: {} };
  }
  const hair = withoutDecl.match(/^cheveux(?:Avants|Arrieres|Intermediaires)_(\d+)/i);
  if (hair) {
    const c = withoutDecl.match(/_c(\d+)$/);
    return { path, sex, nom: `coiffure${hair[1]}`, kind: 'corps', decl: c ? Number(c[1]) : null, flags: {} };
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
  const kind = sub === 'corps' ? 'corps' : ['fonds', 'cadres'].includes(sexFolder) ? 'decor' : 'vetement';
  return { path, sex, nom, kind, decl, flags };
}

const SECTION_CATEGORY = {
  CHAPEAUX: 'Chapeaux', CASQUES: 'Casques', COIFFURES: 'Coiffures', BARBES: 'Barbes',
  YEUX: 'Yeux', TABLIERS: 'Tabliers', GILETS: 'Gilets', MANTELS: 'Mantels', CAPES: 'Capes',
  BRAIES: 'Braies', JUPES: 'Jupes', CHEMISES: 'Chemises', BUSTIERS: 'Bustiers',
  CHAUSSURES: 'Chaussures', 'SOUS-VÊTEMENTS': 'BasDessous', PANOPLIES: 'Panoplies',
  BIJOUX: 'Bijoux', COU: 'Cou', CEINTURE: 'Ceintures', CEINTURES: 'Ceintures', GANTS: 'Gants',
  'MAIN GAUCHE': 'MainGauche', 'MAIN DROITE': 'MainDroite', ARMES: 'Armes',
  BOUCLIERS: 'Boucliers', FAMILIERS: 'Familiers', CADRES: 'Cadres', FONDS: 'Fonds',
  ECHELLES: 'Outils_echelle', FILET: 'Outils_filet', BARQUE: 'Outils_barque',
};

function categoryForSection(section) {
  const label = `${section}`
    .replace(/^[IVXLC]+(?:\.\w+)?\.?\s*/i, '')
    .replace(/[:\s]+$/, '')
    .trim()
    .toUpperCase();
  return SECTION_CATEGORY[label] ?? null;
}

// Le wiki a des emplacements sales : 'cheveux' et 'barbe' au singulier
// n'étaient pas couverts, ce qui envoyait 52 fiches en catégorie « Autres ».
const EMPLACEMENT_CATEGORY = {
  chapeaux: 'Chapeaux', chapeau: 'Chapeaux', casques: 'Casques', casque: 'Casques',
  coiffures: 'Coiffures', coiffure: 'Coiffures', cheveux: 'Coiffures',
  barbes: 'Barbes', barbe: 'Barbes', tabliers: 'Tabliers', gilets: 'Gilets',
  mantels: 'Mantels', mantel: 'Mantels', capes: 'Capes', cape: 'Capes',
  braies: 'Braies', jupes: 'Jupes', jupe: 'Jupes', chemises: 'Chemises',
  chemise: 'Chemises', bustiers: 'Bustiers', chaussures: 'Chaussures',
  'bas et dessous': 'BasDessous', basdessous: 'BasDessous',
  panoplies: 'Panoplies', panoplie: 'Panoplies', outfits: 'Panoplies',
  bijoux: 'Bijoux', cou: 'Cou', ceintures: 'Ceintures', ceinture: 'Ceintures',
  yeux: 'Yeux', gants: 'Gants', gloves: 'Gants',
  'main gauche': 'MainGauche', 'main droite': 'MainDroite',
  fonds: 'Fonds', cadres: 'Cadres', familiers: 'Familiers',
  barque: 'Outils_barque', 'filet de peche': 'Outils_filet', echelle: 'Outils_echelle',
  armes: 'Armes', boucliers: 'Boucliers',
};

function categoriesFromEmplacement(text) {
  const out = { M: null, F: null, any: null };
  for (const line of `${text ?? ''}`.replace(/<br\s*\/?>/gi, '\n').split('\n')) {
    const hasM = /\bhommes?\b/i.test(line);
    const hasF = /\bfemmes?\b/i.test(line);
    const sex = hasM === hasF ? null : hasM ? 'M' : 'F';
    const label = (line.split(':').pop() ?? '')
      .replace(/\([^)]*\)/g, ' ')
      .trim()
      .replace(/^[ivx]+\.?\s*[a-z]?\.?(?=\s|$)\s*/i, '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z ]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const category = EMPLACEMENT_CATEGORY[label];
    if (category) out[sex ?? 'any'] = category;
  }
  return out;
}

const SEX_OVERRIDES = new Map([['renardpolaire', ['M', 'F']]]);
const NAME_OVERRIDES = new Map([['coiffuredanslevent', 'Coiffure dans le vent']]);

// --- 1. objets listés sur la page Vêtement -----------------------------------
async function readWikiPage() {
  const html = await get(`${WIKI}/fr/V%C3%AAtement`);
  const items = new Map();
  for (const block of html.split(/(?=<h2>)/)) {
    if (!block.includes('class="wikitable"')) continue;
    for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      if (cells.length < 2) continue;
      const section = text(cells[0].split(/<br\s*\/?>/i)[0]);
      if (!section) continue;
      for (let col = 1; col < cells.length; col++) {
        const sexes = col === 1 ? ['M', 'F'] : col === 2 ? ['F'] : ['M'];
        for (const a of cells[col].matchAll(/<a [^>]*href="\/fr\/[^"]+"[^>]*title="([^"]+)"/g)) {
          const title = decodeEntities(a[1]);
          if (title.startsWith('Fichier:') || title.startsWith('Catégorie:') || BLACKLIST.has(title)) continue;
          const entry = items.get(title) ?? { title, section, sexes: new Set(), source: 'Vêtement' };
          sexes.forEach((s) => entry.sexes.add(s));
          items.set(title, entry);
        }
      }
    }
  }
  return [...items.values()];
}

// --- 2. membres des catégories (la table Vêtement n'est pas exhaustive) -------
async function categoryMembers(category) {
  const titles = [];
  let cont = {};
  do {
    const res = await api({
      action: 'query', list: 'categorymembers', cmtitle: `Catégorie:${category}`,
      cmlimit: 'max', cmnamespace: '0', ...cont,
    });
    titles.push(...(res.query?.categorymembers ?? []).map((m) => m.title));
    cont = res.continue?.cmcontinue ? { cmcontinue: res.continue.cmcontinue } : {};
  } while (cont.cmcontinue);
  return [...new Set(titles)].filter((t) => !BLACKLIST.has(t));
}

// --- 3. pages d'objets + pages Fichier ---------------------------------------
async function readItems(entries) {
  const pages = [];
  const alias = new Map();
  for (let i = 0; i < entries.length; i += 50) {
    const res = await api({
      action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content',
      rvslots: 'main', redirects: '1',
      titles: entries.slice(i, i + 50).map((it) => it.title).join('|'),
    });
    for (const r of res.query?.redirects ?? []) alias.set(r.from, r.to);
    pages.push(
      ...(res.query?.pages ?? []).map((p) => ({
        title: p.title,
        missing: p.missing === true,
        text: p.revisions?.[0]?.slots?.main?.content ?? '',
        files: (p.images ?? []).map((im) => im.title),
      })),
    );
    if (i % 500 === 0) process.stderr.write(`\r  ${i}/${entries.length}`);
  }
  process.stderr.write('\r');
  const byItem = new Map(pages.map((p) => [p.title, p]));
  const resolve = (title) => {
    let cur = title;
    for (let hop = 0; hop < 5 && alias.has(cur); hop++) cur = alias.get(cur);
    return cur;
  };
  const unique = [...new Set(pages.flatMap((p) => p.files))].filter((t) => /\.(png|gif|jpe?g|webp)$/i.test(t));
  const contents = await inBatches(
    unique,
    { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main' },
    (p) => ({
      title: p.title,
      urls: [...`${p.revisions?.[0]?.slots?.main?.content ?? ''}`.matchAll(CDN_RE)].map((m) => m[0]),
    }),
  );
  const urlsByFile = new Map(contents.map((c) => [c.title, c.urls]));
  return { byItem, resolve, urlsByFile };
}

// --- 4. synthèse --------------------------------------------------------------
function derive(entry, page, urls, extraSection) {
  const wikitext = page?.text ?? '';
  const rawNom = templateField(wikitext, 'nom');
  const rawType = (templateField(wikitext, 'vetementType') || templateField(wikitext, 'VetementType')).toLowerCase();
  const emplacement = templateFieldRaw(wikitext, 'emplacement');
  const genre = extractSexFromTemplate(wikitext);
  const nameFr = NAME_OVERRIDES.get(normalizeName(entry.title)) ?? wikiDisplayName(rawNom || entry.title);
  const nameEn = templateField(wikitext, 'anNom') || null;

  const assets = urls.map(assetInfo).filter((a) => a.path);
  const bySex = { M: [], F: [], ANY: [] };
  for (const a of assets) bySex[a.sex ?? 'ANY'].push(a);

  const sexesFromCdn = bySex.M.length && bySex.F.length ? ['M', 'F'] : bySex.M.length ? ['M'] : bySex.F.length ? ['F'] : [];
  let sexes = genre === 'MF' ? ['M', 'F'] : genre ? [genre] : sexesFromCdn.length ? sexesFromCdn : [...entry.sexes];
  sexes = [...new Set(sexes)].filter((s) => s === 'M' || s === 'F');
  const override = SEX_OVERRIDES.get(normalizeName(entry.title));
  if (override) sexes = override;

  const fromSection = categoryForSection(entry.section ?? extraSection ?? '');
  const fromEmplacement = categoriesFromEmplacement(emplacement);
  const assetCategory = assets.find((a) => a.kind === 'corps' || a.kind === 'decor');
  const assetCategoryKey = assetCategory?.kind === 'corps'
    ? assetCategory.nom.startsWith('barbe') ? 'Barbes' : 'Coiffures'
    : assetCategory?.kind === 'decor'
      ? assetCategory.path.includes('/fonds/') ? 'Fonds' : 'Cadres'
      : null;

  // L'emplacement de la page objet est plus fiable que la section du tableau
  // (ex. l'étole des Cinq Rivières est classée « Chapeaux » dans le tableau
  // alors que sa page dit « XIII.d : Cou »). La panoplie fait exception : son
  // emplacement peut mentir (« VI.b : Main droite » pour le Troubadour).
  const categoryFor = (sex) => rawType.includes('panoplie') ? 'Panoplies'
    : fromEmplacement[sex] ?? fromEmplacement.any ?? fromSection ?? assetCategoryKey ?? '';

  const out = [];
  for (const sex of sexes) {
    const category = categoryFor(sex);
    const list = bySex[sex].length ? bySex[sex] : bySex.ANY;
    const names = new Map();
    for (const a of list) if (a.nom) names.set(a.nom, (names.get(a.nom) ?? 0) + 1);
    const nom = [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const decls = [...new Set(list.map((a) => a.decl).filter((d) => d !== null && Number.isFinite(d)))].sort((a, b) => a - b);
    out.push({
      title: entry.title,
      wikiKey: normalizeName(entry.title),
      sex,
      nom,
      cdn: list.map((a) => a.path),
      declinaisons: list.length ? [...new Set([0, ...decls])] : [],
      nameFr,
      nameEn,
      slotGardeRobe: category,
      dependCouleurPeau: list.some((a) => a.flags.peau),
      dependPostureMainG: list.some((a) => a.flags.mainG),
      dependPostureMainD: list.some((a) => a.flags.mainD),
      source: entry.source ?? 'Vêtement',
    });
  }
  return out;
}

// --- main ---------------------------------------------------------------------
const tableEntries = await readWikiPage();
console.log(`Vêtement : ${tableEntries.length} objets`);

const panoplies = await categoryMembers('Panoplie');
console.log(`Catégorie:Panoplie : ${panoplies.length} pages`);
const known = new Set(tableEntries.map((e) => e.title));
const allEntries = [
  ...tableEntries,
  ...panoplies.filter((t) => !known.has(t)).map((title) => ({
    title, section: 'XII. PANOPLIES', sexes: new Set(['M', 'F']), source: 'Catégorie:Panoplie',
  })),
];
console.log(`total : ${allEntries.length} objets uniques`);

const { byItem, resolve, urlsByFile } = await readItems(allEntries);
const items = [];
for (const entry of allEntries) {
  const title = resolve(entry.title);
  const page = byItem.get(title) ?? byItem.get(entry.title);
  const urls = [...new Set((page?.files ?? []).flatMap((f) => urlsByFile.get(f) ?? []))];
  items.push(...derive(entry, page, urls, entry.section));
}

// Dédup : une même page peut être atteinte par la table et par la catégorie.
const seen = new Set();
const unique = items.filter((it) => {
  const key = `${it.wikiKey}|${it.sex}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const result = {
  generatedAt: new Date().toISOString(),
  source: 'wiki.renaissancekingdoms.com',
  items: unique,
};
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(result));

const categories = {};
for (const it of unique) categories[it.slotGardeRobe || '(vide)'] = (categories[it.slotGardeRobe || '(vide)'] ?? 0) + 1;
console.log(`${unique.length} fiches (${unique.filter((i) => i.sex === 'M').length} M / ${unique.filter((i) => i.sex === 'F').length} F)`);
console.log(`sans CDN : ${unique.filter((i) => !i.cdn.length).length} | sans nom d'asset : ${unique.filter((i) => !i.nom).length}`);
console.log('catégories :', Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' '));
console.log(`-> ${OUT}`);
