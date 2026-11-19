// Génère un catalogue PROPRE uniquement depuis le wiki officiel RK.
//
//   node scripts/catalog-from-wiki.mjs
//
// Sortie : public/rk/catalog.json — aucune donnée ryence, aucun id hérité,
// aucun zIndex inventé. L'enrichissement (zIndex, slotsMasques) se fait ensuite
// avec catalog-enrich.mjs à partir de sources de jeu (fiches de personnage).
//
// Règles d'extraction :
//  - un objet = un nom canonique (`nom` du template), pas une page wiki :
//    les pages FR/variantes qui portent le même nom sont fusionnées ;
//  - une panoplie composée (`vetementType=Panoplie`, `elementPano>0`) donne
//    UNE fiche pour l'ensemble + UNE fiche par élément, chacune avec son propre
//    emplacement (les éléments sont portables séparément) ;
//  - la catégorie vient de l'emplacement de l'objet, pas de la section du
//    tableau ni d'un fichier externe.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache/wiki-audit');
const OUT = join(ROOT, 'data/catalog-wiki-clean.json');
const REPORT = join(ROOT, 'data/catalog-wiki-clean-report.json');
const WIKI = 'https://wiki.renaissancekingdoms.com';
const API = `${WIKI}/fr/api.php`;
const UA = 'trone-des-lames-catalog-clean/1.0';

const BLACKLIST = new Set([
  'arme', 'lac', 'pecher', 'verger', 'Arme', 'Lac', 'Pêcher', 'Verger',
  'Weapon', 'Lake', 'Fishing', 'Orchard',
  'Foulards du teinturier', 'Les foulards du teinturier',
  'Tenues du teinturier', 'Les tenues du teinturier',
  'Panoplie Mariage', "Panoplie 'Mariage'", 'Wedding set',
  'Mariage - 1', 'Mariage - 2', 'Mariage - 3',
  'Cats', 'Chick', 'Clam', 'Chats', 'Poussin', 'Palourde',
  'Pets', 'Familiers', 'Duck', 'Jousting horses', 'Jousting horse',
  'Doodled background', 'Doodled',
  'Common duck', 'Rare duck', 'Epic duck', 'Duck family',
  'Jousting horse (bay)', 'Jousting horse (white)',
  'Jousting horse (isabelline)', 'Jousting horse (jet black)',
]);

const CDN_RE = /https?:\/\/[^\s"'<>)\]]*personnages_midas\/[^\s"'<>)\]]+\.(?:png|webp|gif|jpg)/gi;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FORCE_REFRESH = process.env.WIKI_REFRESH === '1';

async function cached(key, load) {
  const file = join(CACHE, createHash('sha1').update(key).digest('hex'));
  // WIKI_REFRESH=1 force un scan neuf : le cache HTTP n'a pas d'expiration et
  // peut garder des pages Fichier: vides alors que le wiki a depuis été rempli.
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
      if (a >= 3) throw new Error(`${url} -> HTTP ${r.status}`);
      await sleep(1000 * (a + 1));
    }
  });
}
async function api(params, refresh = false) {
  const body = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  if (refresh) {
    // Contourne le cache pour un title précis : une page Fichier: peut avoir
    // été mise en cache vide avant que le wiki n'y publie ses URL CDN.
    for (let a = 0; ; a++) {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (res.ok) {
        const text = await res.text();
        const file = join(CACHE, createHash('sha1').update(`POST ${API}?${body}`).digest('hex'));
        await mkdir(CACHE, { recursive: true });
        await writeFile(file, text);
        return JSON.parse(text);
      }
      if (a >= 3) throw new Error(`API ${res.status}`);
      await sleep(1000 * (a + 1));
    }
  }
  return JSON.parse(await cached(`POST ${API}?${body}`, async () => {
    for (let a = 0; ; a++) {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (r.ok) return r.text();
      if (a >= 3) throw new Error(`API ${r.status}`);
      await sleep(1000 * (a + 1));
    }
  }));
}
async function inBatches(titles, params, pick, refresh = false) {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const res = await api({ ...params, titles: titles.slice(i, i + 50).join('|') }, refresh);
    out.push(...(res.query?.pages ?? []).map(pick));
    if (i % 500 === 0) process.stderr.write(`\r  ${i}/${titles.length}`);
  }
  if (titles.length > 500) process.stderr.write('\r');
  return out;
}

