import type { APIRoute } from 'astro';
import { getEdition, getDb, type Fighter, type Match } from '../../lib/db';
import { computeStandings, statusOf } from '../../lib/tournament';

export const prerender = false;

export const GET: APIRoute = async () => {
  const edition = await getEdition();
  const d = await getDb();

  const [fr, mr] = await Promise.all([
    d.execute({ sql: 'SELECT * FROM fighters WHERE edition_id = ? ORDER BY id', args: [edition.id] }),
    d.execute({ sql: 'SELECT * FROM matches WHERE edition_id = ? ORDER BY phase, slot', args: [edition.id] }),
  ]);

  const fighters = fr.rows as unknown as Fighter[];
  const matches = mr.rows as unknown as Match[];

  const standings = computeStandings(fighters, matches);
  const status = statusOf(matches, matches.some((m) => m.phase !== 'group'));

  if (status !== edition.status) {
    await d.execute({ sql: 'UPDATE editions SET status = ? WHERE id = ?', args: [status, edition.id] });
  }

  const final = matches.find((m) => m.phase === 'final' && m.played === 1);
  const champion =
    final?.winner_id != null
      ? (() => {
          const f = fighters.find((x) => x.id === final.winner_id);
          return f ? { id: f.id, name: f.name } : null;
        })()
      : null;

  const byId = new Map(fighters.map((f) => [f.id, f.name]));
  const slim = matches.map((m) => ({
    id: m.id,
    phase: m.phase,
    slot: m.slot,
    grp: m.grp,
    a: m.a_id != null ? { id: m.a_id, name: byId.get(m.a_id) ?? '?' } : null,
    b: m.b_id != null ? { id: m.b_id, name: byId.get(m.b_id) ?? '?' } : null,
    winnerId: m.winner_id,
    aScore: m.a_score,
    bScore: m.b_score,
    forfeit: m.forfeit === 1,
    played: m.played === 1,
  }));

  return new Response(
    JSON.stringify({
      edition: { ...edition, status, champion },
      fighters,
      matches: slim,
      standings,
    }),
    { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  );
};
