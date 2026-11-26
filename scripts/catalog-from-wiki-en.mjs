// Génère un catalogue PROPRE uniquement depuis le wiki anglophone.
//
//   node scripts/catalog-from-wiki-en.mjs
//   WIKI_REFRESH=1 node scripts/catalog-from-wiki-en.mjs   # cache neuf
//
// Sorties : data/catalog-wiki-en.json + public/rk/wiki-en.json
//
// Aucune lecture du wiki FR, d'un ancien catalogue ou des données de jeu.
// Périmètre : garde-robe (Clothing, Accessory, Weapon, Frame, Background, Pet,
// Outfit, Tattoo, Event_clothing). `Special_object` est exclu : ce sont des
// objets de jeu, pas des sprites de garde-robe.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache/wiki-en');
const OUT_DATA = join(ROOT, 'data/catalog-wiki-en.json');
const OUT_PUBLIC = join(ROOT, 'public/rk/wiki-en.json');
const REPORT = join(ROOT, 'data/catalog-wiki-en-report.json');
const WIKI = 'https://wiki.renaissancekingdoms.com';
const API = `${WIKI}/en/api.php`;
const UA = 'trone-des-lames-catalog-en/1.0';
const FORCE_REFRESH = process.env.WIKI_REFRESH === '1';

