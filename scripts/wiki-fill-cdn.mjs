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
const API = `${WIKI}/fr/api.php`;
const CDN_ROOT = 'https://lesroyaumes.cdn.oxv.fr/images/personnages_midas/';
const UA = 'trone-des-lames-cdn-fill/1.0';
const WRITE = process.argv.includes('--write');

const CATEGORIES = [
  { wiki: 'Accessoire', category: 'Accessoires' },
  { wiki: 'Apparence', category: null },
  { wiki: 'Arme', category: 'Armes' },
  { wiki: 'Cadre', category: 'Cadres' },
  { wiki: 'Decor', category: 'Fonds' },
  { wiki: 'Familier', category: 'Familiers' },
  { wiki: 'Panoplie', category: 'Panoplies' },
  { wiki: 'Tatouage', category: 'Tatouages' },
  { wiki: 'Vêtement événementiel', category: 'Evenementiels' },
  // Catégories parentes : elles portent les fiches d'objets dont les fichiers
  // ne sont pas listés ailleurs (les panoplies en pack, par exemple).
  { wiki: 'Vêtement', category: null },
  { wiki: 'Objet spécial', category: null },
];

// Les pages Fichier: du wiki ne sont pas toutes sur l'hôte CDN : beaucoup
// pointent vers `https://www.renaissancekingdoms.com/images/personnages_midas/…`,
// qui redirige ensuite vers le CDN. On accepte les deux formes.
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

