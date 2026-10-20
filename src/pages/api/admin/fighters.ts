import type { APIRoute } from 'astro';
import { getDb, getEdition } from '../../../lib/db';
import { isAdmin, json, unauthorized } from '../../../lib/auth';

export const prerender = false;

const MAX_NAME = 40;

/** Accent- and case-insensitive key, so "Élodie" and "elodie" clash. */
function normalize(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(raw: unknown) {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME) : '';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const clean = cleanName(body?.name);
  if (!clean) return json({ error: 'Le nom du combattant est requis' }, 400);

  const edition = await getEdition();
  const d = await getDb();

  const existing = await d.execute({
    sql: 'SELECT id, name FROM fighters WHERE edition_id = ?',
    args: [edition.id],
  });
  const clash = (existing.rows as unknown as { id: number; name: string }[]).find(
    (f) => normalize(f.name) === normalize(clean),
  );
  if (clash) return json({ error: `Le nom « ${clash.name} » est déjà inscrit` }, 409);

  // The 16-fighter limit is enforced inside the insert, so two requests that
  // both pass a COUNT check cannot both add a 17th fighter.
  const r = await d.execute({
    sql: `INSERT INTO fighters (edition_id, name)
          SELECT ?, ? WHERE (SELECT COUNT(*) FROM fighters WHERE edition_id = ?) < 16
          RETURNING id`,
    args: [edition.id, clean, edition.id],
  });
  if (r.rows.length === 0) {
    return json({ error: 'Seize combattants maximum : supprimez-en un avant d’en ajouter' }, 409);
  }
  return json({ id: Number(r.rows[0].id) }, 201);
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const body = (await request.json().catch(() => null)) as { id?: number; name?: string } | null;
  const id = Number(body?.id);
  const clean = cleanName(body?.name);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Combattant invalide' }, 400);
  if (!clean) return json({ error: 'Le nom du combattant est requis' }, 400);

  const edition = await getEdition();
  const d = await getDb();

  const others = await d.execute({
    sql: 'SELECT id, name FROM fighters WHERE edition_id = ? AND id <> ?',
    args: [edition.id, id],
  });
  const clash = (others.rows as unknown as { id: number; name: string }[]).find(
    (f) => normalize(f.name) === normalize(clean),
  );
  if (clash) return json({ error: `Le nom « ${clash.name} » est déjà inscrit` }, 409);

  // Renaming after the draw would relabel fighters already published in results.
  const started = await d.execute({
    sql: 'SELECT COUNT(*) AS n FROM matches WHERE edition_id = ?',
    args: [edition.id],
  });
  if (Number(started.rows[0].n) > 0) {
    return json({ error: 'Le tirage a eu lieu : le nom ne peut plus être modifié' }, 409);
  }

  const r = await d.execute({
    sql: 'UPDATE fighters SET name = ? WHERE id = ? AND edition_id = ?',
    args: [clean, id, edition.id],
  });
  if (r.rowsAffected === 0) return json({ error: 'Combattant introuvable' }, 404);

  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();

  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'Identifiant requis' }, 400);

  const d = await getDb();
  const edition = await getEdition();
  const started = await d.execute({
    sql: 'SELECT COUNT(*) AS n FROM matches WHERE edition_id = ?',
    args: [edition.id],
  });
  if (Number(started.rows[0].n) > 0) {
    return json({ error: 'Le tirage a eu lieu : les combattants ne peuvent plus être retirés' }, 409);
  }

  const r = await d.execute({
    sql: 'DELETE FROM fighters WHERE id = ? AND edition_id = ?',
    args: [id, edition.id],
  });
  if (r.rowsAffected === 0) return json({ error: 'Combattant introuvable' }, 404);

  return json({ ok: true });
};
