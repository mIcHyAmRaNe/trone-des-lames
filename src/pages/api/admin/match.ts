import type { APIRoute } from 'astro';
import { getDb, getEdition, type Match } from '../../../lib/db';
import { isAdmin, json, unauthorized } from '../../../lib/auth';
import { ValidationError, resolveResult, resultStatement, syncBracket } from '../../../lib/save-match';

export const prerender = false;

type Item = { id?: number; aScore?: unknown; bScore?: unknown; forfeit?: boolean; forfeitLoserId?: number | null };

/** Accepts one result `{id,...}` or a batch `{results:[{id,...}]}`. */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const payload = (await request.json().catch(() => null)) as (Item & { results?: Item[] }) | null;
  if (!payload) return json({ error: 'Requête invalide' }, 400);

  const items: Item[] = Array.isArray(payload.results) ? payload.results : [payload];
  if (items.length === 0) return json({ error: 'Aucun résultat à enregistrer' }, 400);
  if (items.length > 64) return json({ error: 'Trop de résultats en une fois' }, 400);

  const edition = await getEdition();
  const d = await getDb();

  const ids = items.map((i) => Number(i.id));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    return json({ error: 'Identifiant de duel invalide' }, 400);
  }

  const placeholders = ids.map(() => '?').join(',');
  const found = await d.execute({
    sql: `SELECT * FROM matches WHERE edition_id = ? AND id IN (${placeholders})`,
    args: [edition.id, ...ids],
  });
  const byId = new Map((found.rows as unknown as Match[]).map((m) => [m.id, m]));

  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) return json({ error: 'Un duel est introuvable' }, 404);

  const bracket = await d.execute({
    sql: "SELECT COUNT(*) AS n FROM matches WHERE edition_id = ? AND phase <> 'group'",
    args: [edition.id],
  });
  const hasBracket = Number(bracket.rows[0].n) > 0;

  // The bracket is frozen once generated: the QF pairings were computed from the
  // standings of that moment, so a later group correction would make the
  // standings and the bracket contradict each other (it cannot be re-drawn).
  if (hasBracket && ids.some((id) => byId.get(id)!.phase === 'group')) {
    return json(
      { error: 'Le tableau final existe : effacez les résultats pour corriger un duel de poules' },
      409,
    );
  }

  // Validate everything before writing anything: a batch is all-or-nothing.
  const resolved: { match: Match; res: ReturnType<typeof resolveResult> }[] = [];
  try {
    for (const item of items) {
      const match = byId.get(Number(item.id))!;
      resolved.push({ match, res: resolveResult(match, item) });
    }
  } catch (e) {
    if (e instanceof ValidationError) {
      const match = byId.get(Number(items[resolved.length]?.id));
      const who = match ? ` (duel ${match.slot})` : '';
      return json({ error: e.message + who }, e.status);
    }
    throw e;
  }

  await d.batch(resolved.map(({ match, res }) => resultStatement(match, res)), 'write');

  if (hasBracket) await syncBracket(edition.id);

  return json({ ok: true, saved: resolved.length });
};
