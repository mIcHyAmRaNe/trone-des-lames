import type { APIRoute } from 'astro';
import { loadMergedCatalog } from '../../lib/catalog-store.js';

export const GET: APIRoute = async () => {
  try {
    const catalog = await loadMergedCatalog();
    return new Response(JSON.stringify(catalog), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[api/catalog]', e);
    // Dégradé : servir le catalogue de base statique
    const base = await import('../../../public/rk/catalog.json', { with: { type: 'json' } });
    return new Response(JSON.stringify(base.default), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'x-catalog-degraded': 'true',
      },
    });
  }
};