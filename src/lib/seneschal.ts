/**
 * Le Sénéchal — outils d'aide pour les champs et les échoppes de Renaissance
 * Kingdoms. Données de jeu vérifiées sur le wiki officiel (octobre 2026).
 *
 * Règles retenues pour l'élevage de vaches :
 * - vache à 45 écus (38,25 avec la vertu Conservation + bonus majeur) ;
 * - 4 vaches maximum par champ, traite toutes les 3 jours ;
 * - lait : 1 bouteille × (1 + Intelligence/20) par vache et par traite,
 *   l'Intelligence étant plafonnée à 20 (rendement doublé) ;
 * - carcasses : 0 à 8 selon la corpulence, rendement du 2e champ réduit de 15 % ;
 * - croissance : 1 chance sur 16 par jour nourri, départ « décharné » ;
 * - mortalité à partir du 10e jour (table du wiki) ;
 * - seau : 20 utilisations, couteau : 5 abattages.
 *
 * Règles retenues pour l'échoppe du botaniste :
 * - 6 pots de culture, arrosage toutes les 6 h (bouquets), 8 h (buissons et
 *   épices) ou 24 h (arbres), pot cassé après 5 cueillettes ;
 * - récolte de 3 à 5 bouquets, 1 arbre ou buisson, 2 épices ;
 * - production : Intelligence 0-255 → 0-20 % de temps en moins, vertu
 *   « Don de soi » 0 / 1,5 / 9,5 %, Jardinier −20 % sur la taille ;
 * - chaque production coûte des points d'énergie (PE) et rapporte de l'XP.
 *
 * Règles retenues pour les champs de culture :
 * - la qualité part de 50 % et plafonne à 100 % ; le rendement double entre
 *   les deux. Les minima du wiki (premier et second champ) servent de base ;
 * - Force et Intelligence apportent jusqu'à 5 % chacune, Conservation 4 %,
 *   Faux de l'Ankou 10 %, Bon sens paysan 15 %, Soc 20 %, Cultivateur 5-25 % ;
 * - cycles : blé 10 j (3 sessions), orge 9 j (3), maïs 7 j (2), légumes 5 j (1),
 *   oliviers 14 j (1), vignes 30 j (3), houblon 10 j (2 × 22 h) ;
 * - houblon : rendement fixe de 10 sacs, réservé aux monastères.
 *
 * Règles retenues pour les élevages :
 * - cochons 25 écus (croissance herbe 5/18, maïs 5/9), moutons 35 écus
 *   (croissance 0,3/j, laine 1 × (1 + INT/20) tous les 4 jours), chèvres
 *   45 écus (lait tous les 3 jours) ; 4 bêtes max, couteau 5 abattages,
 *   second champ −15 % ;
 * - tables de mortalité du wiki pour cochons (dès J10) et moutons (dès J7) ;
 *   celle des chèvres n'est pas documentée et n'est donc pas simulée.
 *
 * Règles retenues pour le rucher :
 * - 4 ruches max à 45 écus, enfumoir obligatoire, humeur 0-8 → 0-8 pots de
 *   miel, 0-100 % de cire, 0-6 % de gelée par ruche et par récolte ;
 * - l'humeur baisse de 3 niveaux après chaque récolte ; second champ −15 %.
 */

export type SeneschalToolStatus = 'available' | 'soon';

/** Calculateur branché sur un outil du Sénéchal. */
export type SeneschalToolKind = 'cow' | 'botanist' | 'crop' | 'herd' | 'apiary';

export interface SeneschalTool {
  slug: string;
  name: string;
  summary: string;
  status: SeneschalToolStatus;
  tag?: string;
  href?: string;
  kind?: SeneschalToolKind;
}

export interface SeneschalCategory {
  slug: 'champs' | 'echoppes';
  name: string;
  kicker: string;
  description: string;
  tools: SeneschalTool[];
}

