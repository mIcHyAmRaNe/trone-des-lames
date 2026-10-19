import type { APIRoute } from 'astro';
import { getDb, getEdition } from '../../../lib/db';
import { isAdmin, json, unauthorized } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();
  const { name } = (await request.json()) as { name?: string };
  const clean = name?.trim().slice(0, 40);
  if (!clean) return json({ error: 'Nom requis' }, 400);

  const edition = await getEdition();
  const d = await getDb();
  const count = await d.execute({
    sql: 'SELECT COUNT(*) AS n FROM fighters WHERE edition_id = ?',
    args: [edition.id],
  });
  if (Number(count.rows[0].n) >= 16) return json({ error: 'Seize combattants maximum' }, 400);

  const r = await d.execute({
    sql: 'INSERT INTO fighters (edition_id, name) VALUES (?, ?)',
    args: [edition.id, clean],
  });
  return json({ id: Number(r.lastInsertRowid) }, 201);
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();
  const { id, name } = (await request.json()) as { id?: number; name?: string };
  const clean = name?.trim().slice(0, 40);
  if (!id || !clean) return json({ error: 'Données invalides' }, 400);

  const d = await getDb();
  await d.execute({ sql: 'UPDATE fighters SET name = ? WHERE id = ?', args: [clean, id] });
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return unauthorized();
  const id = Number(url.searchParams.get('id'));
  if (!id) return json({ error: 'Identifiant requis' }, 400);

  const d = await getDb();
  const edition = await getEdition();
  const started = await d.execute({
    sql: 'SELECT COUNT(*) AS n FROM matches WHERE edition_id = ?',
    args: [edition.id],
  });
  if (Number(started.rows[0].n) > 0) return json({ error: 'Le tournoi a commencé' }, 409);

  await d.execute({ sql: 'DELETE FROM fighters WHERE id = ? AND edition_id = ?', args: [id, edition.id] });
  return json({ ok: true });
};
