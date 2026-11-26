// Complète le catalogue wiki avec les 15 clés de jeu relevées sur les fiches
// de personnage, sans registre persistant ni donnée historique.
//
//   node scripts/catalog-enrich.mjs
//
// Entrées : data/catalog-wiki-union.json (ou BASE_PATH)
//           data/character-sheet-assets.json (ou ASSETS_PATH)
// Sortie  : public/rk/catalog.json (ou OUT_PATH) + data/catalog-enrich-report.json
//
// La jointure se fait par nom d'asset (`nom`), seule clé commune au wiki et aux
// fiches de jeu. `zIndexCalques` est le nom du champ côté jeu ; le catalogue ne
// porte plus l'ancien alias `zIndex`.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_PATH ?? join(ROOT, 'data/catalog-wiki-union.json');
const ASSETS = process.env.ASSETS_PATH ?? join(ROOT, 'data/character-sheet-assets.json');
const OUT = process.env.OUT_PATH ?? join(ROOT, 'public/rk/catalog.json');
const REPORT = join(ROOT, 'data/catalog-enrich-report.json');
const RAW_PATH = join(ROOT, 'data/wiki-catalog-raw.json');
const CLEAN_PATH = join(ROOT, 'data/catalog-wiki-clean.json');
const EN_PATH = join(ROOT, 'data/catalog-wiki-en.json');

