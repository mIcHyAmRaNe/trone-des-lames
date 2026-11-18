// Associe les fiches extraites du wiki au catalogue actuel pour récupérer les
// champs que le wiki ne contient pas (id, zIndex, slotsMasques, slot technique),
// puis écrit un catalogue de staging et un rapport de diff.
//
//   RAW_PATH=... OUT_DIR=... node scripts/catalog-wiki-join.mjs
//
// Par défaut : data/wiki-catalog-raw.json + public/rk/catalog.json ->
// data/catalog-wiki-staged.json et data/catalog-wiki-report.json.
// Ne jamais écrire dans public/rk/catalog.json : la validation humaine du
// rapport précède le remplacement.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_PATH = process.env.RAW_PATH ?? join(ROOT, 'data/wiki-catalog-raw.json');
const BASE_PATH = process.env.BASE_PATH ?? join(ROOT, 'public/rk/catalog.json');
const OUT_DIR = process.env.OUT_DIR ?? join(ROOT, 'data');
const STAGED_PATH = join(OUT_DIR, 'catalog-wiki-staged.json');
const REPORT_PATH = join(OUT_DIR, 'catalog-wiki-report.json');

const CATEGORIES = new Set([
  'Chapeaux', 'Casques', 'Coiffures', 'Barbes', 'Tabliers', 'Gilets', 'Mantels', 'Capes',
  'Braies', 'Jupes', 'Chemises', 'Bustiers', 'Chaussures', 'BasDessous', 'Panoplies',
  'Bijoux', 'Cou', 'Ceintures', 'Yeux', 'Gants', 'MainGauche', 'MainDroite', 'Fonds',
  'Cadres', 'Familiers', 'Outils_barque', 'Outils_filet', 'Outils_echelle', 'Armes', 'Boucliers',
]);

