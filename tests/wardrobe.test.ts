import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATEGORIES,
  FAMILIES,
  assetStyleNumber,
  SINGLE_CATEGORIES,
  categoryLabel,
  categoryOf,
  countEquipped,
  entriesInCategory,
  entryFrom,
  familyOf,
  indexByCategory,
  isMultiCategory,
  itemHaystack,
  itemLabel,
  orphanSlots,
  removeCategory,
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
import {
  BODY_FIELDS,
  DEFAULT_CODE_VISAGE,
  codeVisageValue,
  normalizeCodeVisage,
  setCodeVisageSex,
  setCodeVisageValue,
} from '../src/lib/wardrobe.ts';

// --- 1. Le catalogue livré couvre tous les slots connus
{
  const catalog = JSON.parse(readFileSync('public/rk/catalog.json', 'utf8')) as Catalog;
  const items = [...catalog.sexes.M, ...catalog.sexes.F];
  assert.ok(catalog.sexes.M.length > 800, 'catalogue masculin présent');
  assert.ok(catalog.sexes.F.length > 800, 'catalogue féminin présent');
  const slots = new Set(items.map((i) => i.slot));
  assert.deepEqual(orphanSlots(slots), [], 'aucun slot orphelin');
  const categories = new Set(items.map(categoryOf));
  for (const category of categories) {
    assert.ok(
      CATEGORIES.some((c) => c.key === category),
      `catégorie inconnue du jeu : ${category}`,
    );
  }
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
  assert.ok(item.nom);
  assert.ok(itemHaystack(item).includes(item.nom.toLowerCase()));
  assert.equal(assetStyleNumber('coiffure12', 'coiffure'), 12);
  assert.equal(assetStyleNumber('barbe3', 'barbe'), 3);
  assert.equal(assetStyleNumber('casquette', 'coiffure'), null);
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
  assert.equal(entry.slotGardeRobe, null);
  console.log('✓ entrée Midas');
}

// --- 4. Loadout : cumul, remplacement, retrait, catégories du jeu
{
  const item = (id: string, slot: string, slotGardeRobe: string | null): CatalogItem => ({
    id, nom: id, slot, slotGardeRobe, miniature: 'o',
    declinaisons: [0], zIndex: [1], dependCouleurPeau: false,
    dependPostureMainG: false, dependPostureMainD: false, slotsMasques: [],
    nameEn: null, nameFr: id,
  });
  const chat = entryFrom(item('chat', 'Familier', 'Familiers'), 0);
  const chien = entryFrom(item('chien', 'Familier', 'Familiers'), 0);
  const cape = entryFrom(item('cape', 'Cape', 'Capes'), 0);
  assert.deepEqual(orphanSlots(['Cape', 'Familier', 'Inconnu']), ['Inconnu']);
  assert.equal(categoryOf(chat), 'Familiers');
  assert.equal(categoryOf({ slot: 'Panoplie', slotGardeRobe: null }), 'Panoplies');
  assert.ok(isMultiCategory('Familiers'));
  assert.ok(!isMultiCategory('Armes'));
  assert.ok(isMultiCategory('Chapeaux') && isMultiCategory('Bijoux'));

  let loadout = toLoadout([chat, chien, cape]);
  assert.equal(loadout.Familier.length, 2);
  assert.equal(countEquipped(loadout), 3);
  assert.deepEqual(entriesInCategory(loadout, 'Familiers').map((e) => e.idItem), ['chat', 'chien']);

  loadout = upsert(loadout, 'Familier', { ...chat, declinaison: 1 });
  assert.equal(loadout.Familier.length, 2, 'même idItem remplacé, pas dupliqué');
  assert.equal(loadout.Familier.find((e) => e.idItem === 'chat')?.declinaison, 1);

  loadout = removeCategory(loadout, 'Familiers');
  assert.equal(loadout.Familier, undefined, 'catégorie vidée, slot supprimé');
  assert.equal(countEquipped(loadout), 1, 'la cape est conservée');

  loadout = upsert(loadout, 'Familier', chat);
  loadout = removeEntry(loadout, 'Familier', 'chat');
  assert.equal(loadout.Familier, undefined);
  console.log('✓ loadout + catégories');
}

