import type { APIRoute } from 'astro';
import { getDb, getEdition, type Fighter } from '../../../lib/db';
import { isAdmin, json, unauthorized } from '../../../lib/auth';
import { GROUPS, groupPairings } from '../../../lib/tournament';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const edition = await getEdition();
  const d = await getDb();

  const existing = await d.execute({
    sql: 'SELECT COUNT(*) AS n FROM matches WHERE edition_id = ?',
    args: [edition.id],
  });
  if (Number(existing.rows[0].n) > 0) return json({ error: 'Le tirage a déjà eu lieu' }, 409);

  const fr = await d.execute({
    sql: 'SELECT * FROM fighters WHERE edition_id = ? ORDER BY id',
    args: [edition.id],
  });
  const fighters = fr.rows as unknown as Fighter[];
  if (fighters.length !== 16) return json({ error: 'Il faut exactement 16 combattants' }, 400);

  // Fisher-Yates
  const shuffled = [...fighters];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const statements: { sql: string; args: (string | number)[] }[] = [];
  const byGroup = new Map<string, Fighter[]>();
  shuffled.forEach((f, i) => {
    const grp = GROUPS[Math.floor(i / 4)];
    const seed = (i % 4) + 1;
    statements.push({
      sql: 'UPDATE fighters SET grp = ?, seed = ? WHERE id = ?',
      args: [grp, seed, f.id],
    });
    const members = byGroup.get(grp) ?? [];
    members.push({ ...f, grp, seed });
    byGroup.set(grp, members);
  });

  let slot = 1;
  for (const g of GROUPS) {
    for (const [a, b] of groupPairings(byGroup.get(g) ?? [], g)) {
      statements.push({
        sql: 'INSERT INTO matches (edition_id, phase, slot, grp, a_id, b_id) VALUES (?, ?, ?, ?, ?, ?)',
        args: [edition.id, 'group', slot++, g, a, b],
      });
    }
  }

  try {
    await d.batch(statements, 'write');
  } catch (e) {
    // The unique index on (edition_id, phase, slot) rejects a concurrent draw.
    if (String(e).includes('UNIQUE')) return json({ error: 'Le tirage a déjà eu lieu' }, 409);
    throw e;
  }
  return json({ ok: true });
};
