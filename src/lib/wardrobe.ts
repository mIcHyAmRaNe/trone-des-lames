// Catalogue de la garde-robe. `public/rk/catalog.json` est généré par
// scripts/catalog.mjs (bootstrap = instantané ryence.de, refresh = jeu en direct).
// Fichier statique : son URL est l'API que lit le navigateur.

import type { Lang } from '../i18n/index.ts';

export type Sexe = 'M' | 'F';

export interface CatalogItem {
  id: string;
  /**
   * Nom de base de l'image Midas, ex. « gilet »  -  interpolé dans l'URL du CDN.
   * `null` pour un objet relevé au wiki dont l'asset n'est pas encore connu :
   * il figure au catalogue pour être complété, mais ne peut pas être porté.
   */
  nom: string | null;
  slot: string;
  slotGardeRobe: string | null;
  miniature: string;
  declinaisons: number[];
  zIndex: number[];
  dependCouleurPeau: boolean;
  dependPostureMainG: boolean;
  dependPostureMainD: boolean;
  slotsMasques: string[];
  nameEn: string | null;
  nameFr: string | null;
  /**
   * Chemins CDN exacts relevés sur le wiki (relatifs à `CDN_ROOT`), pour les
   * objets dont l'URL ne se déduit pas du nom d'asset (variantes, extension).
   */
  cdn?: string[];
}

export interface Catalog {
  source?: string;
  generatedAt: string;
  refreshedAt?: string;
  sexes: Record<Sexe, CatalogItem[]>;
}

/** Une entrée du tableau `equipement` d'un portrait Midas, telle que servie par le jeu. */
export interface EquipEntry {
  idItem: string;
  declinaison: number;
  nom: string;
  slot: string;
  /** Catégorie d'armoire du jeu (ex. « Armes »)  -  le jeu la fournit sur la fiche. */
  slotGardeRobe?: string | null;
  miniature: string;
  declinaisons: number[];
  slotsMasques: string[];
  dependCouleurPeau: boolean;
  dependPostureMainG: boolean;
  dependPostureMainD: boolean;
  postureMainG: number | null;
  postureMainD: number | null;
  zIndexCalques: number[];
}

export interface Avatar {
  login: string;
  sexe: string;
  codeVisage: string;
  equipement: Partial<EquipEntry>[];
  alterationsMidas?: { Type: string; Value: string }[];
}

/**
 * Catégories de la garde-robe, identiques à celles du jeu (ordre des slots de
 * `#onglet2Panel`, clé = `slotGardeRobe`). `single` reprend `data-limite="1"` :
 * ces catégories n'acceptent qu'un objet à la fois ; les autres se cumulent.
 */
export interface CategoryDef {
  key: string;
  label: string;
  single?: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'Chapeaux', label: 'Chapeaux' },
  { key: 'Casques', label: 'Casques' },
  { key: 'Coiffures', label: 'Coiffures', single: true },
  { key: 'Barbes', label: 'Barbes', single: true },
  { key: 'Tabliers', label: 'Tabliers' },
  { key: 'Gilets', label: 'Gilets' },
  { key: 'Mantels', label: 'Mantels' },
  { key: 'Capes', label: 'Capes' },
  { key: 'Braies', label: 'Braies' },
  { key: 'Jupes', label: 'Jupes' },
  { key: 'Chemises', label: 'Chemises' },
  { key: 'Bustiers', label: 'Bustiers' },
  { key: 'Chaussures', label: 'Chaussures' },
  { key: 'BasDessous', label: 'Bas et dessous' },
  { key: 'Panoplies', label: 'Panoplies' },
  { key: 'Bijoux', label: 'Bijoux' },
  { key: 'Cou', label: 'Cou' },
  { key: 'Ceintures', label: 'Ceintures' },
  { key: 'Yeux', label: 'Yeux' },
  { key: 'Gants', label: 'Gants' },
  { key: 'MainGauche', label: 'Main gauche' },
  { key: 'MainDroite', label: 'Main droite' },
  { key: 'Fonds', label: 'Fonds', single: true },
  { key: 'Cadres', label: 'Cadres', single: true },
  { key: 'Familiers', label: 'Familiers' },
  { key: 'Outils_barque', label: 'Barque', single: true },
  { key: 'Outils_filet', label: 'Filet de pêche', single: true },
  { key: 'Outils_echelle', label: 'Échelle', single: true },
  { key: 'Armes', label: 'Armes', single: true },
  { key: 'Boucliers', label: 'Boucliers', single: true },
];

