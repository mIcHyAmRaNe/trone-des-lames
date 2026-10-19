import { createClient, type Client } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL ?? 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db: Client = createClient({ url, authToken });

let ready: Promise<void> | null = null;

async function init() {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS editions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'classique',
        status TEXT NOT NULL DEFAULT 'setup'
      )`,
      `CREATE TABLE IF NOT EXISTS fighters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        edition_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        grp TEXT,
        seed INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        edition_id INTEGER NOT NULL,
        phase TEXT NOT NULL,
        slot INTEGER NOT NULL,
        grp TEXT,
        a_id INTEGER,
        b_id INTEGER,
        winner_id INTEGER,
        a_score REAL,
        b_score REAL,
        forfeit INTEGER NOT NULL DEFAULT 0,
        played INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_matches_edition ON matches (edition_id, phase, slot)`,
      `CREATE INDEX IF NOT EXISTS idx_fighters_edition ON fighters (edition_id)`,
    ],
    'write',
  );

  const existing = await db.execute({
    sql: 'SELECT id FROM editions WHERE slug = ?',
    args: ['classique'],
  });
  if (existing.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO editions (slug, name, format, status) VALUES ('classique', 'Classique', 'classique', 'setup')",
      args: [],
    });
  }
}

export function getDb() {
  ready ??= init();
  return ready.then(() => db);
}

export type Edition = {
  id: number;
  slug: string;
  name: string;
  format: string;
  status: 'setup' | 'groups' | 'bracket' | 'done';
};

export type Fighter = {
  id: number;
  name: string;
  grp: string | null;
  seed: number | null;
};

export type Match = {
  id: number;
  phase: 'group' | 'qf' | 'sf' | 'final';
  slot: number;
  grp: string | null;
  a_id: number | null;
  b_id: number | null;
  winner_id: number | null;
  a_score: number | null;
  b_score: number | null;
  forfeit: number;
  played: number;
};

export async function getEdition(slug = 'classique'): Promise<Edition> {
  const d = await getDb();
  const r = await d.execute({ sql: 'SELECT * FROM editions WHERE slug = ?', args: [slug] });
  const row = r.rows[0];
  if (!row) throw new Error('Edition introuvable');
  return row as unknown as Edition;
}
