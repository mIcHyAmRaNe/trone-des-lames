import type { APIRoute } from 'astro';
import { json } from '../../../lib/auth';
import { readRkSession } from '../../../lib/rk-session';

export const GET: APIRoute = async ({ cookies }) => {
  return json({ player: readRkSession(cookies)?.login ?? null });
};
