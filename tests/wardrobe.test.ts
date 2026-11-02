import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MULTI_SLOTS,
  SECTIONS,
  countEquipped,
  entryFrom,
  indexBySlot,
  itemHaystack,
  itemLabel,
  multiSlotsOf,
  orphanSlots,
  removeEntry,
  slotLabel,
  toLoadout,
  upsert,
  type Catalog,
  type CatalogItem,
} from '../src/lib/wardrobe.ts';
import {
  clearRkSession,
  readRkSession,
  setRkSession,
  type RkSession,
} from '../src/lib/rk-session.ts';

// --- 1. Le catalogue livré couvre tous les slots connus
{
  const catalog = JSON.parse(readFileSync('public/rk/catalog.json', 'utf8')) as Catalog;
  const items = [...catalog.sexes.M, ...catalog.sexes.F];
  assert.ok(catalog.sexes.M.length > 800, 'catalogue masculin présent');
  assert.ok(catalog.sexes.F.length > 800, 'catalogue féminin présent');
  const slots = new Set(items.map((i) => i.slot));
  assert.deepEqual(orphanSlots(slots), [], 'aucun slot orphelin');
  for (const item of items) {
    assert.ok(Array.isArray(item.declinaisons), `${item.id}: déclinaisons`);
    assert.ok(Array.isArray(item.zIndex), `${item.id}: zIndex`);
  }
  console.log('✓ catalogue complet, slots classés');
}

// --- 2. Libellés et recherche
{
  const item: CatalogItem = JSON.parse(readFileSync('public/rk/catalog.json', 'utf8')).sexes.M[0];
  assert.equal(itemLabel(item), item.nameFr ?? item.nameEn ?? item.nom);
  assert.equal(slotLabel('MainGauche'), 'Main gauche');
  assert.equal(slotLabel('Pelle'), 'Pelle');
  assert.equal(slotLabel('Inconnu'), 'Inconnu');
  assert.ok(itemHaystack(item).includes(item.nom.toLowerCase()));
  console.log('✓ libellés + recherche');
}

// --- 3. item -> entrée d'équipement
{
  const item: CatalogItem = {
    id: '42', nom: 'gilet', slot: 'Gilet', slotGardeRobe: null, miniature: 'o',
    declinaisons: [0, 2], zIndex: [2601], dependCouleurPeau: false,
    dependPostureMainG: false, dependPostureMainD: false, slotsMasques: [], nameEn: 'Vest', nameFr: 'Gilet',
  };
  const entry = entryFrom(item, 2);
  assert.equal(entry.idItem, '42');
  assert.equal(entry.declinaison, 2);
  assert.deepEqual(entry.zIndexCalques, [2601]);
  assert.equal(entry.postureMainG, null);
  console.log('✓ entrée Midas');
}

// --- 4. Loadout : cumul, remplacement, retrait
{
  const item = (id: string, slot = 'Familier'): CatalogItem => ({
    id, nom: id, slot, slotGardeRobe: null, miniature: 'o',
    declinaisons: [0], zIndex: [1], dependCouleurPeau: false,
    dependPostureMainG: false, dependPostureMainD: false, slotsMasques: [],
    nameEn: null, nameFr: id,
  });
  const chat = entryFrom(item('chat'), 0);
  const chien = entryFrom(item('chien'), 0);
  const equipement = [chat, chien, entryFrom(item('cape', 'Cape'), 0)];
  assert.deepEqual(orphanSlots(['Cape', 'Familier', 'Inconnu']), ['Inconnu']);
  assert.deepEqual([...multiSlotsOf(equipement)], ['Familier']);
  assert.ok(MULTI_SLOTS.has('Familier'));

  let loadout = toLoadout(equipement);
  assert.equal(loadout.Familier.length, 2);
  assert.equal(countEquipped(loadout), 3);

  loadout = upsert(loadout, 'Familier', { ...chat, declinaison: 1 });
  assert.equal(loadout.Familier.length, 2, 'même idItem remplacé, pas dupliqué');
  assert.equal(loadout.Familier.find((e) => e.idItem === 'chat')?.declinaison, 1);

  loadout = removeEntry(loadout, 'Familier', 'chat');
  assert.equal(loadout.Familier.length, 1);
  loadout = removeEntry(loadout, 'Familier', 'chien');
  assert.equal(loadout.Familier, undefined, 'slot vide supprimé');
  console.log('✓ loadout');
}

// --- 5. Tri par slot
{
  const items: CatalogItem[] = ['Zèbre', 'abeille', 'Castor'].map((nameFr, i) => ({
    id: String(i), nom: nameFr.toLowerCase(),
    slot: 'Chapeau', slotGardeRobe: null, miniature: 'o', declinaisons: [0], zIndex: [1],
    dependCouleurPeau: false, dependPostureMainG: false, dependPostureMainD: false,
    slotsMasques: [], nameEn: null, nameFr,
  }));
  const buckets = indexBySlot(items);
  assert.deepEqual(buckets.get('Chapeau')?.map(itemLabel), ['abeille', 'Castor', 'Zèbre']);
  console.log('✓ tri alphabétique');
}

// --- 6. Sections
{
  assert.ok(SECTIONS.some((s) => s.hidden));
  const claimed = SECTIONS.flatMap((s) => s.slots);
  assert.equal(new Set(claimed).size, claimed.length, 'aucun slot en double');
  console.log('✓ sections');
}

// --- 7. Cookie de session chiffré
{
  process.env.ADMIN_SECRET = 'test-secret';
  const jar = new Map<string, string>();
  const cookies = {
    get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  } as unknown as Parameters<typeof setRkSession>[0];

  const session: RkSession = { login: 'Dame_Isabelle', gameCookie: 'KC=abc; PHPSESSID=xyz' };
  setRkSession(cookies, session);
  assert.deepEqual(readRkSession(cookies), session);
  assert.ok(!jar.get('tdl_rk')!.includes('Dame_Isabelle'), 'le contenu est chiffré');

  // Falsification : un octet modifié invalide l'authentification GCM.
  const raw = jar.get('tdl_rk')!;
  jar.set('tdl_rk', raw.slice(0, -2) + (raw.endsWith('A') ? 'B' : 'A'));
  assert.equal(readRkSession(cookies), null);

  // Expiration.
  setRkSession(cookies, session);
  const realNow = Date.now;
  Date.now = () => realNow() + 2 * 60 * 60 * 1000;
  assert.equal(readRkSession(cookies), null);
  Date.now = realNow;

  setRkSession(cookies, session);
  clearRkSession(cookies);
  assert.equal(readRkSession(cookies), null);
  console.log('✓ session chiffrée');
}

console.log('\nGarde-robe : tous les tests passent.');
