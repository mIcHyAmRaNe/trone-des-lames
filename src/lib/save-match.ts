import { getDb, type Match } from './db';

export class ValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type MatchInput = {
  id?: number;
  aScore?: number | string | null;
  bScore?: number | string | null;
  forfeit?: boolean;
  forfeitLoserId?: number | null;
};

export type Resolved = {
  winnerId: number;
  aScore: number | null;
  bScore: number | null;
  forfeit: boolean;
};

/** Accepts "17,5" as well as 17.5. Returns null when out of range or unparsable. */
export function parsePoints(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 999) return null;
  return n;
}

/**
 * A duel always has a winner: the higher score. A forfeit is declared by the
 * loser — the winner is the other fighter and their points are derived from
 * the rules, never entered.
 */
export function resolveResult(match: Match, input: MatchInput): Resolved {
  const aId = match.a_id;
  const bId = match.b_id;
  if (aId == null || bId == null) {
    throw new ValidationError('Les combattants de ce duel ne sont pas encore connus', 409);
  }

  if (input.forfeit) {
    const loser = Number(input.forfeitLoserId);
    if (loser !== aId && loser !== bId) {
      throw new ValidationError('Indiquez le combattant qui déclare forfait');
    }
    return {
      winnerId: loser === aId ? bId : aId,
      aScore: 0,
      bScore: 0,
      forfeit: true,
    };
  }

  const a = parsePoints(input.aScore);
  const b = parsePoints(input.bScore);
  if (a == null || b == null) {
    throw new ValidationError('Saisissez les points des deux combattants');
  }
  if (a === b) {
    throw new ValidationError('Les points sont égaux : un duel doit désigner un vainqueur');
  }
  return { winnerId: a > b ? aId : bId, aScore: a, bScore: b, forfeit: false };
}

/**
 * Rebuilds the bracket from validated results. If a feeder result changes, the
 * downstream match is cleared so a stale winner can never reach the final.
 */
export async function syncBracket(editionId: number) {
  const d = await getDb();
  const r = await d.execute({
    sql: "SELECT * FROM matches WHERE edition_id = ? AND phase <> 'group'",
    args: [editionId],
  });
  const matches = r.rows as unknown as Match[];
  const at = (phase: string, slot: number) => matches.find((m) => m.phase === phase && m.slot === slot);
  const winnerOf = (m?: Match) => (m && m.played === 1 ? m.winner_id : null);

  const updates: { sql: string; args: (number | null)[] }[] = [];

  const place = (phase: string, slot: number, col: 'a_id' | 'b_id', value: number | null) => {
    const m = at(phase, slot);
    if (!m) return;
    if ((m as unknown as Record<string, unknown>)[col] === value) return;

    (m as unknown as Record<string, unknown>)[col] = value;
    updates.push({ sql: `UPDATE matches SET ${col} = ? WHERE id = ?`, args: [value, m.id] });

    if (m.played === 1) {
      m.played = 0;
      m.winner_id = null;
      updates.push({
        sql: 'UPDATE matches SET winner_id = NULL, a_score = NULL, b_score = NULL, forfeit = 0, played = 0 WHERE id = ?',
        args: [m.id],
      });
    }
  };

  // SF1 = QF1 + QF3, SF2 = QF2 + QF4, then the final.
  place('sf', 1, 'a_id', winnerOf(at('qf', 1)));
  place('sf', 1, 'b_id', winnerOf(at('qf', 3)));
  place('sf', 2, 'a_id', winnerOf(at('qf', 2)));
  place('sf', 2, 'b_id', winnerOf(at('qf', 4)));
  place('final', 1, 'a_id', winnerOf(at('sf', 1)));
  place('final', 1, 'b_id', winnerOf(at('sf', 2)));

  if (updates.length) await d.batch(updates, 'write');
}

export function resultStatement(match: Match, res: Resolved) {
  return {
    sql: 'UPDATE matches SET winner_id = ?, a_score = ?, b_score = ?, forfeit = ?, played = 1 WHERE id = ?',
    args: [res.winnerId, res.aScore, res.bScore, res.forfeit ? 1 : 0, match.id] as (number | null)[],
  };
}