/** Même normalisation que les slugs `wiki:<slug>` du catalogue. */
const slugify = (value) =>
  `${value ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/,?\s*appel\w*\s+aussi.*$/, '')
    .replace(/^(?:l'|le |la |les |un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');

/** Titre exact de la page wiki par slug (`wiki:<slug>`). */
async function loadWikiTitles() {
  const titles = new Map();
  try {
    const raw = JSON.parse(await readFile(RAW_PATH, 'utf8'));
    for (const item of raw.items ?? []) {
      if (item.wikiKey && item.title) titles.set(item.wikiKey, item.title);
    }
  } catch {
    /* fichier optionnel */
  }
  try {
    const clean = JSON.parse(await readFile(CLEAN_PATH, 'utf8'));
    for (const item of [...(clean.sexes?.M ?? []), ...(clean.sexes?.F ?? [])]) {
      if (item.id?.startsWith('wiki:') && item.nameFr) titles.set(item.id.slice(5), item.nameFr);
    }
  } catch {
    /* fichier optionnel */
  }
  // Fiches importées uniquement depuis le wiki EN : leur `nameFr` donne le
  // titre de la page FR (ex. « Festive mask » -> « Panoplie Fête »).
  try {
    const en = JSON.parse(await readFile(EN_PATH, 'utf8'));
    for (const item of en.items ?? []) {
      if (!item.nameFr) continue;
      for (const key of [item.page, item.name]) {
        const slug = slugify(key);
        if (slug && !titles.has(slug)) titles.set(slug, item.nameFr);
      }
    }
  } catch {
    /* fichier optionnel */
  }
  return titles;
}

const catalog = JSON.parse(await readFile(BASE, 'utf8'));
const sheet = JSON.parse(await readFile(ASSETS, 'utf8'));
const byNom = new Map(Object.entries(sheet.assets ?? {}));

/** « chapeau_m0 » et « chapeau » désignent le même asset de base. */
const stripSuffix = (nom) => `${nom}`.replace(/_+$/, '').replace(/_(?:m\d+|n\d+|p\d+)+$/i, '');
const candidatesFor = (nom) => [...new Set([nom, stripSuffix(nom), stripSuffix(nom).replace(/\d+$/, '')])].filter(Boolean);

/** Fiche du sexe demandé, sinon l'autre sexe (même objet, même idItem). */
function recordFor(entry, sex) {
  return entry[sex] ?? entry.F ?? entry.M ?? null;
}

/** Une jointure dérivée ne doit pas changer de catégorie d'armoire. */
function compatible(rec, item) {
  return !item.slotGardeRobe || !rec.slotGardeRobe || rec.slotGardeRobe === item.slotGardeRobe;
}

function match(item, sex) {
  let seen = false;
  for (const [rank, nom] of candidatesFor(item.nom).entries()) {
    const entry = byNom.get(nom);
    if (!entry) continue;
    seen = true;
    const rec = recordFor(entry, sex);
    if (!rec) continue;
    if (rank === 0) return { rec, how: 'exact' };
    if (compatible(rec, item)) return { rec, how: 'derived' };
  }
  return { rec: null, how: seen ? 'rejected' : 'none' };
}

const report = {
  source: ASSETS,
  base: BASE,
  counts: {
    items: 0,
    withoutAsset: 0,
    exact: 0,
    derived: 0,
    unmatched: 0,
    rejected: 0,
    enriched: 0,
    withoutZIndex: 0,
    nomKept: 0,
  },
  derivedIds: [],
  rejected: [],
  unmatched: [],
};

for (const sex of ['M', 'F']) {
  for (const item of catalog.sexes[sex]) {
    report.counts.items++;
    if (!item.nom) {
      report.counts.withoutAsset++;
      item.zIndexCalques = Array.isArray(item.zIndexCalques) ? item.zIndexCalques : [];
      delete item.zIndex;
      continue;
    }
    const { rec, how } = match(item, sex);
    if (!rec) {
      report.counts[how === 'rejected' ? 'rejected' : 'unmatched']++;
      report[how === 'rejected' ? 'rejected' : 'unmatched'].push(`${sex}:${item.id} (${item.nom})`);
      item.zIndexCalques = Array.isArray(item.zIndexCalques) ? item.zIndexCalques : [];
      delete item.zIndex;
      continue;
    }

    report.counts[how]++;
    report.counts.enriched++;
    if (how === 'derived') {
      // Le nom du catalogue peut être une variante (`_m0`, teinte…) absente de
      // la fiche : on garde le nom qui sert déjà à construire les URLs CDN.
      report.counts.nomKept++;
      report.derivedIds.push(`${sex}:${item.id} (${item.nom} -> ${rec.nom})`);
    } else {
      item.nom = rec.nom;
    }

    item.idItem = rec.idItem;
    item.declinaison = rec.declinaison;
    item.parametre = rec.parametre;
    item.slot = rec.slot;
    item.slotGardeRobe = rec.slotGardeRobe;
    item.miniature = rec.miniature;
    item.declinaisons = [...rec.declinaisons];
    item.slotsMasques = [...rec.slotsMasques];
    item.dependCouleurPeau = rec.dependCouleurPeau;
    item.dependPostureMainG = rec.dependPostureMainG;
    item.dependPostureMainD = rec.dependPostureMainD;
    item.postureMainG = rec.postureMainG;
    item.postureMainD = rec.postureMainD;
    item.zIndexCalques = [...rec.zIndexCalques];
    delete item.zIndex;

    if (!item.zIndexCalques.length) report.counts.withoutZIndex++;
  }
}

// Titre exact de la page wiki : le libellé affiché (nom du template) peut
// différer par la casse ou un qualificatif, ce qui casse le lien direct.
const wikiTitles = await loadWikiTitles();
for (const sex of ['M', 'F']) {
  for (const item of catalog.sexes[sex]) {
    if (!item.id?.startsWith('wiki:')) continue;
    const title =
      wikiTitles.get(item.id.slice(5)) ??
      `${item.nameFr ?? ''}`.replace(/\s*,\s*(?:appel[ée]e?s?\s+aussi|anciennement).*$/i, '').trim();
    if (title && title !== item.nameFr) {
      item.wikiTitle = title;
      report.counts.wikiTitle = (report.counts.wikiTitle ?? 0) + 1;
    }
  }
}

// Aucun item ne doit conserver l'ancien alias, même non enrichi.
for (const sex of ['M', 'F']) {
  for (const item of catalog.sexes[sex]) {
    assert.ok(Array.isArray(item.zIndexCalques), `${sex}:${item.id} zIndexCalques`);
    assert.ok(!('zIndex' in item), `${sex}:${item.id} conserve zIndex`);
  }
}
assert.equal(
  catalog.sexes.M.length + catalog.sexes.F.length,
  report.counts.items,
  'le nombre de fiches change pendant l’enrichissement',
);

await writeFile(OUT, JSON.stringify(catalog));
await writeFile(REPORT, JSON.stringify(report, null, 2));

const c = report.counts;
console.log(`${c.enriched}/${c.items} fiches enrichies (${c.exact} exact, ${c.derived} dérivé, ${c.nomKept} nom conservé)`);
console.log(`sans correspondance : ${c.unmatched} | rejetées : ${c.rejected} | sans asset : ${c.withoutAsset}`);
console.log(`sans zIndexCalques : ${c.withoutZIndex}`);
console.log(`titres wiki corrigés : ${c.wikiTitle ?? 0}`);
console.log(`-> ${OUT}\n-> ${REPORT}`);