export const SENESCHAL_CATEGORIES: SeneschalCategory[] = [
  {
    slug: 'champs',
    name: 'Champs',
    kicker: 'Le domaine',
    description:
      'Cultures, élevages et rendements : les comptes du paysan, du champ de blé au pré des vaches.',
    tools: [
      {
        slug: 'elevage-de-vaches',
        name: 'Élevage de vaches',
        summary:
          'Traite, croissance, abattage et rentabilité : calculez le rendement de votre champ de vaches.',
        status: 'available',
        tag: 'Disponible',
        href: '/seneschal/champs/elevage-de-vaches',
        kind: 'cow',
      },
      {
        slug: 'elevage-de-moutons',
        name: 'Élevage de moutons',
        summary: 'Laine et peaux : le rendement de la tonte et de l’abattage.',
        status: 'available',
        tag: 'Disponible',
        kind: 'herd',
      },
      {
        slug: 'elevage-de-cochons',
        name: 'Élevage de cochons',
        summary: 'Poids, carcasses et cycle d’engraissement.',
        status: 'available',
        tag: 'Disponible',
        kind: 'herd',
      },
      {
        slug: 'elevage-de-chevres',
        name: 'Élevage de chèvres',
        summary: 'Lait et carcasses du champ de chèvres.',
        status: 'available',
        tag: 'Disponible',
        kind: 'herd',
      },
      {
        slug: 'champ-de-ble',
        name: 'Champ de blé',
        summary: 'Sacs de blé, qualité du champ et embauches.',
        status: 'available',
        tag: 'Disponible',
        kind: 'crop',
      },
      {
        slug: 'champ-de-mais',
        name: 'Champ de maïs',
        summary: 'Rendement du maïs et coût des semailles.',
        status: 'available',
        tag: 'Disponible',
        kind: 'crop',
      },
      {
        slug: 'champ-d-orge',
        name: 'Champ d’orge',
        summary: 'Orge, brasserie et rentabilité du cycle.',
        status: 'available',
        tag: 'Disponible',
        kind: 'crop',
      },
      {
        slug: 'champ-d-oliviers',
        name: 'Champ d’oliviers',
        summary: 'Olives, huile et rendement du verger.',
        status: 'available',
        tag: 'Disponible',
        kind: 'crop',
      },
      {
        slug: 'champ-de-vignes',
        name: 'Champ de vignes',
        summary: 'Raisins, vin et calcul du cycle viticole.',
        status: 'available',
        tag: 'Disponible',
        kind: 'crop',
      },
      {
        slug: 'champ-de-legumes',
        name: 'Champ de légumes',
        summary: 'Le maraîcher et ses récoltes.',
        status: 'available',
        tag: 'Disponible',
        kind: 'crop',
      },
      {
        slug: 'champ-de-houblon',
        name: 'Champ de houblon',
        summary: 'Le houblon des monastères : cycle, qualité et rentabilité.',
        status: 'available',
        tag: 'Disponible',
        kind: 'crop',
      },
      {
        slug: 'rucher',
        name: 'Rucher',
        summary: 'Ruches, humeur des abeilles, miel, cire et gelée royale.',
        status: 'available',
        tag: 'Disponible',
        kind: 'apiary',
      },
    ],
  },
  {
    slug: 'echoppes',
    name: 'Échoppes',
    kicker: 'L’atelier',
    description:
      'Matières premières, recettes et marges : les comptes des artisans et des échoppes du royaume.',
    tools: [
      {
        slug: 'botaniste',
        name: 'Botaniste',
        summary:
          'Cultures, colorants et teintures : le temps, le coût et la marge de chaque production.',
        status: 'available',
        tag: 'Disponible',
        href: '/seneschal/echoppes/botaniste',
        kind: 'botanist',
      },
      {
        slug: 'boucher',
        name: 'Boucher',
        summary:
          'Carcasses, viande et découpe : recettes, temps et énergie de la boucherie.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'fromager',
        name: 'Fromager',
        summary:
          'Laits, fromages et pots de yaourt : recettes, temps et marge de la fromagerie.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'boulanger',
        name: 'Boulanger',
        summary:
          'Farine, pains et tartes : recettes, temps et énergie de la boulangerie.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'meunier',
        name: 'Meunier',
        summary:
          'Blé, farine et boissons : recettes, temps et énergie du moulin.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'forgeron',
        name: 'Forgeron',
        summary:
          'Minerai, fer et outils : recettes, temps et énergie de la forge.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'charpentier',
        name: 'Charpentier',
        summary:
          'Bois, planches et meubles : recettes, temps et énergie de la charpenterie.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'tisserand',
        name: 'Tisserand',
        summary:
          'Laine, peaux et tissus : recettes, temps et énergie du tissage.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'sculpteur',
        name: 'Sculpteur',
        summary:
          'Pierre, argile et cire : recettes, temps et énergie de la sculpture.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'cidriculteur',
        name: 'Cidriculteur',
        summary: 'Fruits, cidre et tonnelets : recettes, temps et marge de la ferme à cidre.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'distillateur',
        name: 'Distillateur',
        summary: 'Orge, whiskey et whisky : recettes, temps et marge de la distillerie.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'viniculteur',
        name: 'Viniculteur',
        summary: 'Raisins, vins et tonnelets : recettes, temps et marge de la cave.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
      {
        slug: 'oleiculteur',
        name: 'Oléiculteur',
        summary: 'Olives et huile : recettes, temps et marge du pressoir.',
        status: 'available',
        tag: 'Disponible',
        kind: 'craft',
      },
    ],
  },
];

export function findCategory(slug: string | undefined): SeneschalCategory | undefined {
  return SENESCHAL_CATEGORIES.find((category) => category.slug === slug);
}

export function findTool(
  category: SeneschalCategory | undefined,
  slug: string | undefined,
): SeneschalTool | undefined {
  return category?.tools.find((tool) => tool.slug === slug);
}

export interface CraftRecipe {
  name: string;
  inputs: string[];
  /** Unités produites par fournée (1 par défaut). */
  output?: number;
  hours: number;
  energy: number;
  tier?: 'base' | 'savoir-faire' | 'competence';
  note?: string;
}

export interface CraftShop {
  id: string;
  name: string;
  bonus: string;
  recipes: CraftRecipe[];
}

/** Recettes d'atelier, d'après les pages brutes du wiki (octobre 2026).
 *  shortcut : sous-ensemble curaté (base et savoir-faire) ; ajouter un palier
 *  quand une recette manque à un calculateur. */
export const CRAFT_SHOPS: Record<string, CraftShop> = {
  boucher: {
    id: 'boucher',
    name: 'Boucherie',
    bonus: 'Pierre à aiguiser −25 % de temps sur la viande · Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Morceau de viande (cochon, chèvre, brebis)', inputs: ['1 demi-quintal de carcasses'], hours: 1.2, energy: 5, tier: 'base' },
      { name: 'Morceaux de viande (vache)', inputs: ['1 quintal de carcasses de vache'], output: 2, hours: 2.4, energy: 10, tier: 'base' },
      { name: 'Jambon de Parme, Forêt Noire, Bayonne, Iberico', inputs: ['1 demi-quintal de carcasses de cochon', '2 boisseaux de sel'], hours: 26, energy: 100, tier: 'base' },
      { name: 'Lait chaud au ghee', inputs: ['1 bouteille de lait', '1 pot de ghee'], hours: 2, energy: 10, tier: 'base' },
      { name: 'Porc au miel de fleurs', inputs: ['1 demi-quintal de carcasses de cochon', '1 boisseau de sel', '1 miel de fleurs'], hours: 2, energy: 10, tier: 'base' },
      { name: 'Porc au miel de thym', inputs: ['1 demi-quintal de carcasses de cochon', '1 boisseau de sel', '1 miel de thym'], hours: 2, energy: 10, tier: 'base' },
      { name: 'Saucisson sec aux noisettes', inputs: ['1 demi-quintal de carcasses de cochon', '4 noisettes'], hours: 2, energy: 10, tier: 'savoir-faire' },
      { name: 'Pâté au porc salé de Noël', inputs: ['1 demi-quintal de carcasses de cochon', '2 bâtons de cannelle', '1 sac de farine', '2 boisseaux de sel'], hours: 2, energy: 10, tier: 'savoir-faire' },
      { name: 'Pierogi', inputs: ['1 poignée de grains', '1 stigmate de safran', '1 sac de farine'], hours: 9, energy: 45, tier: 'savoir-faire', note: 'Produit 4 pierogi.' },
      { name: 'Stand du boucher', inputs: ['3 morceaux de viande'], hours: 3, energy: 15, tier: 'savoir-faire' },
    ],
  },
  boulanger: {
    id: 'boulanger',
    name: 'Boulangerie',
    bonus: 'Pétrissage musclé −25 % sur les miches · Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Miches de pain', inputs: ['2 sacs de farine', '1 stère de bois'], output: 6, hours: 2.4, energy: 10, tier: 'base' },
      { name: 'Pains de seigle', inputs: ['2 poignées de grains', '2 sacs de farine', '1 stère de bois'], output: 6, hours: 2, energy: 10, tier: 'base' },
      { name: 'Crêpe au miel de fleurs', inputs: ['1 bouteille de lait', '1 miel de fleurs', '1 sac de farine'], hours: 1, energy: 5, tier: 'base' },
      { name: 'Crêpe au miel de romarin', inputs: ['1 bouteille de lait', '1 miel de romarin', '1 sac de farine'], hours: 1, energy: 5, tier: 'base' },
      { name: 'Pain aux noisettes', inputs: ['1 miche de pain', '1 noisette'], hours: 1, energy: 5, tier: 'base' },
      { name: 'Tarte aux trois miels', inputs: ['1 bouteille de lait', '1 miel de lavande', '1 miel de romarin', '1 miel de thym', '1 sac de farine'], hours: 1, energy: 5, tier: 'base' },
      { name: 'Bouchée de poisson au safran', inputs: ['2 poissons', '1 sac de farine', '6 stigmates de safran'], output: 2, hours: 6, energy: 30, tier: 'savoir-faire' },
      { name: 'Pâté en croûte au cumin', inputs: ['6 graines de cumin', '2 morceaux de viande', '1 sac de farine'], output: 2, hours: 6, energy: 30, tier: 'savoir-faire' },
      { name: 'Tarte aux pommes et à la cannelle', inputs: ['6 bâtons de cannelle', '2 fruits', '1 sac de farine'], output: 2, hours: 6, energy: 30, tier: 'savoir-faire' },
      { name: 'Pain au lait', inputs: ['2 bouteilles de lait', '1 miche de pain'], hours: 1, energy: 5, tier: 'competence' },
      { name: 'Pain de viande', inputs: ['1 morceau de viande', '1 miche de pain'], hours: 1, energy: 5, tier: 'competence' },
      { name: 'Tarte aux légumes', inputs: ['2 légumes', '1 miche de pain'], hours: 1, energy: 5, tier: 'competence' },
      { name: 'Stand du maraîcher', inputs: ['6 fruits'], hours: 3, energy: 15, tier: 'savoir-faire' },
    ],
  },
  charpentier: {
    id: 'charpentier',
    name: 'Charpenterie',
    bonus: 'Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Planche de bois', inputs: ['1 bois'], output: 2, hours: 1, energy: 5, tier: 'base' },
      { name: 'Support en bois', inputs: ['1 bois'], output: 4, hours: 4, energy: 20, tier: 'base' },
      { name: 'Petite échelle', inputs: ['1 bois'], hours: 56.25, energy: 100, tier: 'base', note: '28 h 08 avec la compétence Pro des barreaux −50 %.' },
      { name: 'Banc rustique', inputs: ['1 manche', '2 planches'], hours: 6, energy: 30, tier: 'savoir-faire' },
      { name: 'Arc court', inputs: ['1 manche', '1 peau', '1 corde'], hours: 22, energy: 100, tier: 'savoir-faire' },
      { name: 'Table en ébène', inputs: ['5 planches d’ébène'], hours: 22, energy: 100, tier: 'savoir-faire' },
    ],
  },
  forgeron: {
    id: 'forgeron',
    name: 'Forge',
    bonus: 'Haut-fourneau : fer brut en 6 h au lieu de 22 h · Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Kilo de fer brut', inputs: ['1 minerai', '2 bois'], hours: 22, energy: 100, tier: 'base', note: '6 h et 30 PE avec le haut-fourneau.' },
      { name: 'Cerclage métallique', inputs: ['1 minerai'], output: 3, hours: 6, energy: 30, tier: 'base' },
      { name: 'Serrure', inputs: ['1 fer'], hours: 3, energy: 15, tier: 'base' },
      { name: 'Couteau', inputs: ['1 minerai', '1 bois'], hours: 22, energy: 100, tier: 'base' },
      { name: 'Seau', inputs: ['1 minerai'], hours: 4, energy: 20, tier: 'base', note: 'Variante : 1 cerclage, 3 h 36.' },
      { name: 'Épée', inputs: ['1 lame', '1 caillou'], hours: 10.8, energy: 60, tier: 'savoir-faire' },
    ],
  },
  meunier: {
    id: 'meunier',
    name: 'Moulin',
    bonus: 'Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Sac de farine', inputs: ['1 blé'], hours: 1.2, energy: 5, tier: 'base' },
      { name: 'Bière ambrée', inputs: ['1 blé', '1 sirop d’érable'], hours: 2, energy: 10, tier: 'base' },
      { name: 'Moût à la cannelle', inputs: ['1 cannelle', '1 blé'], hours: 12, energy: 70, tier: 'savoir-faire' },
      { name: 'Eau-de-vie de grain', inputs: ['1 cumin', '1 poignée de grains'], hours: 6, energy: 30, tier: 'savoir-faire' },
      { name: 'Hydromel sec', inputs: ['1 moût au miel de fleurs'], hours: 22, energy: 86, tier: 'savoir-faire' },
      { name: 'Stand du meunier', inputs: ['4 sacs de farine'], hours: 3, energy: 15, tier: 'savoir-faire' },
    ],
  },
  sculpteur: {
    id: 'sculpteur',
    name: 'Sculpture',
    bonus: 'Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Pierre de taille', inputs: ['1 quintal de pierre'], hours: 4.8, energy: 20, tier: 'base' },
      { name: 'Pot de culture', inputs: ['3 argile'], hours: 3, energy: 15, tier: 'base' },
      { name: 'Mur en torchis', inputs: ['1 blé'], hours: 3, energy: 15, tier: 'base' },
      { name: 'Sculpture de cire', inputs: ['3 cire'], hours: 12, energy: 60, tier: 'savoir-faire' },
      { name: 'Apatite taillée', inputs: ['1 apatite brute'], hours: 22, energy: 100, tier: 'savoir-faire' },
      { name: 'Vase de Nicée', inputs: ['1 jade', '1 verre', '2 argile'], hours: 12, energy: 60, tier: 'savoir-faire' },
    ],
  },
  tisserand: {
    id: 'tisserand',
    name: 'Tissage',
    bonus: 'Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Paillasse', inputs: ['1 laine'], hours: 12, energy: 60, tier: 'base' },
      { name: 'Braies', inputs: ['4 laine'], hours: 22, energy: 100, tier: 'base' },
      { name: 'Chemise d’homme', inputs: ['8 laine'], hours: 22, energy: 100, tier: 'base' },
      { name: 'Teinture blanche', inputs: ['3 blanc de blanc'], hours: 6, energy: 30, tier: 'savoir-faire' },
      { name: 'Grande voile', inputs: ['100 laine'], hours: 22, energy: 100, tier: 'savoir-faire' },
      { name: 'Tapisserie murale', inputs: ['2 peaux', '2 laine'], hours: 6, energy: 30, tier: 'savoir-faire' },
    ],
  },
  fromager: {
    id: 'fromager',
    name: 'Fromagerie',
    bonus: 'Spécialités régionales −25 % · Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Fromage de brebis', inputs: ['2 bouteilles de lait de brebis', '1 boisseau de sel', '1 stère de bois'], hours: 26.4, energy: 100, tier: 'base' },
      { name: 'Fromage de chèvre', inputs: ['2 bouteilles de lait de chèvre', '1 boisseau de sel', '1 stère de bois'], hours: 26.4, energy: 100, tier: 'base' },
      { name: 'Fromage de vache', inputs: ['1 bouteille de lait', '1 boisseau de sel', '1 stère de bois'], hours: 7.2, energy: 30, tier: 'base' },
      { name: 'Lait chaud au ghee', inputs: ['1 bouteille de lait', '1 pot de ghee'], hours: 2, energy: 10, tier: 'base' },
      { name: 'Pot de yaourt', inputs: ['1 boisseau de sel', '1 bouteille de lait de chèvre', '1 bouteille de lait', '1 stère de bois'], hours: 26.4, energy: 100, tier: 'base' },
    ],
  },
  cidriculteur: {
    id: 'cidriculteur',
    name: 'Ferme à cidre',
    bonus: 'Spécialités régionales −25 % · Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Tonnelet de cidre', inputs: ['1 fruit', '1 stère de bois', '1 tonneau'], hours: 26.4, energy: 100, tier: 'base' },
      { name: 'Lait chaud au ghee', inputs: ['1 bouteille de lait', '1 pot de ghee'], hours: 2, energy: 10, tier: 'base' },
    ],
  },
  distillateur: {
    id: 'distillateur',
    name: 'Distillerie',
    bonus: 'Spécialités régionales −25 % · Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Tonnelet de whiskey', inputs: ['2 sacs d’orge', '7 stères de bois', '1 tonneau'], hours: 22, energy: 100, tier: 'base' },
      { name: 'Tonnelet de whisky', inputs: ['2 sacs d’orge', '7 stères de bois', '1 tonneau'], hours: 22, energy: 100, tier: 'base' },
      { name: 'Lait chaud au ghee', inputs: ['1 bouteille de lait', '1 pot de ghee'], hours: 2, energy: 10, tier: 'base' },
    ],
  },
  viniculteur: {
    id: 'viniculteur',
    name: 'Cave à vin',
    bonus: 'Spécialités régionales −25 % · Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Tonnelet de vin de Porto', inputs: ['6 livres de raisin', '1 tonneau'], hours: 26.4, energy: 100, tier: 'base' },
      { name: 'Tonnelet de vin Retsina', inputs: ['3 livres de raisin', '1 tonneau'], hours: 7.2, energy: 30, tier: 'base' },
      { name: 'Tonnelet de vin de Tokay', inputs: ['6 livres de raisin', '1 tonneau'], hours: 26.4, energy: 100, tier: 'base' },
      { name: 'Vin d’Anjou', inputs: ['3 livres de raisin', '1 tonneau'], hours: 7.2, energy: 30, tier: 'base' },
      { name: 'Vin de Bordeaux', inputs: ['3 livres de raisin', '1 tonneau'], hours: 7.2, energy: 30, tier: 'base' },
      { name: 'Vin de Bourgogne', inputs: ['6 livres de raisin', '1 tonneau'], hours: 26.4, energy: 100, tier: 'base' },
      { name: 'Vin de Champagne', inputs: ['6 livres de raisin', '1 tonneau'], hours: 26.4, energy: 100, tier: 'base' },
      { name: 'Vin de Toscane', inputs: ['3 livres de raisin', '1 tonneau'], hours: 7.2, energy: 30, tier: 'base' },
      { name: 'Vin Rioja', inputs: ['6 livres de raisin', '1 tonneau'], hours: 26.4, energy: 100, tier: 'base' },
      { name: 'Lait chaud au ghee', inputs: ['1 bouteille de lait', '1 pot de ghee'], hours: 2, energy: 10, tier: 'base' },
    ],
  },
  oleiculteur: {
    id: 'oleiculteur',
    name: 'Pressoir',
    bonus: 'Spécialités régionales −25 % · Intelligence 0–20 % · Don de soi jusqu’à 9,5 %.',
    recipes: [
      { name: 'Bouteille d’huile d’olives', inputs: ['4 livres d’olives'], hours: 7.2, energy: 30, tier: 'base' },
    ],
  },
};

