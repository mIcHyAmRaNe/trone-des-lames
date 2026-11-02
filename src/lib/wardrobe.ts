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
 * Sections de la garde-robe, groupées par `slot` et non par le `slotGardeRobe`
 * du jeu : ce champ liste toutes les armoires où un objet *peut* être rangé
 * (un Mantel apparaît sous Capes, Gilets, Cou, Mantels et Panoplies), donc
 * many-to-many et inutilisable comme catégorie. L'ordre est celui d'affichage.
 */
export const SECTIONS: { title: string; slots: string[]; hidden?: boolean }[] = [
  { title: 'I · Chapeaux & Casques', slots: ['Chapeau'] },
  { title: 'II · Corps', slots: ['Coiffures'] },
  { title: 'III · Tabliers & Gilets', slots: ['Tablier', 'Gilet'] },
  { title: 'IV · Braies & Jupes', slots: ['Braies', 'Jupe'] },
  { title: 'V · Chaussures & Sous-Vêtements', slots: ['Chaussures', 'Bas'] },
  { title: 'VI · Bijoux', slots: ['Bijoux', 'Collier'] },
  { title: 'VII · Mains', slots: ['MainGauche', 'MainDroite'], hidden: true },
  { title: 'VIII · Familiers', slots: ['Familier'], hidden: true },
  { title: 'IX · Armes', slots: ['Arme', 'Epee', 'Baton', 'Hache', 'Crosse'] },
  { title: 'X · Visage', slots: ['Barbes', 'Yeux'] },
  { title: 'XI · Capes & Mantels', slots: ['Cape', 'Mantel', 'Robe'] },
  { title: 'XII · Bustiers & Chemises', slots: ['Bustier', 'Chemise'] },
  { title: 'XIII · Panoplies', slots: ['Panoplie'] },
  { title: 'XIV · Gants, Ceinture & Cou', slots: ['Gants', 'Ceinture', 'Col'] },
  { title: 'XV · Cadres & Fonds', slots: ['Cadre', 'Fond'] },
  { title: 'XVI · Boucliers', slots: ['Bouclier'] },
  {
    title: 'XVII · Outils',
    slots: ['Objet', 'Objet2', 'Barque', 'Echelle', 'FiletPeche', 'Pelle', 'Pioche'],
    hidden: true,
  },
];

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

/**
 * Slots qui se cumulent. `multiSlotsOf` marque déjà tout ce que le personnage
 * chargé porte en plusieurs exemplaires ; cet ensemble ne couvre que les cas
 * qu'un personnage donné ne peut pas démontrer (les familiers).
 */
export const MULTI_SLOTS = new Set(['Familier']);

/** slot -> entrées portées. La longueur vaut 1 pour presque tous les slots. */
export type Loadout = Record<string, EquipEntry[]>;

export function orphanSlots(present: Iterable<string>): string[] {
  const claimed = new Set(SECTIONS.flatMap((s) => s.slots));
  return [...present].filter((s) => !claimed.has(s)).sort();
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

/** Items regroupés par slot, chaque lot trié par libellé français. */
export function indexBySlot(items: CatalogItem[]): Map<string, CatalogItem[]> {
  const out = new Map<string, CatalogItem[]>();
  for (const item of items) {
    const bucket = out.get(item.slot);
    if (bucket) bucket.push(item);
    else out.set(item.slot, [item]);
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

/** Slots que ce personnage cumule visiblement (il en porte plusieurs). */
export function multiSlotsOf(equipement: Partial<EquipEntry>[] = []): Set<string> {
  const counts = new Map<string, number>();
  for (const e of equipement) if (e?.slot) counts.set(e.slot, (counts.get(e.slot) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n > 1).map(([slot]) => slot));
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
