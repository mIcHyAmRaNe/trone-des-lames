import type { APIRoute } from 'astro';
import { isAdmin } from '../../lib/auth';
import { readRkSession } from '../../lib/rk-session';
import { addSubmission, readSubmissions } from '../../lib/store';

const numArray = (v: unknown): number[] | null => {
  if (!Array.isArray(v)) return null;
  const out = v.map(Number);
  if (out.some((n) => !Number.isFinite(n))) throw new Error('invalid number');
  return out;
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const rk = readRkSession(cookies);
  if (!rk) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const submittedBy = rk.login;
  let body: { item?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
  const item = body?.item;
  if (!item || typeof item !== 'object') return Response.json({ error: 'missing item' }, { status: 400 });
  const nom = typeof item.nom === 'string' ? item.nom.trim() : '';
  const slot = typeof item.slot === 'string' ? item.slot.trim() : '';
  const sexes = Array.isArray(item.sexes) ? item.sexes.filter((s) => s === 'M' || s === 'F') : [];
  let zIndex: number[];
  let declinaisons: number[];
  try {
    zIndex = numArray(item.zIndex) ?? [];
    declinaisons = numArray(item.declinaisons) ?? [];
  } catch {
    return Response.json({ error: 'invalid item' }, { status: 400 });
  }
  if (!nom || !slot || !sexes.length || !zIndex.length) {
    return Response.json({ error: 'invalid item' }, { status: 400 });
  }
  if (readSubmissions().filter((s) => s.status === 'pending' && s.submittedBy === submittedBy).length >= 20) {
    return Response.json({ error: 'too many pending submissions' }, { status: 429 });
  }
  const s = addSubmission({
    id: crypto.randomUUID(),
    status: 'pending',
    submittedBy,
    submittedAt: new Date().toISOString(),
    item: {
      nom,
      nameEn: typeof item.nameEn === 'string' && item.nameEn.trim() ? item.nameEn.trim() : undefined,
      nameFr: typeof item.nameFr === 'string' && item.nameFr.trim() ? item.nameFr.trim() : undefined,
      slot,
      sexes: [...new Set(sexes)] as ('M' | 'F')[],
      declinaisons,
      zIndex,
      slotsMasques: Array.isArray(item.slotsMasques) ? item.slotsMasques.map(String) : undefined,
      dependCouleurPeau: item.dependCouleurPeau === true,
      dependPostureMainG: item.dependPostureMainG === true,
      dependPostureMainD: item.dependPostureMainD === true,
      sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
      note: typeof item.note === 'string' ? item.note : undefined,
    },
  });
  return Response.json({ ok: true, id: s.id });
};

export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return Response.json({ error: 'forbidden' }, { status: 403 });
  const status = url.searchParams.get('status');
  const all = readSubmissions().sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  return Response.json(status ? all.filter((s) => s.status === status) : all);
};
