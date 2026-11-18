// Enrichit le catalogue Propre (wiki) avec les données de jeu des fiches de
// personnage : zIndex, slotsMasques, dépendances peau/postures.
//
//   node scripts/catalog-enrich.mjs
//
// Entrée : data/catalog-wiki-clean.json (ou public/rk/catalog.json avec BASE_PATH)
// Sortie : public/rk/catalog.json + data/catalog-enrich-report.json
// Aucune donnée ryence, aucun id ou nom hérité de l'ancien catalogue.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = process.env.SHEET_PATH ?? '/home/starlab/Projects/rk/blabla.txt';
const BASE = process.env.BASE_PATH ?? join(ROOT, 'data/catalog-wiki-clean.json');
const OUT = process.env.OUT_PATH ?? join(ROOT, 'public/rk/catalog.json');
const REPORT = join(ROOT, 'data/catalog-enrich-report.json');

// --- lecture des blocs JSON de la fiche --------------------------------------
const html = await readFile(SHEET, 'utf8');
const byNom = new Map();
let i = 0;
while (true) {
  const s = html.indexOf('{"login"', i);
  if (s < 0) break;
  let depth = 0; let inStr = false; let esc = false; let end = -1;
  for (let j = s; j < html.length; j++) {
    const ch = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end < 0) { i = s + 1; continue; }
  let blob;
  try { blob = JSON.parse(html.slice(s, end + 1)); } catch { i = end + 1; continue; }
  for (const it of blob.equipement ?? []) {
    if (!byNom.has(it.nom)) byNom.set(it.nom, it);
  }
  i = end + 1;
}
console.log(`fiche : ${byNom.size} noms d'assets uniques`);

const catalog = JSON.parse(await readFile(BASE, 'utf8'));
const report = {
  generatedAt: new Date().toISOString(),
  source: 'character sheet (blabla.txt)',
  counts: { items: 0, enriched: 0, alreadyHadZIndex: 0 },
  enrichedIds: [],
};

for (const sex of ['M', 'F']) {
  for (const it of catalog.sexes[sex]) {
    report.counts.items++;
    const candidates = [it.nom, `${it.nom ?? ''}`.replace(/\d+$/, '')].filter(Boolean);
    const src = candidates.map((n) => byNom.get(n)).find(Boolean);
    if (!src) continue;
    if (src.zIndexCalques?.length) {
      it.zIndex = src.zIndexCalques.map(Number);
      report.counts.enriched++;
      report.enrichedIds.push(`${sex}:${it.id}`);
    } else if (it.zIndex?.length) {
      report.counts.alreadyHadZIndex++;
      continue;
    } else continue;
    it.slotsMasques = src.slotsMasques ?? [];
    it.dependCouleurPeau = !!src.dependCouleurPeau;
    it.dependPostureMainG = !!src.dependPostureMainG;
    it.dependPostureMainD = !!src.dependPostureMainD;
  }
}

await writeFile(OUT, JSON.stringify(catalog));
await writeFile(REPORT, JSON.stringify(report, null, 2));
console.log(`${report.counts.enriched}/${report.counts.items} fiches enrichies en zIndex`);
console.log(`-> ${OUT}\n-> ${REPORT}`);
