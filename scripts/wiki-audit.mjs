// Audit de couverture : wiki officiel -> catalogue de la garde-robe.
//
//   node scripts/wiki-audit.mjs
//
// Lit la page « Vêtement » du wiki (16 tableaux, colonnes MIXTE / FEMME / HOMME),
// suit chaque objet jusqu'aux pages Fichier: de ses sprites, y récupère les URL
// CDN Midas, puis compare les noms d'assets à `public/rk/catalog.json`.
//
// Sortie : `data/wiki-gaps.json` (objets du wiki absents du catalogue) et un
// résumé console. Les réponses HTTP sont mises en cache dans `.cache/wiki-audit`
// pour que les relances ne re-téléchargent que ce qui manque.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'public/rk/catalog.json');
const OUT = join(ROOT, 'data/wiki-gaps.json');
const CACHE = join(ROOT, '.cache/wiki-audit');
const WIKI = 'https://wiki.renaissancekingdoms.com';
const API = `${WIKI}/fr/api.php`;
const UA = 'trone-des-lames-catalog-audit/1.0';
// Pages de section/catégorie qui listent des objets sans être des items.
// Même liste que wiki-fill-cdn.mjs : sans elle, `--import` recrée des fiches fantômes.
const BLACKLIST = new Set([
  'arme', 'lac', 'pecher', 'verger',
  'Arme', 'Lac', 'Pêcher', 'Verger',
  'Weapon', 'Lake', 'Fishing', 'Orchard',
  // Pages qui listent les variantes d'un objet, pas un objet unique
  'Foulard du teinturier', 'Tenue du teinturier',
  'Foulards du teinturier', 'Tenues du teinturier',
  'Les foulards du teinturier', 'Les tenues du teinturier',
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
// Les pages Fichier: du wiki utilisent plusieurs hôtes (www.renaissancekingdoms.com,
// beta.lesroyaumes.com, CDN oxv) et parfois un double slash. Ne pas les filtrer par
// hôte, sinon l'asset passe pour absent et la fiche est importée sans CDN.
const CDN_RE =
  /https?:\/\/[^\s"'<>)\]]*personnages_midas\/(hommes|femmes)\/*\/vetements\/([^\s"'<>)\]]+\.(?:png|webp|gif|jpg))/gi;

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

/** POST de l'API MediaWiki (les listes de titres dépassent la longueur d'une URL). */
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

/** Lot de titres -> réponses de l'API, en respectant la limite de 50. */
async function inBatches(titles, params, pick) {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const res = await api({ ...params, titles: titles.slice(i, i + 50).join('|') });
    out.push(...(res.query?.pages ?? []).map(pick));
    if (i % 500 === 0) process.stderr.write(`\r${i}/${titles.length}`);
  }
  if (titles.length > 500) process.stderr.write('\r');
  return out;
}

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// --- 1. page Vêtement : objets, sexe, section --------------------------------
async function readWikiPage() {
  const html = await get(`${WIKI}/fr/V%C3%AAtement`);
  const items = new Map(); // titre -> { title, section, sexes:Set }
  let table = 0;
  for (const block of html.split(/(?=<h2>)/)) {
    if (!block.includes('class="wikitable"')) continue;
    table++;
    for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      if (cells.length < 2) continue;
      const section = text(cells[0].split(/<br\s*\/?>/i)[0]);
      if (!section) continue;
      // Colonnes : 1 = MIXTE, 2 = FEMME, 3 = HOMME.
      for (let col = 1; col < cells.length; col++) {
        const sexes = col === 1 ? ['M', 'F'] : col === 2 ? ['F'] : ['M'];
        for (const a of cells[col].matchAll(/<a [^>]*href="\/fr\/[^"]+"[^>]*title="([^"]+)"/g)) {
          const title = decodeEntities(a[1]);
          if (title.startsWith('Fichier:') || title.startsWith('Catégorie:') || BLACKLIST.has(title)) continue;
          const entry = items.get(title) ?? { title, section, sexes: new Set() };
          sexes.forEach((s) => entry.sexes.add(s));
          items.set(title, entry);
        }
      }
    }
  }
  return { items: [...items.values()], tables: table };
}

// --- 2. pages Fichier: -> assets CDN ----------------------------------------
/** Nom d'asset Midas d'un fichier CDN : `casqueSarrasin_0_@1X.png` -> casqueSarrasin. */
function assetName(file) {
  const bare = decodeURIComponent(file).replace(/\.\w+$/, '');
  const m = bare.match(/^(.*)_([^_]+)_@\d+X$/i);
  const base = m ? m[1] : bare;
  return { base, decl: m && /^\d+$/.test(m[2]) ? Number(m[2]) : null };
}

/**
 * Nom comparable : les pages du wiki suffixent certaines variantes Midas
 * (`_m0`, `_m1_n0`, `_p1`, `_d1`) alors que le catalogue garde le nom de base.
 */
function stripVariants(base) {
  return base.replace(/(?:_(?:[mnpd]\d+|o))+$/i, '');
}

function canonical(base) {
  return stripVariants(base).toLowerCase();
}

function extractAssets(wikitext) {
  const out = [];
  for (const m of wikitext.matchAll(CDN_RE)) {
    const { base, decl } = assetName(m[2]);
    out.push({ sex: m[1] === 'femmes' ? 'F' : 'M', base, decl });
  }
  return out;
}

/**
 * Pages d'objets : images utilisées + wikitexte (modèle `{{Vetement}}`). Les
 * liens CDN apparaissent sur les pages Fichier:, parfois sur la page elle-même.
 */
async function readItems(items) {
  const pages = [];
  const alias = new Map();
  for (let i = 0; i < items.length; i += 50) {
    const res = await api({
      action: 'query',
      prop: 'images|revisions',
      imlimit: 'max',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      titles: items.slice(i, i + 50).map((it) => it.title).join('|'),
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
    if (i % 500 === 0) process.stderr.write(`\r${i}/${items.length}`);
  }
  const byItem = new Map(pages.map((p) => [p.title, p]));
  // Les tableaux du wiki pointent parfois une redirection (« Aventure - 2 ») :
  // l'API renvoie la page finale, il faut suivre le renommage pour la retrouver.
  const resolve = (title) => {
    let cur = title;
    for (let hop = 0; hop < 5 && alias.has(cur); hop++) cur = alias.get(cur);
    return cur;
  };

  const unique = [...new Set(pages.flatMap((p) => p.files))].filter((t) => /\.(png|gif|jpe?g|webp)$/i.test(t));
  const contents = await inBatches(
    unique,
    { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main' },
    (p) => ({ title: p.title, assets: extractAssets(p.revisions?.[0]?.slots?.main?.content ?? '') }),
  );
  const assetsByFile = new Map(contents.map((c) => [c.title, c.assets]));
  return { byItem, assetsByFile, resolve };
}

/** Entités HTML des pages MediaWiki (`&quot;`, `&#39;`…). */
const ENTITIES = { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, k) => ENTITIES[k] ?? m);
}

/**
 * Coupe une valeur de modèle au premier `|` de premier niveau. Un lien wiki
 * (`[[colliers en pierre fine|collier en pierre fine]] (ambre)`) contient un
 * `|` qui ne sépare pas deux paramètres : sans ce suivi de profondeur, le nom
 * était tronqué à « Le [[colliers en pierre fine ».
 */
function cutAtFieldSeparator(value) {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value.startsWith('[[', i)) {
      depth++;
      i++;
    } else if (value.startsWith(']]', i)) {
      depth = Math.max(0, depth - 1);
      i++;
    } else if (value[i] === '|' && depth === 0) {
      return value.slice(0, i);
    }
  }
  return value;
}

/** Champ d'un modèle `{{Vetement|...}}` (valeur sur la ligne). */
function templateField(wikitext, name) {
  const m = wikitext.match(new RegExp(`\\|\\s*${name}\\s*=\\s*([^\\n}]*)`));
  return m ? decodeEntities(cutAtFieldSeparator(m[1]).trim()) : null;
}

/** Nom comparable : sans accents, article initial, ni ponctuation. */
function normalizeName(value) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^(?:le |la |les |l'|un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');
}