/**
 * Familles de navigation : les 30 catégories du jeu regroupées par usage.
 * L'ordre de ce tableau est celui de la barre d'onglets  -  ne pas le changer.
 */
export interface FamilyDef {
  key: string;
  label: string;
  categories: string[];
}

export const FAMILIES: FamilyDef[] = [
  {
    key: "corps",
    label: "Corps",
    categories: ["Coiffures", "Barbes", "Yeux", "Chapeaux", "Casques"],
  },
  {
    key: "vetements",
    label: "Vêtements",
    categories: [
      "Tabliers",
      "Gilets",
      "Mantels",
      "Capes",
      "Braies",
      "Jupes",
      "Chemises",
      "Bustiers",
      "Chaussures",
      "BasDessous",
      "Panoplies",
    ],
  },
  {
    key: "equipements",
    label: "Équipements",
    categories: [
      "Bijoux",
      "Cou",
      "Ceintures",
      "Gants",
      "MainGauche",
      "MainDroite",
      "Armes",
      "Boucliers",
      "Outils_barque",
      "Outils_filet",
      "Outils_echelle",
    ],
  },
  { key: "familiers", label: "Familiers", categories: ["Familiers"] },
  { key: "decors", label: "Décors", categories: ["Fonds", "Cadres"] },
];

const FAMILY_BY_CATEGORY = new Map(
  FAMILIES.flatMap((f) => f.categories.map((c) => [c, f] as const)),
);

/** Famille d'une catégorie, ou `undefined` si elle n'est rangée nulle part. */
export function familyOf(category: string): FamilyDef | undefined {
  return FAMILY_BY_CATEGORY.get(category);
}

/** Repli quand une fiche n'a pas de `slotGardeRobe` (l'objet 0, par exemple). */
const SLOT_CATEGORY: Record<string, string> = {
  Arme: 'Armes',
  Barbes: 'Barbes',
  Barque: 'Outils_barque',
  Bas: 'BasDessous',
  Baton: 'Armes',
  Bijoux: 'Bijoux',
  Bouclier: 'Boucliers',
  Braies: 'Braies',
  Bustier: 'Bustiers',
  Cadre: 'Cadres',
  Cape: 'Capes',
  Ceinture: 'Ceintures',
  Chapeau: 'Chapeaux',
  Chaussures: 'Chaussures',
  Chemise: 'Chemises',
  Coiffures: 'Coiffures',
  Col: 'Cou',
  Collier: 'Bijoux',
  Crosse: 'Armes',
  Echelle: 'Outils_echelle',
  Epee: 'Armes',
  Familier: 'Familiers',
  FiletPeche: 'Outils_filet',
  Fond: 'Fonds',
  Gants: 'Gants',
  Gilet: 'Gilets',
  Hache: 'Armes',
  Jupe: 'Jupes',
  MainDroite: 'MainDroite',
  MainGauche: 'MainGauche',
  Mantel: 'Mantels',
  Objet: 'MainDroite',
  Objet2: 'MainDroite',
  Panoplie: 'Panoplies',
  Pelle: 'Armes',
  Pioche: 'Armes',
  Robe: 'Mantels',
  Tablier: 'Tabliers',
  Yeux: 'Yeux',
};

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

