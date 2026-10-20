import type { APIRoute } from 'astro';
import { json } from '../../lib/auth';
import { getTournamentState } from '../../lib/state';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug') ?? 'classique';
  try {
    return json(await getTournamentState(slug));
  } catch (e) {
    if (e instanceof Error && e.message === 'Edition introuvable') {
      return json({ error: 'Édition introuvable' }, 404);
    }
    throw e;
  }
};