/** Section du wiki (« I.b CASQUES ») -> clé de catégorie du jeu. */
const SECTION_CATEGORY = {
  CHAPEAUX: 'Chapeaux',
  CASQUES: 'Casques',
  COIFFURES: 'Coiffures',
  BARBES: 'Barbes',
  YEUX: 'Yeux',
  TABLIERS: 'Tabliers',
  GILETS: 'Gilets',
  MANTELS: 'Mantels',
  CAPES: 'Capes',
  BRAIES: 'Braies',
  JUPES: 'Jupes',
  CHEMISES: 'Chemises',
  BUSTIERS: 'Bustiers',
  CHAUSSURES: 'Chaussures',
  'SOUS-VÊTEMENTS': 'BasDessous',
  PANOPLIES: 'Panoplies',
  BIJOUX: 'Bijoux',
  COU: 'Cou',
  CEINTURE: 'Ceintures',
  CEINTURES: 'Ceintures',
  GANTS: 'Gants',
  'MAIN GAUCHE': 'MainGauche',
  'MAIN DROITE': 'MainDroite',
  ARMES: 'Armes',
  BOUCLIERS: 'Boucliers',
  FAMILIERS: 'Familiers',
  CADRES: 'Cadres',
  FONDS: 'Fonds',
  ECHELLES: 'Outils_echelle',
  FILET: 'Outils_filet',
  BARQUE: 'Outils_barque',
};