/** Libellés anglais des 30 catégories du jeu (mêmes clés, ordre inchangé). */
const CATEGORY_LABELS_EN: Record<string, string> = {
  Chapeaux: 'Hats',
  Casques: 'Helmets',
  Coiffures: 'Hair',
  Barbes: 'Beards',
  Tabliers: 'Aprons',
  Gilets: 'Vests',
  Mantels: 'Cloaks',
  Capes: 'Capes',
  Braies: 'Breeches',
  Jupes: 'Skirts',
  Chemises: 'Shirts',
  Bustiers: 'Bodices',
  Chaussures: 'Shoes',
  BasDessous: 'Underwear & hosiery',
  Panoplies: 'Outfits',
  Bijoux: 'Jewellery',
  Cou: 'Neck',
  Ceintures: 'Belts',
  Yeux: 'Eyes',
  Gants: 'Gloves',
  MainGauche: 'Left hand',
  MainDroite: 'Right hand',
  Fonds: 'Backdrops',
  Cadres: 'Frames',
  Familiers: 'Companions',
  Outils_barque: 'Boat',
  Outils_filet: 'Fishing net',
  Outils_echelle: 'Ladder',
  Armes: 'Weapons',
  Boucliers: 'Shields',
};

/** Libellés anglais des familles de navigation. */
const FAMILY_LABELS_EN: Record<string, string> = {
  corps: 'Body',
  vetements: 'Clothing',
  equipements: 'Equipment',
  familiers: 'Companions',
  decors: 'Scenery',
};

/** Catégorie d'affichage d'un objet ou d'une entrée d'équipement. */
export function categoryOf(item: { slot: string; slotGardeRobe?: string | null }): string {
  if (item.slotGardeRobe && CATEGORY_LABELS[item.slotGardeRobe]) return item.slotGardeRobe;
  return SLOT_CATEGORY[item.slot] ?? 'Autres';
}

export function categoryLabel(key: string, lang: Lang = 'fr'): string {
  if (lang === 'en') return CATEGORY_LABELS_EN[key] ?? CATEGORY_LABELS[key] ?? key;
  return CATEGORY_LABELS[key] ?? key;
}

export function familyLabel(key: string, lang: Lang = 'fr'): string {
  if (lang === 'en') return FAMILY_LABELS_EN[key] ?? key;
  return FAMILIES.find((f) => f.key === key)?.label ?? key;
}

/** Catégories à capacité un (`data-limite="1"` du jeu). */
export const SINGLE_CATEGORIES = new Set(CATEGORIES.filter((c) => c.single).map((c) => c.key));

export function isMultiCategory(key: string): boolean {
  return !SINGLE_CATEGORIES.has(key);
}

/** Libellés lisibles des clés techniques du catalogue. */
const SLOT_LABELS: Record<string, string> = {
  Arme: 'Arme',
  Barbes: 'Barbes',
  Barque: 'Barque',
  Bas: 'Sous-vêtements',
  Baton: 'Bâton',
  Bijoux: 'Bijoux',
  Bouclier: 'Bouclier',
  Braies: 'Braies',
  Bustier: 'Bustier',
  Cadre: 'Cadre',
  Cape: 'Cape',
  Ceinture: 'Ceinture',
  Chapeau: 'Chapeau',
  Chaussures: 'Chaussures',
  Chemise: 'Chemise',
  Coiffures: 'Coiffures',
  Col: 'Cou',
  Collier: 'Collier',
  Crosse: 'Crosse',
  Echelle: 'Échelle',
  Epee: 'Épée',
  Familier: 'Familier',
  FiletPeche: 'Filet de pêche',
  Fond: 'Fond',
  Gants: 'Gants',
  Gilet: 'Gilet',
  Hache: 'Hache',
  Jupe: 'Jupe',
  MainDroite: 'Main droite',
  MainGauche: 'Main gauche',
  Mantel: 'Mantel',
  Objet: 'Objet',
  Objet2: 'Objet secondaire',
  Panoplie: 'Panoplie',
  Pelle: 'Pelle',
  Pioche: 'Pioche',
  Robe: 'Robe',
  Tablier: 'Tablier',
  Yeux: 'Yeux',
};

