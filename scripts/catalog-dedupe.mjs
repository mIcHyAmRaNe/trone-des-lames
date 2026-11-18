// Supprime les fiches incomplètes qui doublonnent une fiche complète du même sexe.
//   node scripts/catalog-dedupe.mjs          # dry-run
//   node scripts/catalog-dedupe.mjs --write  # applique
//
// Une fiche « complète » a un nom d'asset CDN et un z-index. Les doublons
// viennent de l'import wiki (`wiki:<slug>`) : même objet, aucun asset. Leurs
// traductions manquantes sont recopiées sur la fiche complète avant suppression,
// sinon le prochain `wiki-audit` les recrée (il rapproche par nom, FR ou EN).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'public/rk/catalog.json');
const WRITE = process.argv.includes('--write');

/** « Barbe originelle n°0, appelée aussi barbe masquée » -> barbeoriginellen0. */
function normalizeName(value) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/,?\s*appel\w*\s+aussi.*$/, '')
    .replace(/^(?:l'|le |la |les |un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');
}

const isComplete = (it) => !!it.nom && it.zIndex.length > 0;

const catalog = JSON.parse(await readFile(CATALOG, 'utf8'));

for (const sex of ['M', 'F']) {
  const list = catalog.sexes[sex];
  const complete = new Map();
  for (const it of list) {
    if (!isComplete(it)) continue;
    for (const key of [it.nameFr, it.nameEn]) {
      const norm = normalizeName(key);
      if (norm) complete.set(norm, it);
    }
    // Also index by nom for wiki:* duplicate detection
    if (it.nom) complete.set(normalizeName(it.nom), it);
  }

  const removed = [];
  catalog.sexes[sex] = list.filter((it) => {
    if (isComplete(it)) return true;
    // Try matching by nameFr, nameEn, then nom (asset name)
    const twin = complete.get(normalizeName(it.nameFr))
      ?? complete.get(normalizeName(it.nameEn))
      ?? (it.nom ? complete.get(normalizeName(it.nom)) : undefined);
    if (!twin) return true;
    twin.nameFr ||= it.nameFr;
    twin.nameEn ||= it.nameEn;
    if (!twin.cdn?.length && it.cdn?.length) twin.cdn = it.cdn;
    removed.push(`${it.id} (${it.nameFr ?? it.nameEn ?? '?'}) -> ${twin.id}`);
    return false;
  });
  console.log(`${sex}: ${removed.length} doublon(s) incomplet(s) supprimé(s)`);
  for (const r of removed) console.log(`  ${r}`);
}

// --- 2e passe : vrais doublons (même libellé et même asset), souvent une page
// wiki FR et sa page EN importées sous deux ids (`wiki:masse-epineuse` /
// `wiki:thornymace`). On garde la fiche la plus ancienne du catalogue.
for (const sex of ['M', 'F']) {
  const kept = [];
  const removed = [];
  // Deux fiches sont le même objet si elles partagent le même asset et qu'au
  // moins un libellé coïncide, sans qu'aucun libellé présent ne contredise
  // l'autre. Ainsi « Cadre Atout majeur I » et « II » (même nom FR, numéros
  // différents dans nameEn) restent deux objets distincts.
  const sameObject = (a, b) => {
    const asset = normalizeName(a.nom);
    if (!asset || asset !== normalizeName(b.nom)) return false;
    const fr = [normalizeName(a.nameFr), normalizeName(b.nameFr)];
    const en = [normalizeName(a.nameEn), normalizeName(b.nameEn)];
    const match = (pair) => pair[0] && pair[1] && pair[0] === pair[1];
    const conflict = (pair) => pair[0] && pair[1] && pair[0] !== pair[1];
    if (match(fr) || match(en)) return !conflict(fr) && !conflict(en);
    // Les pages FR et EN d'un même objet peuvent avoir des libellés divergents
    // (la page EN fournissant un nom anglais). Même asset + mêmes CDN = même objet.
    if (!a.id.startsWith('wiki:') || !b.id.startsWith('wiki:')) return false;
    const sameCdn =
      a.cdn?.length &&
      b.cdn?.length &&
      JSON.stringify([...a.cdn].sort()) === JSON.stringify([...b.cdn].sort());
    return !!sameCdn;
  };
  for (const it of catalog.sexes[sex]) {
    const twin = kept.find((o) => o.id === it.id || sameObject(o, it));
    if (twin) {
      if (twin.id === it.id && (it.cdn?.length ?? 0) > (twin.cdn?.length ?? 0)) {
        // Deux fiches portent le même id : garder celle qui a le CDN, pas la
        // première venue (le renard polaire F est dans ce cas).
        kept[kept.indexOf(twin)] = {
          ...it,
          nameFr: twin.nameFr || it.nameFr,
          nameEn: twin.nameEn || it.nameEn,
        };
        removed.push(`${it.id} : version sans CDN remplacée par la version avec CDN`);
      } else {
        twin.nameFr ||= it.nameFr;
        twin.nameEn ||= it.nameEn;
        if (!twin.cdn?.length && it.cdn?.length) twin.cdn = it.cdn;
        removed.push(`${it.id} (${it.nameFr ?? it.nameEn ?? '?'}) -> ${twin.id}`);
      }
      continue;
    }
    kept.push(it);
  }
  catalog.sexes[sex] = kept;
  console.log(`${sex}: ${removed.length} doublon(s) strict(s) supprimé(s)`);
  for (const r of removed) console.log(`  ${r}`);
}

if (WRITE) {
  const now = new Date().toISOString();
  catalog.refreshedAt = now;
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log('catalog.json réécrit');
} else {
  console.log('dry-run : relancer avec --write');
}
