import type { APIRoute } from 'astro';
import { isAdmin } from '../../../../lib/auth.js';
import { closeReport } from '../../../../lib/catalog-store.js';

export const POST: APIRoute = async ({ cookies, params }) => {
  if (!isAdmin(cookies)) return Response.json({ error: 'forbidden' }, { status: 403 });
  const report = await closeReport(params.id!);
  if (!report) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json(report);
};
