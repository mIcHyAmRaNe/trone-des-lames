// Complète le catalogue FR avec les CDN relevés sur le wiki EN.
//
//   node scripts/catalog-merge-en.mjs
//
// Entrées : data/catalog-wiki-clean.json (wiki FR brut)
//           data/catalog-wiki-en.json    (wiki EN brut)
//           data/name-map-fr-en.json     (mapping FR<->EN depuis FragmentsRAR.php du jeu)
// Sorties : data/catalog-wiki-union.json + data/catalog-wiki-union-report.json
//
// Seuls les CDN sont copiés. Aucun nom, section ou type ne change de langue.
// Aucune donnée de jeu n'est lue ici (l'enrichissement vient ensuite).

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FR_PATH = join(ROOT, 'data/catalog-wiki-clean.json');
const EN_PATH = join(ROOT, 'data/catalog-wiki-en.json');
const MAP_PATH = join(ROOT, 'data/name-map-fr-en.json');
const OUT = join(ROOT, 'data/catalog-wiki-union.json');
const REPORT = join(ROOT, 'data/catalog-wiki-union-report.json');
const CDN_ROOT = 'https://lesroyaumes.cdn.oxv.fr/images/personnages_midas/';

const fr = JSON.parse(await readFile(FR_PATH, 'utf8'));
const en = JSON.parse(await readFile(EN_PATH, 'utf8'));
const nameMap = JSON.parse(await readFile(MAP_PATH, 'utf8'));

const norm = (v) =>
  `${v ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^(?:le|la|les|the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, '');

const enItems = (en.items ?? []).filter((i) => i.cdn?.length);
const index = new Map();
const add = (key, item) => {
  if (!key) return;
  const list = index.get(key) ?? [];
  if (!list.includes(item)) list.push(item);
  index.set(key, list);
};
for (const item of enItems) {
  add(norm(item.name), item);
  add(norm(item.page), item);
  add(norm(item.nameFr), item);
}
// Index des noms d'assets par préfixe court, pour le rattrapage par `nom`.
const assetIndex = new Map();
for (const item of enItems) {
  for (const url of item.cdn) {
    const base = url.split('/').pop() ?? '';
    const key = base.slice(0, 4).toLowerCase();
    if (!key) continue;
    const list = assetIndex.get(key) ?? [];
    if (!list.includes(item)) list.push(item);
    assetIndex.set(key, list);
  }
}

const relative = (url) => (url.startsWith(CDN_ROOT) ? url.slice(CDN_ROOT.length) : url);
const basename = (url) => url.split('/').pop() ?? '';

/** Essaie de trouver la page EN correspondante via le mapping officiel du jeu. */
function matchViaGameMap(item) {
  const frName = item.nameFr ?? '';
  const frNorm = norm(frName);
  if (!frNorm) return null;

  // 1. Mapping direct FR -> EN (noms singuliers/pluriels du jeu)
  const enName = nameMap.frToEn[frNorm];
  if (enName) {
    const match = index.get(norm(enName));
    if (match?.length) return { item: match[0], method: 'game-map-fr-en' };
  }

  // 2. Si l'item FR a déjà un nameEn (rempli depuis le wiki), essayer via le mapping inverse
  const existingEn = item.nameEn ?? '';
  const existingEnNorm = norm(existingEn);
  if (existingEnNorm) {
    const frFromMap = nameMap.enToFr[existingEnNorm];
    if (frFromMap) {
      const match = index.get(norm(frFromMap));
      if (match?.length) return { item: match[0], method: 'game-map-en-fr' };
    }
    // Essayer aussi directement avec le nameEn existant
    const directMatch = index.get(existingEnNorm);
    if (directMatch?.length) return { item: directMatch[0], method: 'existing-nameEn' };
  }

  return null;
}

function matchEn(item, sex) {
  // 0. Mapping officiel du jeu (le plus fiable)
  const viaMap = matchViaGameMap(item);
  if (viaMap) return viaMap;

  // 1. nameEn du wiki FR (si déjà renseigné)
  const byName = index.get(norm(item.nameEn)) ?? [];
  if (byName.length) return { item: byName[0], method: 1 };

  // 2. nameFr du wiki FR
  const byFr = index.get(norm(item.nameFr)) ?? [];
  if (byFr.length) return { item: byFr[0], method: 2 };

  // 3. Rattrapage par nom d'asset (préfixe 4 chars)
  const nom = `${item.nom ?? ''}`.trim();
  if (nom.length >= 4) {
    const candidates = assetIndex.get(nom.slice(0, 4).toLowerCase()) ?? [];
    for (const candidate of candidates) {
      const hit = candidate.cdn.some((url) => {
        const base = basename(url).toLowerCase();
        return base.startsWith(`${nom.toLowerCase()}_`) || base.startsWith(`${nom.toLowerCase()}.`);
      });
      if (hit) return { item: candidate, method: 3 };
    }
  }
  return null;
}

function urlsForSex(item, sex) {
  const all = [...new Set(item.cdn.map(relative))];
  const segment = sex === 'M' ? '/hommes/' : '/femmes/';
  const specific = all.filter((u) => u.includes(segment));
  const neutral = all.filter((u) => !u.includes('/hommes/') && !u.includes('/femmes/'));
  const kept = [...new Set([...specific, ...neutral])];
  return kept.length ? kept : all;
}

const counts = { total: 0, withoutBefore: 0, recovered: 0, stillWithout: 0, byMethod: {} };
const examples = [];
const sexes = {};

for (const sex of ['M', 'F']) {
  sexes[sex] = [];
  for (const item of fr.sexes?.[sex] ?? []) {
    counts.total++;
    if (Array.isArray(item.cdn) && item.cdn.length) {
      sexes[sex].push(item);
      continue;
    }
    counts.withoutBefore++;
    const match = matchEn(item, sex);
    if (!match) {
      counts.stillWithout++;
      sexes[sex].push(item);
      continue;
    }
    const urls = urlsForSex(match.item, sex);
    if (!urls.length) {
      counts.stillWithout++;
      sexes[sex].push(item);
      continue;
    }
    const merged = { ...item, cdn: urls };
    sexes[sex].push(merged);
    counts.recovered++;
    counts.byMethod[match.method] = (counts.byMethod[match.method] ?? 0) + 1;
    if (examples.length < 10) {
      examples.push({
        id: item.id,
        nameFr: item.nameFr ?? null,
        enPage: match.item.page,
        method: match.method,
        urls: urls.length,
      });
    }
  }
}

const catalog = { ...fr, sexes, generatedAt: new Date().toISOString() };
const report = { generatedAt: catalog.generatedAt, counts, examples };
await writeFile(OUT, JSON.stringify(catalog));
await writeFile(REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`-> ${OUT}\n-> ${REPORT}`);