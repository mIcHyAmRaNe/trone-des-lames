import type { APIRoute } from 'astro';
import { json } from '../../../lib/auth';
import { clearRkSession } from '../../../lib/rk-session';

export const POST: APIRoute = async ({ cookies }) => {
  clearRkSession(cookies);
  return json({ ok: true });
};