const SLOT_LABELS_EN: Record<string, string> = {
  Arme: 'Weapon',
  Barbes: 'Beard',
  Barque: 'Boat',
  Bas: 'Underwear',
  Baton: 'Staff',
  Bijoux: 'Jewellery',
  Bouclier: 'Shield',
  Braies: 'Breeches',
  Bustier: 'Bodice',
  Cadre: 'Frame',
  Cape: 'Cape',
  Ceinture: 'Belt',
  Chapeau: 'Hat',
  Chaussures: 'Shoes',
  Chemise: 'Shirt',
  Coiffures: 'Hair',
  Col: 'Neck',
  Collier: 'Necklace',
  Crosse: 'Crozier',
  Echelle: 'Ladder',
  Epee: 'Sword',
  Familier: 'Companion',
  FiletPeche: 'Fishing net',
  Fond: 'Backdrop',
  Gants: 'Gloves',
  Gilet: 'Vest',
  Hache: 'Axe',
  Jupe: 'Skirt',
  MainDroite: 'Right hand',
  MainGauche: 'Left hand',
  Mantel: 'Cloak',
  Objet: 'Item',
  Objet2: 'Secondary item',
  Panoplie: 'Outfit',
  Pelle: 'Shovel',
  Pioche: 'Pickaxe',
  Robe: 'Robe',
  Tablier: 'Apron',
  Yeux: 'Eyes',
};

export function slotLabel(slot: string, lang: Lang = 'fr'): string {
  if (lang === 'en') return SLOT_LABELS_EN[slot] ?? SLOT_LABELS[slot] ?? slot;
  return SLOT_LABELS[slot] ?? slot;
}

export const SEXE_LABEL: Record<Sexe, string> = { M: 'Homme', F: 'Femme' };

export function sexeLabel(sexe: Sexe, lang: Lang = 'fr'): string {
  if (lang === 'en') return sexe === 'M' ? 'Man' : 'Woman';
  return SEXE_LABEL[sexe];
}

/**
 * Attributs du visage encodés dans `codeVisage` (mêmes plages que la garde-robe
 * du jeu). L'index 0 porte le sexe ; les autres sont des chiffres 0-9.
 * Les index 13 (style de barbe), 17 (iris) et 21 (addition) existent dans le
 * code mais ne sont pas éditables, comme dans la garde-robe de référence.
 */
export interface BodyField {
  key: string;
  label: string;
  /** Libellé anglais, affiché quand la langue vaut `en`. */
  labelEn: string;
  index: number;
  min: number;
  max: number;
  /** Liste explicite quand les valeurs ne sont pas contiguës. */
  values?: number[];
  maleOnly?: boolean;
}

export const BODY_FIELDS: BodyField[] = [
  { key: 'visage', label: 'Visage', labelEn: 'Face', index: 1, min: 0, max: 7 },
  { key: 'couleurPeau', label: 'Couleur de la peau', labelEn: 'Skin colour', index: 2, min: 0, max: 4 },
  { key: 'age', label: 'Âge', labelEn: 'Age', index: 3, min: 0, max: 7 },
  { key: 'sourcils', label: 'Sourcils', labelEn: 'Eyebrows', index: 4, min: 0, max: 6 },
  { key: 'couleurSourcils', label: 'Couleur des sourcils', labelEn: 'Eyebrow colour', index: 5, min: 0, max: 7 },
  { key: 'yeux', label: 'Yeux', labelEn: 'Eyes', index: 6, min: 0, max: 7 },
  { key: 'couleurYeux', label: 'Couleur des yeux', labelEn: 'Eye colour', index: 7, min: 0, max: 4 },
  { key: 'nez', label: 'Nez', labelEn: 'Nose', index: 8, min: 0, max: 7 },
  { key: 'bouche', label: 'Bouche', labelEn: 'Mouth', index: 9, min: 0, max: 7 },
  { key: 'couleurBouche', label: 'Couleur des lèvres', labelEn: 'Lip colour', index: 10, min: 0, max: 4 },
  { key: 'cheveux', label: 'Cheveux', labelEn: 'Hair', index: 11, min: 0, max: 6 },
  { key: 'couleurCheveux', label: 'Couleur des cheveux', labelEn: 'Hair colour', index: 12, min: 0, max: 7 },
  { key: 'couleurBarbe', label: 'Couleur de la barbe', labelEn: 'Beard colour', index: 14, min: 0, max: 7, maleOnly: true },
  { key: 'sourcilsEmotion', label: 'Sourcils (émotion)', labelEn: 'Eyebrows (emotion)', index: 15, min: 0, max: 4 },
  { key: 'yeuxEmotion', label: 'Yeux (émotion)', labelEn: 'Eyes (emotion)', index: 16, min: 0, max: 4 },
  { key: 'nezEmotion', label: 'Nez (émotion)', labelEn: 'Nose (emotion)', index: 18, min: 0, max: 2, values: [0, 2] },
  { key: 'boucheEmotion', label: 'Bouche (émotion)', labelEn: 'Mouth (emotion)', index: 19, min: 0, max: 4 },
  { key: 'barbeEmotion', label: 'Barbe (émotion)', labelEn: 'Beard (emotion)', index: 20, min: 0, max: 4, maleOnly: true },
];