function normalize(value) {
  return `${value ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/,?\s*appel\w*\s+aussi.*$/, '')
    .replace(/^(?:l'|le |la |les |un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');
}

const raw = JSON.parse(await readFile(RAW_PATH, 'utf8'));
const base = JSON.parse(await readFile(BASE_PATH, 'utf8'));
if (!Array.isArray(raw.items)) throw new Error('raw.items manquant');
if (!base?.sexes?.M || !base?.sexes?.F) throw new Error('base.sexes invalide');

// Index des donnees par sexe. Un donneur ne peut etre utilises qu'une fois.
const donors = {};
for (const sex of ['M', 'F']) {
  donors[sex] = { byKey: new Map(), used: new Set(), list: base.sexes[sex] };
  for (const it of base.sexes[sex]) {
    const keys = new Set([normalize(it.nom), normalize(it.nameFr), normalize(it.nameEn)].filter(Boolean));
    for (const key of keys) {
      const group = donors[sex].byKey.get(key) ?? [];
      group.push(it);
      donors[sex].byKey.set(key, group);
    }
  }
}

function pickDonor(sex, item) {
  const candidates = new Map();
  const stripDigits = (value) => normalize(value).replace(/\d+$/, '');
  const keys = [
    [normalize(item.nom), 3],
    [normalize(item.nameFr), 2],
    [normalize(item.nameEn), 1],
    [normalize(item.title), 1.5],
    // Le parseur CDN garde parfois un chiffre de frame dans le nom
    // (`gilet0` pour `gilet`) : proposer la forme sans chiffre en dernier.
    [stripDigits(item.nom), 0.5],
    [stripDigits(item.nameFr), 0.4],
  ];
  for (const [key, weight] of keys) {
    if (!key) continue;
    for (const it of donors[sex].byKey.get(key) ?? []) {
      if (donors[sex].used.has(it.id)) continue;
      candidates.set(it, (candidates.get(it) ?? 0) + weight);
    }
  }
  if (!candidates.size) return null;
  // Un objet wiki à variantes ne doit pas voler la fiche de jeu canonique :
  // celle-ci a un id numérique, un zIndex et toutes ses déclinaisons.
  const quality = (it) => [
    candidates.get(it),
    /^\d+$/.test(String(it.id)) ? 2 : 0,
    it.zIndex?.length ? 1 : 0,
    (it.declinaisons?.length ?? 0) > 1 ? 0.5 : 0,
  ];
  const sorted = [...candidates.keys()].sort((a, b) => {
    const qa = quality(a);
    const qb = quality(b);
    for (let i = 0; i < qa.length; i++) if (qa[i] !== qb[i]) return qb[i] - qa[i];
    const na = Number(a.id);
    const nb = Number(b.id);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a.id).localeCompare(String(b.id));
  });
  const chosen = sorted[0];
  donors[sex].used.add(chosen.id);
  return chosen;
}

const staged = { M: [], F: [] };
const report = {
  generatedAt: new Date().toISOString(),
  source: 'wiki.renaissancekingdoms.com (rebuilt)',
  counts: {
    wikiRawItems: raw.items.length,
    stagedM: 0, stagedF: 0, matched: 0, unmatched: 0,
    droppedBaseItems: 0, idCollisions: 0,
  },
  added: [],
  idCollisionsDetails: [],
  droppedBase: [],
  categoryChanges: [],
  zIndexLost: [],
  emptyZIndex: [],
  orphanCategories: [],
};

const idSets = { M: new Set(), F: new Set() };

for (const sex of ['M', 'F']) {
  for (const item of raw.items.filter((it) => it.sex === sex)) {
    const donor = pickDonor(sex, item);
    if (donor) report.counts.matched++;
    else report.counts.unmatched++;

    let id = donor?.id ?? `wiki:${item.wikiKey}`;
    if (!donor) {
      // Un id wiki:* peut deja etre porte par une fiche du catalogue actuel
      // (matchée par une autre fiche) : ne jamais le réutiliser pour un autre
      // objet, sinon un override DB serait appliqué à la mauvaise fiche.
      let suffix = 2;
      while (idSets[sex].has(id) || donors[sex].list.some((it) => it.id === id)) {
        id = `wiki:${item.wikiKey}-${suffix++}`;
      }
    }
    if (idSets[sex].has(id)) {
      report.counts.idCollisions++;
      report.idCollisionsDetails.push({ id, nameFr: item.nameFr, sex, source: item.source });
      continue;
    }
    idSets[sex].add(id);

    const hasWikiFlags = item.cdn?.length > 0;
    const out = {
      id,
      nom: item.nom || donor?.nom || null,
      slot: donor?.slot ?? '',
      slotGardeRobe: item.slotGardeRobe || '',
      miniature: donor?.miniature ?? 'o',
      declinaisons: item.declinaisons?.length ? item.declinaisons : donor?.declinaisons ?? [],
      zIndex: donor?.zIndex ?? [],
      dependCouleurPeau: hasWikiFlags ? !!item.dependCouleurPeau : !!donor?.dependCouleurPeau,
      dependPostureMainG: hasWikiFlags ? !!item.dependPostureMainG : !!donor?.dependPostureMainG,
      dependPostureMainD: hasWikiFlags ? !!item.dependPostureMainD : !!donor?.dependPostureMainD,
      slotsMasques: donor?.slotsMasques ?? [],
      nameEn: item.nameEn || donor?.nameEn || null,
      nameFr: item.nameFr || donor?.nameFr || null,
    };
    if (item.cdn?.length) out.cdn = item.cdn;
    else if (donor?.cdn?.length) out.cdn = donor.cdn;

    if (!CATEGORIES.has(out.slotGardeRobe) && out.slotGardeRobe !== '') {
      report.orphanCategories.push({ id, slotGardeRobe: out.slotGardeRobe, sex });
    }
    if (!out.zIndex.length) report.emptyZIndex.push({ id, nameFr: out.nameFr, sex });
    if (donor?.zIndex?.length && !out.zIndex.length) {
      report.zIndexLost.push({ id, nameFr: out.nameFr, sex });
    }
    if (donor && donor.slotGardeRobe !== out.slotGardeRobe) {
      report.categoryChanges.push({
        id, nameFr: out.nameFr, sex,
        from: donor.slotGardeRobe, to: out.slotGardeRobe,
      });
    }
    if (!donor) report.added.push({ id, nameFr: out.nameFr, sex, source: item.source });
    staged[sex].push(out);
  }
}

for (const sex of ['M', 'F']) {
  for (const it of base.sexes[sex]) {
    if (!donors[sex].used.has(it.id)) {
      report.droppedBase.push({
        id: it.id, nameFr: it.nameFr ?? it.nameEn ?? it.nom, sex,
        zIndexLength: it.zIndex?.length ?? 0,
      });
    }
  }
}
report.counts.stagedM = staged.M.length;
report.counts.stagedF = staged.F.length;
report.counts.droppedBaseItems = report.droppedBase.length;

const now = new Date().toISOString();
const catalog = {
  source: 'wiki.renaissancekingdoms.com (rebuilt)',
  sexes: staged,
  generatedAt: raw.generatedAt ?? now,
  refreshedAt: now,
  wikiUpdatedAt: raw.generatedAt ?? now,
};

await writeFile(STAGED_PATH, JSON.stringify(catalog));
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

console.log(`wiki brut : ${report.counts.wikiRawItems} fiches`);
console.log(`staging   : ${staged.M.length} M / ${staged.F.length} F`);
console.log(`jointure  : ${report.counts.matched} matches, ${report.counts.unmatched} nouveaux, ${report.counts.droppedBaseItems} abandonnés`);
console.log(`catégories corrigées : ${report.categoryChanges.length} | sans zIndex : ${report.emptyZIndex.length} | orphelines : ${report.orphanCategories.length}`);
console.log(`collisions d'id : ${report.counts.idCollisions} | zIndex perdus : ${report.zIndexLost.length}`);
console.log(`-> ${STAGED_PATH}\n-> ${REPORT_PATH}`);
