import type { APIRoute } from 'astro';
import { getDb, getEdition, type Fighter, type Match } from '../../../lib/db';
import { isAdmin, json, unauthorized } from '../../../lib/auth';
import { bracketSeeds, computeStandings } from '../../../lib/tournament';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const edition = await getEdition();
  const d = await getDb();

  const exists = await d.execute({
    sql: "SELECT COUNT(*) AS n FROM matches WHERE edition_id = ? AND phase <> 'group'",
    args: [edition.id],
  });
  if (Number(exists.rows[0].n) > 0) return json({ error: 'Le tableau final existe déjà' }, 409);

  const [fr, mr] = await Promise.all([
    d.execute({ sql: 'SELECT * FROM fighters WHERE edition_id = ?', args: [edition.id] }),
    d.execute({ sql: "SELECT * FROM matches WHERE edition_id = ? AND phase = 'group'", args: [edition.id] }),
  ]);
  const fighters = fr.rows as unknown as Fighter[];
  const matches = mr.rows as unknown as Match[];

  if (matches.length === 0 || matches.some((m) => m.played !== 1)) {
    return json({ error: 'Tous les duels de poules doivent être validés' }, 409);
  }

  let seeds: [number, number][];
  try {
    seeds = bracketSeeds(computeStandings(fighters, matches));
  } catch {
    return json({ error: 'Classement incomplet : vérifiez les duels de poules' }, 409);
  }

  const statements = seeds.map(([a, b], i) => ({
    sql: 'INSERT INTO matches (edition_id, phase, slot, a_id, b_id) VALUES (?, ?, ?, ?, ?)',
    args: [edition.id, 'qf', i + 1, a, b],
  }));
  for (let slot = 1; slot <= 2; slot++) {
    statements.push({
      sql: 'INSERT INTO matches (edition_id, phase, slot) VALUES (?, ?, ?)',
      args: [edition.id, 'sf', slot],
    });
  }
  statements.push({
    sql: 'INSERT INTO matches (edition_id, phase, slot) VALUES (?, ?, ?)',
    args: [edition.id, 'final', 1],
  });
  statements.push({
    sql: "UPDATE editions SET status = 'bracket' WHERE id = ?",
    args: [edition.id],
  });

  await d.batch(statements, 'write');
  return json({ ok: true });
};
