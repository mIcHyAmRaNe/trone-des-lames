import type { APIRoute } from 'astro';
import { getDb, getEdition } from '../../../lib/db';
import { isAdmin, json, unauthorized } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();
  const { what } = (await request.json().catch(() => ({}))) as { what?: string };
  if (what !== 'results' && what !== 'all') return json({ error: 'Paramètre invalide' }, 400);

  const edition = await getEdition();
  const d = await getDb();

  if (what === 'all') {
    await d.batch(
      [
        { sql: 'DELETE FROM matches WHERE edition_id = ?', args: [edition.id] },
        { sql: 'DELETE FROM fighters WHERE edition_id = ?', args: [edition.id] },
        { sql: "UPDATE editions SET status = 'setup' WHERE id = ?", args: [edition.id] },
      ],
      'write',
    );
  } else {
    await d.batch(
      [
        {
          sql: `UPDATE matches SET winner_id = NULL, a_score = NULL, b_score = NULL,
                forfeit = 0, played = 0
                WHERE edition_id = ? AND phase = 'group'`,
          args: [edition.id],
        },
        { sql: "DELETE FROM matches WHERE edition_id = ? AND phase <> 'group'", args: [edition.id] },
        { sql: "UPDATE editions SET status = 'groups' WHERE id = ?", args: [edition.id] },
      ],
      'write',
    );
  }

  return json({ ok: true });
};
