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
        name TEXT NOT NULL
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
      `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        rk_name TEXT NOT NULL,
        city TEXT NOT NULL,
        county TEXT NOT NULL,
        forum_url TEXT NOT NULL,
        starts_on TEXT NOT NULL,
        ends_on TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_events_status ON events (status, starts_on)`,
      `CREATE TABLE IF NOT EXISTS catalog_submissions (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        target_key TEXT NOT NULL,
        item_id TEXT,
        payload TEXT NOT NULL,
        before TEXT,
        submitted_by TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        decided_by TEXT,
        decided_at TEXT,
        admin_note TEXT
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_catalog_sub_pending ON catalog_submissions (target_key) WHERE status = 'pending'`,
      `CREATE INDEX IF NOT EXISTS idx_catalog_sub_status ON catalog_submissions (status, submitted_at)`,
      `CREATE TABLE IF NOT EXISTS catalog_overrides (
        sexe TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item TEXT NOT NULL,
        submission_id TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (sexe, item_id)
      )`,
      `CREATE TABLE IF NOT EXISTS catalog_reports (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        item_label TEXT NOT NULL,
        reason TEXT NOT NULL,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        closed_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_catalog_reports_status ON catalog_reports (status, created_at)`,
    ],
    'write',
  );

  // Two requests that both pass the "already drawn?" check cannot both insert:
  // the second transaction hits this index and is rolled back. Kept out of the
  // batch above so pre-existing duplicates cannot block the boot.
  try {
    await db.batch(
      ['CREATE UNIQUE INDEX IF NOT EXISTS ux_matches_slot ON matches (edition_id, phase, slot)'],
      'write',
    );
  } catch (e) {
    console.error('[db] index unique non créé (doublons existants ?)', e);
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM editions WHERE slug = ?',
    args: ['classique'],
  });
  if (existing.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO editions (slug, name) VALUES ('classique', 'Classique')",
      args: [],
    });
  }
}

export function getDb() {
  ready ??= init().catch((e) => {
    // Retry on the next request instead of serving a cached failure forever.
    ready = null;
    throw e;
  });
  return ready.then(() => db);
}

export type Edition = {
  id: number;
  slug: string;
  name: string;
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
