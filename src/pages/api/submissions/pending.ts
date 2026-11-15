import type { APIRoute } from 'astro';
import { pendingKeys } from '../../../lib/catalog-store.js';

/** Public : permet au catalogue d'afficher « en attente » sans connaître le visiteur. */
export const GET: APIRoute = async () => Response.json(await pendingKeys());