/** Profil par défaut : même visage que la garde-robe de référence, sans objet. */
export const DEFAULT_CODE_VISAGE: Record<Sexe, string> = {
  M: 'M01000000001000000000',
  F: 'F01000000001000000000',
};

/** Code visage complet (sexe + 20 chiffres), les codes anciens étant complétés par des 0. */
export function normalizeCodeVisage(code: string | undefined, sexe: Sexe = 'M'): string {
  const raw = `${code ?? ''}`;
  const head = raw[0] === 'P' ? 'P' : raw[0] === 'F' ? 'F' : raw[0] === 'M' ? 'M' : sexe;
  const digits = raw.slice(1).replace(/\D/g, '').padEnd(20, '0').slice(0, 20);
  return head + digits;
}

export function codeVisageValue(code: string, index: number): number {
  return Number(code[index] ?? 0) || 0;
}

/** Remplace un chiffre sans toucher au reste du code (sexe compris). */
export function setCodeVisageValue(code: string, index: number, value: number): string {
  const base = normalizeCodeVisage(code);
  const digit = String(Math.max(0, Math.min(9, Math.trunc(value))));
  return base.slice(0, index) + digit + base.slice(index + 1);
}

export function setCodeVisageSex(code: string, sexe: Sexe): string {
  return sexe + normalizeCodeVisage(code, sexe).slice(1);
}

/** slot technique -> entrées portées. Midas dessine par slot, pas par catégorie. */
export type Loadout = Record<string, EquipEntry[]>;

/** Slots techniques inconnus du code, hors fiches pas encore complétées (`''`). */
export function orphanSlots(present: Iterable<string>): string[] {
  return [...present].filter((s) => s && !(s in SLOT_LABELS)).sort();
}

let catalogPromise: Promise<Catalog> | null = null;

/** Chargé une seule fois par page ; l'échec n'est pas mémorisé. */
export function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= fetch('/api/catalog')
    .then((r) => {
      if (!r.ok) throw new Error(`catalogue indisponible (HTTP ${r.status})`);
      return r.json() as Promise<Catalog>;
    })
    .catch(async () => {
      // Repli sur le fichier statique si la route API échoue (réseau, build statique, etc.)
      catalogPromise = null;
      const res = await fetch('/rk/catalog.json');
      if (!res.ok) throw new Error(`catalogue statique indisponible (HTTP ${res.status})`);
      return res.json() as Promise<Catalog>;
    });
  return catalogPromise;
}

export function itemLabel(item: CatalogItem, lang: Lang = 'fr'): string {
  if (lang === 'en') return item.nameEn ?? item.nameFr ?? item.nom ?? item.id;
  return item.nameFr ?? item.nameEn ?? item.nom ?? item.id;
}