// --- 5. Tri par catégorie
{
  const items: CatalogItem[] = ['Zèbre', 'abeille', 'Castor'].map((nameFr, i) => ({
    id: String(i), nom: nameFr.toLowerCase(),
    slot: 'Chapeau', slotGardeRobe: 'Chapeaux', miniature: 'o', declinaisons: [0], zIndex: [1],
    dependCouleurPeau: false, dependPostureMainG: false, dependPostureMainD: false,
    slotsMasques: [], nameEn: null, nameFr,
  }));
  const buckets = indexByCategory(items);
  assert.deepEqual(buckets.get('Chapeaux')?.map((item) => itemLabel(item)), ['abeille', 'Castor', 'Zèbre']);
  console.log('✓ tri alphabétique par catégorie');
}

// --- 6. Catégories identiques à la garde-robe du jeu
{
  // 30 slots de #onglet2Panel, dans l'ordre du jeu.
  assert.equal(CATEGORIES.length, 30);
  assert.equal(new Set(CATEGORIES.map((c) => c.key)).size, 30, 'clés uniques');
  assert.equal(new Set(CATEGORIES.map((c) => c.label)).size, 30, 'libellés uniques');
  assert.equal(CATEGORIES[0].key, 'Chapeaux');
  assert.equal(CATEGORIES.at(-1)?.key, 'Boucliers');
  // data-limite="1" du jeu : un seul objet par catégorie.
  assert.deepEqual(
    [...SINGLE_CATEGORIES],
    ['Coiffures', 'Barbes', 'Fonds', 'Cadres', 'Outils_barque', 'Outils_filet', 'Outils_echelle', 'Armes', 'Boucliers'],
  );
  assert.equal(categoryLabel('BasDessous'), 'Bas et dessous');
  assert.equal(categoryLabel('Inconnue'), 'Inconnue');
  console.log('✓ catégories du jeu');
}

// --- 7. Familles de navigation : chaque catégorie dans exactement une famille
{
  const seen = new Set<string>();
  for (const family of FAMILIES) {
    assert.ok(family.categories.length > 0, `${family.key}: famille non vide`);
    for (const key of family.categories) {
      assert.ok(!seen.has(key), `${key}: rangée dans deux familles`);
      seen.add(key);
      assert.ok(
        CATEGORIES.some((c) => c.key === key),
        `${key}: catégorie inconnue du jeu`,
      );
      assert.equal(familyOf(key)?.key, family.key, `${key}: familyOf`);
    }
  }
  assert.deepEqual(
    [...seen].sort(),
    CATEGORIES.map((c) => c.key).sort(),
    'toutes les catégories sont rangées',
  );
  assert.deepEqual(
    FAMILIES.map((f) => f.key),
    ['corps', 'vetements', 'equipements', 'familiers', 'decors'],
    'ordre des familles stable',
  );
  assert.equal(familyOf('Inconnue'), undefined);
  console.log('✓ familles de navigation');
}

// --- 8. Code visage : lecture et écriture des attributs du corps
{
  assert.equal(DEFAULT_CODE_VISAGE.M.length, 21);
  assert.equal(DEFAULT_CODE_VISAGE.F[0], 'F');

  // Code réel du jeu (21 caractères : sexe + 20 chiffres).
  const real = 'M50241317230001400033';
  assert.equal(codeVisageValue(real, 1), 5);
  assert.equal(codeVisageValue(real, 14), 1);
  assert.equal(codeVisageValue(real, 20), 3);

  // Modifier un chiffre laisse tous les autres intacts.
  const edited = setCodeVisageValue(real, 11, 4);
  assert.equal(edited[11], '4');
  assert.equal(edited.slice(0, 11), real.slice(0, 11));
  assert.equal(edited.slice(12), real.slice(12));

  // Les anciens codes courts sont complétés par des zéros, le sexe suit.
  const short = 'M010000000010000';
  assert.equal(normalizeCodeVisage(short).length, 21);
  assert.equal(codeVisageValue(normalizeCodeVisage(short), 15), 0);
  assert.equal(setCodeVisageSex(short, 'F')[0], 'F');

  // Chaque valeur proposée par le formulaire se relit sans perte.
  for (const field of BODY_FIELDS) {
    const values =
      field.values ?? Array.from({ length: field.max - field.min + 1 }, (_, i) => field.min + i);
    for (const value of values) {
      const code = setCodeVisageValue(real, field.index, value);
      assert.equal(codeVisageValue(code, field.index), value, field.label);
    }
  }
  console.log('✓ code visage');
}

// --- 9. Cookie de session chiffré
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
