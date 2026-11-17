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

if (WRITE) {
  const now = new Date().toISOString();
  catalog.refreshedAt = now;
  await writeFile(CATALOG, JSON.stringify(catalog));
  console.log('catalog.json réécrit');
} else {
  console.log('dry-run : relancer avec --write');
}
