import type { Fighter, Match } from './db';

export const GROUPS = ['A', 'B', 'C', 'D'] as const;

/** Round-robin order for 4 fighters: each plays once per round. */
const RR: [number, number][][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

export function roundOfSlot(slot: number): number {
  return Math.floor(((slot - 1) % 6) / 2) + 1;
}

export type Standing = {
  fighterId: number;
  name: string;
  wins: number;
  points: number;
  rank: number;
  qualified: boolean;
};

type Eff = { a: number; b: number };

function pointsOf(m: Match, fighterId: number, eff: Map<number, Eff>): number | null {
  const e = eff.get(m.id);
  if (!e) return null;
  return m.a_id === fighterId ? e.a : e.b;
}

/**
 * Forfeit points for the winner: 18 on their 1st bout, the points of their
 * 1st bout on the 2nd, the average of the first two on the 3rd.
 * "The points of their 1st bout" is read literally: a fighter who lost their
 * 1st bout by forfeit scored 0 there, so a later forfeit win repeats 0.
 * Requires earlier rounds to be resolved first (we iterate by slot).
 */
function forfeitPoints(
  winnerId: number,
  round: number,
  played: Match[],
  eff: Map<number, Eff>,
): number {
  const earlier = (r: number) =>
    played.find(
      (m) => roundOfSlot(m.slot) === r && (m.a_id === winnerId || m.b_id === winnerId),
    );

  const p1 = earlier(1);
  const p2 = earlier(2);
  const v1 = p1 ? pointsOf(p1, winnerId, eff) : null;
  const v2 = p2 ? pointsOf(p2, winnerId, eff) : null;

  if (round <= 1) return 18;
  if (round === 2) return v1 ?? 18;
  if (v1 == null) return 18;
  if (v2 == null) return v1;
  return (v1 + v2) / 2;
}

export function computeStandings(fighters: Fighter[], matches: Match[]): Record<string, Standing[]> {
  const groupMatches = matches
    .filter((m) => m.phase === 'group' && m.grp)
    .sort((x, y) => x.slot - y.slot);
  const played = groupMatches.filter((m) => m.played === 1 && m.winner_id != null);
  const complete = groupMatches.length > 0 && played.length === groupMatches.length;

  const eff = new Map<number, Eff>();
  for (const m of played) {
    if (m.forfeit === 1) {
      const pts = forfeitPoints(m.winner_id as number, roundOfSlot(m.slot), played, eff);
      const winnerIsA = m.winner_id === m.a_id;
      eff.set(m.id, winnerIsA ? { a: pts, b: 0 } : { a: 0, b: pts });
    } else {
      eff.set(m.id, { a: m.a_score ?? 0, b: m.b_score ?? 0 });
    }
  }

  const out: Record<string, Standing[]> = {};

  for (const g of GROUPS) {
    const inGroup = fighters.filter((f) => f.grp === g);
    const stats = new Map<number, { wins: number; points: number }>();
    for (const f of inGroup) stats.set(f.id, { wins: 0, points: 0 });

    for (const m of played) {
      if (m.grp !== g) continue;
      const e = eff.get(m.id);
      if (!e) continue;
      const w = stats.get(m.winner_id as number);
      if (w) w.wins += 1;
      const a = m.a_id != null ? stats.get(m.a_id) : undefined;
      const b = m.b_id != null ? stats.get(m.b_id) : undefined;
      if (a) a.points += e.a;
      if (b) b.points += e.b;
    }

    const rows = inGroup.map((f) => ({
      fighterId: f.id,
      name: f.name,
      wins: stats.get(f.id)!.wins,
      points: stats.get(f.id)!.points,
      rank: 0,
      qualified: false,
    }));

    const h2h = (x: Standing, y: Standing): number => {
      const m = played.find(
        (mm) =>
          mm.grp === g &&
          ((mm.a_id === x.fighterId && mm.b_id === y.fighterId) ||
            (mm.a_id === y.fighterId && mm.b_id === x.fighterId)),
      );
      if (!m || m.winner_id == null) return 0;
      return m.winner_id === x.fighterId ? -1 : 1;
    };

    // Direct confrontation only breaks a tie between exactly two fighters:
    // with three or more, the pairwise comparison is not transitive (a cycle
    // would order fighters by registration order), so the alphabetical rule
    // applies instead.
    const tied = new Map<string, Standing[]>();
    for (const r of rows) {
      const key = `${r.wins}|${r.points}`;
      const list = tied.get(key);
      if (list) list.push(r);
      else tied.set(key, [r]);
    }
    const advantage = new Map<string, number>();
    for (const list of tied.values()) {
      if (list.length !== 2) continue;
      const [x, y] = list;
      const d = h2h(x, y);
      advantage.set(`${x.fighterId}|${y.fighterId}`, d);
      advantage.set(`${y.fighterId}|${x.fighterId}`, -d);
    }

    rows.sort(
      (x, y) =>
        y.wins - x.wins ||
        y.points - x.points ||
        (advantage.get(`${x.fighterId}|${y.fighterId}`) ?? 0) ||
        x.name.localeCompare(y.name, 'fr'),
    );

    rows.forEach((r, i) => {
      r.rank = i + 1;
      // Qualification is only meaningful once every group match is played.
      r.qualified = complete && i < 2;
    });
    out[g] = rows;
  }

  return out;
}

export function groupPairings(fighters: Fighter[], grp: string): [number, number][] {
  const members = fighters.filter((f) => f.grp === grp).sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));
  const pairs: [number, number][] = [];
  for (const round of RR) {
    for (const [i, j] of round) {
      if (members[i] && members[j]) pairs.push([members[i].id, members[j].id]);
    }
  }
  return pairs;
}

/** QF1: 1A-2B, QF2: 1B-2A, QF3: 1C-2D, QF4: 1D-2C */
const QF_SEEDS: [string, number, string, number][] = [
  ['A', 1, 'B', 2],
  ['B', 1, 'A', 2],
  ['C', 1, 'D', 2],
  ['D', 1, 'C', 2],
];

export function bracketSeeds(standings: Record<string, Standing[]>): [number, number][] {
  const at = (g: string, rank: number) => {
    const row = standings[g]?.find((s) => s.rank === rank);
    if (!row?.qualified) throw new Error('Classement incomplet');
    return row.fighterId;
  };
  const out: [number, number][] = [];
  for (const [g1, r1, g2, r2] of QF_SEEDS) {
    const a = at(g1, r1);
    const b = at(g2, r2);
    out.push([a, b]);
  }
  return out;
}

export function statusOf(matches: Match[], hasBracket: boolean): 'setup' | 'groups' | 'bracket' | 'done' {
  const final = matches.find((m) => m.phase === 'final');
  if (final?.played === 1) return 'done';
  // The draw only happens once every group duel is played, so a complete group
  // stage without a bracket is still the group stage.
  if (hasBracket) return 'bracket';
  const groups = matches.filter((m) => m.phase === 'group');
  if (groups.length === 0) return 'setup';
  return 'groups';
}