export function findCraft(id: string | undefined): CraftShop | undefined {
  return id ? CRAFT_SHOPS[id] : undefined;
}

/** Recettes triées par palier : base, savoir-faire, compétence. */
export function craftRecipesByTier(craft: CraftShop): Array<{
  tier: 'base' | 'savoir-faire' | 'competence';
  label: string;
  recipes: CraftRecipe[];
}> {
  const labels = {
    base: 'Recettes de base',
    'savoir-faire': 'Savoir-faire',
    competence: 'Compétences',
  } as const;
  return (['base', 'savoir-faire', 'competence'] as const)
    .map((tier) => ({
      tier,
      label: labels[tier],
      recipes: craft.recipes.filter((recipe) => (recipe.tier ?? 'base') === tier),
    }))
    .filter((group) => group.recipes.length > 0);
}

/** « 2 sacs de farine » → { qty: 2, label: 'sacs de farine' }. */
export function parseCraftInput(input: string): { qty: number; label: string } {
  const match = input.trim().match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (!match) return { qty: 1, label: input.trim() };
  const qty = Number(match[1].replace(',', '.'));
  return { qty: Number.isFinite(qty) ? qty : 1, label: match[2] };
}

/** Unités produites par une fournée. */
export function craftRecipeOutput(recipe: CraftRecipe): number {
  return Math.max(1, recipe.output ?? 1);
}

/** Réduction du temps de production, en fraction (0 à 0,8). */
export function craftTimeReduction(
  intelligence: number,
  virtuePercent: number,
  skillPercent: number,
): number {
  const int = Math.min(255, Math.max(0, Number.isFinite(intelligence) ? intelligence : 0));
  const virtue = Math.min(20, Math.max(0, Number.isFinite(virtuePercent) ? virtuePercent : 0));
  const skill = Math.min(50, Math.max(0, Number.isFinite(skillPercent) ? skillPercent : 0));
  return Math.min(0.8, (int / 255) * 0.2 + virtue / 100 + skill / 100);
}

export interface CraftProductionInput {
  craftId: string;
  recipeName: string;
  /** Nombre de fournées lancées. */
  batch: number;
  /** Prix unitaire par matière (clé = libellé sans la quantité). */
  prices: Record<string, number>;
  outputPrice: number;
  intelligence: number;
  virtuePercent: number;
  /** Réduction de la compétence d'atelier, en pourcentage (0 / 10 / 25 / 50). */
  skillPercent: number;
}

export interface CraftCostLine {
  label: string;
  qty: number;
  unitPrice: number;
  cost: number;
}

export interface CraftProductionResult {
  recipe: CraftRecipe;
  batch: number;
  reduction: number;
  hoursPerBatch: number;
  totalHours: number;
  outputQty: number;
  lines: CraftCostLine[];
  ingredientCost: number;
  revenue: number;
  profit: number;
  profitPerHour: number;
  profitPerUnit: number;
  costPerUnit: number;
  energy: number;
}

export function computeCraftProduction(input: CraftProductionInput): CraftProductionResult {
  const craft = findCraft(input.craftId) ?? CRAFT_SHOPS.boucher;
  const recipe =
    craft.recipes.find((entry) => entry.name === input.recipeName) ?? craft.recipes[0];
  const batch = Math.min(999, Math.max(1, Math.round(Number.isFinite(input.batch) ? input.batch : 1)));
  const reduction = craftTimeReduction(
    input.intelligence,
    input.virtuePercent,
    input.skillPercent,
  );
  const hoursPerBatch = recipe.hours * (1 - reduction);
  const totalHours = hoursPerBatch * batch;
  const outputPerBatch = craftRecipeOutput(recipe);
  const outputQty = outputPerBatch * batch;

  const lines = recipe.inputs.map((raw) => {
    const material = parseCraftInput(raw);
    const unitPrice = safeMoney(input.prices[material.label] ?? 0);
    return {
      label: material.label,
      qty: material.qty * batch,
      unitPrice,
      cost: material.qty * batch * unitPrice,
    };
  });

  const ingredientCost = lines.reduce((sum, line) => sum + line.cost, 0);
  const revenue = outputQty * safeMoney(input.outputPrice);
  const profit = revenue - ingredientCost;

  return {
    recipe,
    batch,
    reduction,
    hoursPerBatch,
    totalHours,
    outputQty,
    lines,
    ingredientCost,
    revenue,
    profit,
    profitPerHour: totalHours > 0 ? profit / totalHours : 0,
    profitPerUnit: outputQty > 0 ? profit / outputQty : 0,
    costPerUnit: outputQty > 0 ? ingredientCost / outputQty : 0,
    energy: recipe.energy * batch,
  };
}


export const COW_RULES = {
  price: 45,
  conservationPrice: 38.25,
  maxCows: 4,
  bucketDurability: 20,
  knifeDurability: 5,
  secondFieldYield: 0.85,
  growthChance: 1 / 16,
  intelligenceCap: 20,
  milkBase: 1,
} as const;

export interface CowSize {
  value: number;
  label: string;
  carcasses: number;
}

export const COW_SIZES: CowSize[] = [
  { value: 0, label: 'Mourant', carcasses: 0 },
  { value: 1, label: 'Décharné', carcasses: 1 },
  { value: 2, label: 'Maigre', carcasses: 2 },
  { value: 3, label: 'Normal', carcasses: 3 },
  { value: 4, label: 'Dodu', carcasses: 4 },
  { value: 5, label: 'Charnu', carcasses: 5 },
  { value: 6, label: 'Gras', carcasses: 6 },
  { value: 7, label: 'Pansu', carcasses: 7 },
  { value: 8, label: 'American style', carcasses: 8 },
];

/** Risque de mourir dans la journée, en pourcentage. */
const COW_MORTALITY: Readonly<Record<number, number>> = {
  10: 1,
  11: 2,
  12: 3,
  13: 4,
  14: 5,
  15: 8,
  16: 12,
  17: 15,
  18: 20,
  19: 22,
  20: 25,
  21: 30,
};

export function cowDailyMortality(age: number): number {
  if (age < 10) return 0;
  if (age > 21) return 35;
  return COW_MORTALITY[age] ?? 35;
}

/** Risque cumulé de mourir avant l'âge donné, en pourcentage. */
export function cowCumulativeMortality(age: number): number {
  if (age < 10) return 0;
  let survival = 1;
  for (let day = 10; day <= Math.min(age, 21); day += 1) {
    survival *= 1 - cowDailyMortality(day) / 100;
  }
  if (age > 21) survival *= Math.pow(1 - 0.35, age - 21);
  return (1 - survival) * 100;
}

/** Bouteilles produites par vache et par traite. */
export function cowMilkPerMilking(intelligence: number, secondField = false): number {
  const effective = Math.min(
    COW_RULES.intelligenceCap,
    Math.max(0, Number.isFinite(intelligence) ? intelligence : 0),
  );
  const base = COW_RULES.milkBase * (1 + effective / 20);
  return secondField ? base * COW_RULES.secondFieldYield : base;
}

/** Quintaux de carcasses produits par une vache à l'abattage. */
export function cowCarcasses(size: number, secondField = false): number {
  const safeSize = Math.min(8, Math.max(0, Number.isFinite(size) ? size : 0));
  const raw = safeSize * (secondField ? COW_RULES.secondFieldYield : 1);
  return Math.floor(raw + 1e-9);
}

/** Corpulence attendue après `age` jours nourris (départ décharné). */
export function cowExpectedSize(age: number): number {
  return Math.min(8, 1 + Math.max(0, age) * COW_RULES.growthChance);
}

export interface CowCycleCow {
  enabled: boolean;
  purchaseDay: number;
  slaughterAge: number;
  size: number;
}

export interface CowCycleInput {
  cows: CowCycleCow[];
  /** 0 = jamais traire, sinon intervalle en jours. */
  milkEvery: number;
  intelligence: number;
  secondField: boolean;
  cowPrice: number;
  bucketPrice: number;
  knifePrice: number;
  milkPrice: number;
  carcassPrice: number;
  milkingSalary: number;
  slaughterSalary: number;
}

export interface CowCycleCowResult {
  index: number;
  milkings: number;
  milkBottles: number;
  carcasses: number;
  dailyRisk: number;
  cumulativeRisk: number;
  slaughterDay: number;
}

export interface SlaughterConflict {
  day: number;
  /** Index d'origine des bêtes abattues le même jour. */
  indices: number[];
}

export interface CowCycleResult {
  activeCows: number;
  cycleDays: number;
  slaughterConflicts: SlaughterConflict[];
  milkingOperations: number;
  bucketUses: number;
  knifeUses: number;
  buckets: number;
  knives: number;
  milkBottles: number;
  carcasses: number;
  milkRevenue: number;
  carcassRevenue: number;
  revenue: number;
  cowCost: number;
  toolsCost: number;
  salaries: number;
  costs: number;
  profit: number;
  profitPerCow: number;
  profitPerDay: number;
  perCow: CowCycleCowResult[];
}

