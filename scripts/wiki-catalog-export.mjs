// Met l'extraction FR brute du wiki au même format que l'extraction EN.
//
//   node scripts/wiki-catalog-export.mjs
//
// Lit data/catalog-wiki-clean.json (wiki FR seulement, avant enrichissement
// par les données de jeu) et écrit public/rk/wiki-fr.json.
// Aucune lecture de public/rk/catalog.json ni des données de jeu.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data/catalog-wiki-clean.json');
const OUT = join(ROOT, 'public/rk/wiki-fr.json');
const WIKI = 'https://wiki.renaissancekingdoms.com/fr';
const CDN_ROOT = 'https://lesroyaumes.cdn.oxv.fr/images/personnages_midas/';

const raw = JSON.parse(await readFile(SRC, 'utf8'));
const byId = new Map();

for (const sex of ['M', 'F']) {
  for (const item of raw.sexes?.[sex] ?? []) {
    const entry = byId.get(item.id) ?? {
      id: item.id,
      nameFr: item.nameFr ?? '',
      nameEn: item.nameEn ?? '',
      nom: item.nom ?? '',
      slotGardeRobe: item.slotGardeRobe ?? '',
      slot: item.slot ?? '',
      group: item.group ?? null,
      sexes: new Set(),
      cdn: new Set(),
    };
    entry.sexes.add(sex);
    for (const url of item.cdn ?? []) entry.cdn.add(url);
    byId.set(item.id, entry);
  }
}

const items = [...byId.values()].map((e) => {
  const sexes = ['M', 'F'].filter((s) => e.sexes.has(s));
  const name = e.nameFr || e.nameEn || e.nom || e.id;
  return {
    page: e.nameFr || e.nameEn || e.nom || e.id,
    pageUrl: `${WIKI}/index.php?search=${encodeURIComponent(name.replace(/ /g, '_'))}`,
    name,
    nameFr: e.nameFr || null,
    section: e.slotGardeRobe || '',
    slot: e.slotGardeRobe || '',
    category: e.slotGardeRobe || '',
    type: e.slot || '',
    sexe: sexes.length === 2 ? 'Mixte' : sexes[0],
    sexes,
    group: e.group || null,
    images: e.cdn.size,
    cdn: [...e.cdn].map((u) => (/^https?:/i.test(u) ? u : `${CDN_ROOT}${u.replace(/^\//, '')}`)),
  };
});

items.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

const catalog = {
  lang: 'fr',
  source: `${WIKI}`,
  generatedAt: new Date().toISOString(),
  items,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(catalog));

const withCdn = items.filter((i) => i.cdn.length).length;
console.log(
  JSON.stringify(
    {
      items: items.length,
      withCdn,
      withoutCdn: items.length - withCdn,
      cdnUrls: new Set(items.flatMap((i) => i.cdn)).size,
    },
    null,
    2,
  ),
);
console.log(`-> ${OUT}`);
