import type { APIRoute } from 'astro';
import { getDb, getEdition, type Fighter, type Match } from '../../../lib/db';
import { isAdmin, json, unauthorized } from '../../../lib/auth';
import { computeStandings } from '../../../lib/tournament';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const body = (await request.json().catch(() => null)) as { what?: string } | null;
  if (body?.what !== 'results' && body?.what !== 'all') {
    return json({ error: 'Paramètre invalide' }, 400);
  }

  const edition = await getEdition();
  const d = await getDb();

  if (body.what === 'all') {
    await d.batch(
      [
        { sql: 'DELETE FROM matches WHERE edition_id = ?', args: [edition.id] },
        { sql: 'DELETE FROM fighters WHERE edition_id = ?', args: [edition.id] },
      ],
      'write',
    );
    return json({ ok: true });
  }

  // Results only: keep fighters and the drawn groups, rebuild the bracket from
  // the (now empty) group standings so the page never shows orphaned nodes.
  await d.batch(
    [
      {
        sql: `UPDATE matches SET winner_id = NULL, a_score = NULL, b_score = NULL,
              forfeit = 0, played = 0
              WHERE edition_id = ?`,
        args: [edition.id],
      },
      { sql: "DELETE FROM matches WHERE edition_id = ? AND phase <> 'group'", args: [edition.id] },
    ],
    'write',
  );

  const fr = await d.execute({
    sql: 'SELECT * FROM fighters WHERE edition_id = ?',
    args: [edition.id],
  });
  const fighters = fr.rows as unknown as Fighter[];

  // Sanity: standings must still be computable after the reset.
  const mr = await d.execute({
    sql: 'SELECT * FROM matches WHERE edition_id = ?',
    args: [edition.id],
  });
  computeStandings(fighters, mr.rows as unknown as Match[]);

  return json({ ok: true });
};