const safeInt = (value: number, fallback: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
};

const safeMoney = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

/** Un seul abattage par jour : signale les bêtes qui tombent le même jour. */
function findSlaughterConflicts(
  entries: { index: number; slaughterDay: number }[],
): SlaughterConflict[] {
  const byDay = new Map<number, number[]>();
  for (const entry of entries) {
    const indices = byDay.get(entry.slaughterDay) ?? [];
    indices.push(entry.index);
    byDay.set(entry.slaughterDay, indices);
  }
  return [...byDay.entries()]
    .filter(([, indices]) => indices.length > 1)
    .map(([day, indices]) => ({ day, indices }))
    .sort((a, b) => a.day - b.day);
}

export function computeCowCycle(input: CowCycleInput): CowCycleResult {
  const active = input.cows
    .map((cow, index) => ({ ...cow, index }))
    .filter((cow) => cow.enabled);

  const milkEvery = safeInt(input.milkEvery, 0, 0, 30);
  const intelligence = Math.min(
    COW_RULES.intelligenceCap,
    Math.max(0, Number.isFinite(input.intelligence) ? input.intelligence : 0),
  );
  const secondField = Boolean(input.secondField);
  const perMilking = cowMilkPerMilking(intelligence, secondField);

  const milkingDays = new Set<number>();
  const perCow: CowCycleCowResult[] = active.map((cow) => {
    const purchaseDay = safeInt(cow.purchaseDay, 1, 1, 60);
    const slaughterAge = safeInt(cow.slaughterAge, 0, 0, 120);
    const size = safeInt(cow.size, 0, 0, 8);
    // Pas de traite le jour de l'abattage : la dernière traite doit tomber avant.
    const milkings =
      milkEvery > 0 ? Math.max(0, Math.floor((slaughterAge - 1) / milkEvery)) : 0;

    for (let k = 1; k <= milkings; k += 1) {
      milkingDays.add(purchaseDay + k * milkEvery - 1);
    }

    return {
      index: cow.index,
      milkings,
      milkBottles: milkings * perMilking,
      carcasses: cowCarcasses(size, secondField),
      dailyRisk: cowDailyMortality(slaughterAge),
      cumulativeRisk: cowCumulativeMortality(slaughterAge),
      slaughterDay: purchaseDay + slaughterAge - 1,
    };
  });

  const activeCows = active.length;
  const cycleDays = perCow.reduce((max, cow) => Math.max(max, cow.slaughterDay), 0);
  const bucketUses = perCow.reduce((sum, cow) => sum + cow.milkings, 0);
  const knifeUses = activeCows;
  const buckets = bucketUses > 0 ? Math.ceil(bucketUses / COW_RULES.bucketDurability) : 0;
  const knives = knifeUses > 0 ? Math.ceil(knifeUses / COW_RULES.knifeDurability) : 0;

  const milkBottles = perCow.reduce((sum, cow) => sum + cow.milkBottles, 0);
  const carcasses = perCow.reduce((sum, cow) => sum + cow.carcasses, 0);

  const milkPrice = safeMoney(input.milkPrice);
  const carcassPrice = safeMoney(input.carcassPrice);
  const milkRevenue = milkBottles * milkPrice;
  const carcassRevenue = carcasses * carcassPrice;
  const revenue = milkRevenue + carcassRevenue;

  const cowCost = activeCows * safeMoney(input.cowPrice);
  const toolsCost =
    buckets * safeMoney(input.bucketPrice) + knives * safeMoney(input.knifePrice);
  const salaries =
    milkingDays.size * safeMoney(input.milkingSalary) +
    activeCows * safeMoney(input.slaughterSalary);
  const costs = cowCost + toolsCost + salaries;
  const profit = revenue - costs;

  return {
    activeCows,
    cycleDays,
    slaughterConflicts: findSlaughterConflicts(perCow),
    milkingOperations: milkingDays.size,
    bucketUses,
    knifeUses,
    buckets,
    knives,
    milkBottles,
    carcasses,
    milkRevenue,
    carcassRevenue,
    revenue,
    cowCost,
    toolsCost,
    salaries,
    costs,
    profit,
    profitPerCow: activeCows > 0 ? profit / activeCows : 0,
    profitPerDay: cycleDays > 0 ? profit / cycleDays : 0,
    perCow,
  };
}

/** Prix au comptant à partir d'écus et de deniers. */
export function toEcus(ecus: number, deniers = 0): number {
  const e = Number.isFinite(ecus) ? ecus : 0;
  const d = Number.isFinite(deniers) ? deniers : 0;
  return Math.max(0, e + d / 100);
}

// ---------------------------------------------------------------------------
// Échoppe du botaniste
// ---------------------------------------------------------------------------

export const BOTANIST_RULES = {
  maxPots: 6,
  potDurability: 5,
  intelligenceMax: 255,
  intelligenceBonus: 0.2,
} as const;

export type BotanistFamily =
  | 'savoir-faire'
  | 'base'
  | 'colorants'
  | 'teintures-capillaires'
  | 'teintures-pileuses';

export const BOTANIST_FAMILIES: { id: BotanistFamily; label: string }[] = [
  { id: 'savoir-faire', label: 'Avec savoir-faire' },
  { id: 'base', label: 'De base' },
  { id: 'colorants', label: 'Doses de colorant' },
  { id: 'teintures-capillaires', label: 'Teintures capillaires' },
  { id: 'teintures-pileuses', label: 'Teintures pileuses' },
];

export interface BotanistIngredient {
  key: string;
  label: string;
  qty: number;
}

export interface BotanistRecipe {
  id: string;
  name: string;
  family: BotanistFamily;
  output: number;
  xp: number;
  /** Durée de base en heures. */
  hours: number;
  /** Points d'énergie requis. */
  energy: number;
  ingredients: BotanistIngredient[];
  /** La compétence Jardinier réduit la durée de la taille. */
  trim?: boolean;
}

const INGREDIENT_LABELS: Record<string, string> = {
  manches: 'Manches',
  peaux: 'Peaux',
  'pelotes-laine': 'Pelotes de laine',
  'bouquets-achillees': 'Bouquets d’achillées',
  'bouquets-passeroses': 'Bouquets de passeroses',
  'corde-tressee': 'Corde tressée',
  'dose-blanche': 'Dose de colorant blanc',
  'minerai-fer': 'Kilo de minerai de fer',
  'ailes-papillons': 'Ailes de papillons',
  'brin-romarin': 'Brin de romarin',
  'buisson-commun': 'Buisson commun',
  'graines-cumin': 'Graines de cumin',
  'stigmates-safran': 'Stigmates de safran',
  naphtes: 'Naphtes',
  'pains-argile': 'Pains d’argile',
  'pelote-laine': 'Pelote de laine',
  'batons-cannelle': 'Bâtons de cannelle',
  'pots-culture': 'Pots de culture',
  bouleau: 'Bouleau',
  'feu-rustique': 'Feu rustique',
  'pierres-taille': 'Pierres de taille',
  'buisson-taille': 'Buisson taillé',
  'coffre-rustique': 'Coffre rustique',
  'bouquet-guedes': 'Bouquet de guèdes',
  'bouquet-achillees': 'Bouquet d’achillées',
  saule: 'Saule',
  hetre: 'Hêtre',
  'bouteille-lait': 'Bouteille de lait',
  'pot-ghee': 'Pot de ghee',
  'cires-abeille': 'Cires d’abeille',
  'pot-culture': 'Pot de culture',
  'dose-marron': 'Dose de colorant marron',
  'dose-bleue': 'Dose de colorant bleu',
  'dose-noire': 'Dose de colorant noir',
  'dose-rouge': 'Dose de colorant rouge',
  'dose-verte': 'Dose de colorant vert',
  'dose-jaune': 'Dose de colorant jaune',
  'dose-pourpre': 'Dose de colorant pourpre',
  'bouquet-garances': 'Bouquet de garances',
  caroubier: 'Caroubier',
  'fleurs-camomille': 'Fleurs de camomille',
  'fleurs-pavot-blanc': 'Fleurs de pavot blanc',
  'fleur-camomille': 'Fleur de camomille',
  'ecorce-saule-blanc': 'Morceaux d’écorce de saule blanc',
  'baies-sureau-noir': 'Baies de sureau noir',
  'pinceau-teinture': 'Pinceau de teinture',
};

const ing = (key: string, qty: number): BotanistIngredient => ({
  key,
  label: INGREDIENT_LABELS[key] ?? key,
  qty,
});