/**
 * Numéro d'un asset de style (`coiffure12`, `barbe3`).
 * Le catalogue nomme certains articles sans libellé lisible : ce numéro permet
 * d'afficher « Coiffure 12 » et de fusionner les styles de base 0..6 avec leurs
 * équivalents catalogue.
 */
export function assetStyleNumber(nom: string | null, prefix: string): number | null {
  const match = nom?.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
  return match ? Number(match[1]) : null;
}

/** Un objet sans nom d'asset ne peut pas être dessiné par Midas. */
export function hasCdn(item: CatalogItem): boolean {
  return !!item.nom;
}

export function hasZIndex(item: CatalogItem): boolean {
  return item.zIndex.length > 0;
}

/** Fiche à compléter : asset CDN, z-index, ou les deux manquent. */
export function isIncomplete(item: CatalogItem): boolean {
  return !hasCdn(item) || !hasZIndex(item);
}

export const CDN_ROOT = 'https://lesroyaumes.cdn.oxv.fr/images/personnages_midas/';

/**
 * Toutes les URL CDN d'un objet, une par déclinaison, construites comme
 * `midas.js` — c'est la liste que montre le catalogue.
 * - fonds / cadres : racine sans segment de sexe (`fonds/`, `cadres/`).
 * - barbes / coiffures : les sprites de corps ne suivent pas la règle des
 *   vêtements. Une barbe est `corps/barbe_<style>_c<teinte>_e0`, une coiffure
 *   est découpée en deux calques `cheveuxArrieres` / `cheveuxAvants`.
 * - le reste : `nom[_d{teinte}][_p{peau}][_m{main G}][_n{main D}]_0_@1X.png`
 *   sous `{sexe}/vetements/`. Postures et peau figées à 0 : aperçu d'objet.
 */
export function midasAssetUrls(item: CatalogItem, sexe: Sexe): string[] {
  if (!item.nom) return [];
  // URL exacte relevée sur le wiki : elle fait foi quand le nom ne suffit pas.
  if (item.cdn?.length) return item.cdn.map((path) => `${CDN_ROOT}${path}`);
  const dir = sexe === 'F' ? 'femmes' : 'hommes';
  // Les fiches importées du wiki n'ont pas de slot technique : la catégorie
  // de garde-robe prend le relais ('Fonds', 'Cadres', 'Barbes', 'Coiffures').
  const category = item.slot || item.slotGardeRobe || '';
  const declinaisons = item.declinaisons.length ? item.declinaisons : [0];

  if (category === 'Barbes' || category === 'Barbe') {
    const style = assetStyleNumber(item.nom, 'barbe');
    if (style !== null) {
      return declinaisons.map((d) => `${CDN_ROOT}hommes/corps/barbe_${style}_c${d}_e0_@1X.png`);
    }
  }

  if (category === 'Coiffures' || category === 'Coiffure') {
    const style = assetStyleNumber(item.nom, 'coiffure');
    if (style !== null) {
      // ponytail: la couche `cheveuxIntermediaires` (styles 2, 4, 5, 11) n'est
      // pas listée : sa présence n'est pas déductible sans requête.
      return declinaisons.flatMap((d) =>
        ['cheveuxArrieres', 'cheveuxAvants'].map((layer) => `${CDN_ROOT}${dir}/corps/${layer}_${style}_c${d}_@1X.png`),
      );
    }
  }

  const root =
    category === 'Fond' || category === 'Fonds'
      ? `${CDN_ROOT}fonds/`
      : category === 'Cadre' || category === 'Cadres'
        ? `${CDN_ROOT}cadres/`
        : `${CDN_ROOT}${dir}/vetements/`;
  return declinaisons.map((d) => {
    let name = item.nom!;
    if (d > 0) name += `_d${d}`;
    if (item.dependCouleurPeau) name += '_p0';
    if (item.dependPostureMainG) name += '_m0';
    if (item.dependPostureMainD) name += '_n0';
    return `${root}${name}_0_@1X.png`;
  });
}

