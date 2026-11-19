// Complète le catalogue propre (wiki) avec les champs de jeu relevés dans la
// fiche de personnage : zIndex, idItem, déclinaisons, paramètres, postures…
//
//   node scripts/catalog-enrich.mjs
//
// Entrée : data/catalog-wiki-clean.json (ou BASE_PATH)
// Sortie : public/rk/catalog.json + data/catalog-enrich-report.json
// Aucune donnée ryence, aucun id hérité de l'ancien catalogue.

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
    const list = byNom.get(it.nom) ?? [];
    if (!list.some((x) => x.declinaison === it.declinaison && x.parametre === it.parametre)) list.push(it);
    byNom.set(it.nom, list);
  }
  i = end + 1;
}
console.log(`fiche : ${byNom.size} noms d'assets uniques`);

// Une fiche catalogue correspond à un objet : on prend la déclinaison 0 quand
// elle existe, sinon la première entrée relevée.
const pick = (entries) => entries.find((e) => e.declinaison === '0') ?? entries[0];

const catalog = JSON.parse(await readFile(BASE, 'utf8'));
// Ne pas introduire de slot inconnu de l'application (ex. « Bracelet ») :
// seuls les slots déjà présents dans le catalogue wiki sont acceptés.
const knownSlots = new Set(
  [...catalog.sexes.M, ...catalog.sexes.F].map((it) => it.slot).filter(Boolean),
);
const report = {
  generatedAt: new Date().toISOString(),
  source: 'character sheet (blabla.txt)',
  counts: { items: 0, enriched: 0, withoutZIndex: 0 },
  enrichedIds: [],
};

for (const sex of ['M', 'F']) {
  for (const it of catalog.sexes[sex]) {
    report.counts.items++;
    const candidates = [it.nom, `${it.nom ?? ''}`.replace(/\d+$/, '')].filter(Boolean);
    const src = candidates.map((n) => byNom.get(n)).find(Boolean) ??
      // Les noms d'assets du wiki peuvent porter un suffixe _m0/_n0 absent de
      // la fiche ; on essaie aussi la forme épurée.
      candidates.map((n) => byNom.get(n.replace(/_(?:m\d+|n\d+|p\d+)+$/i, ''))).find(Boolean);
    if (!src) continue;
    const record = pick(src);

    // Les champs que le wiki sait déjà remplir ne sont pas écrasés : la fiche
    // est celle d'un personnage féminin, ses emplacements ne valent pas pour
    // les fiches masculines. On ne comble que les vides.
    if (!it.nom) it.nom = record.nom;
    if (!it.slot && knownSlots.has(record.slot)) it.slot = record.slot;
    if (!it.slotGardeRobe) it.slotGardeRobe = record.slotGardeRobe ?? null;
    if (!it.miniature) it.miniature = record.miniature ?? 'o';
    if (!it.declinaisons?.length) it.declinaisons = (record.declinaisons ?? []).map(Number);

    // Champs absents du wiki, repris tels quels de la fiche de jeu.
    it.idItem = record.idItem;
    it.declinaison = record.declinaison;
    it.parametre = record.parametre;
    it.slotsMasques = record.slotsMasques ?? [];
    it.dependCouleurPeau = !!record.dependCouleurPeau;
    it.dependPostureMainG = !!record.dependPostureMainG;
    it.dependPostureMainD = !!record.dependPostureMainD;
    it.postureMainG = record.postureMainG ?? null;
    it.postureMainD = record.postureMainD ?? null;
    it.zIndexCalques = (record.zIndexCalques ?? []).map(Number);
    // Le champ historique reste synchronisé pour la cabine d'essayage.
    it.zIndex = [...it.zIndexCalques];

    report.counts.enriched++;
    report.enrichedIds.push(`${sex}:${it.id}`);
    if (!it.zIndexCalques.length) report.counts.withoutZIndex++;
  }
}

await writeFile(OUT, JSON.stringify(catalog));
await writeFile(REPORT, JSON.stringify(report, null, 2));
console.log(`${report.counts.enriched}/${report.counts.items} fiches enrichies (${report.counts.withoutZIndex} sans zIndex)`);
console.log(`-> ${OUT}\n-> ${REPORT}`);