export const BOTANIST_RECIPES: BotanistRecipe[] = [
  // Avec savoir-faire
  {
    id: 'attrape-papillons',
    name: 'Attrape-papillons',
    family: 'savoir-faire',
    output: 1,
    xp: 1230,
    hours: 22,
    energy: 100,
    ingredients: [ing('manches', 2), ing('peaux', 2), ing('pelotes-laine', 8)],
  },
  {
    id: 'bouquet-de-fleurs-sauvages',
    name: 'Bouquet de fleurs sauvages',
    family: 'savoir-faire',
    output: 1,
    xp: 740,
    hours: 12,
    energy: 60,
    ingredients: [
      ing('bouquets-achillees', 3),
      ing('bouquets-passeroses', 3),
      ing('corde-tressee', 1),
    ],
  },
  {
    id: 'folle-fumee',
    name: 'Folle-fumée',
    family: 'savoir-faire',
    output: 2,
    xp: 180,
    hours: 3,
    energy: 15,
    ingredients: [ing('dose-blanche', 1), ing('minerai-fer', 1)],
  },
  {
    id: 'huile-de-luminescence',
    name: 'Huile de Luminescence',
    family: 'savoir-faire',
    output: 1,
    xp: 370,
    hours: 6,
    energy: 30,
    ingredients: [ing('ailes-papillons', 5), ing('brin-romarin', 1), ing('minerai-fer', 1)],
  },
  {
    id: 'parterre-de-cumin-fleuri',
    name: 'Parterre de cumin fleuri',
    family: 'savoir-faire',
    output: 1,
    xp: 740,
    hours: 12,
    energy: 60,
    ingredients: [ing('buisson-commun', 1), ing('graines-cumin', 3)],
  },
  {
    id: 'parterre-de-safran-fleuri',
    name: 'Parterre de safran fleuri',
    family: 'savoir-faire',
    output: 1,
    xp: 740,
    hours: 12,
    energy: 60,
    ingredients: [ing('buisson-commun', 1), ing('stigmates-safran', 3)],
  },
  {
    id: 'petit-pot-gregeois',
    name: 'Petit pot grégeois',
    family: 'savoir-faire',
    output: 1,
    xp: 740,
    hours: 12,
    energy: 60,
    ingredients: [ing('naphtes', 3), ing('pains-argile', 3), ing('pelote-laine', 1)],
  },
  {
    id: 'plantation-de-cannelle',
    name: 'Plantation de cannelle',
    family: 'savoir-faire',
    output: 1,
    xp: 990,
    hours: 16,
    energy: 80,
    ingredients: [ing('batons-cannelle', 3), ing('buisson-commun', 1)],
  },
  {
    id: 'stand-de-l-herboriste',
    name: 'Stand de l’herboriste',
    family: 'savoir-faire',
    output: 1,
    xp: 180,
    hours: 3,
    energy: 15,
    ingredients: [ing('pots-culture', 3)],
  },

  // De base
  {
    id: 'bouleau-taille',
    name: 'Bouleau taillé',
    family: 'base',
    output: 1,
    xp: 1230,
    hours: 24.75,
    energy: 100,
    ingredients: [ing('bouleau', 1)],
    trim: true,
  },
  {
    id: 'buisson-taille',
    name: 'Buisson taillé',
    family: 'base',
    output: 1,
    xp: 610,
    hours: 11.25,
    energy: 50,
    ingredients: [ing('buisson-commun', 1)],
    trim: true,
  },
  {
    id: 'cheminee-au-chaudron',
    name: 'Cheminée au chaudron',
    family: 'base',
    output: 1,
    xp: 1230,
    hours: 22,
    energy: 100,
    ingredients: [ing('buisson-taille', 1), ing('feu-rustique', 1), ing('pierres-taille', 2)],
  },
  {
    id: 'coffre-d-herboriste',
    name: 'Coffre d’herboriste',
    family: 'base',
    output: 1,
    xp: 1230,
    hours: 22,
    energy: 100,
    ingredients: [ing('buisson-taille', 1), ing('coffre-rustique', 1)],
  },
  {
    id: 'dose-blanche',
    name: 'Doses de colorant blanc',
    family: 'base',
    output: 2,
    xp: 180,
    hours: 3,
    energy: 15,
    ingredients: [ing('bouleau', 1)],
  },
  {
    id: 'dose-bleue',
    name: 'Dose de colorant bleu',
    family: 'base',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('bouquet-guedes', 1)],
  },
  {
    id: 'dose-jaune',
    name: 'Dose de colorant jaune',
    family: 'base',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('bouquet-achillees', 1)],
  },
  {
    id: 'dose-noire',
    name: 'Doses de colorant noir',
    family: 'base',
    output: 2,
    xp: 180,
    hours: 3,
    energy: 15,
    ingredients: [ing('saule', 1)],
  },
  {
    id: 'hetre-taille',
    name: 'Hêtre taillé',
    family: 'base',
    output: 1,
    xp: 1230,
    hours: 24.75,
    energy: 100,
    ingredients: [ing('hetre', 1)],
    trim: true,
  },
  {
    id: 'lait-chaud-au-ghee',
    name: 'Lait chaud au ghee',
    family: 'base',
    output: 1,
    xp: 120,
    hours: 2,
    energy: 10,
    ingredients: [ing('bouteille-lait', 1), ing('pot-ghee', 1)],
  },
  {
    id: 'parterre-de-passeroses',
    name: 'Parterre de passeroses',
    family: 'base',
    output: 1,
    xp: 370,
    hours: 6,
    energy: 30,
    ingredients: [ing('bouquets-passeroses', 3)],
  },
  {
    id: 'pot-de-cire-d-abeille',
    name: 'Pot de cire d’abeille',
    family: 'base',
    output: 1,
    xp: 340,
    hours: 6,
    energy: 28,
    ingredients: [ing('cires-abeille', 3)],
  },
  {
    id: 'pot-de-passeroses',
    name: 'Pot de passeroses',
    family: 'base',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('bouquets-passeroses', 3), ing('pot-culture', 1)],
  },
  {
    id: 'saule-taille',
    name: 'Saule taillé',
    family: 'base',
    output: 1,
    xp: 1230,
    hours: 24.75,
    energy: 100,
    ingredients: [ing('saule', 1)],
    trim: true,
  },

  // Doses de colorant
  {
    id: 'dose-beige',
    name: 'Dose de colorant beige',
    family: 'colorants',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('dose-blanche', 1), ing('dose-marron', 1)],
  },
  {
    id: 'dose-cyan',
    name: 'Dose de colorant cyan',
    family: 'colorants',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('dose-blanche', 1), ing('dose-bleue', 1)],
  },
  {
    id: 'dose-grise',
    name: 'Dose de colorant gris',
    family: 'colorants',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('dose-blanche', 1), ing('dose-noire', 1)],
  },
  {
    id: 'dose-marron-x1',
    name: 'Dose de colorant marron ×1',
    family: 'colorants',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('dose-rouge', 1), ing('dose-verte', 1), ing('hetre', 1)],
  },
  {
    id: 'dose-marron-x2',
    name: 'Doses de colorant marron ×2',
    family: 'colorants',
    output: 2,
    xp: 180,
    hours: 3,
    energy: 15,
    ingredients: [ing('dose-rouge', 1), ing('dose-verte', 1), ing('hetre', 1)],
  },
  {
    id: 'dose-pourpre-x1',
    name: 'Dose de colorant pourpre ×1',
    family: 'colorants',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('bouquets-passeroses', 1), ing('dose-bleue', 1), ing('dose-rouge', 1)],
  },
  {
    id: 'dose-pourpre-x2',
    name: 'Doses de colorant pourpre ×2',
    family: 'colorants',
    output: 2,
    xp: 180,
    hours: 3,
    energy: 15,
    ingredients: [ing('bouquets-passeroses', 1), ing('dose-bleue', 1), ing('dose-rouge', 1)],
  },
  {
    id: 'dose-rouge-x1',
    name: 'Dose de colorant rouge ×1',
    family: 'colorants',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('bouquet-garances', 1), ing('dose-jaune', 1), ing('dose-pourpre', 1)],
  },
  {
    id: 'dose-rouge-x2',
    name: 'Doses de colorant rouge ×2',
    family: 'colorants',
    output: 2,
    xp: 180,
    hours: 3,
    energy: 15,
    ingredients: [ing('bouquet-garances', 1), ing('dose-jaune', 1), ing('dose-pourpre', 1)],
  },
  {
    id: 'dose-verte-x1',
    name: 'Dose de colorant vert ×1',
    family: 'colorants',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [ing('caroubier', 1), ing('dose-bleue', 1), ing('dose-jaune', 1)],
  },
  {
    id: 'dose-verte-x2',
    name: 'Doses de colorant vert ×2',
    family: 'colorants',
    output: 2,
    xp: 180,
    hours: 3,
    energy: 15,
    ingredients: [ing('caroubier', 1), ing('dose-bleue', 1), ing('dose-jaune', 1)],
  },

  // Teintures capillaires
  {
    id: 'capillaire-blond-clair',
    name: 'Teinture capillaire — Blond clair',
    family: 'teintures-capillaires',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-blanche', 1),
      ing('dose-jaune', 1),
      ing('fleurs-camomille', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'capillaire-blond-dore',
    name: 'Teinture capillaire — Blond doré',
    family: 'teintures-capillaires',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-jaune', 1),
      ing('dose-marron', 1),
      ing('fleurs-camomille', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'capillaire-blanc-glacial',
    name: 'Teinture capillaire — Blanc glacial',
    family: 'teintures-capillaires',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-blanche', 2),
      ing('fleurs-pavot-blanc', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'capillaire-blond-miel',
    name: 'Teinture capillaire — Blond miel',
    family: 'teintures-capillaires',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-beige', 1),
      ing('dose-jaune', 1),
      ing('fleur-camomille', 1),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'capillaire-chatain-fonce',
    name: 'Teinture capillaire — Châtain foncé',
    family: 'teintures-capillaires',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-marron', 1),
      ing('dose-noire', 1),
      ing('ecorce-saule-blanc', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'capillaire-gris-argente',
    name: 'Teinture capillaire — Gris argenté',
    family: 'teintures-capillaires',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('baies-sureau-noir', 2),
      ing('dose-grise', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'capillaire-noir-de-jais',
    name: 'Teinture capillaire — Noir de jais',
    family: 'teintures-capillaires',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('baies-sureau-noir', 2),
      ing('dose-noire', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'capillaire-roux-cuivre',
    name: 'Teinture capillaire — Roux cuivré',
    family: 'teintures-capillaires',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-beige', 1),
      ing('dose-rouge', 1),
      ing('fleurs-camomille', 2),
      ing('pinceau-teinture', 1),
    ],
  },

  // Teintures pileuses
  {
    id: 'pileuse-blanc-glacial',
    name: 'Teinture pileuse — Blanc glacial',
    family: 'teintures-pileuses',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-blanche', 2),
      ing('fleurs-pavot-blanc', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'pileuse-blond-miel',
    name: 'Teinture pileuse — Blond miel',
    family: 'teintures-pileuses',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-beige', 1),
      ing('dose-jaune', 1),
      ing('fleurs-camomille', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'pileuse-chatain-fonce',
    name: 'Teinture pileuse — Châtain foncé',
    family: 'teintures-pileuses',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-marron', 1),
      ing('dose-noire', 1),
      ing('ecorce-saule-blanc', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'pileuse-gris-argente',
    name: 'Teinture pileuse — Gris argenté',
    family: 'teintures-pileuses',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('baies-sureau-noir', 2),
      ing('dose-grise', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'pileuse-noir-de-jais',
    name: 'Teinture pileuse — Noir de jais',
    family: 'teintures-pileuses',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('baies-sureau-noir', 2),
      ing('dose-noire', 2),
      ing('pinceau-teinture', 1),
    ],
  },
  {
    id: 'pileuse-roux-cuivre',
    name: 'Teinture pileuse — Roux cuivré',
    family: 'teintures-pileuses',
    output: 1,
    xp: 60,
    hours: 1,
    energy: 5,
    ingredients: [
      ing('dose-blanche', 1),
      ing('dose-rouge', 1),
      ing('fleurs-camomille', 2),
      ing('pinceau-teinture', 1),
    ],
  },
];

export interface BotanistPlant {
  key: string;
  label: string;
  kind: 'fleur' | 'arbre' | 'buisson' | 'epice';
  yieldMin: number;
  yieldMax: number;
  /** Temps de pousse en heures. */
  hours: number;
  /** Arrosage toutes les N heures. */
  waterEvery: number;
}

export const BOTANIST_PLANTS: BotanistPlant[] = [
  { key: 'bouleau', label: 'Bouleau cultivé', kind: 'arbre', yieldMin: 1, yieldMax: 1, hours: 617, waterEvery: 24 },
  { key: 'achillees', label: 'Bouquet d’achillées', kind: 'fleur', yieldMin: 3, yieldMax: 5, hours: 61, waterEvery: 6 },
  { key: 'garances', label: 'Bouquet de garances', kind: 'fleur', yieldMin: 3, yieldMax: 5, hours: 61, waterEvery: 6 },
  { key: 'guedes', label: 'Bouquet de guèdes', kind: 'fleur', yieldMin: 3, yieldMax: 5, hours: 61, waterEvery: 6 },
  { key: 'passeroses', label: 'Bouquet de passeroses', kind: 'fleur', yieldMin: 3, yieldMax: 5, hours: 61, waterEvery: 6 },
  { key: 'buisson-commun', label: 'Buisson commun', kind: 'buisson', yieldMin: 1, yieldMax: 1, hours: 216, waterEvery: 8 },
  { key: 'cannelle', label: 'Cannelle', kind: 'epice', yieldMin: 2, yieldMax: 2, hours: 240, waterEvery: 8 },
  { key: 'caroubier', label: 'Caroubier', kind: 'arbre', yieldMin: 1, yieldMax: 1, hours: 617, waterEvery: 24 },
  { key: 'cumin', label: 'Cumin', kind: 'epice', yieldMin: 2, yieldMax: 2, hours: 240, waterEvery: 8 },
  { key: 'hetre', label: 'Hêtre', kind: 'arbre', yieldMin: 1, yieldMax: 1, hours: 771, waterEvery: 24 },
  { key: 'safran', label: 'Safran', kind: 'epice', yieldMin: 2, yieldMax: 2, hours: 240, waterEvery: 8 },
  { key: 'saule', label: 'Saule', kind: 'arbre', yieldMin: 1, yieldMax: 1, hours: 926, waterEvery: 24 },
];

export const BOTANIST_SKILLS = [
  { name: 'Apprenti botaniste', effect: 'XP +5 à +25 %', prereq: '—', cost: '1 à 5 PC' },
  {
    name: 'Floriculteur',
    effect: 'Pousse des fleurs −10 à −30 %',
    prereq: 'Apprenti botaniste',
    cost: '1 à 3 PC',
  },
  {
    name: 'Pépiniériste',
    effect: 'Pousse des arbres et buissons −10 à −30 %',
    prereq: 'Apprenti botaniste',
    cost: '1 à 3 PC',
  },
  {
    name: 'Broyeur de couleurs',
    effect: '+1 colorant produit à partir de fleurs',
    prereq: 'Floriculteur',
    cost: '3 PC',
  },
  {
    name: 'Jardinier',
    effect: 'Taille des arbres et buissons −20 %',
    prereq: 'Pépiniériste',
    cost: '3 PC',
  },
  {
    name: 'Maîtrise du pot',
    effect: 'Durabilité du pot +15 %',
    prereq: 'Broyeur + Jardinier',
    cost: '3 PC',
  },
];

export function findBotanistRecipe(id: string | undefined): BotanistRecipe | undefined {
  return BOTANIST_RECIPES.find((recipe) => recipe.id === id);
}

/** Réduction du temps de production, en fraction (0 à 0,8). */
export function botanistTimeReduction(
  intelligence: number,
  virtuePercent: number,
  skillPercent: number,
): number {
  const int = Math.min(
    BOTANIST_RULES.intelligenceMax,
    Math.max(0, Number.isFinite(intelligence) ? intelligence : 0),
  );
  const virtue = Math.min(20, Math.max(0, Number.isFinite(virtuePercent) ? virtuePercent : 0));
  const skill = Math.min(30, Math.max(0, Number.isFinite(skillPercent) ? skillPercent : 0));
  return Math.min(
    0.8,
    (int / BOTANIST_RULES.intelligenceMax) * BOTANIST_RULES.intelligenceBonus +
      virtue / 100 +
      skill / 100,
  );
}

/** Durée effective d'une production, en heures. */
export function botanistRecipeDuration(
  recipe: BotanistRecipe,
  reduction: number,
): number {
  const safeReduction = Math.min(0.8, Math.max(0, Number.isFinite(reduction) ? reduction : 0));
  return recipe.hours * (1 - safeReduction);
}

export interface BotanistProductionInput {
  recipeId: string;
  /** Nombre de productions lancées. */
  batch: number;
  /** Prix unitaire par clé d'ingrédient. */
  prices: Record<string, number>;
  outputPrice: number;
  intelligence: number;
  virtuePercent: number;
  /** Réduction Jardinier, en pourcentage (0 / 10 / 20 / 30). */
  skillPercent: number;
}

export interface BotanistCostLine {
  key: string;
  label: string;
  qty: number;
  unitPrice: number;
  cost: number;
}

export interface BotanistProductionResult {
  recipe: BotanistRecipe;
  batch: number;
  reduction: number;
  hoursPerBatch: number;
  totalHours: number;
  outputQty: number;
  lines: BotanistCostLine[];
  ingredientCost: number;
  revenue: number;
  profit: number;
  profitPerHour: number;
  profitPerUnit: number;
  costPerUnit: number;
  xp: number;
  energy: number;
}

export function computeBotanistProduction(
  input: BotanistProductionInput,
): BotanistProductionResult {
  const recipe = findBotanistRecipe(input.recipeId) ?? BOTANIST_RECIPES[0];
  const batch = Math.min(99, Math.max(1, Math.round(Number.isFinite(input.batch) ? input.batch : 1)));
  const skill = recipe.trim ? input.skillPercent : 0;
  const reduction = botanistTimeReduction(input.intelligence, input.virtuePercent, skill);
  const hoursPerBatch = botanistRecipeDuration(recipe, reduction);
  const totalHours = hoursPerBatch * batch;
  const outputQty = recipe.output * batch;

  const lines = recipe.ingredients.map((ingredient) => {
    const unitPrice = safeMoney(input.prices[ingredient.key] ?? 0);
    return {
      key: ingredient.key,
      label: ingredient.label,
      qty: ingredient.qty * batch,
      unitPrice,
      cost: ingredient.qty * batch * unitPrice,
    };
  });

  const ingredientCost = lines.reduce((sum, line) => sum + line.cost, 0);
  const revenue = outputQty * safeMoney(input.outputPrice);
  const profit = revenue - ingredientCost;

  return {
    recipe,
    batch,
    reduction,
    hoursPerBatch,
    totalHours,
    outputQty,
    lines,
    ingredientCost,
    revenue,
    profit,
    profitPerHour: totalHours > 0 ? profit / totalHours : 0,
    profitPerUnit: outputQty > 0 ? profit / outputQty : 0,
    costPerUnit: outputQty > 0 ? ingredientCost / outputQty : 0,
    xp: recipe.xp * batch,
    energy: recipe.energy * batch,
  };
}

/** Culture → matière récoltée, telle qu'utilisée dans les recettes. */
export const BOTANIST_PLANT_PRODUCE: Record<string, string> = {
  achillees: 'bouquets-achillees',
  garances: 'bouquet-garances',
  guedes: 'bouquet-guedes',
  passeroses: 'bouquets-passeroses',
  bouleau: 'bouleau',
  caroubier: 'caroubier',
  hetre: 'hetre',
  saule: 'saule',
  'buisson-commun': 'buisson-commun',
  cannelle: 'batons-cannelle',
  cumin: 'graines-cumin',
  safran: 'stigmates-safran',
};

/** Recettes qui consomment la récolte d'une culture. */
export function botanistRecipesForPlant(plantKey: string): BotanistRecipe[] {
  const produce = BOTANIST_PLANT_PRODUCE[plantKey];
  if (!produce) return [];
  return BOTANIST_RECIPES.filter((recipe) =>
    recipe.ingredients.some((ingredient) => ingredient.key === produce),
  );
}

export interface BotanistCycleInput {
  plantKey: string;
  recipeId: string;
  /** Pots cultivés en parallèle (6 maximum). */
  pots: number;
  /** Cueillettes par pot avant qu'il casse (5). */
  harvestsPerPot: number;
  potPrice: number;
  /** Prix unitaire des ingrédients autres que la récolte cultivée. */
  prices: Record<string, number>;
  outputPrice: number;
  /** Floriculteur / Pépiniériste : réduction de la pousse, en pourcentage. */
  growthReductionPercent: number;
  intelligence: number;
  virtuePercent: number;
  /** Jardinier, pour les recettes de taille. */
  skillPercent: number;
  /** Broyeur de couleurs : +1 colorant par lot issu de fleurs. */
  colorantBonus?: boolean;
}

export interface BotanistCycleResult {
  plant: BotanistPlant;
  recipe: BotanistRecipe;
  pots: number;
  harvestsPerPot: number;
  /** Unités produites par lot, bonus Broyeur de couleurs compris. */
  outputPerBatch: number;
  harvestMin: number;
  harvestMax: number;
  batchMin: number;
  batchMax: number;
  outputMin: number;
  outputMax: number;
  /** Pousse de tous les pots en parallèle, en heures. */
  growthHours: number;
  /** Fabrication des lots du rendement maximal, en heures. */
  craftHours: number;
  totalHours: number;
  potCost: number;
  otherCost: number;
  revenueMin: number;
  revenueMax: number;
  profitMin: number;
  profitMax: number;
  profitPerHour: number;
  energy: number;
  xp: number;
}

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));

export function computeBotanistCycle(input: BotanistCycleInput): BotanistCycleResult {
  const plant = BOTANIST_PLANTS.find((entry) => entry.key === input.plantKey) ?? BOTANIST_PLANTS[0];
  const produce = BOTANIST_PLANT_PRODUCE[plant.key];
  const candidates = botanistRecipesForPlant(plant.key);
  const recipe =
    candidates.find((entry) => entry.id === input.recipeId) ?? candidates[0] ?? BOTANIST_RECIPES[0];

  const pots = clampInt(input.pots, 1, BOTANIST_RULES.maxPots);
  // shortcut: Maîtrise du pot (+15 % de chance de préserver le pot) n'est pas simulée ;
  // ajouter un facteur de durabilité si le rendement long terme doit l'inclure.
  const harvestsPerPot = clampInt(input.harvestsPerPot, 1, BOTANIST_RULES.potDurability);

  const harvestMin = pots * harvestsPerPot * plant.yieldMin;
  const harvestMax = pots * harvestsPerPot * plant.yieldMax;

  const consumed = recipe.ingredients.find((ingredient) => ingredient.key === produce)?.qty ?? 1;
  const batchMin = Math.floor(harvestMin / consumed);
  const batchMax = Math.floor(harvestMax / consumed);

  const growthReduction = Math.min(0.3, Math.max(0, input.growthReductionPercent / 100));
  const growthHours = harvestsPerPot * plant.hours * (1 - growthReduction);

  const reduction = botanistTimeReduction(
    input.intelligence,
    input.virtuePercent,
    recipe.trim ? input.skillPercent : 0,
  );
  const craftHours = batchMax * botanistRecipeDuration(recipe, reduction);
  const totalHours = growthHours + craftHours;

  const potCost = pots * safeMoney(input.potPrice);
  const otherPerBatch = recipe.ingredients
    .filter((ingredient) => ingredient.key !== produce)
    .reduce(
      (sum, ingredient) => sum + ingredient.qty * safeMoney(input.prices[ingredient.key] ?? 0),
      0,
    );
  const otherCost = otherPerBatch * batchMax;

  const flowerDye = recipe.ingredients.some((ingredient) => ingredient.key.startsWith('bouquet'));
  const outputPerBatch = recipe.output + (input.colorantBonus && flowerDye ? 1 : 0);

  const outputMin = batchMin * outputPerBatch;
  const outputMax = batchMax * outputPerBatch;
  const revenueMin = outputMin * safeMoney(input.outputPrice);
  const revenueMax = outputMax * safeMoney(input.outputPrice);
  const profitMin = revenueMin - potCost - otherPerBatch * batchMin;
  const profitMax = revenueMax - potCost - otherCost;

  return {
    plant,
    recipe,
    pots,
    harvestsPerPot,
    outputPerBatch,
    harvestMin,
    harvestMax,
    batchMin,
    batchMax,
    outputMin,
    outputMax,
    growthHours,
    craftHours,
    totalHours,
    potCost,
    otherCost,
    revenueMin,
    revenueMax,
    profitMin,
    profitMax,
    profitPerHour: totalHours > 0 ? profitMax / totalHours : 0,
    energy: recipe.energy * batchMax,
    xp: recipe.xp * batchMax,
  };
}

// ---------------------------------------------------------------------------
// Champs de culture
// ---------------------------------------------------------------------------

export type CropId = 'ble' | 'orge' | 'mais' | 'legumes' | 'oliviers' | 'vignes' | 'houblon';

export interface CropQualityRules {
  /** Qualité gagnée avec 20 points de Force (0 à 5). */
  force: number;
  /** Qualité gagnée avec 20 points d'Intelligence (0 à 5). */
  intelligence: number;
  conservation: number;
  ankou: number;
  bonSens: number;
  soc: number;
  cultivator: number;
}

export interface CropField {
  id: CropId;
  name: string;
  produce: string;
  /** Semence consommée à chaque cycle, si le champ doit être semé. */
  seed?: string;
  cycleDays: number;
  workSessions: number;
  hoursPerSession: number;
  energyPerSession: number;
  /** Récolte à 50 % de qualité, premier et second champ. */
  firstFieldYield: number;
  secondFieldYield: number;
  quality: CropQualityRules;
  /** Rendement fixe, indépendant de la qualité (houblon). */
  fixedYield?: number;
  note?: string;
}

export const CROP_FIELDS: CropField[] = [
  {
    id: 'ble',
    name: 'Champ de blé',
    produce: 'Sac de blé',
    seed: 'Sac de blé',
    cycleDays: 10,
    workSessions: 3,
    hoursPerSession: 10,
    energyPerSession: 100,
    firstFieldYield: 6,
    secondFieldYield: 4,
    quality: { force: 5, intelligence: 5, conservation: 4, ankou: 10, bonSens: 15, soc: 20, cultivator: 25 },
  },
  {
    id: 'orge',
    name: 'Champ d’orge',
    produce: 'Sac d’orge',
    seed: 'Sac d’orge',
    cycleDays: 9,
    workSessions: 3,
    hoursPerSession: 10,
    energyPerSession: 100,
    firstFieldYield: 6,
    secondFieldYield: 4,
    quality: { force: 5, intelligence: 5, conservation: 4, ankou: 10, bonSens: 15, soc: 20, cultivator: 25 },
  },
  {
    id: 'mais',
    name: 'Champ de maïs',
    produce: 'Sac de maïs',
    seed: 'Sac de maïs',
    cycleDays: 7,
    workSessions: 2,
    hoursPerSession: 10,
    energyPerSession: 100,
    firstFieldYield: 14,
    secondFieldYield: 9,
    quality: { force: 5, intelligence: 0, conservation: 4, ankou: 10, bonSens: 15, soc: 20, cultivator: 25 },
    note: 'Le soc et le sac de maïs originel comptent aussi dans la qualité ; le premier champ de maïs a un bonus propre non modélisé ici.',
  },
  {
    id: 'legumes',
    name: 'Champ de légumes',
    produce: 'Légume',
    cycleDays: 5,
    workSessions: 1,
    hoursPerSession: 10,
    energyPerSession: 100,
    firstFieldYield: 3,
    secondFieldYield: 2,
    quality: { force: 0, intelligence: 0, conservation: 4, ankou: 10, bonSens: 15, soc: 0, cultivator: 25 },
  },
  {
    id: 'oliviers',
    name: 'Champ d’oliviers',
    produce: 'Livre d’olives',
    cycleDays: 14,
    workSessions: 1,
    hoursPerSession: 10,
    energyPerSession: 100,
    firstFieldYield: 3,
    secondFieldYield: 2,
    quality: { force: 0, intelligence: 0, conservation: 4, ankou: 10, bonSens: 15, soc: 0, cultivator: 25 },
  },
  {
    id: 'vignes',
    name: 'Champ de vignes',
    produce: 'Livre de raisins',
    cycleDays: 30,
    workSessions: 3,
    hoursPerSession: 10,
    energyPerSession: 100,
    firstFieldYield: 15,
    secondFieldYield: 10,
    quality: { force: 5, intelligence: 5, conservation: 4, ankou: 10, bonSens: 15, soc: 0, cultivator: 25 },
  },
  {
    id: 'houblon',
    name: 'Champ de houblon',
    produce: 'Sac de houblon',
    seed: 'Sac de houblon',
    cycleDays: 10,
    workSessions: 2,
    hoursPerSession: 22,
    energyPerSession: 100,
    firstFieldYield: 10,
    secondFieldYield: 10,
    quality: { force: 0, intelligence: 0, conservation: 0, ankou: 0, bonSens: 0, soc: 40, cultivator: 0 },
    fixedYield: 10,
    note: 'Réservé aux monastères : 10 sacs par cycle quelles que soient les caractéristiques. 22 h de travail par étape.',
  },
];

export function findCrop(id: string | undefined): CropField | undefined {
  return CROP_FIELDS.find((field) => field.id === id);
}

export interface CropQualityInput {
  force: number;
  intelligence: number;
  conservation: boolean;
  ankou: boolean;
  bonSens: boolean;
  soc: boolean;
  cultivatorPercent: number;
}

/** Qualité du champ, en pourcentage, plafonnée à 100. */
export function cropQuality(field: CropField, input: CropQualityInput): number {
  const points = (value: number) => Math.min(20, Math.max(0, Number.isFinite(value) ? value : 0)) / 20;
  const cultivator = Math.min(25, Math.max(0, Number.isFinite(input.cultivatorPercent) ? input.cultivatorPercent : 0));

  const quality =
    50 +
    field.quality.force * points(input.force) +
    field.quality.intelligence * points(input.intelligence) +
    (input.conservation ? field.quality.conservation : 0) +
    (input.ankou ? field.quality.ankou : 0) +
    (input.bonSens ? field.quality.bonSens : 0) +
    (input.soc ? field.quality.soc : 0) +
    (cultivator / 25) * field.quality.cultivator;

  return Math.min(100, quality);
}

/** Récolte attendue pour une qualité donnée (50 % = minimum du wiki, 100 % = double). */
export function cropYield(field: CropField, quality: number, secondField = false): number {
  if (field.fixedYield !== undefined) return field.fixedYield;
  const base = secondField ? field.secondFieldYield : field.firstFieldYield;
  const q = Math.min(100, Math.max(50, Number.isFinite(quality) ? quality : 50));
  return Math.floor(base * (1 + (q - 50) / 50) + 1e-9);
}

export interface CropCycleInput extends CropQualityInput {
  cropId: string;
  secondField: boolean;
  seedPrice: number;
  producePrice: number;
  /** Salaire versé par session de travail. */
  salary: number;
}

export interface CropCycleResult {
  field: CropField;
  quality: number;
  yieldQty: number;
  revenue: number;
  seedCost: number;
  salaries: number;
  costs: number;
  profit: number;
  profitPerDay: number;
  hours: number;
  energy: number;
}

export function computeCropCycle(input: CropCycleInput): CropCycleResult {
  const field = findCrop(input.cropId) ?? CROP_FIELDS[0];
  const quality = cropQuality(field, input);
  const yieldQty = cropYield(field, quality, input.secondField);

  const producePrice = safeMoney(input.producePrice);
  const revenue = yieldQty * producePrice;
  const seedCost = field.seed ? safeMoney(input.seedPrice) : 0;
  const salaries = field.workSessions * safeMoney(input.salary);
  const costs = seedCost + salaries;
  const profit = revenue - costs;

  return {
    field,
    quality,
    yieldQty,
    revenue,
    seedCost,
    salaries,
    costs,
    profit,
    profitPerDay: field.cycleDays > 0 ? profit / field.cycleDays : 0,
    hours: field.workSessions * field.hoursPerSession,
    energy: field.workSessions * field.energyPerSession,
  };
}

// ---------------------------------------------------------------------------
// Élevages : cochons, moutons, chèvres
// ---------------------------------------------------------------------------

export type HerdId = 'cochons' | 'moutons' | 'chevres';

export interface HerdMilk {
  label: string;
  /** Intervalle optimal entre deux traites ou tontes, en jours. */
  every: number;
  tool: 'seau' | null;
  toolDurability: number;
}

export interface HerdRules {
  id: HerdId;
  name: string;
  price: number;
  maxAnimals: number;
  knifeDurability: number;
  secondFieldFactor: number;
  milk: HerdMilk | null;
  feed: 'none' | 'corn';
  growthChance: number;
  mortality: Readonly<Record<number, number>> | null;
  mortalityStart: number;
  idealAge: number;
}

const PIG_MORTALITY: Readonly<Record<number, number>> = {
  10: 2,
  11: 3,
  12: 15,
  13: 22,
  14: 25,
  15: 30,
};

const SHEEP_MORTALITY: Readonly<Record<number, number>> = {
  7: 8,
  8: 10,
  9: 12,
  10: 18,
  11: 25,
  12: 30,
};

export const HERD_RULES: HerdRules[] = [
  {
    id: 'cochons',
    name: 'Élevage de cochons',
    price: 25,
    maxAnimals: 4,
    knifeDurability: 5,
    secondFieldFactor: 0.85,
    milk: null,
    feed: 'corn',
    growthChance: 5 / 18,
    mortality: PIG_MORTALITY,
    mortalityStart: 10,
    idealAge: 12,
  },
  {
    id: 'moutons',
    name: 'Élevage de moutons',
    price: 35,
    maxAnimals: 4,
    knifeDurability: 5,
    secondFieldFactor: 0.85,
    milk: { label: 'Pelote de laine', every: 4, tool: null, toolDurability: 0 },
    feed: 'none',
    growthChance: 0.3,
    mortality: SHEEP_MORTALITY,
    mortalityStart: 7,
    idealAge: 10,
  },
  {
    id: 'chevres',
    name: 'Élevage de chèvres',
    price: 45,
    maxAnimals: 4,
    knifeDurability: 5,
    secondFieldFactor: 0.85,
    milk: { label: 'Bouteille de lait de chèvre', every: 3, tool: 'seau', toolDurability: 20 },
    feed: 'none',
    growthChance: 0,
    mortality: null,
    mortalityStart: 999,
    idealAge: 0,
  },
];

export function findHerd(id: string | undefined): HerdRules | undefined {
  return HERD_RULES.find((herd) => herd.id === id);
}

/** Risque de mourir dans la journée, en pourcentage. */
export function herdDailyMortality(herd: HerdRules, age: number): number {
  if (!herd.mortality) return 0;
  if (age < herd.mortalityStart) return 0;
  return herd.mortality[age] ?? 35;
}

/** Risque cumulé de mourir avant l'âge donné, en pourcentage. */
export function herdCumulativeMortality(herd: HerdRules, age: number): number {
  if (!herd.mortality) return 0;
  let survival = 1;
  const last = Math.max(...Object.keys(herd.mortality).map(Number));
  for (let day = herd.mortalityStart; day <= Math.min(age, last); day += 1) {
    survival *= 1 - herdDailyMortality(herd, day) / 100;
  }
  if (age > last) survival *= Math.pow(1 - 0.35, age - last);
  return (1 - survival) * 100;
}

/** Unités produites par bête et par traite / tonte. */
export function herdMilkPerOperation(intelligence: number): number {
  const effective = Math.min(20, Math.max(0, Number.isFinite(intelligence) ? intelligence : 0));
  return 1 * (1 + effective / 20);
}

/** Unités produites à l'abattage pour une corpulence donnée. */
export function herdCarcasses(herd: HerdRules, size: number, secondField = false): number {
  const safeSize = Math.min(8, Math.max(0, Number.isFinite(size) ? size : 0));
  const raw = safeSize * (secondField ? herd.secondFieldFactor : 1);
  return Math.floor(raw + 1e-9);
}

/** Corpulence attendue après `age` jours nourris (départ décharné). */
export function herdExpectedSize(herd: HerdRules, age: number): number {
  return Math.min(8, 1 + Math.max(0, age) * herd.growthChance);
}

export interface HerdAnimal {
  enabled: boolean;
  purchaseDay: number;
  slaughterAge: number;
  size: number;
}

export interface HerdCycleInput {
  herdId: string;
  animals: HerdAnimal[];
  /** 0 = jamais traire / tondre. */
  milkEvery: number;
  intelligence: number;
  secondField: boolean;
  /** Nourrir au maïs plutôt qu'à l'herbe (cochons uniquement). */
  feedCorn: boolean;
  animalPrice: number;
  knifePrice: number;
  bucketPrice: number;
  milkPrice: number;
  carcassPrice: number;
  cornPrice: number;
  milkSalary: number;
  slaughterSalary: number;
}

export interface HerdCycleAnimalResult {
  index: number;
  operations: number;
  milkQty: number;
  carcasses: number;
  dailyRisk: number;
  cumulativeRisk: number;
  slaughterDay: number;
}

export interface HerdCycleResult {
  herd: HerdRules;
  activeAnimals: number;
  cycleDays: number;
  slaughterConflicts: SlaughterConflict[];
  operations: number;
  milkQty: number;
  carcasses: number;
  milkRevenue: number;
  carcassRevenue: number;
  revenue: number;
  animalCost: number;
  toolCost: number;
  feedCost: number;
  salaries: number;
  costs: number;
  profit: number;
  profitPerAnimal: number;
  profitPerDay: number;
  perAnimal: HerdCycleAnimalResult[];
}

export function computeHerdCycle(input: HerdCycleInput): HerdCycleResult {
  const herd = findHerd(input.herdId) ?? HERD_RULES[0];
  const active = input.animals
    .map((animal, index) => ({ ...animal, index }))
    .filter((animal) => animal.enabled);

  const milkEvery = safeInt(input.milkEvery, herd.milk?.every ?? 0, 0, 30);
  const perOperation = herdMilkPerOperation(input.intelligence);
  const secondField = Boolean(input.secondField);

  const operationDays = new Set<number>();
  const perAnimal: HerdCycleAnimalResult[] = active.map((animal) => {
    const purchaseDay = safeInt(animal.purchaseDay, 1, 1, 60);
    const slaughterAge = safeInt(animal.slaughterAge, herd.idealAge, 0, 120);
    const size = safeInt(animal.size, 0, 0, 8);
    // Pas de traite / tonte le jour de l'abattage : la dernière passe tombe avant.
    const operations =
      milkEvery > 0 && herd.milk
        ? Math.max(0, Math.floor((slaughterAge - 1) / milkEvery))
        : 0;

    for (let k = 1; k <= operations; k += 1) {
      operationDays.add(purchaseDay + k * milkEvery - 1);
    }

    return {
      index: animal.index,
      operations,
      milkQty: operations * perOperation,
      carcasses: herdCarcasses(herd, size, secondField),
      dailyRisk: herdDailyMortality(herd, slaughterAge),
      cumulativeRisk: herdCumulativeMortality(herd, slaughterAge),
      slaughterDay: purchaseDay + slaughterAge - 1,
    };
  });

  const activeAnimals = active.length;
  const cycleDays = perAnimal.reduce((max, animal) => Math.max(max, animal.slaughterDay), 0);
  const operations = perAnimal.reduce((sum, animal) => sum + animal.operations, 0);
  const milkUses = operations;
  const milkQty = perAnimal.reduce((sum, animal) => sum + animal.milkQty, 0);
  const carcasses = perAnimal.reduce((sum, animal) => sum + animal.carcasses, 0);

  const toolUses = herd.milk?.tool === 'seau' ? milkUses : 0;
  const buckets = toolUses > 0 ? Math.ceil(toolUses / (herd.milk?.toolDurability || 20)) : 0;
  const knives = activeAnimals > 0 ? Math.ceil(activeAnimals / herd.knifeDurability) : 0;

  const milkRevenue = milkQty * safeMoney(input.milkPrice);
  const carcassRevenue = carcasses * safeMoney(input.carcassPrice);
  const revenue = milkRevenue + carcassRevenue;

  const animalCost = activeAnimals * safeMoney(input.animalPrice);
  const toolCost = knives * safeMoney(input.knifePrice) + buckets * safeMoney(input.bucketPrice);
  const feedDays = herd.feed === 'corn' && input.feedCorn
    ? active.reduce((sum, animal) => sum + safeInt(animal.slaughterAge, herd.idealAge, 0, 120), 0)
    : 0;
  const feedCost = feedDays * safeMoney(input.cornPrice);
  const salaries =
    operationDays.size * safeMoney(input.milkSalary) +
    activeAnimals * safeMoney(input.slaughterSalary);
  const costs = animalCost + toolCost + feedCost + salaries;
  const profit = revenue - costs;

  return {
    herd,
    activeAnimals,
    cycleDays,
    slaughterConflicts: findSlaughterConflicts(perAnimal),
    operations,
    milkQty,
    carcasses,
    milkRevenue,
    carcassRevenue,
    revenue,
    animalCost,
    toolCost,
    feedCost,
    salaries,
    costs,
    profit,
    profitPerAnimal: activeAnimals > 0 ? profit / activeAnimals : 0,
    profitPerDay: cycleDays > 0 ? profit / cycleDays : 0,
    perAnimal,
  };
}

// ---------------------------------------------------------------------------
// Rucher
// ---------------------------------------------------------------------------

export const APIARY_RULES = {
  hivePrice: 45,
  maxHives: 4,
  secondFieldFactor: 0.85,
  /** Niveaux d'humeur perdus après chaque récolte. */
  harvestMoodDrop: 3,
} as const;

export interface ApiaryMood {
  level: number;
  label: string;
  /** Pots de miel par ruche et par récolte. */
  honey: number;
  /** Probabilité d'une cire d'abeille par ruche et par récolte. */
  wax: number;
  /** Probabilité d'une gelée royale par ruche et par récolte. */
  jelly: number;
}

export const APIARY_MOODS: ApiaryMood[] = [
  { level: 0, label: 'Désespérées', honey: 0, wax: 0, jelly: 0 },
  { level: 1, label: 'Enragées', honey: 1, wax: 0.1, jelly: 0 },
  { level: 2, label: 'Agressives', honey: 2, wax: 0.2, jelly: 0 },
  { level: 3, label: 'Défensives', honey: 3, wax: 0.3, jelly: 0.01 },
  { level: 4, label: 'Anxieuses', honey: 4, wax: 0.4, jelly: 0.02 },
  { level: 5, label: 'Vigilantes', honey: 5, wax: 0.5, jelly: 0.03 },
  { level: 6, label: 'Sereines', honey: 6, wax: 0.6, jelly: 0.04 },
  { level: 7, label: 'Heureuses', honey: 7, wax: 0.8, jelly: 0.05 },
  { level: 8, label: 'Euphoriques', honey: 8, wax: 1, jelly: 0.06 },
];

export function apiaryMood(level: number): ApiaryMood {
  const index = Math.min(8, Math.max(0, Math.round(Number.isFinite(level) ? level : 0)));
  return APIARY_MOODS[index];
}

export interface ApiaryInput {
  hives: number;
  moodLevel: number;
  harvests: number;
  secondField: boolean;
  hivePrice: number;
  smokerPrice: number;
  honeyPrice: number;
  waxPrice: number;
  jellyPrice: number;
}

export interface ApiaryResult {
  hives: number;
  mood: ApiaryMood;
  harvests: number;
  honeyPerHive: number;
  honeyQty: number;
  waxQty: number;
  jellyQty: number;
  revenue: number;
  hiveCost: number;
  smokerCost: number;
  costs: number;
  profit: number;
  profitPerHive: number;
}

export function computeApiary(input: ApiaryInput): ApiaryResult {
  const hives = safeInt(input.hives, 1, 0, APIARY_RULES.maxHives);
  const mood = apiaryMood(input.moodLevel);
  const harvests = safeInt(input.harvests, 1, 1, 99);
  const factor = input.secondField ? APIARY_RULES.secondFieldFactor : 1;

  const honeyPerHive = Math.floor(mood.honey * factor + 1e-9);
  const honeyQty = honeyPerHive * hives * harvests;
  const waxQty = mood.wax * hives * harvests;
  const jellyQty = mood.jelly * hives * harvests;

  const revenue =
    honeyQty * safeMoney(input.honeyPrice) +
    waxQty * safeMoney(input.waxPrice) +
    jellyQty * safeMoney(input.jellyPrice);

  const hiveCost = hives * safeMoney(input.hivePrice);
  const smokerCost = hives > 0 ? safeMoney(input.smokerPrice) : 0;
  const costs = hiveCost + smokerCost;
  const profit = revenue - costs;

  return {
    hives,
    mood,
    harvests,
    honeyPerHive,
    honeyQty,
    waxQty,
    jellyQty,
    revenue,
    hiveCost,
    smokerCost,
    costs,
    profit,
    profitPerHive: hives > 0 ? profit / hives : 0,
  };
}