/** Texte comparable pour la recherche : libellé, nom CDN, slot, deux langues. */
export function itemHaystack(item: CatalogItem): string {
  return [itemLabel(item), item.nom, item.nameFr, item.nameEn, item.slot, slotLabel(item.slot)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Une teinte déterministe par déclinaison  -  le catalogue ne fournit pas de couleur. */
export function shadeColor(declinaison: number): string {
  return `hsl(${(declinaison * 47) % 360} 65% 60%)`;
}

/** Items regroupés par catégorie d'armoire, chaque lot trié par libellé français. */
export function indexByCategory(items: CatalogItem[]): Map<string, CatalogItem[]> {
  const out = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const key = categoryOf(item);
    const bucket = out.get(key);
    if (bucket) bucket.push(item);
    else out.set(key, [item]);
  }
  for (const bucket of out.values()) {
    bucket.sort((a, b) => itemLabel(a).localeCompare(itemLabel(b), 'fr'));
  }
  return out;
}

/**
 * Item de catalogue -> entrée `equipement` que Midas dessine. `declinaison`
 * choisit la variante de couleur ; `zIndexCalques` vient du catalogue, c'est
 * lui qui place le vêtement par rapport au corps.
 */
export function entryFrom(item: CatalogItem, declinaison: number): EquipEntry {
  return {
    idItem: item.id,
    declinaison,
    // Un objet incomplet (sans asset) ne doit jamais arriver jusqu'ici : la
    // garde-robe filtre les fiches sans `nom` avant de proposer un choix.
    nom: item.nom ?? '',
    slot: item.slot,
    slotGardeRobe: item.slotGardeRobe,
    miniature: item.miniature,
    declinaisons: item.declinaisons,
    slotsMasques: item.slotsMasques,
    dependCouleurPeau: item.dependCouleurPeau,
    dependPostureMainG: item.dependPostureMainG,
    dependPostureMainD: item.dependPostureMainD,
    postureMainG: null,
    postureMainD: null,
    zIndexCalques: item.zIndex,
  };
}

/** Tableau equipement -> lots par slot. */
export function toLoadout(equipement: Partial<EquipEntry>[] = []): Loadout {
  const out: Loadout = {};
  for (const e of equipement) {
    if (!e?.slot) continue;
    (out[e.slot] ??= []).push(e as EquipEntry);
  }
  return out;
}

/** Entrées portées dans une catégorie d'armoire (tous slots techniques confondus). */
export function entriesInCategory(loadout: Loadout, category: string): EquipEntry[] {
  return Object.values(loadout)
    .flat()
    .filter((e) => categoryOf(e) === category);
}

/** Retire toutes les entrées d'une catégorie, sauf éventuellement un idItem. */
export function removeCategory(loadout: Loadout, category: string, keepId?: string): Loadout {
  const next: Loadout = {};
  for (const [slot, list] of Object.entries(loadout)) {
    const kept = list.filter((e) => categoryOf(e) !== category || e.idItem === keepId);
    if (kept.length) next[slot] = kept;
  }
  return next;
}

/** Remplace l'entrée de même idItem, ou l'ajoute au slot. */
export function upsert(loadout: Loadout, slot: string, entry: EquipEntry): Loadout {
  const list = loadout[slot] ?? [];
  const at = list.findIndex((e) => e.idItem === entry.idItem);
  if (at < 0) return { ...loadout, [slot]: [...list, entry] };
  const next = [...list];
  next[at] = entry;
  return { ...loadout, [slot]: next };
}

export function removeEntry(loadout: Loadout, slot: string, idItem: string): Loadout {
  const list = (loadout[slot] ?? []).filter((e) => e.idItem !== idItem);
  if (list.length) return { ...loadout, [slot]: list };
  const next = { ...loadout };
  delete next[slot];
  return next;
}

export function countEquipped(loadout: Loadout): number {
  return Object.values(loadout).reduce((n, list) => n + list.length, 0);
}
