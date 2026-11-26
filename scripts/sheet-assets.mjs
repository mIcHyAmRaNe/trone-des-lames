// Construit une fois `data/character-sheet-assets.json` depuis les fiches de jeu.
//
  //   node scripts/sheet-assets.mjs --female <fiche-femme> --male <fiche-homme> [--ryence <fichier>] [--out <fichier>]
  //
  // Les deux fichiers sont des pages de personnage RK (HTML avec des blobs
  // `{"login"...}`). Le rôle de chaque fichier est explicite : le champ `sexe` des
  // blobs n'est pas fiable (les captures peuvent venir d'un autre personnage).
  // Pour un même rôle, la valeur majoritaire l'emporte : les blobs dupliqués et
  // les rares fiches étrangères ne polluent pas le résultat.
  //
  // Optionnel : --ryence <fichier> pour compléter les champs manquants
  // (declinaisons, slotsMasques, dependCouleurPeau, dependPostureMainG,
  // dependPostureMainD, postureMainG, postureMainD, zIndexCalques)
  // depuis les données ryence.de (format JS window.equipmentDefinitions).
  //
  // Sortie : une entrée par nom d'asset, avec la fiche de chaque sexe.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : null;
}

const femalePath = arg('female');
const malePath = arg('male');
const ryencePath = arg('ryence');
const outPath = arg('out') ?? join(ROOT, 'data/character-sheet-assets.json');

if (!femalePath || !malePath) {
  console.error('usage : node scripts/sheet-assets.mjs --female <fiche> --male <fiche> [--ryence <fichier>] [--out <fichier>]');
  process.exit(1);
}

/** Blobs `{"login"...}` d'une page de personnage, accolades équilibrées. */
function readBlobs(html) {
  const out = [];
  let at = 0;
  while (true) {
    const start = html.indexOf('{"login"', at);
    if (start < 0) break;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = start; i < html.length; i++) {
      const c = html[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) {
      at = start + 1;
      continue;
    }
    try {
      out.push(JSON.parse(html.slice(start, end + 1)));
    } catch {
      /* blob tronqué — ignoré */
    }
    at = end + 1;
  }
  return out;
}

