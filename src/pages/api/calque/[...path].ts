import type { APIRoute } from 'astro';

// Proxy des calques. Le navigateur ne peut pas charger le CDN du jeu
// directement : un fichier absent répond 404 sans Access-Control-Allow-Origin,
// ce que Chrome traite comme une erreur CORS, et nous n'aurions aucune cache
// maîtrisée. Passer par ici rend chaque calque same-origin et silencieux.
//
// Un calque manquant renvoie un GIF transparent 1×1 en 200 : midas.js croit le
// chargement réussi et ne dessine rien, comme le client officiel.
// ponytail: ce choix troque le repli « portrait personnalisé » de midas.js
// (il ne masque le visage générique que si ses deux calques chargent, et un faux
// 200 les fait « charger ») contre une console propre. Ne concerne que les
// codeVisage commençant par « P ». Renvoyer 404 si un jour ce cas compte.

const CDN = 'https://lesroyaumes.cdn.oxv.fr/images/personnages_midas/';
const TIMEOUT_MS = 10_000;
// GIF transparent 1×1. atob évite d'importer Buffer pour trois octets.
const TRANSPARENT_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (c) => c.charCodeAt(0),
);

const MIME: Record<string, string> = { webp: 'image/webp', png: 'image/png', gif: 'image/gif' };

// midas.js construit cinq racines : {sexe}/corps et {sexe}/vetements, plus
// fonds/ et cadres/ (sans segment de sexe) et portraitsPersonnalises/.
const ALLOWED_ROOTS = /^(hommes|femmes|fonds|cadres|portraitsPersonnalises)\//;

export const GET: APIRoute = async ({ params }) => {
  const raw = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  // midas.js émet une double barre pour les vêtements (`${racine}/vetements/`) :
  // on la replie, puis on refuse tout ce qui sortirait du préfixe CDN.
  const clean = raw.replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
  if (!clean || clean.includes('..') || !/^[A-Za-z0-9_@./-]+$/.test(clean) || !ALLOWED_ROOTS.test(clean)) {
    return new Response('calque invalide', { status: 400 });
  }

  const upstream = await fetch(CDN + clean, {
    headers: { 'user-agent': 'trone-des-lames' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);

  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  const type = MIME[ext] ?? 'application/octet-stream';
  // Les noms de calques sont adressés par contenu (objet + variante + calque +
  // résolution) : une URL donnée ne change jamais de sens.
  const cache = 'public, max-age=604800, s-maxage=604800, immutable';

  if (upstream?.ok) {
    return new Response(upstream.body, {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': cache },
    });
  }

  if (clean.startsWith('portraitsPersonnalises/')) {
    return new Response('introuvable', { status: 404 });
  }

  return new Response(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': cache,
      'X-Calque-Missing': clean,
    },
  });
};