async function categoryMembers(title) {
  const out = [];
  let cont = {};
  for (;;) {
    const res = await api({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Catégorie:${title}`,
      cmnamespace: '0',
      cmlimit: '500',
      ...cont,
    });
    out.push(...(res.query?.categorymembers ?? []).map((m) => m.title));
    if (!res.continue) break;
    cont = res.continue;
  }
  return out;
}

async function inBatches(titles, params, pick) {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const res = await api({ ...params, titles: titles.slice(i, i + 50).join('|') });
    out.push(...(res.query?.pages ?? []).map(pick));
    if (i % 500 === 0) process.stderr.write(`\r${i}/${titles.length}`);
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
  const bare = file.replace(/\.\w+$/, '').replace(/_@\d+X$/i, '').replace(/_\d+$/, '');
  const decl = bare.match(/_d(\d+)(?:_|$)/i);
  const withoutDecl = decl ? bare.replace(/_d\d+(?:_|$)/i, '') : bare;

  const beard = withoutDecl.match(/^barbe_(\d+)/i);
  if (beard) return { path, sex, nom: `barbe${beard[1]}`, kind: 'corps', decl: null, flags: {} };

  const hair = withoutDecl.match(/^cheveux(?:Avants|Arrieres|Intermediaires)_(\d+)/i);
  if (hair) return { path, sex, nom: `coiffure${hair[1]}`, kind: 'corps', decl: null, flags: {} };

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
  return { path, sex, nom, kind, decl: decl ? Number(decl[1]) : null, flags };
}

/** Catégorie de garde-robe déduite de l'asset (cheveux, barbe…). */
function categoryOfAsset(info) {
  if (info.kind === 'corps') return info.nom.startsWith('barbe') ? 'Barbes' : 'Coiffures';
  return null;
}

// --- 1. crawl des catégories -------------------------------------------------
const wikiItems = new Map();
for (const cat of CATEGORIES) {
  const titles = await categoryMembers(cat.wiki);
  process.stderr.write(`${cat.wiki}: ${titles.length} pages\n`);
  for (const title of titles) {
    const entry = wikiItems.get(title) ?? { title, categories: [], names: new Set() };
    entry.categories.push(cat);
    wikiItems.set(title, entry);
  }
}

const titles = [...wikiItems.keys()];
const pickPage = (p) => ({
  title: p.title,
  text: p.revisions?.[0]?.slots?.main?.content ?? '',
  files: (p.images ?? []).map((im) => im.title).filter((t) => /\.(png|gif|jpe?g|webp)$/i.test(t)),
});
// `redirects` est volontairement absent : les pages de redirection
// (« Fête - 1 » -> « Panoplie Fête ») doivent garder leur titre d'origine,
// sinon leur nom ne correspond plus à aucune fiche du catalogue.
const pages = await inBatches(
  titles,
  { action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content', rvslots: 'main' },
  pickPage,
);

const redirectTarget = (text) =>
  (text.match(/^\s*#(?:REDIRECTION|REDIRECT)\s*:?\s*\[\[\s*([^\]|#]+)/i) ?? [])[1]?.trim() ?? null;

const targets = [...new Set(pages.map((p) => redirectTarget(p.text)).filter(Boolean))].filter(
  (t) => !pages.some((p) => p.title === t),
);
const targetPages = targets.length
  ? await inBatches(targets, { action: 'query', prop: 'images|revisions', imlimit: 'max', rvprop: 'content', rvslots: 'main' }, pickPage)
  : [];
const pageByTitle = new Map([...pages, ...targetPages].map((p) => [p.title, p]));

const fileTitles = [...new Set([...pages, ...targetPages].flatMap((p) => p.files))];
process.stderr.write(`\n${fileTitles.length} fichiers\n`);
const fileAssets = new Map(
  (
    await inBatches(fileTitles, { action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main' }, (p) => ({
      title: p.title,
      infos: [...(p.revisions?.[0]?.slots?.main?.content ?? '').matchAll(CDN_RE)].map((m) => assetInfo(m[0])),
    }))
  ).map((f) => [f.title, f.infos]),
);

const assetsByItem = new Map();
for (const page of pages) {
  const source = pageByTitle.get(redirectTarget(page.text) ?? page.title) ?? page;
  const infos = [];
  for (const file of source.files) infos.push(...(fileAssets.get(file) ?? []));
  assetsByItem.set(page.title, infos);
  const item = wikiItems.get(page.title);
  if (!item) continue;
  item.text = source.text;
  for (const value of [
    templateField(source.text, 'nom'),
    templateField(source.text, 'anNom'),
    page.title,
    source.title,
  ]) {
    if (value) item.names.add(value);
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

/** z-index par catégorie : uniquement si la catégorie n'a qu'une valeur. */
const zSets = new Map();
for (const sex of ['M', 'F']) {
  for (const it of catalog.sexes[sex]) {
    if (!it.nom || !it.zIndex.length) continue;
    const key = it.slot || it.slotGardeRobe || '';
    const set = zSets.get(key) ?? new Set();
    set.add(it.zIndex.join(','));
    zSets.set(key, set);
  }
}
const unambiguousZ = new Map(
  [...zSets.entries()].filter(([, set]) => set.size === 1).map(([key, set]) => [key, [...set][0].split(',').map(Number)]),
);

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
    if (!it.zIndex.length) {
      const z = unambiguousZ.get(it.slot || it.slotGardeRobe || '') ?? unambiguousZ.get(categoryOfAsset(asset) ?? '');
      if (z) it.zIndex = z;
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

for (const item of wikiItems.values()) {
  const infos = assetsByItem.get(item.title) ?? [];
  if (!infos.length) continue;
  const name = templateField(item.text ?? '', 'nom') || item.title;
  const nameEn = templateField(item.text ?? '', 'anNom') || null;
  const sexes = [...new Set(infos.map((i) => i.sex).filter(Boolean))];
  if (!sexes.length) sexes.push('M', 'F');
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

    const z = unambiguousZ.get(category) ?? [];
    const entry = {
      id: `wiki:${slug}`,
      nom: asset.nom,
      cdn: usable,
      slot: '',
      slotGardeRobe: category,
      miniature: 'o',
      declinaisons: decls,
      zIndex: z,
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
    added.push(`${sex} ${name} -> ${asset.nom}${z.length ? '' : ' (sans z-index)'}`);
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
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log('catalog.json réécrit');
} else {
  console.log('dry-run : relancer avec --write');
}
