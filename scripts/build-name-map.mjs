// Construit un mapping FR <-> EN des noms d'objets depuis FragmentsRAR.php du jeu.
//   node scripts/build-name-map.mjs [--out <fichier>]
//
// Sortie : data/name-map-fr-en.json
//   { byId: { "499": { fr: "Porte-bébé par Alii", en: "Baby carrier by Alii", frPlural: "...", enPlural: "..." } },
//     frToEn: { "porte-bébé par alii": "Baby carrier by Alii", ... },
//     enToFr: { "baby carrier by alii": "Porte-bébé par Alii", ... } }

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : join(ROOT, 'data/name-map-fr-en.json');

const FR_URL = 'https://www.renaissancekingdoms.com/FragmentsRAR.php?lan=fr';
const EN_URL = 'https://www.renaissancekingdoms.com/FragmentsRAR.php?lan=en';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function norm(v) {
  return `${v ?? ''}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^(?:le|la|les|the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, '');
}

const [fr, en] = await Promise.all([fetchJson(FR_URL), fetchJson(EN_URL)]);

const frObj = fr.FonctionsObjets ?? {};
const enObj = en.FonctionsObjets ?? {};

const byId = {};
const frToEn = {};
const enToFr = {};

let count = 0;
for (const key of Object.keys(frObj)) {
  if (!key.startsWith('nomsObjetsNormauxSingulier')) continue;
  const id = key.replace('nomsObjetsNormauxSingulier', '');
  const frSingular = frObj[key];
  const frPlural = frObj['nomsObjetsNormauxPluriel' + id];
  const enSingular = enObj['nomsObjetsNormauxSingulier' + id];
  const enPlural = enObj['nomsObjetsNormauxPluriel' + id];

  if (!frSingular || !enSingular) continue;

  byId[id] = {
    fr: frSingular,
    en: enSingular,
    frPlural: frPlural ?? '',
    enPlural: enPlural ?? '',
  };

  const frKey = norm(frSingular);
  const enKey = norm(enSingular);
  if (frKey && enKey) {
    frToEn[frKey] = enSingular;
    enToFr[enKey] = frSingular;
  }

  // Also map plurals
  if (frPlural && enPlural) {
    const frPluralKey = norm(frPlural);
    const enPluralKey = norm(enPlural);
    if (frPluralKey && enPluralKey) {
      frToEn[frPluralKey] = enSingular;
      enToFr[enPluralKey] = frSingular;
    }
  }

  count++;
}

const output = { byId, frToEn, enToFr, generatedAt: new Date().toISOString(), count };
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(output));

console.log(`Mapping built: ${count} items`);
console.log(`-> ${OUT}`);

// Quick test
const testFr = 'porte-bébé par alii';
const testEn = 'baby carrier by alii';
console.log(`Test FR->EN: "${testFr}" => "${frToEn[norm(testFr)]}"`);
console.log(`Test EN->FR: "${testEn}" => "${enToFr[norm(testEn)]}"`);