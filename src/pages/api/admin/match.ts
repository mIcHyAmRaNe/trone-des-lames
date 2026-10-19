import type { APIRoute } from 'astro';
import { getDb, getEdition, type Match } from '../../../lib/db';
import { isAdmin, json, unauthorized } from '../../../lib/auth';

export const prerender = false;

/** Where a winner goes: [next phase, next slot, column] */
const ADVANCE: Record<string, [string, number, 'a_id' | 'b_id']> = {
  'qf:1': ['sf', 1, 'a_id'],
  'qf:3': ['sf', 1, 'b_id'],
  'qf:2': ['sf', 2, 'a_id'],
  'qf:4': ['sf', 2, 'b_id'],
  'sf:1': ['final', 1, 'a_id'],
  'sf:2': ['final', 1, 'b_id'],
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const body = (await request.json()) as {
    id?: number;
    winnerId?: number;
    aScore?: number | null;
    bScore?: number | null;
    forfeit?: boolean;
  };
  if (!body.id || !body.winnerId) return json({ error: 'Données invalides' }, 400);

  const edition = await getEdition();
  const d = await getDb();

  const r = await d.execute({
    sql: 'SELECT * FROM matches WHERE id = ? AND edition_id = ?',
    args: [body.id, edition.id],
  });
  const match = r.rows[0] as unknown as Match | undefined;
  if (!match) return json({ error: 'Match introuvable' }, 404);
  if (match.a_id == null || match.b_id == null) return json({ error: 'Combattants non définis' }, 409);
  if (body.winnerId !== match.a_id && body.winnerId !== match.b_id) {
    return json({ error: 'Vainqueur invalide' }, 400);
  }

  const forfeit = body.forfeit === true;
  const aScore = forfeit ? 0 : body.aScore ?? null;
  const bScore = forfeit ? 0 : body.bScore ?? null;

  const statements: { sql: string; args: (string | number | null)[] }[] = [
    {
      sql: 'UPDATE matches SET winner_id = ?, a_score = ?, b_score = ?, forfeit = ?, played = 1 WHERE id = ?',
      args: [body.winnerId, aScore, bScore, forfeit ? 1 : 0, match.id],
    },
  ];

  const next = ADVANCE[`${match.phase}:${match.slot}`];
  if (next) {
    const [phase, slot, column] = next;
    statements.push({
      sql: `UPDATE matches SET ${column} = ? WHERE edition_id = ? AND phase = ? AND slot = ?`,
      args: [body.winnerId, edition.id, phase, slot],
    });
  }

  if (match.phase === 'final') {
    statements.push({ sql: "UPDATE editions SET status = 'done' WHERE id = ?", args: [edition.id] });
  }

  await d.batch(statements, 'write');
  return json({ ok: true });
};