const stripTags = (s) => `${s ?? ''}`.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const ENTITIES = { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decodeEntities(v) {
  return `${v}`.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? m);
}
function cleanName(v) {
  return `${v ?? ''}`
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')
    .replace(/\[\[|\]\]/g, '').replace(/\|/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/'''+/g, '')
    .replace(/\s+/g, ' ').trim();
}
function displayName(v) {
  return cleanName(v).replace(/^(?:l['’]|le |la |les |un |une |des |du |de |d')/i, '').trim();
}
function normalize(v) {
  return `${v ?? ''}`.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/,?\s*appel\w*\s+aussi.*$/, '')
    .replace(/^(?:l'|le |la |les |un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');
}
const field = (text, name) => {
  const m = `${text ?? ''}`.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^|\\n]*)`, 'i'));
  return m ? cleanName(m[1]) : '';
};
const fieldRaw = (text, name) => {
  const lines = `${text ?? ''}`.split('\n');
  const re = new RegExp(`^\\s*\\|?\\s*${name}\\s*=(.*)$`, 'i');
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return '';
  const out = [lines[i].replace(re, '$1')];
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\s*(?:\||\}\})/.test(lines[j]) || /^\s*[a-z][\w ]*\s*=/i.test(lines[j])) break;
    out.push(lines[j]);
  }
  return out.join('\n');
};

function extractSex(text) {
  const g = field(text, 'vetementGenre').toLowerCase();
  if (!g) return null;
  if (/mixte|les deux|both/.test(g)) return ['M', 'F'];
  const m = /homme/.test(g); const f = /femme/.test(g);
  if (m && !f) return ['M'];
  if (f && !m) return ['F'];
  return m && f ? ['M', 'F'] : null;
}

function normalizeCdnPath(p) {
  return p.replace(/\/{2,}/g, '/').replace(/_@\d+X(\.\w+)$/i, '_@1X$1');
}
function assetInfo(url) {
  const path = normalizeCdnPath(decodeURIComponent(url.slice(url.indexOf('personnages_midas/') + 'personnages_midas/'.length)));
  const parts = path.split('/');
  const folder = parts[0];
  const sub = parts.length > 2 ? parts[1] : null;
  const bare = parts[parts.length - 1].replace(/\.\w+$/, '').replace(/_@\d+X$/i, '');
  const std = bare.match(/_d(\d+)(?:_|$)/i);
  const wiki = !std ? bare.match(/_(\d+)$/) : null;
  let base = bare; let decl = null;
  if (std) { base = bare.replace(/_d\d+_\d+$/i, '0').replace(/_d\d+(?:_|$)/i, ''); decl = Number(std[1]); }
  else if (wiki) { const n = Number(wiki[1]); base = bare.replace(/_\d+$/, ''); if (n > 0) decl = n; }
  else base = bare.replace(/_0$/, '');
  const beard = base.match(/^barbe_(\d+)/i);
  if (beard) return { path, sex: folder === 'hommes' ? 'M' : folder === 'femmes' ? 'F' : null, nom: `barbe${beard[1]}`, kind: 'corps', decl: Number(base.match(/_c(\d+)$/)?.[1] ?? 0) || null, flags: {} };
  const hair = base.match(/^cheveux(?:Avants|Arrieres|Intermediaires)_(\d+)/i);
  if (hair) return { path, sex: folder === 'hommes' ? 'M' : folder === 'femmes' ? 'F' : null, nom: `coiffure${hair[1]}`, kind: 'corps', decl: Number(base.match(/_c(\d+)$/)?.[1] ?? 0) || null, flags: {} };
  const flags = {};
  if (/_p\d+$/.test(base)) { flags.peau = true; base = base.replace(/_p\d+$/, ''); }
  const posture = base.match(/_(m\d+_n\d+|n\d+_m\d+)$/);
  if (posture) { flags.mainG = posture[1].includes('m'); flags.mainD = posture[1].includes('n'); base = base.replace(posture[1], ''); }
  const kind = sub === 'corps' ? 'corps' : ['fonds', 'cadres'].includes(folder) ? 'decor' : 'vetement';
  return { path, sex: folder === 'hommes' ? 'M' : folder === 'femmes' ? 'F' : null, nom: base, kind, decl, flags };
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
  const label = `${section ?? ''}`.replace(/^[IVXLC]+(?:\.\w+)?\.?\s*/i, '').replace(/[:\s]+$/, '').trim().toUpperCase();
  return SECTION_CATEGORY[label] ?? null;
}
const EMPLACEMENT_CATEGORY = {
  chapeaux: 'Chapeaux', chapeau: 'Chapeaux', casques: 'Casques', casque: 'Casques',
  coiffures: 'Coiffures', coiffure: 'Coiffures', cheveux: 'Coiffures', barbes: 'Barbes', barbe: 'Barbes',
  tabliers: 'Tabliers', tablier: 'Tabliers', gilets: 'Gilets', gilet: 'Gilets',
  mantels: 'Mantels', mantel: 'Mantels', capes: 'Capes', cape: 'Capes',
  braies: 'Braies', jupes: 'Jupes', jupe: 'Jupes', chemises: 'Chemises', chemise: 'Chemises',
  bustiers: 'Bustiers', bustier: 'Bustiers', chaussures: 'Chaussures',
  'bas et dessous': 'BasDessous', basdessous: 'BasDessous',
  panoplies: 'Panoplies', panoplie: 'Panoplies', outfits: 'Panoplies',
  bijoux: 'Bijoux', bijou: 'Bijoux', cou: 'Cou', ceintures: 'Ceintures', ceinture: 'Ceintures',
  yeux: 'Yeux', gants: 'Gants', gloves: 'Gants',
  'main gauche': 'MainGauche', 'main droite': 'MainDroite',
  fonds: 'Fonds', cadres: 'Cadres', familiers: 'Familiers', decor: 'Fonds',
  barque: 'Outils_barque', 'filet de peche': 'Outils_filet', echelle: 'Outils_echelle',
  armes: 'Armes', arme: 'Armes', boucliers: 'Boucliers', bouclier: 'Boucliers',
};
const SOURCE_CATEGORY = {
  'Catégorie:Familier': 'Familiers',
  'Catégorie:Arme': 'Armes',
  'Catégorie:Cadre': 'Cadres',
  'Catégorie:Decor': 'Fonds',
  'Catégorie:Apparence': 'Coiffures',
  'Catégorie:Accessoire': 'Bijoux',
  'Catégorie:Panoplie': 'Panoplies',
  'Élément de panoplie': 'Panoplies',
  'Catégorie:Vêtement événementiel': '',
  'Catégorie:Vêtement': '',
};
function categoryFromSource(source) {
  return SOURCE_CATEGORY[source] ?? null;
}
function categoryFromText(text) {
  const label = `${text ?? ''}`.replace(/\([^)]*\)/g, ' ').trim()
    .replace(/^[ivx]+\.?\s*[a-z]?\.?(?=\s|$)\s*/i, '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z ]+/g, '').replace(/\s+/g, ' ').trim();
  return EMPLACEMENT_CATEGORY[label] ?? null;
}
function categoriesFromEmplacement(text) {
  const out = {};
  for (const line of `${text ?? ''}`.replace(/<br\s*\/?>/gi, '\n').split('\n')) {
    if (!line.trim()) continue;
    const hasM = /\bhommes?\b/.test(line);
    const hasF = /\bfemmes?\b/.test(line);
    const sexes = hasM === hasF ? ['M', 'F'] : hasM ? ['M'] : ['F'];
    // Une ligne peut donner deux emplacements séparés par une virgule :
    // "XI.a Bustiers (pour les femmes), XI.b Chemises (pour les hommes)".
    const parts = line.split(/,|;/);
    for (const part of parts) {
      const cat = categoryFromText(part.split(':').pop());
      if (!cat) continue;
      const hasM2 = /\bhommes?\b/.test(part); const hasF2 = /\bfemmes?\b/.test(part);
      const target = hasM2 === hasF2 ? sexes : hasM2 ? ['M'] : ['F'];
      for (const s of target) out[s] ??= cat;
    }
  }
  return out;
}

// --- panoplies composées ------------------------------------------------------
function cleanElementLabel(value) {
  return displayName(`${value ?? ''}`.replace(/\s*\((?:femme|homme|mixte)[^)]*\)\s*$/i, ''));
}
function parseElements(wikitext) {
  const detail = fieldRaw(wikitext, 'elementPanoDetail')
    .split('\n').map((l) => l.trim().replace(/^\*+\s*/, '').replace(/\|+\s*$/, '')).filter(Boolean);
  const special = fieldRaw(wikitext, 'emplacementSpecial')
    .split('\n').map((l) => l.trim().replace(/^\*+\s*/, '')).filter(Boolean);
  const elements = [];
  for (const line of detail) {
    const [ref, rawLabel] = line.split(/\s*:\s*/, 2);
    if (!ref || !rawLabel) continue;
    const label = cleanElementLabel(rawLabel);
    const sp = special.find((s) => s.startsWith(ref) || s.toLowerCase().includes(label.toLowerCase()));
    const categories = categoriesFromEmplacement(sp ?? '');
    elements.push({ ref: ref.trim(), label, categories });
  }
  return elements;
}

/** Les fiches `{{PackEnsemble}}` listent leurs éléments avec `ElementsListe`. */
function parsePackElements(wikitext) {
  if (!/\{\{\s*PackEnsemble/i.test(wikitext)) return [];
  const raw = fieldRaw(wikitext, 'ElementsListe');
  return [...raw.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)]
    .map((m) => cleanName(m[1]))
    .filter(Boolean)
    .map((label) => ({ ref: '', label, categories: {} }));
}
function isCompositePage(page) {
  const text = page?.text ?? '';
  return /\{\{\s*PackEnsemble/i.test(text) ||
    (/vetementType\s*=\s*Panoplie/i.test(text) && Number(field(text, 'elementPano') || 0) > 0);
}
function parseImageRows(wikitext) {
  const rows = [];
  for (const chunk of `${wikitext ?? ''}`.split(/\n\|-|\|-/)) {
    const files = [...chunk.matchAll(/\[\[(?:Image|Fichier|File):([^\]|]+)(?:\|[^\]]*)?\]\]/gi)].map((m) => m[1].trim());
    if (!files.length) continue;
    // La cellule libellé est la première ligne ; le reste contient les
    // cellules d'images avec leurs attributs align="center" etc.
    const firstLine = chunk.trim().split('\n')[0].replace(/\[\[(?:Image|Fichier|File):[^\]]*\]\]/gi, '');
    const label = cleanName(firstLine.replace(/^\s*\|/, '').replace(/\|.*$/, ''));
    rows.push({ label, files });
  }
  return rows;
}

// --- collecte des titres ------------------------------------------------------
async function readWikiPage() {
  const html = await get(`${WIKI}/fr/V%C3%AAtement`);
  const items = new Map();
  for (const block of html.split(/(?=<h2>)/)) {
    if (!block.includes('class="wikitable"')) continue;
    for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      if (cells.length < 2) continue;
      const section = stripTags(cells[0].split(/<br\s*\/?>/i)[0]);
      if (!section) continue;
      for (let col = 1; col < cells.length; col++) {
        const sexes = col === 1 ? ['M', 'F'] : col === 2 ? ['F'] : ['M'];
        for (const a of cells[col].matchAll(/<a [^>]*href="\/fr\/[^"]+"[^>]*title="([^"]+)"/g)) {
          const title = decodeEntities(a[1]);
          if (title.startsWith('Fichier:') || title.startsWith('Catégorie:') || BLACKLIST.has(title)) continue;
          const e = items.get(title) ?? { title, section, sexes: new Set(), source: 'Vêtement' };
          sexes.forEach((s) => e.sexes.add(s));
          items.set(title, e);
        }
      }
    }
  }
  return [...items.values()];
}
async function categoryMembers(category) {
  const titles = []; let cont = {};
  do {
    const res = await api({ action: 'query', list: 'categorymembers', cmtitle: `Catégorie:${category}`, cmlimit: 'max', cmnamespace: '0', ...cont });
    titles.push(...(res.query?.categorymembers ?? []).map((m) => m.title));
    cont = res.continue?.cmcontinue ? { cmcontinue: res.continue.cmcontinue } : {};
  } while (cont.cmcontinue);
  return [...new Set(titles)].filter((t) => !BLACKLIST.has(t));
}
async function fetchPages(entries) {
  const pages = []; const alias = new Map();
  for (let i = 0; i < entries.length; i += 50) {
    const res = await api({ action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content', rvslots: 'main', redirects: '1', titles: entries.slice(i, i + 50).map((e) => typeof e === 'string' ? e : e.title).join('|') });
    for (const r of res.query?.redirects ?? []) alias.set(r.from, r.to);
    pages.push(...(res.query?.pages ?? []).map((p) => ({
      title: p.title, missing: p.missing === true,
      text: p.revisions?.[0]?.slots?.main?.content ?? '',
      files: (p.images ?? []).map((im) => im.title),
    })));
    if (i % 500 === 0) process.stderr.write(`\r  ${i}/${entries.length}`);
  }
  process.stderr.write('\r');
  const byItem = new Map(pages.map((p) => [p.title, p]));
  const byLower = new Map(pages.map((p) => [p.title.toLowerCase(), p]));
  const resolve = (t) => { let c = t; for (let k = 0; k < 5 && alias.has(c); k++) c = alias.get(c); return c; };
  const unique = [...new Set(pages.flatMap((p) => p.files))].filter((t) => /\.(png|gif|jpe?g|webp)$/i.test(t));
  const readContent = (p) => {
    const text = `${p.revisions?.[0]?.slots?.main?.content ?? ''}`;
    return { title: p.title, urls: [...text.matchAll(CDN_RE)].map((m) => m[0]), empty: !text.trim() };
  };
  const contents = await inBatches(
    unique,
    { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main' },
    readContent,
  );
  // Certaines pages Fichier: ont été mises en cache vides avant que le wiki
  // n'y publie leurs URL. On les relit une fois en force (sprite uniquement).
  const emptySprites = contents
    .filter((c) => c.empty && /^(?:Fichier:|Image:)?(?:Item\d+|barbe|cheveux|fond|cadre)/i.test(c.title))
    .map((c) => c.title);
  if (emptySprites.length) {
    console.log(`relecture de ${emptySprites.length} pages Fichier: vides`);
    const retried = await inBatches(
      emptySprites,
      { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main' },
      readContent,
      true,
    );
    for (const c of retried) {
      if (!c.urls.length) continue;
      const existing = contents.find((x) => x.title === c.title);
      if (existing) existing.urls = c.urls;
      else contents.push(c);
    }
  }
  return { pages, byItem, byLower, resolve, urlsByFile: new Map(contents.map((c) => [c.title, c.urls])) };
}

// --- synthèse d'un objet ------------------------------------------------------
function makeItem(nameFr, nameEn, sex, rawAssets, categories, section, kind) {
  const assets = dedupeAssets(rawAssets);
  const nom = [...assets.reduce((m, a) => (a.nom ? m.set(a.nom, (m.get(a.nom) ?? 0) + 1) : m), new Map()).entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const decls = [...new Set(assets.map((a) => a.decl).filter((d) => d !== null && Number.isFinite(d)))].sort((a, b) => a - b);
  const category = categories?.[sex] ?? categories?.any ?? categoryForSection(section)
    ?? (assets.find((a) => a.kind === 'corps') ? (assets[0].nom.startsWith('barbe') ? 'Barbes' : 'Coiffures')
      : assets.find((a) => a.kind === 'decor') ? (/(?:^|\/)fonds\//.test(assets[0].path) ? 'Fonds' : 'Cadres') : '');
  const out = {
    id: `wiki:${normalize(nameFr)}`,
    nom, slot: '', slotGardeRobe: category, miniature: 'o',
    declinaisons: assets.length ? [...new Set([0, ...decls])] : [],
    zIndex: [], dependCouleurPeau: assets.some((a) => a.flags.peau),
    dependPostureMainG: assets.some((a) => a.flags.mainG),
    dependPostureMainD: assets.some((a) => a.flags.mainD),
    slotsMasques: [], nameEn: nameEn || null, nameFr,
  };
  if (assets.length) out.cdn = assets.map((a) => a.path);
  // Sexe de la fiche, retiré juste avant l'écriture du catalogue.
  Object.defineProperty(out, '_sex', { value: sex, enumerable: false, configurable: true });
  return out;
}

const tableEntries = await readWikiPage();
console.log(`Vêtement : ${tableEntries.length} objets`);
const CATEGORY_PAGES = ['Panoplie', 'Vêtement événementiel', 'Vêtement', 'Familier', 'Arme', 'Cadre', 'Decor', 'Apparence', 'Accessoire'];
const known = new Set(tableEntries.map((e) => e.title));
const entries = [...tableEntries];
for (const cat of CATEGORY_PAGES) {
  const titles = await categoryMembers(cat);
  console.log(`Catégorie:${cat} : ${titles.length} pages`);
  for (const title of titles) if (!known.has(title)) { known.add(title); entries.push({ title, section: '', sexes: new Set(['M', 'F']), source: `Catégorie:${cat}` }); }
}
let data = await fetchPages(entries);

// Les noms de fichiers dans le wikitexte n'ont pas le préfixe "Fichier:",
// contrairement aux clés renvoyées par prop=images.
const urlsForFile = (file) =>
  data.urlsByFile.get(file) ??
  data.urlsByFile.get(`Fichier:${file}`) ??
  data.urlsByFile.get(`Image:${file}`) ??
  [];
const assetsForFiles = (files) => [...new Set(files.flatMap(urlsForFile))].map(assetInfo);
const dedupeAssets = (assets) => [...new Map(assets.filter((a) => a.path).map((a) => [a.path, a])).values()];
const filesForSex = (files, sex) =>
  (files ?? []).filter((f) => {
    const match = f.match(/([fh])?\.(?:png|gif|jpe?g|webp)$/i);
    if (!match || !match[1]) return true; // vignette sans suffixe : conservée
    return sex === 'F' ? /f\./i.test(f) : /h\./i.test(f);
  });

// Deuxième passe : les éléments de panoplie sont aussi des pages à part.
const extraTitles = new Set();
for (const p of data.pages) {
  if (!isCompositePage(p)) continue;
  for (const el of [...parseElements(p.text), ...parsePackElements(p.text)]) {
    const n = normalize(el.label);
    if (n && !known.has(n)) { extraTitles.add(el.label); known.add(n); }
  }
}
if (extraTitles.size) {
  console.log(`pages d'éléments de panoplie : ${extraTitles.size}`);
  const extraEntries = [...extraTitles].map((title) => ({
    title, section: '', sexes: new Set(['M', 'F']), source: 'Élément de panoplie',
  }));
  const more = await fetchPages(extraEntries);
  data.pages.push(...more.pages);
  for (const [k, v] of more.byItem) data.byItem.set(k, v);
  for (const [k, v] of more.byLower) data.byLower.set(k, v);
  for (const [k, v] of more.urlsByFile) data.urlsByFile.set(k, v);
  entries.push(...extraEntries);
}

// Regroupement par nom canonique (`nom` du template), PAS par titre de page.
const objects = new Map();
let skipped = 0;
for (const entry of entries) {
  const page = data.byItem.get(data.resolve(entry.title)) ?? data.byItem.get(entry.title) ?? data.byLower.get(String(entry.title).toLowerCase());
  const text = page?.text ?? '';
  if (/^\s*#REDIRECTION/i.test(text) || !/\bnom\s*=|\{\{\s*Vetement/i.test(text)) { skipped++; continue; }
  const nameFr = displayName(field(text, 'nom') || entry.title);
  const key = normalize(nameFr);
  if (!key) { skipped++; continue; }
  const obj = objects.get(key) ?? {
    key, nameFr, nameEn: field(text, 'anNom') || null,
    sexes: new Set(), categories: {}, section: entry.section || '' || '',
    assets: { M: [], F: [], ANY: [] }, sources: new Set(), pages: [],
  };
  for (const s of (entry.sexes?.size ? [...entry.sexes] : ['M', 'F'])) obj.sexes.add(s);
  obj.sources.add(entry.source);
  obj.pages.push(page);
  if (!obj.nameEn && field(text, 'anNom')) obj.nameEn = field(text, 'anNom');
  const sexList = extractSex(text) ?? [...entry.sexes ?? ['M', 'F']];
  const cats = categoriesFromEmplacement(fieldRaw(text, 'emplacement'));
  for (const s of sexList) if (cats[s]) obj.categories[s] = cats[s];
  if (cats.any) for (const s of sexList) obj.categories[s] ??= cats.any;
  const fromSource = categoryFromSource(entry.source);
  if (fromSource) for (const s of sexList) obj.categories[s] ??= fromSource;
  // Un pack / une panoplie sans élément listé n'a pas d'emplacement : son type
  // wiki suffit à le classer (les noms « pack … » sont des panoplies).
  if (/panoplie|pack/i.test(field(text, 'vetementType') || nameFr)) {
    for (const s of sexList) obj.categories[s] ??= 'Panoplies';
  }
  const urls = [...new Set((page.files ?? []).flatMap((f) => data.urlsByFile.get(f) ?? []))];
  const assets = urls.map(assetInfo);
  // Un sprite fonds/ ou cadres/ est un décor, jamais un élément de panoplie.
  const decor = assets.find((a) => a.kind === 'decor');
  if (decor) {
    const category = /(?:^|\/)fonds\//.test(decor.path) ? 'Fonds' : 'Cadres';
    for (const s of sexList) {
      if (!obj.categories[s] || obj.categories[s] === 'Panoplies') obj.categories[s] = category;
    }
  }
  for (const a of assets) obj.assets[a.sex ?? 'ANY'].push(a);
  objects.set(key, obj);
}
console.log(`${objects.size} objets canoniques (${skipped} pages ignorées)`);

const items = [];
const decomposed = [];
for (const obj of objects.values()) {
  const sexList = obj.sexes.size ? [...obj.sexes] : ['M', 'F'];
  const isComposite = obj.pages.some(isCompositePage);
  if (!isComposite) {
    for (const sex of sexList) {
      const assets = obj.assets[sex].length ? obj.assets[sex] : obj.assets.ANY;
      items.push(makeItem(obj.nameFr, obj.nameEn, sex, assets, obj.categories, obj.section, 'simple'));
    }
    continue;
  }
  const panoPage = obj.pages.find(isCompositePage);
  const rows = parseImageRows(panoPage.text);
  const elements = [...parseElements(panoPage.text), ...parsePackElements(panoPage.text)];
  decomposed.push({ name: obj.nameFr, elements: elements.map((e) => e.label) });
  const findRow = (label) => rows.find((r) => normalize(r.label) === normalize(label));
  const wholeRow = rows.find((r) => /entier/i.test(r.label));
  for (const el of elements) {
    const elKey = normalize(el.label);
    const elObj = objects.get(elKey);
    const label = elObj?.nameFr ?? displayName(el.label);
    // Un décor / fond n'est pas un élément portable d'une panoplie : ce n'est
    // ni un vêtement, ni une arme. Il reste un objet Fonds/Cadres autonome.
    const elCategory = elObj?.categories?.M ?? elObj?.categories?.F ?? elObj?.categories?.any;
    if (['Fonds', 'Cadres'].includes(elCategory) || /^(?:d[ée]cor|fond)\b/i.test(label)) continue;
    const row = findRow(el.label);
    const fromRow = { M: assetsForFiles(filesForSex(row?.files, 'M')), F: assetsForFiles(filesForSex(row?.files, 'F')) };
    // La présence des deux pages Fichier:*f.png et *h.png suffit à dire « mixte ».
    const sexes = fromRow.M.length && fromRow.F.length ? ['M', 'F']
      : fromRow.F.length ? ['F']
        : fromRow.M.length ? ['M']
          : elObj && elObj.sexes.size ? [...elObj.sexes] : sexList;
    for (const sex of sexes) {
      const inherited = elObj ? (elObj.assets[sex].length ? elObj.assets[sex] : elObj.assets.ANY) : [];
      const assets = dedupeAssets([...fromRow[sex], ...inherited]);
      const element = makeItem(label, elObj?.nameEn ?? null, sex, assets,
        { ...elObj?.categories, ...el.categories }, elObj?.section ?? '', 'element');
      // Pas de fiche pour l'article parent : on n'a pas son zIndex. On tague
      // ses éléments pour retrouver l'ensemble en une seule recherche.
      element.group = obj.nameFr;
      items.push(element);
    }
  }
}

// Une seule fiche par nom canonique et par sexe.
const sexes = { M: [], F: [] };
const seen = new Set();
const collisions = [];
// On garde la fiche la mieux documentée quand deux pages produisent le même
// objet (panoplie complète + élément de panoplie, par exemple harpe).
const seenNames = new Set();
const reportUnclassified = [];
const ordered = [...items].sort(
  (a, b) => (b.cdn?.length ?? 0) - (a.cdn?.length ?? 0) || (b.group ? 1 : 0) - (a.group ? 1 : 0),
);
for (const it of ordered) {
  const sex = it._sex;
  delete it._sex;
  if (!sexes[sex]) { collisions.push({ id: it.id, nameFr: it.nameFr, sex }); continue; }
  // Sans catégorie wiki, l'objet n'est pas classable dans la garde-robe :
  // on ne l'invente pas, on le signale dans le rapport.
  if (!it.slotGardeRobe) {
    reportUnclassified.push({ id: it.id, nameFr: it.nameFr, sex });
    continue;
  }
  const nameKey = `${sex}|${normalize(it.nameFr)}`;
  if (seenNames.has(nameKey)) {
    collisions.push({ id: it.id, nameFr: it.nameFr, sex, reason: 'nom dupliqué' });
    continue;
  }
  const originalId = it.id;
  let suffix = 2;
  while (seen.has(`${sex}|${it.id}`)) it.id = `${originalId}-${suffix++}`;
  if (it.id !== originalId) collisions.push({ id: it.id, from: originalId, nameFr: it.nameFr, sex });
  seen.add(`${sex}|${it.id}`);
  seenNames.add(nameKey);
  sexes[sex].push(it);
}

const now = new Date().toISOString();
const catalog = { source: 'wiki.renaissancekingdoms.com', sexes, generatedAt: now };
const report = {
  generatedAt: now,
  counts: {
    pages: entries.length, ignoredPages: skipped, objects: objects.size,
    itemsM: sexes.M.length, itemsF: sexes.F.length,
    withCdn: [...sexes.M, ...sexes.F].filter((i) => i.cdn?.length).length,
    withNom: [...sexes.M, ...sexes.F].filter((i) => i.nom).length,
    collisions: collisions.length,
    unclassified: reportUnclassified.length,
  },
  compositePanoplies: decomposed,
  collisions,
  unclassified: reportUnclassified,
};
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(catalog));
await writeFile(REPORT, JSON.stringify(report, null, 2));
console.log(`catalogue propre : ${sexes.M.length} M / ${sexes.F.length} F`);
console.log(`avec CDN : ${report.counts.withCdn} | avec nom d'asset : ${report.counts.withNom} | collisions : ${collisions.length}`);
console.log(`panoplies composées décomposées : ${decomposed.length}`);
console.log(`-> ${OUT}\n-> ${REPORT}`);