/** Extrait les données ryence (format JS window.equipmentDefinitions). */
function readRyence(js) {
  const out = { F: [], M: [] };
  for (const role of ['F', 'M']) {
    const re = new RegExp(`window\\.equipmentDefinitions\\.${role}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
    const m = js.match(re);
    if (!m) continue;
    try {
      out[role] = JSON.parse(`[${m[1]}]`);
    } catch {
      /* JSON invalide — ignoré */
    }
  }
  return out;
}

/** Les 15 clés du jeu, typées pour l'application. */
function recordOf(it) {
  return {
    idItem: String(it.idItem),
    declinaison: String(it.declinaison ?? '0'),
    parametre: String(it.parametre ?? '0'),
    nom: String(it.nom ?? ''),
    slot: String(it.slot ?? ''),
    slotGardeRobe: it.slotGardeRobe ?? null,
    miniature: it.miniature ?? 'o',
    declinaisons: (it.declinaisons ?? []).map(Number).sort((a, b) => a - b),
    slotsMasques: (it.slotsMasques ?? []).map(String),
    dependCouleurPeau: !!it.dependCouleurPeau,
    dependPostureMainG: !!it.dependPostureMainG,
    dependPostureMainD: !!it.dependPostureMainD,
    postureMainG: it.postureMainG ?? null,
    postureMainD: it.postureMainD ?? null,
    zIndexCalques: (it.zIndexCalques ?? []).map(Number),
  };
}

/** Les lignes d'un même objet ne diffèrent que par la déclinaison/le paramètre. */
function signature(rec) {
  const { declinaison, parametre, ...rest } = rec;
  return JSON.stringify(rest);
}

/** Une fiche par (rôle, nom) : groupe majoritaire, puis déclinaison 0. */
function collect(html) {
  const blobs = readBlobs(html);
  const groups = new Map(); // nom -> Map<signature, { count, rows }>
  let rows = 0;
  let skipped = 0;
  for (const blob of blobs) {
    for (const raw of blob.equipement ?? []) {
      const rec = recordOf(raw);
      if (!rec.nom) {
        skipped++;
        continue;
      }
      rows++;
      const bySig = groups.get(rec.nom) ?? new Map();
      const sig = signature(rec);
      const group = bySig.get(sig) ?? { count: 0, rows: [] };
      group.count++;
      group.rows.push(rec);
      bySig.set(sig, group);
      groups.set(rec.nom, bySig);
    }
  }

  const records = new Map();
  for (const [nom, bySig] of groups) {
    const winner = [...bySig.values()].sort((a, b) => b.count - a.count)[0];
    const row =
      winner.rows.find((r) => r.declinaison === '0') ??
      winner.rows.sort((a, b) => Number(a.declinaison) - Number(b.declinaison))[0];
    records.set(nom, row);
  }
  return { records, rows, skipped, blobs: blobs.length, variants: [...groups.values()].filter((m) => m.size > 1).length };
}

/** Collecte les données ryence par nom d'asset. */
function collectRyence(ryenceData, role) {
  const groups = new Map(); // nom -> Map<signature, { count, rows }>
  for (const raw of ryenceData[role] ?? []) {
    const rec = recordOf(raw);
    if (!rec.nom) continue;
    const bySig = groups.get(rec.nom) ?? new Map();
    const sig = signature(rec);
    const group = bySig.get(sig) ?? { count: 0, rows: [] };
    group.count++;
    group.rows.push(rec);
    bySig.set(sig, group);
    groups.set(rec.nom, bySig);
  }

  const records = new Map();
  for (const [nom, bySig] of groups) {
    const winner = [...bySig.values()].sort((a, b) => b.count - a.count)[0];
    const row =
      winner.rows.find((r) => r.declinaison === '0') ??
      winner.rows.sort((a, b) => Number(a.declinaison) - Number(b.declinaison))[0];
    records.set(nom, row);
  }
  return records;
}

/** Fusionne les données ryence dans les records existants (complète seulement les champs vides)
 *  et ajoute les items ryence-only (absents des fiches de jeu). */
function mergeRyence(records, ryenceRecords, role) {
  const RYENCE_FIELDS = [
    'declinaisons', 'slotsMasques', 'dependCouleurPeau',
    'dependPostureMainG', 'dependPostureMainD', 'postureMainG',
    'postureMainD', 'zIndexCalques'
  ];
  // 1. Complète les items existants
  for (const [nom, rec] of records) {
    const ryenceRec = ryenceRecords.get(nom);
    if (!ryenceRec) continue;
    for (const field of RYENCE_FIELDS) {
      const val = rec[field];
      const ryenceVal = ryenceRec[field];
      const isEmpty = Array.isArray(val) ? val.length === 0 : (val === null || val === undefined || val === false);
      if (isEmpty && ryenceVal !== null && ryenceVal !== undefined && !(Array.isArray(ryenceVal) && ryenceVal.length === 0)) {
        rec[field] = ryenceVal;
      }
    }
  }
  // 2. Ajoute les items ryence-only (absents des fiches de jeu)
  for (const [nom, ryenceRec] of ryenceRecords) {
    if (!records.has(nom)) {
      records.set(nom, ryenceRec);
    }
  }
}

const [femaleHtml, maleHtml] = await Promise.all([
  readFile(femalePath, 'utf8'),
  readFile(malePath, 'utf8'),
]);
const female = collect(femaleHtml);
const male = collect(maleHtml);

let ryenceFemaleRecords = new Map();
let ryenceMaleRecords = new Map();
if (ryencePath) {
  const ryenceJs = await readFile(ryencePath, 'utf8');
  const ryenceData = readRyence(ryenceJs);
  ryenceFemaleRecords = collectRyence(ryenceData, 'F');
  ryenceMaleRecords = collectRyence(ryenceData, 'M');
  mergeRyence(female.records, ryenceFemaleRecords, 'F');
  mergeRyence(male.records, ryenceMaleRecords, 'M');
}

const assets = {};
for (const [nom, rec] of female.records) assets[nom] = { ...(assets[nom] ?? {}), F: rec };
for (const [nom, rec] of male.records) assets[nom] = { ...(assets[nom] ?? {}), M: rec };

const sortedAssets = Object.fromEntries(
  Object.keys(assets)
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((nom) => [nom, assets[nom]]),
);

const output = {
  sources: [
    {
      role: 'F',
      file: basename(femalePath),
      sha256: createHash('sha256').update(femaleHtml).digest('hex'),
      blobs: female.blobs,
      rows: female.rows,
    },
    {
      role: 'M',
      file: basename(malePath),
      sha256: createHash('sha256').update(maleHtml).digest('hex'),
      blobs: male.blobs,
      rows: male.rows,
    },
  ],
  assets: sortedAssets,
};

if (ryencePath) {
  output.sources.push({
    role: 'RYENCE',
    file: basename(ryencePath),
    sha256: createHash('sha256').update(await readFile(ryencePath, 'utf8')).digest('hex'),
    entriesF: ryenceFemaleRecords.size,
    entriesM: ryenceMaleRecords.size,
  });
}

const KEYS = [
  'idItem', 'declinaison', 'parametre', 'nom', 'slot', 'slotGardeRobe',
  'miniature', 'declinaisons', 'slotsMasques', 'dependCouleurPeau',
  'dependPostureMainG', 'dependPostureMainD', 'postureMainG',
  'postureMainD', 'zIndexCalques',
];
const noms = Object.keys(sortedAssets);
assert.ok(noms.length > 0, 'aucun asset trouvé');
for (const nom of noms) {
  const entry = sortedAssets[nom];
  assert.ok(entry.F || entry.M, `${nom}: aucun rôle`);
  for (const role of ['F', 'M']) {
    const rec = entry[role];
    if (!rec) continue;
    assert.deepEqual(Object.keys(rec).sort(), [...KEYS].sort(), `${nom}/${role}: clés`);
    assert.equal(typeof rec.idItem, 'string', `${nom}/${role}: idItem`);
    assert.ok(Array.isArray(rec.declinaisons), `${nom}/${role}: declinaisons`);
    assert.ok(Array.isArray(rec.zIndexCalques), `${nom}/${role}: zIndexCalques`);
    assert.ok(!('zIndex' in rec), `${nom}/${role}: zIndex résiduel`);
  }
}

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(output));

const count = (role) => noms.filter((nom) => sortedAssets[nom][role]).length;
console.log(`femme : ${female.records.size} noms (${female.rows} lignes, ${female.blobs} blobs, ${female.variants} variantes)`);
console.log(`homme : ${male.records.size} noms (${male.rows} lignes, ${male.blobs} blobs, ${male.variants} variantes)`);
if (ryencePath) {
  console.log(`ryence F : ${ryenceFemaleRecords.size} noms | ryence M : ${ryenceMaleRecords.size} noms`);
}
console.log(`assets : ${noms.length} (F ${count('F')} / M ${count('M')})`);
console.log(`-> ${outPath}`);