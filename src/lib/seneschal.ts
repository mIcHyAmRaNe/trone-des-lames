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
 */

export type SeneschalToolStatus = 'available' | 'soon';

export interface SeneschalTool {
  slug: string;
  name: string;
  summary: string;
  status: SeneschalToolStatus;
  tag?: string;
  href?: string;
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
      },
      {
        slug: 'elevage-de-moutons',
        name: 'Élevage de moutons',
        summary: 'Laine et peaux : le rendement de la tonte et de l’abattage.',
        status: 'soon',
      },
      {
        slug: 'elevage-de-cochons',
        name: 'Élevage de cochons',
        summary: 'Poids, carcasses et cycle d’engraissement.',
        status: 'soon',
      },
      {
        slug: 'elevage-de-chevres',
        name: 'Élevage de chèvres',
        summary: 'Lait et carcasses du champ de chèvres.',
        status: 'soon',
      },
      {
        slug: 'champ-de-ble',
        name: 'Champ de blé',
        summary: 'Sacs de blé, qualité du champ et embauches.',
        status: 'soon',
      },
      {
        slug: 'champ-de-mais',
        name: 'Champ de maïs',
        summary: 'Rendement du maïs et coût des semailles.',
        status: 'soon',
      },
      {
        slug: 'champ-d-orge',
        name: 'Champ d’orge',
        summary: 'Orge, brasserie et rentabilité du cycle.',
        status: 'soon',
      },
      {
        slug: 'champ-d-oliviers',
        name: 'Champ d’oliviers',
        summary: 'Olives, huile et rendement du verger.',
        status: 'soon',
      },
      {
        slug: 'champ-de-vignes',
        name: 'Champ de vignes',
        summary: 'Raisins, vin et calcul du cycle viticole.',
        status: 'soon',
      },
      {
        slug: 'champ-de-legumes',
        name: 'Champ de légumes',
        summary: 'Le maraîcher et ses récoltes.',
        status: 'soon',
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
        slug: 'boucher',
        name: 'Boucher',
        summary: 'Carcasses, viande et découpe : la marge du boucher.',
        status: 'soon',
      },
      {
        slug: 'fromager',
        name: 'Fromager',
        summary: 'Lait, fromages et pots de yaourt.',
        status: 'soon',
      },
      {
        slug: 'boulanger',
        name: 'Boulanger',
        summary: 'Farine, pains et consommation de bois.',
        status: 'soon',
      },
      {
        slug: 'meunier',
        name: 'Meunier',
        summary: 'Blé, farine et rendement du moulin.',
        status: 'soon',
      },
      {
        slug: 'forgeron',
        name: 'Forgeron',
        summary: 'Minerai, outils et produits artisanaux.',
        status: 'soon',
      },
      {
        slug: 'charpentier',
        name: 'Charpentier',
        summary: 'Bois, meubles et pièces de charpente.',
        status: 'soon',
      },
      {
        slug: 'tisserand',
        name: 'Tisserand',
        summary: 'Laine, tissus et vêtements.',
        status: 'soon',
      },
      {
        slug: 'cidriculteur',
        name: 'Cidriculteur',
        summary: 'Pommes, cidre et cycle de production.',
        status: 'soon',
      },
      {
        slug: 'distillateur',
        name: 'Distillateur',
        summary: 'Alcools, matières premières et marges.',
        status: 'soon',
      },
      {
        slug: 'viniculteur',
        name: 'Viniculteur',
        summary: 'Raisins, vin et vieillissement.',
        status: 'soon',
      },
      {
        slug: 'oleiculteur',
        name: 'Oléiculteur',
        summary: 'Olives, huile et rendement de l’échoppe.',
        status: 'soon',
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

export interface CowCycleResult {
  activeCows: number;
  cycleDays: number;
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
    const milkings = milkEvery > 0 ? Math.floor(slaughterAge / milkEvery) : 0;

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
