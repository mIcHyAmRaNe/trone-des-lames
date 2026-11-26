// Migration unique : renomme `zIndex` en `zIndexCalques` dans les JSON persistés.
//
//   node scripts/migrate-zindex-key.mjs              # dry-run
//   node scripts/migrate-zindex-key.mjs --write      # applique
//
// Cible la même base que l'application : TURSO_DATABASE_URL / TURSO_AUTH_TOKEN,
// sinon `file:local.db`. Les lignes touchées sont sauvegardées avant écriture.
// Idempotent : une seconde passe ne trouve plus rien.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const backupArg = process.argv.indexOf('--backup');
const BACKUP = backupArg > 0 ? process.argv[backupArg + 1] : join(ROOT, 'data/migrate-zindex-backup.json');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const TARGETS = [
  {
    label: 'catalog_overrides.item',
    select: 'SELECT sexe, item_id, item AS value FROM catalog_overrides WHERE item IS NOT NULL',
    update: 'UPDATE catalog_overrides SET item = ? WHERE sexe = ? AND item_id = ?',
    rowKey: (row) => `${row.sexe}|${row.item_id}`,
    args: (row) => [row.sexe, row.item_id],
  },
  {
    label: 'catalog_submissions.payload',
    select: 'SELECT id, payload AS value FROM catalog_submissions WHERE payload IS NOT NULL',
    update: 'UPDATE catalog_submissions SET payload = ? WHERE id = ?',
    rowKey: (row) => row.id,
    args: (row) => [row.id],
  },
  {
    label: 'catalog_submissions.before',
    select: 'SELECT id, before AS value FROM catalog_submissions WHERE before IS NOT NULL',
    update: 'UPDATE catalog_submissions SET before = ? WHERE id = ?',
    rowKey: (row) => row.id,
    args: (row) => [row.id],
  },
];

/** Renomme la clé racine ; garde `zIndexCalques` s'il existe déjà. */
function migrate(value) {
  const obj = JSON.parse(value);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (!Object.prototype.hasOwnProperty.call(obj, 'zIndex')) return null;
  if (!Object.prototype.hasOwnProperty.call(obj, 'zIndexCalques')) {
    obj.zIndexCalques = obj.zIndex;
  }
  delete obj.zIndex;
  return JSON.stringify(obj);
}

const changes = [];
const backup = { generatedAt: new Date().toISOString(), database: process.env.TURSO_DATABASE_URL ?? 'file:local.db', rows: [] };
const report = [];

for (const target of TARGETS) {
  const result = await db.execute(target.select);
  const rows = result.rows;
  let touched = 0;
  for (const row of rows) {
    let next = null;
    try {
      next = migrate(String(row.value));
    } catch {
      report.push(`! ${target.label} ${target.rowKey(row)} : JSON illisible, ignoré`);
      continue;
    }
    if (!next) continue;
    touched++;
    changes.push({ target, row, next });
    backup.rows.push({ table: target.label, key: target.rowKey(row), before: row.value });
  }
  report.push(`${target.label} : ${touched}/${rows.length} ligne(s) à migrer`);
}

console.log(report.join('\n'));

if (!changes.length) {
  console.log('rien à migrer');
  process.exit(0);
}

if (!WRITE) {
  console.log(`dry-run : ${changes.length} ligne(s). Relancer avec --write.`);
  process.exit(0);
}

await mkdir(dirname(BACKUP), { recursive: true });
await writeFile(BACKUP, JSON.stringify(backup, null, 2));
console.log(`sauvegarde : ${BACKUP}`);

await db.batch(
  changes.map(({ target, row, next }) => ({
    sql: target.update,
    args: [next, ...target.args(row)],
  })),
  'write',
);

// Contrôle après écriture : plus aucune clé racine `zIndex`.
let leftovers = 0;
for (const target of TARGETS) {
  const result = await db.execute(target.select);
  for (const row of result.rows) {
    try {
      const obj = JSON.parse(String(row.value));
      if (obj && Object.prototype.hasOwnProperty.call(obj, 'zIndex')) leftovers++;
    } catch {
      /* déjà signalé */
    }
  }
}
console.log(`écrit : ${changes.length} ligne(s), reste ${leftovers} clé(s) zIndex`);
process.exit(leftovers === 0 ? 0 : 1);
