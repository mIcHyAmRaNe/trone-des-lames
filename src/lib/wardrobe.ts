// Catalogue de la garde-robe. `public/rk/catalog.json` est généré par
// scripts/catalog.mjs (bootstrap = instantané ryence.de, refresh = jeu en direct).
// Fichier statique : son URL est l'API que lit le navigateur.

export type Sexe = 'M' | 'F';

export interface CatalogItem {
  id: string;
  /** Nom de base de l'image Midas, ex. « gilet » — interpolé dans l'URL du CDN. */
  nom: string;
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
  /** Catégorie d'armoire du jeu (ex. « Armes ») — le jeu la fournit sur la fiche. */
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
 * L'ordre de ce tableau est celui de la barre d'onglets — ne pas le changer.
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

/** Catégorie d'affichage d'un objet ou d'une entrée d'équipement. */
export function categoryOf(item: { slot: string; slotGardeRobe?: string | null }): string {
  if (item.slotGardeRobe && CATEGORY_LABELS[item.slotGardeRobe]) return item.slotGardeRobe;
  return SLOT_CATEGORY[item.slot] ?? 'Autres';
}

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key;
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

export function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] ?? slot;
}

export const SEXE_LABEL: Record<Sexe, string> = { M: 'Homme', F: 'Femme' };

/** slot technique -> entrées portées. Midas dessine par slot, pas par catégorie. */
export type Loadout = Record<string, EquipEntry[]>;

export function orphanSlots(present: Iterable<string>): string[] {
  return [...present].filter((s) => !(s in SLOT_LABELS)).sort();
}

let catalogPromise: Promise<Catalog> | null = null;

/** Chargé une seule fois par page ; l'échec n'est pas mémorisé. */
export function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= fetch('/rk/catalog.json')
    .then((r) => {
      if (!r.ok) throw new Error(`catalogue indisponible (HTTP ${r.status})`);
      return r.json() as Promise<Catalog>;
    })
    .catch((e) => {
      catalogPromise = null;
      throw e;
    });
  return catalogPromise;
}

export function itemLabel(item: CatalogItem): string {
  return item.nameFr ?? item.nameEn ?? item.nom;
}

/** Texte comparable pour la recherche : libellé, nom CDN, slot, deux langues. */
export function itemHaystack(item: CatalogItem): string {
  return [itemLabel(item), item.nom, item.nameFr, item.nameEn, item.slot, slotLabel(item.slot)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Une teinte déterministe par déclinaison — le catalogue ne fournit pas de couleur. */
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
    nom: item.nom,
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
