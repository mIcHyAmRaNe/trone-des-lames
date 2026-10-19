import { getDb, getEdition, type Fighter, type Match } from './db';
import { computeStandings, statusOf } from './tournament';

export async function getTournamentState(slug = 'classique') {
  const edition = await getEdition(slug);
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
  const championFighter = final?.winner_id != null ? fighters.find((f) => f.id === final.winner_id) : undefined;
  const champion = championFighter ? { id: championFighter.id, name: championFighter.name } : null;

  const byId = new Map(fighters.map((f) => [f.id, f.name]));

  return {
    edition: { ...edition, status, champion },
    fighters,
    matches: matches.map((m) => ({
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
    })),
    standings,
  };
}

export type TournamentState = Awaited<ReturnType<typeof getTournamentState>>;