const CDN_RE = /https?:\/\/[^\s"'<>)\]]*personnages_midas\/[^\s"'<>)\]]+\.(?:png|webp|gif|jpg)/gi;
const IMAGE_RE = /\.(png|gif|jpe?g|webp)$/i;
const UI_FILES = new Set([
  'File:Info button image.png',
  'File:IGdescription2.png',
  'File:ClothingHeader.jpg',
  'File:shopIcon.png',
  'File:premiumAccessInterface.png',
]);
const BLACKLIST = new Set([
  'Accessory', 'Accessories', 'Appearance', 'Clothing', 'Weapon', 'Weapons',
  'Frame', 'Frames', 'Background', 'Backgrounds', 'Pet', 'Pets', 'Outfit',
  'Outfits', 'Tattoo', 'Tattoos', 'Event clothing', 'Event_clothing',
  'Special object', 'Special_object',
  'Cats', 'Chick', 'Clam', 'Duck', 'Jousting horse', 'Jousting horses',
  'Doodled background', 'Doodled', 'Common duck', 'Rare duck', 'Epic duck',
  'Duck family', 'Jousting horse (bay)', 'Jousting horse (white)',
  'Jousting horse (isabelline)', 'Jousting horse (jet black)',
]);
// Modèles de maintenance : ils apparaissent en tête de page mais ne décrivent
// pas l'objet. On les ignore pour deviner le type.
const META_TEMPLATES = new Set([
  'note', 'info', 'information', 'cleanup', 'stub', 'delete', 'merge', 'split',
  'disambiguation', 'otheruses', 'about', 'main', 'see also', 'quote', 'wikify',
  'unreferenced', 'update', 'expand', 'tutorial', 'toc', 'clear', 'reflist',
  'notenglish', 'copyedit', 'translation', 'image', 'navbox',
]);
const CATEGORIES = [
  'Clothing', 'Accessory', 'Weapon', 'Frame', 'Background',
  'Pet', 'Outfit', 'Tattoo', 'Event_clothing',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cached(key, load) {
  const file = join(CACHE, createHash('sha1').update(key).digest('hex'));
  if (!FORCE_REFRESH) {
    try { return await readFile(file, 'utf8'); } catch { /* miss */ }
  }
  const text = await load();
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, text);
  return text;
}
async function get(url) {
  return cached(url, async () => {
    for (let a = 0; ; a++) {
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      if (r.ok) return r.text();
      if (a >= 4) throw new Error(`${url} -> HTTP ${r.status}`);
      await sleep(800 * (a + 1));
    }
  });
}
async function api(params) {
  const body = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  return JSON.parse(await cached(`POST ${API}?${body}`, async () => {
    for (let a = 0; ; a++) {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (r.ok) return r.text();
      if (a >= 4) throw new Error(`API ${r.status}`);
      await sleep(800 * (a + 1));
    }
  }));
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

const decodeEntities = (v) => `${v}`
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&apos;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const stripTags = (s) => `${s ?? ''}`.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const cleanName = (v) => `${v ?? ''}`
  .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1')
  .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')
  .replace(/\[\[|\]\]/g, '').replace(/\|/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/'''+/g, '')
  .replace(/\s+/g, ' ').trim();
const field = (text, name) => {
  const m = `${text ?? ''}`.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^|\\n]*)`, 'i'));
  return m ? cleanName(m[1]) : '';
};
const norm = (v) => `${v ?? ''}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/^(?:the |a |an )/, '').replace(/[^a-z0-9]+/g, '').trim();

function resolvePagename(value, title) {
  return `${value ?? ''}`
    .replace(/\{\{\s*PAGENAME\s*\}\}/gi, title)
    .replace(/\{\{\s*PAGENAME\s*\|[^}]*\}\}/gi, title)
    .trim();
}

// --- catégories de garde-robe ------------------------------------------------
const EMPLACEMENT_CATEGORY = {
  chapeaux: 'Chapeaux', chapeau: 'Chapeaux', hats: 'Chapeaux', hat: 'Chapeaux',
  casques: 'Casques', casque: 'Casques', helmets: 'Casques', helmet: 'Casques',
  coiffures: 'Coiffures', coiffure: 'Coiffures', hairstyles: 'Coiffures', hairstyle: 'Coiffures',
  barbes: 'Barbes', barbe: 'Barbes', beards: 'Barbes', beard: 'Barbes',
  tabliers: 'Tabliers', tablier: 'Tabliers', aprons: 'Tabliers', apron: 'Tabliers',
  gilets: 'Gilets', gilet: 'Gilets', vests: 'Gilets', vest: 'Gilets',
  mantels: 'Mantels', mantel: 'Mantels', mantles: 'Mantels', mantle: 'Mantels',
  capes: 'Capes', cape: 'Capes',
  braies: 'Braies', trousers: 'Braies', trouser: 'Braies', pants: 'Braies',
  jupes: 'Jupes', jupe: 'Jupes', skirts: 'Jupes', skirt: 'Jupes',
  chemises: 'Chemises', chemise: 'Chemises', shirts: 'Chemises', shirt: 'Chemises',
  bustiers: 'Bustiers', bustier: 'Bustiers', corsets: 'Bustiers', corset: 'Bustiers',
  chaussures: 'Chaussures', shoewear: 'Chaussures', shoes: 'Chaussures', shoe: 'Chaussures',
  hosiery: 'BasDessous', 'bas et dessous': 'BasDessous', basdessous: 'BasDessous',
  panoplies: 'Panoplies', panoplie: 'Panoplies', outfits: 'Panoplies', outfit: 'Panoplies',
  bijoux: 'Bijoux', bijou: 'Bijoux', jewellery: 'Bijoux', jewelry: 'Bijoux',
  cou: 'Cou', scarves: 'Cou', scarf: 'Cou', neck: 'Cou',
  ceintures: 'Ceintures', ceinture: 'Ceintures', belts: 'Ceintures', belt: 'Ceintures',
  yeux: 'Yeux', eyes: 'Yeux', eye: 'Yeux',
  gants: 'Gants', gloves: 'Gants', glove: 'Gants',
  'main gauche': 'MainGauche', 'left hand': 'MainGauche',
  'main droite': 'MainDroite', 'right hand': 'MainDroite',
  fonds: 'Fonds', backgrounds: 'Fonds', background: 'Fonds', decor: 'Fonds',
  cadres: 'Cadres', frames: 'Cadres', frame: 'Cadres',
  familiers: 'Familiers', pets: 'Familiers', pet: 'Familiers',
  armes: 'Armes', arme: 'Armes', weapons: 'Armes', weapon: 'Armes',
  boucliers: 'Boucliers', bouclier: 'Boucliers', shields: 'Boucliers', shield: 'Boucliers',
  barque: 'Outils_barque', boats: 'Outils_barque', boat: 'Outils_barque',
  'filet de peche': 'Outils_filet', 'fishing nets': 'Outils_filet', 'fishing net': 'Outils_filet',
  echelle: 'Outils_echelle', ladders: 'Outils_echelle', ladder: 'Outils_echelle',
};
function categoryFromText(text) {
  const label = `${text ?? ''}`.replace(/\([^)]*\)/g, ' ').trim()
    .replace(/^[ivx]+\.?\s*[a-z]?\.?(?=\s|$)\s*/i, '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z ]+/g, '').replace(/\s+/g, ' ').trim();
  return EMPLACEMENT_CATEGORY[label] ?? null;
}
const SECTION_CATEGORY = {
  HATS: 'Chapeaux', HELMETS: 'Casques', APRONS: 'Tabliers', VESTS: 'Gilets',
  TROUSERS: 'Braies', SKIRTS: 'Jupes', SHOEWEAR: 'Chaussures', HOSIERY: 'BasDessous',
  BEARDS: 'Barbes', HAIRSTYLES: 'Coiffures', JEWELLERY: 'Bijoux',
  'LEFT HAND': 'MainGauche', 'RIGHT HAND': 'MainDroite', PETS: 'Familiers',
  WEAPONS: 'Armes', CAPES: 'Capes', MANTLES: 'Mantels', CORSETS: 'Bustiers',
  SHIRTS: 'Chemises', OUTFITS: 'Panoplies', GLOVES: 'Gants', EYES: 'Yeux',
  BELTS: 'Ceintures', SCARVES: 'Cou', FRAMES: 'Cadres', BACKGROUNDS: 'Fonds',
  SHIELDS: 'Boucliers', LADDERS: 'Outils_echelle', 'FISHING NETS': 'Outils_filet',
  BOATS: 'Outils_barque',
};
function categoryForSection(section) {
  const label = `${section ?? ''}`.replace(/^[IVXLC]+(?:\.\w+)?\.?\s*/i, '').replace(/[:\s]+$/, '').trim().toUpperCase();
  return SECTION_CATEGORY[label] ?? null;
}

// --- 1. tableaux de la page Clothing ----------------------------------------
async function readClothingTables() {
  const html = await get(`${WIKI}/en/Clothing`);
  const entries = new Map();
  for (const block of html.split(/(?=<h2>)/)) {
    if (!block.includes('class="wikitable"')) continue;
    for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      if (cells.length < 2) continue;
      const section = stripTags(cells[0].split(/<br\s*\/?>/i)[0]);
      if (!section) continue;
      for (let col = 1; col < cells.length; col++) {
        const sexes = col === 1 ? ['M', 'F'] : col === 2 ? ['F'] : ['M'];
        for (const a of cells[col].matchAll(/<a [^>]*href="\/en\/[^"]+"[^>]*title="([^"]+)"/g)) {
          const title = decodeEntities(a[1]);
          if (/^(File|Category):/i.test(title) || BLACKLIST.has(title)) continue;
          const e = entries.get(title) ?? { title, section, sexes: new Set(), source: 'Clothing' };
          sexes.forEach((s) => e.sexes.add(s));
          entries.set(title, e);
        }
      }
    }
  }
  return entries;
}

async function categoryMembers(cat) {
  const titles = [];
  let cont = {};
  do {
    const res = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${cat}`, cmlimit: '500', cmnamespace: '0', ...cont });
    titles.push(...(res.query?.categorymembers ?? []).map((m) => m.title));
    cont = res.continue?.cmcontinue ? { cmcontinue: res.continue.cmcontinue } : {};
  } while (cont.cmcontinue);
  return titles.filter((t) => !BLACKLIST.has(t));
}

// --- 2. pages d'objets -------------------------------------------------------
async function fetchPages(titles) {
  const pages = [];
  for (let i = 0; i < titles.length; i += 50) {
    const res = await api({
      action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content',
      rvslots: 'main', redirects: '1', titles: titles.slice(i, i + 50).join('|'),
    });
    for (const p of res.query?.pages ?? []) {
      pages.push({
        title: p.title,
        missing: p.missing === true,
        text: p.revisions?.[0]?.slots?.main?.content ?? '',
        files: (p.images ?? []).map((im) => im.title).filter((t) => IMAGE_RE.test(t) && !UI_FILES.has(t)),
      });
    }
    process.stderr.write(`\r  pages ${Math.min(i + 50, titles.length)}/${titles.length}`);
  }
  process.stderr.write('\r');
  return pages;
}

async function readFileUrls(files) {
  const urlsByFile = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const res = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: files.slice(i, i + 50).join('|') });
    for (const p of res.query?.pages ?? []) {
      const text = p.revisions?.[0]?.slots?.main?.content ?? '';
      const urls = [...text.matchAll(CDN_RE)].map((m) => m[0]);
      if (urls.length) urlsByFile.set(p.title, [...new Set([...(urlsByFile.get(p.title) ?? []), ...urls])]);
    }
    process.stderr.write(`\r  files ${Math.min(i + 50, files.length)}/${files.length}`);
  }
  if (files.length > 500) process.stderr.write('\r');
  return urlsByFile;
}

// --- 3. extraction -----------------------------------------------------------
const entries = await readClothingTables();
console.log(`tableaux Clothing : ${entries.size} pages`);
for (const cat of CATEGORIES) {
  const titles = await categoryMembers(cat);
  for (const title of titles) {
    if (!entries.has(title)) entries.set(title, { title, section: '', sexes: new Set(), source: `Category:${cat}` });
  }
  console.log(`Category:${cat} : ${titles.length} pages`);
}
console.log(`total pages : ${entries.size}`);

const pages = await fetchPages([...entries.keys()]);
const byTitle = new Map(pages.map((p) => [p.title, p]));
const files = [...new Set(pages.flatMap((p) => p.files))];
console.log(`pages lues : ${pages.length} | fichiers : ${files.length}`);
const urlsByFile = await readFileUrls(files);
console.log(`\npages File: avec CDN : ${urlsByFile.size}/${files.length}`);

const items = [];
const missing = [];
let pagenameFixed = 0;
for (const [title, entry] of entries) {
  const page = byTitle.get(title);
  if (!page || page.missing) { missing.push(title); continue; }
  const text = page.text;
  const rawName = field(text, 'ClothingName') || field(text, 'PetName') || field(text, 'name') || field(text, 'Name') || title;
  const name = resolvePagename(rawName, title);
  if (/\{\{\s*PAGENAME/i.test(rawName)) pagenameFixed++;

  const gender = (field(text, 'ClothingGender') || field(text, 'Gender') || '').toLowerCase();
  let sexes;
  if (/mixed|mixte|both/.test(gender)) sexes = ['M', 'F'];
  else if (/female|woman|femme/.test(gender)) sexes = ['F'];
  else if (/male|man|homme/.test(gender)) sexes = ['M'];
  else if (gender === 's') sexes = ['M', 'F'];
  else sexes = entry.sexes.size ? [...entry.sexes] : ['M', 'F'];
  if (!sexes.length) sexes = ['M', 'F'];
  sexes = [...new Set(sexes)];

  const slot = field(text, 'Slot') || field(text, 'slot');
  const template = [...`${text}`.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9 _-]*)/g)]
    .map((m) => m[1].trim())
    .find((t) => !META_TEMPLATES.has(t.toLowerCase()));
  const type = field(text, 'ClothingType') || field(text, 'ItemKind') || template || '';
  const rawPack = field(text, 'elementPack') || field(text, 'elementOutfit');
  const group = /\[\[/.test(rawPack) ? cleanName(rawPack) : null;
  const cdn = [...new Set(page.files.flatMap((f) => urlsByFile.get(f) ?? []))];
  const category = categoryFromText(slot) || categoryForSection(entry.section) || '';

  items.push({
    page: title,
    pageUrl: `${WIKI}/en/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    name,
    nameFr: field(text, 'frName') || null,
    section: entry.section || category || type || entry.source || '',
    slot,
    category,
    type,
    sexe: sexes.length === 2 ? 'Mixte' : sexes[0],
    sexes,
    group,
    images: page.files.length,
    cdn,
  });
}

const dupNames = new Map();
for (const it of items) {
  const key = norm(it.name);
  dupNames.set(key, (dupNames.get(key) ?? 0) + 1);
}
const duplicates = [...dupNames.entries()].filter(([, n]) => n > 1).map(([name, n]) => ({ name, n }));

const bySection = {};
for (const it of items) {
  const key = it.section || '(sans section)';
  bySection[key] ??= { items: 0, cdn: 0 };
  bySection[key].items++;
  if (it.cdn.length) bySection[key].cdn++;
}

const now = new Date().toISOString();
const catalog = {
  lang: 'en',
  source: `${WIKI}/en`,
  generatedAt: now,
  items,
};
const report = {
  generatedAt: now,
  source: `${WIKI}/en`,
  counts: {
    pages: entries.size,
    missing: missing.length,
    items: items.length,
    withCdn: items.filter((i) => i.cdn.length).length,
    withoutCdn: items.filter((i) => !i.cdn.length).length,
    cdnUrls: [...new Set(items.flatMap((i) => i.cdn))].length,
    pagenameFixed,
    duplicateNames: duplicates.length,
  },
  bySection,
  duplicates,
  missing,
};
await mkdir(dirname(OUT_DATA), { recursive: true });
await mkdir(dirname(OUT_PUBLIC), { recursive: true });
await writeFile(OUT_DATA, JSON.stringify(catalog));
await writeFile(OUT_PUBLIC, JSON.stringify(catalog));
await writeFile(REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.counts, null, 2));
console.log(`-> ${OUT_DATA}\n-> ${OUT_PUBLIC}\n-> ${REPORT}`);