function categoryForSection(section) {
  const label = `${section}`
    .replace(/^[IVXLC]+(?:\.\w+)?\.?\s*/i, '')
    .replace(/[:\s]+$/, '')
    .trim()
    .toUpperCase();
  return SECTION_CATEGORY[label] ?? null;
}

/** Nom affichable : retire le balisage wiki (`[[lien|texte]]`, `[url texte]`). */
function cleanWikiName(value) {
  return `${value ?? ''}`
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1')
    // Filet de sécurité : un lien mal fermé sur le wiki ne doit pas laisser
    // crochets ni pipe dans un nom affiché.
    .replace(/\[\[|\]\]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'pour', 'par',
  'et', 'en', 'au', 'aux', 'a', 'avec', 'sans', 'sur',
]);

/** Mots significatifs d'un nom, camelCase éclaté (`hautDunes` -> haut, dunes). */
function wordsOf(value) {
  return new Set(
    `${value ?? ''}`
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOPWORDS.has(w)),
  );
}

/** Identifiant stable d'une fiche wiki — jamais un idItem du jeu (préfixe). */
function wikiId(title) {
  const slug = `${title}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `wiki:${slug || 'objet'}`;
}

// --- 3. comparaison ---------------------------------------------------------
/** Libellé de catalogue : sans article initial ni minuscule de début. */
function displayName(name) {
  const bare = cleanWikiName(name).replace(/^(?:l'|le |la |les |un |une |des |du |de |d')/i, '');
  return bare ? bare[0].toUpperCase() + bare.slice(1) : name;
}

/** Regroupe les manquants par objet wiki : une fiche, plusieurs sexes. */
function groupForImport(rows) {
  const byTitle = new Map();
  for (const r of rows) {
    const entry = byTitle.get(r.title) ?? {
      title: r.title,
      name: r.name,
      nameEn: r.nameEn ?? null,
      section: r.section,
      genre: r.genre ?? null,
      sexes: new Set(),
      assets: {},
    };
    entry.sexes.add(r.sex);
    if (r.assets) {
      const decls = new Set();
      for (const a of r.assets) {
        if (a.decl != null) decls.add(a.decl);
        const d = a.base.match(/_d(\d+)$/i);
        if (d) decls.add(Number(d[1]));
      }
      const nom = [...new Set(r.assets.map((a) => stripVariants(a.base)))].sort(
        (a, b) => a.length - b.length,
      )[0];
      entry.assets[r.sex] = { nom, decls: [...decls].sort((a, b) => a - b) };
    }
    byTitle.set(r.title, entry);
  }
  return byTitle;
}

/**
 * Ajoute les fiches manquantes au catalogue, sans rien inventer : `id` synthétique
 * préfixé `wiki:`, `zIndexCalques` vide, `nom` nul quand le wiki ne documente pas
 * l'asset. La garde-robe écarte déjà les fiches sans `nom`.
 */
function importWikiItems(catalog, gaps, namedOnly) {
  const byTitle = groupForImport([...gaps, ...namedOnly]);
  let added = 0;
  for (const entry of byTitle.values()) {
    const id = wikiId(entry.title);
    // `VetementGenre` du wiki prime sur la colonne du tableau « Vêtement »,
    // qui range parfois un objet « pour homme » sous FEMME.
    const g = `${entry.genre ?? ''}`.toLowerCase();
    const sexes =
      g.includes('femme') && !g.includes('homme') ? ['F'] :
      g.includes('homme') && !g.includes('femme') ? ['M'] :
      g.includes('mixte') ? ['M', 'F'] : [...entry.sexes];
    for (const sex of sexes) {
      if (catalog.sexes[sex].some((it) => it.id === id)) continue;
      const asset = entry.assets[sex];
      // Une fiche du même objet peut déjà exister sous un autre id (fiche du
      // jeu, page wiki FR/EN importée plus tôt) : ne pas la dupliquer.
      const incoming = [entry.name, entry.nameEn, asset?.nom].map(normalizeName).filter(Boolean);
      const existing = catalog.sexes[sex].find((it) =>
        [it.nameFr, it.nameEn, it.nom].map(normalizeName).filter(Boolean)
          .some((key) => incoming.includes(key)));
      if (existing) {
        existing.nameFr ||= displayName(entry.name);
        existing.nameEn ||= entry.nameEn;
        continue;
      }
      catalog.sexes[sex].push({
        id,
        nom: asset?.nom ?? null,
        // Slot technique inconnu : `categoryOf` retombe sur `slotGardeRobe`.
        slot: '',
        slotGardeRobe: categoryForSection(entry.section),
        miniature: 'o',
        declinaisons: asset?.decls ?? [],
        zIndexCalques: [],
        dependCouleurPeau: false,
        dependPostureMainG: false,
        dependPostureMainD: false,
        slotsMasques: [],
        nameEn: entry.nameEn,
        nameFr: displayName(entry.name),
      });
      added++;
    }
  }
  catalog.wikiImportedAt = new Date().toISOString();
  return { added, objects: byTitle.size };
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));
  const byAsset = new Map(
    ['M', 'F'].map((sex) => [
      sex,
      new Map(catalog.sexes[sex].filter((it) => it.nom).map((it) => [it.nom.toLowerCase(), it])),
    ]),
  );
  const byName = new Map(
    ['M', 'F'].map((sex) => [
      sex,
      new Map(
        catalog.sexes[sex].flatMap((it) =>
          [it.nameFr, it.nameEn].filter(Boolean).map((n) => [normalizeName(n), it]),
        ),
      ),
    ]),
  );
  // Catalogue réduit à ses noms d'assets, pour rapprocher les fiches wiki dont
  // le nom n'a pas encore de traduction (`collierPerlesJade`, `hautDunes`…).
  const byNomWords = new Map(
    ['M', 'F'].map((sex) => [
      sex,
      catalog.sexes[sex].filter((it) => it.nom).map((it) => ({ item: it, words: wordsOf(it.nom) })),
    ]),
  );

  const { items, tables } = await readWikiPage();
  process.stderr.write(`wiki: ${items.length} objets dans ${tables} tableaux\n`);
  const { byItem, assetsByFile, resolve } = await readItems(items);

  const gaps = [];
  const crossSex = [];
  const candidates = [];
  const unknownAssets = new Map();
  let resolved = 0;
  let resolvedByName = 0;
  for (const item of items) {
    const page = byItem.get(resolve(item.title)) ?? { files: [], text: '', missing: true };
    const assets = new Map();
    for (const a of [
      ...extractAssets(page.text),
      ...page.files.flatMap((f) => assetsByFile.get(f) ?? []),
    ]) {
      if (item.sexes.has(a.sex)) assets.set(`${a.sex}|${a.base}|${a.decl}`, a);
    }
    const name = cleanWikiName(templateField(page.text, 'nom')) || item.title;
    const nameEn = cleanWikiName(templateField(page.text, 'anNom')) || null;
    const known = new Set();

    for (const a of assets.values()) {
      const index = byAsset.get(a.sex);
      if (index.has(a.base.toLowerCase()) || index.has(canonical(a.base))) known.add(a.sex);
    }
    resolved += known.size;
    for (const sex of item.sexes) {
      if (known.has(sex)) continue;
      // Le nom tranche avant tout : une URL CDN erronée sur le wiki
      // (`chemisesMarinOriental` pour `chemiseMarinOriental`) ne doit pas
      // créer une fiche fantôme.
      const named =
        byName.get(sex).get(normalizeName(name)) ?? (nameEn && byName.get(sex).get(normalizeName(nameEn)));
      if (named) {
        resolvedByName++;
        continue;
      }
      const list = [...assets.values()].filter((a) => a.sex === sex);
      if (!list.length) {
        candidates.push({
          title: item.title,
          name,
          nameEn,
          section: item.section,
          sex,
          genre: templateField(page.text, 'VetementGenre'),
          emplacement: templateField(page.text, 'emplacement'),
          missingPage: page.missing,
        });
        continue;
      }
      // Même objet déjà catalogué pour l'autre sexe : rien à inventer, il
      // suffit de recopier l'entrée (même idItem, même z-index).
      const other = sex === 'M' ? 'F' : 'M';
      const twin = list
        .map((a) => byAsset.get(other).get(a.base.toLowerCase()) ?? byAsset.get(other).get(canonical(a.base)))
        .find(Boolean);
      if (twin) {
        crossSex.push({ title: item.title, name, section: item.section, sex, from: other, id: twin.id, nom: twin.nom });
        continue;
      }
      gaps.push({
        title: item.title,
        name,
        section: item.section,
        sex,
        assets: list.filter((a, i) => list.findIndex((b) => b.base === a.base && b.decl === a.decl) === i),
      });
      for (const a of list) {
        const key = `${sex}:${canonical(a.base)}`;
        if (!unknownAssets.has(key))
          unknownAssets.set(key, { base: canonical(a.base), raw: a.base, sex, item: item.title });
      }
    }
  }

  // Rapprochement par mots du nom d'asset. Un même nom d'asset revendiqué par
  // plusieurs fiches wiki (« Cadre Atout majeur » I…XXI) reste un vrai manque.
  const claims = new Map();
  for (const c of candidates) {
    const words = wordsOf(c.name);
    if (!words.size) continue;
    let best = null;
    for (const { item, words: w } of byNomWords.get(c.sex)) {
      if (!w.size) continue;
      if (![...w].every((x) => words.has(x))) continue;
      // Le nom d'asset doit couvrir l'essentiel du nom wiki : « collierAmbre »
      // (Collier d'ambre) ne doit pas absorber « collier en pierre fine
      // (ambre) », qui est un autre objet.
      if (w.size / words.size < 0.6) continue;
      if (!best || w.size > best.words.size) best = { item, words: w };
    }
    c.match = best;
    if (best) {
      const key = `${c.sex}|${best.item.nom}`;
      claims.set(key, (claims.get(key) ?? 0) + 1);
    }
  }
  const probable = [];
  const namedOnly = [];
  for (const c of candidates) {
    if (c.match && claims.get(`${c.sex}|${c.match.item.nom}`) === 1) {
      probable.push({
        title: c.title,
        name: c.name,
        section: c.section,
        sex: c.sex,
        id: c.match.item.id,
        nom: c.match.item.nom,
        nameFr: c.match.item.nameFr,
      });
    } else {
      const { match, ...rest } = c;
      namedOnly.push(rest);
    }
  }

  const order = (a, b) => a.section.localeCompare(b.section, 'fr') || a.title.localeCompare(b.title, 'fr');
  gaps.sort(order);
  crossSex.sort(order);
  probable.sort(order);
  namedOnly.sort(order);

  if (crossSex.length && process.argv.includes('--merge-sexes')) {
    for (const twin of crossSex) {
      const list = catalog.sexes[twin.sex];
      if (list.some((it) => it.id === twin.id)) continue;
      list.push({ ...byAsset.get(twin.from).get(twin.nom.toLowerCase()), id: twin.id });
      console.log(`+ ${twin.sex} ${twin.nom} (id ${twin.id})`);
    }
    const now = new Date().toISOString();
    catalog.refreshedAt = now;
    catalog.wikiUpdatedAt = now;
    await writeFile(CATALOG, JSON.stringify(catalog));
    console.log(`catalogue : ${catalog.sexes.M.length} M / ${catalog.sexes.F.length} F`);
  }

  const imported = process.argv.includes('--import') ? importWikiItems(catalog, gaps, namedOnly) : null;
  if (imported) {
    const now = new Date().toISOString();
    catalog.refreshedAt = now;
    catalog.wikiUpdatedAt = now;
    await writeFile(CATALOG, JSON.stringify(catalog));
    console.log(`+${imported.added} fiches wiki importées (${imported.objects} objets)`);
    console.log(`catalogue : ${catalog.sexes.M.length} M / ${catalog.sexes.F.length} F`);
  }

  const incomplete = ['M', 'F']
    .flatMap((sex) => catalog.sexes[sex])
    .filter((it) => !it.nom || !(it.zIndexCalques ?? []).length).length;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: `${WIKI}/fr/V%C3%AAtement`,
        catalog: { generatedAt: catalog.generatedAt, refreshedAt: catalog.refreshedAt },
        counts: {
          wikiItems: items.length,
          tables,
          itemSexPairs: items.reduce((n, i) => n + i.sexes.size, 0),
          resolvedByAsset: resolved,
          resolvedByName,
          crossSex: crossSex.length,
          gaps: gaps.length,
          probable: probable.length,
          namedOnly: namedOnly.length,
        },
        gaps,
        crossSex,
        probable,
        namedOnly,
        unknownAssets: [...unknownAssets.values()],
      },
      null,
      2,
    ),
  );

  const count = (list, sex) => list.filter((x) => x.sex === sex).length;
  console.log(`${items.length} objets wiki (${tables} tableaux), ${items.reduce((n, i) => n + i.sexes.size, 0)} couples objet/sexe`);
  console.log(`  connus par asset CDN        : ${resolved}`);
  console.log(`  connus par nom              : ${resolvedByName}`);
  console.log(`  rapprochés par mots d'asset : ${probable.length}`);
  console.log(`  à copier depuis l'autre sexe: ${crossSex.length}`);
  console.log(`  MANQUANTS (asset CDN)       : ${gaps.length} (M ${count(gaps, 'M')} / F ${count(gaps, 'F')})`);
  console.log(`  MANQUANTS (nom seul)        : ${namedOnly.length} (M ${count(namedOnly, 'M')} / F ${count(namedOnly, 'F')})`);
  console.log(`catalogue : ${incomplete} fiches à compléter (CDN ou z-index)`);
  const sections = new Map();
  for (const g of gaps) sections.set(g.section, (sections.get(g.section) ?? 0) + 1);
  for (const [section, n] of sections) console.log(`  ${String(n).padStart(3)}  ${section}`);
  console.log(`-> ${OUT}`);
}

await main();
