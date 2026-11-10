import assert from 'node:assert/strict';
import {
  APIARY_MOODS,
  BOTANIST_RECIPES,
  CROP_FIELDS,
  HERD_RULES,
  COW_RULES,
  apiaryMood,
  botanistRecipeDuration,
  botanistRecipesForPlant,
  botanistTimeReduction,
  computeApiary,
  computeBotanistCycle,
  computeBotanistProduction,
  computeCropCycle,
  computeHerdCycle,
  computeCowCycle,
  cowCarcasses,
  cowCumulativeMortality,
  cowDailyMortality,
  cowExpectedSize,
  cowMilkPerMilking,
  cropQuality,
  cropYield,
  CRAFT_SHOPS,
  craftRecipesByTier,
  computeCraftProduction,
  craftRecipeOutput,
  craftTimeReduction,
  parseCraftInput,
  findCategory,
  findCraft,
  findCrop,
  findHerd,
  herdCarcasses,
  herdCumulativeMortality,
  herdDailyMortality,
  herdExpectedSize,
  herdMilkPerOperation,
  findBotanistRecipe,
  toEcus,
} from '../src/lib/seneschal.ts';

// --- Lait : 1 bouteille × (1 + Intelligence/20), plafond à 20
{
  assert.equal(cowMilkPerMilking(0), 1);
  assert.equal(cowMilkPerMilking(10), 1.5);
  assert.equal(cowMilkPerMilking(20), 2);
  assert.equal(cowMilkPerMilking(57), 2); // plafonné
  assert.equal(cowMilkPerMilking(-5), 1);
  console.log('✓ rendement laitier');
}

// --- Deuxième champ : -15 % sur le lait et les carcasses
{
  assert.equal(cowMilkPerMilking(20, true), 1.7);
  assert.equal(cowCarcasses(3), 3);
  assert.equal(cowCarcasses(3, true), 2); // 2,55 -> 2
  assert.equal(cowCarcasses(8, true), 6); // 6,8 -> 6
  assert.equal(cowCarcasses(0), 0);
  console.log('✓ malus du second champ');
}

// --- Mortalité
{
  assert.equal(cowDailyMortality(9), 0);
  assert.equal(cowDailyMortality(10), 1);
  assert.equal(cowDailyMortality(21), 30);
  assert.equal(cowDailyMortality(22), 35);
  assert.equal(cowCumulativeMortality(9), 0);
  assert.ok(Math.abs(cowCumulativeMortality(10) - 1) < 1e-9);
  assert.ok(Math.abs(cowCumulativeMortality(11) - 2.98) < 1e-9);
  console.log('✓ table de mortalité');
}

// --- Croissance attendue (1/16 par jour, départ décharné)
{
  assert.equal(cowExpectedSize(0), 1);
  assert.equal(cowExpectedSize(16), 2);
  assert.equal(cowExpectedSize(112), 8);
  assert.equal(cowExpectedSize(200), 8);
  console.log('✓ croissance attendue');
}

// --- Cycle synchronisé : 4 vaches, 15 jours, traite tous les 3 jours, INT 20
{
  const result = computeCowCycle({
    cows: Array.from({ length: 4 }, () => ({
      enabled: true,
      purchaseDay: 1,
      slaughterAge: 15,
      size: 3,
    })),
    milkEvery: 3,
    intelligence: 20,
    secondField: false,
    cowPrice: COW_RULES.price,
    bucketPrice: 50,
    knifePrice: 20,
    milkPrice: 10,
    carcassPrice: 30,
    milkingSalary: 0,
    slaughterSalary: 0,
  });

  assert.equal(result.activeCows, 4);
  assert.equal(result.cycleDays, 15);
  assert.deepEqual(result.slaughterConflicts, [{ day: 15, indices: [0, 1, 2, 3] }]);
  assert.equal(result.milkingOperations, 4);
  assert.equal(result.bucketUses, 16);
  assert.equal(result.buckets, 1);
  assert.equal(result.knives, 1);
  assert.equal(result.milkBottles, 32);
  assert.equal(result.carcasses, 12);
  assert.equal(result.revenue, 680);
  assert.equal(result.costs, 250);
  assert.equal(result.profit, 430);
  assert.equal(result.profitPerCow, 107.5);
  assert.ok(Math.abs(result.profitPerDay - 430 / 15) < 1e-9);
  console.log('✓ cycle synchronisé');
}

// --- Pas de traite le jour de l'abattage : 14 j → 4 traites, 16 j → 5
{
  const milkingsAt = (slaughterAge: number) =>
    computeCowCycle({
      cows: [{ enabled: true, purchaseDay: 1, slaughterAge, size: 1 }],
      milkEvery: 3,
      intelligence: 20,
      secondField: false,
      cowPrice: 45,
      bucketPrice: 30,
      knifePrice: 17,
      milkPrice: 9,
      carcassPrice: 30,
      milkingSalary: 19,
      slaughterSalary: 0,
    }).perCow[0].milkings;

  assert.equal(milkingsAt(14), 4);
  assert.equal(milkingsAt(15), 4);
  assert.equal(milkingsAt(16), 5);
  assert.equal(milkingsAt(17), 5);
  console.log('✓ pas de traite le jour de l’abattage');
}

// --- Cycle décalé : les traites ne tombent pas les mêmes jours
{
  const result = computeCowCycle({
    cows: [1, 2, 3, 4].map((purchaseDay) => ({
      enabled: true,
      purchaseDay,
      slaughterAge: 15,
      size: 3,
    })),
    milkEvery: 3,
    intelligence: 20,
    secondField: false,
    cowPrice: 45,
    bucketPrice: 50,
    knifePrice: 20,
    milkPrice: 10,
    carcassPrice: 30,
    milkingSalary: 0,
    slaughterSalary: 0,
  });

  assert.equal(result.cycleDays, 18);
  assert.equal(result.slaughterConflicts.length, 0);
  assert.equal(result.milkingOperations, 13);
  assert.equal(result.bucketUses, 16);
  assert.equal(result.milkBottles, 32);
  console.log('✓ cycle décalé');
}

// --- Sans traite et vaches désactivées
{
  const result = computeCowCycle({
    cows: [
      { enabled: true, purchaseDay: 1, slaughterAge: 17, size: 4 },
      { enabled: false, purchaseDay: 1, slaughterAge: 17, size: 8 },
    ],
    milkEvery: 0,
    intelligence: 20,
    secondField: false,
    cowPrice: 45,
    bucketPrice: 50,
    knifePrice: 20,
    milkPrice: 10,
    carcassPrice: 30,
    milkingSalary: 0,
    slaughterSalary: 0,
  });

  assert.equal(result.activeCows, 1);
  assert.equal(result.milkBottles, 0);
  assert.equal(result.buckets, 0);
  assert.equal(result.carcasses, 4);
  assert.equal(result.costs, 65); // 45 + 1 couteau
  console.log('✓ traite désactivée');
}

// --- Salaires et conversion deniers
{
  assert.equal(toEcus(12, 50), 12.5);
  assert.equal(toEcus(0, 25), 0.25);

  const result = computeCowCycle({
    cows: [{ enabled: true, purchaseDay: 1, slaughterAge: 15, size: 3 }],
    milkEvery: 3,
    intelligence: 0,
    secondField: false,
    cowPrice: 45,
    bucketPrice: 0,
    knifePrice: 0,
    milkPrice: 10,
    carcassPrice: 30,
    milkingSalary: 12,
    slaughterSalary: 12,
  });

  assert.equal(result.salaries, 4 * 12 + 12);
  console.log('✓ salaires et deniers');
}

// --- Botaniste : réduction du temps de production
{
  assert.equal(botanistTimeReduction(0, 0, 0), 0);
  assert.ok(Math.abs(botanistTimeReduction(255, 0, 0) - 0.2) < 1e-9);
  assert.ok(Math.abs(botanistTimeReduction(127.5, 0, 0) - 0.1) < 1e-9);
  assert.ok(Math.abs(botanistTimeReduction(0, 9.5, 0) - 0.095) < 1e-9);
  assert.ok(Math.abs(botanistTimeReduction(0, 0, 20) - 0.2) < 1e-9);
  assert.equal(botanistTimeReduction(255, 9.5, 30), 0.595);
  assert.equal(botanistTimeReduction(999, 99, 99), 0.7); // bornes : INT 20 %, vertu 20 %, skill 30 %
  console.log('✓ botaniste : réduction du temps');
}

// --- Botaniste : durée d'une production
{
  const recipe = findBotanistRecipe('dose-blanche');
  assert.ok(recipe);
  assert.equal(botanistRecipeDuration(recipe, 0), 3);
  assert.ok(Math.abs(botanistRecipeDuration(recipe, 0.5) - 1.5) < 1e-9);
  console.log('✓ botaniste : durées');
}

// --- Botaniste : marge d'une production (2 doses blanches, bouleau à 100)
{
  const result = computeBotanistProduction({
    recipeId: 'dose-blanche',
    batch: 1,
    prices: { bouleau: 100 },
    outputPrice: 30,
    intelligence: 0,
    virtuePercent: 0,
    skillPercent: 0,
  });

  assert.equal(result.recipe.id, 'dose-blanche');
  assert.equal(result.outputQty, 2);
  assert.equal(result.totalHours, 3);
  assert.equal(result.ingredientCost, 100);
  assert.equal(result.revenue, 60);
  assert.equal(result.profit, -40);
  assert.equal(result.costPerUnit, 50);
  assert.equal(result.profitPerUnit, -20);
  assert.ok(Math.abs(result.profitPerHour + 40 / 3) < 1e-9);
  assert.equal(result.xp, 180);
  assert.equal(result.energy, 15);
  console.log('✓ botaniste : marge d’une production');
}

// --- Botaniste : lot, Intelligence et vertu
{
  const result = computeBotanistProduction({
    recipeId: 'capillaire-blond-clair',
    batch: 2,
    prices: {
      'dose-blanche': 20,
      'dose-jaune': 15,
      'fleurs-camomille': 4,
      'pinceau-teinture': 10,
    },
    outputPrice: 200,
    intelligence: 255,
    virtuePercent: 9.5,
    skillPercent: 0,
  });

  assert.equal(result.batch, 2);
  assert.equal(result.outputQty, 2);
  assert.ok(Math.abs(result.reduction - 0.295) < 1e-9);
  assert.ok(Math.abs(result.totalHours - 1.41) < 1e-9); // 1 h × 0,705 × 2
  assert.equal(result.ingredientCost, 2 * (20 + 15 + 8 + 10));
  assert.equal(result.revenue, 400);
  assert.equal(result.profit, 400 - 106);
  assert.equal(result.xp, 120);
  assert.equal(result.energy, 10);
  console.log('✓ botaniste : lot et bonus');
}

// --- Botaniste : Jardinier ne s'applique qu'à la taille
{
  const trimmed = computeBotanistProduction({
    recipeId: 'buisson-taille',
    batch: 1,
    prices: { 'buisson-commun': 10 },
    outputPrice: 50,
    intelligence: 0,
    virtuePercent: 0,
    skillPercent: 20,
  });
  assert.ok(Math.abs(trimmed.reduction - 0.2) < 1e-9);
  assert.ok(Math.abs(trimmed.totalHours - 9) < 1e-9); // 11,25 h × 0,8

  const other = computeBotanistProduction({
    recipeId: 'dose-bleue',
    batch: 1,
    prices: { 'bouquet-guedes': 10 },
    outputPrice: 50,
    intelligence: 0,
    virtuePercent: 0,
    skillPercent: 20,
  });
  assert.equal(other.reduction, 0);
  assert.equal(other.totalHours, 1);
  console.log('✓ botaniste : compétence Jardinier');
}

// --- Botaniste : jeu de données complet
{
  assert.ok(BOTANIST_RECIPES.length >= 45);
  assert.ok(BOTANIST_RECIPES.every((recipe) => recipe.ingredients.length > 0));
  assert.ok(BOTANIST_RECIPES.every((recipe) => recipe.hours > 0));
  assert.ok(BOTANIST_RECIPES.every((recipe) => recipe.output > 0));
  console.log('✓ botaniste : catalogue de recettes');
}

// --- Botaniste : récolte rattachée à la bonne recette
{
  assert.ok(botanistRecipesForPlant('guedes').some((recipe) => recipe.id === 'dose-bleue'));
  assert.ok(botanistRecipesForPlant('bouleau').some((recipe) => recipe.id === 'dose-blanche'));
  assert.ok(botanistRecipesForPlant('garances').some((recipe) => recipe.id === 'dose-rouge-x1'));
  assert.equal(botanistRecipesForPlant('inconnue').length, 0);
  console.log('✓ botaniste : cultures → recettes');
}

// --- Botaniste : cycle complet fleurs → colorant bleu
{
  const result = computeBotanistCycle({
    plantKey: 'guedes',
    recipeId: 'dose-bleue',
    pots: 5,
    harvestsPerPot: 5,
    potPrice: 10,
    prices: {},
    outputPrice: 2,
    growthReductionPercent: 0,
    intelligence: 0,
    virtuePercent: 0,
    skillPercent: 0,
  });
  assert.equal(result.harvestMin, 75); // 5 × 5 × 3
  assert.equal(result.harvestMax, 125); // 5 × 5 × 5
  assert.equal(result.batchMin, 75);
  assert.equal(result.batchMax, 125);
  assert.equal(result.outputMin, 75);
  assert.equal(result.outputMax, 125);
  assert.equal(result.growthHours, 305); // 5 × 61 h
  assert.equal(result.craftHours, 125); // 1 h par dose
  assert.equal(result.totalHours, 430);
  assert.equal(result.potCost, 50);
  assert.equal(result.revenueMin, 150);
  assert.equal(result.revenueMax, 250);
  assert.equal(result.profitMin, 100);
  assert.equal(result.profitMax, 200);
  console.log('✓ botaniste : cycle fleurs → colorant');
}

// --- Botaniste : cycle arbre → doses blanches (1 bouleau = 2 doses, 3 h)
{
  const result = computeBotanistCycle({
    plantKey: 'bouleau',
    recipeId: 'dose-blanche',
    pots: 5,
    harvestsPerPot: 5,
    potPrice: 10,
    prices: {},
    outputPrice: 2,
    growthReductionPercent: 0,
    intelligence: 255, // −20 %
    virtuePercent: 9.5,
    skillPercent: 30,
  });
  assert.equal(result.harvestMax, 25);
  assert.equal(result.batchMax, 25);
  assert.equal(result.outputMax, 50);
  assert.equal(result.growthHours, 3085); // 5 × 617 h
  assert.ok(Math.abs(result.craftHours - 25 * 3 * 0.705) < 1e-9); // 1 − 0,295
  assert.equal(result.energy, 375);
  assert.equal(result.xp, 4500);
  assert.equal(result.profitMax, 50); // 100 − 50
  console.log('✓ botaniste : cycle arbre → colorant');
}

// --- Botaniste : Broyeur de couleurs, +1 colorant par lot de fleurs
{
  const bonus = computeBotanistCycle({
    plantKey: 'guedes',
    recipeId: 'dose-bleue',
    pots: 5,
    harvestsPerPot: 5,
    potPrice: 10,
    prices: {},
    outputPrice: 2,
    growthReductionPercent: 0,
    intelligence: 0,
    virtuePercent: 0,
    skillPercent: 0,
    colorantBonus: true,
  });
  assert.equal(bonus.outputPerBatch, 2);
  assert.equal(bonus.outputMax, 250);
  assert.equal(bonus.revenueMax, 500);

  const tree = computeBotanistCycle({
    plantKey: 'bouleau',
    recipeId: 'dose-blanche',
    pots: 1,
    harvestsPerPot: 1,
    potPrice: 10,
    prices: {},
    outputPrice: 2,
    growthReductionPercent: 0,
    intelligence: 0,
    virtuePercent: 0,
    skillPercent: 0,
    colorantBonus: true,
  });
  assert.equal(tree.outputPerBatch, 2); // le bonus ne touche que les fleurs
  console.log('✓ botaniste : Broyeur de couleurs');
}

// --- Botaniste : bornes et ingrédients secondaires
{
  const result = computeBotanistCycle({
    plantKey: 'passeroses',
    recipeId: 'dose-pourpre-x1',
    pots: 99, // plafonné à 6
    harvestsPerPot: 99, // plafonné à 5
    potPrice: 10,
    prices: { 'dose-bleue': 4, 'dose-rouge': 6 },
    outputPrice: 10,
    growthReductionPercent: 30,
    intelligence: 0,
    virtuePercent: 0,
    skillPercent: 0,
  });
  assert.equal(result.pots, 6);
  assert.equal(result.harvestsPerPot, 5);
  assert.equal(result.growthHours, 5 * 61 * 0.7);
  assert.equal(result.otherCost, 150 * 10); // 150 lots × (4 + 6)
  assert.equal(result.profitMax, 150 * 10 - 60 - 1500);
  console.log('✓ botaniste : bornes et coûts annexes');
}

// --- Champs de culture : qualité
{
  const wheat = findCrop('ble');
  assert.ok(wheat);
  assert.equal(
    cropQuality(wheat, {
      force: 0,
      intelligence: 0,
      conservation: false,
      ankou: false,
      bonSens: false,
      soc: false,
      cultivatorPercent: 0,
    }),
    50,
  );
  assert.equal(
    cropQuality(wheat, {
      force: 20,
      intelligence: 20,
      conservation: true,
      ankou: true,
      bonSens: true,
      soc: true,
      cultivatorPercent: 25,
    }),
    100, // 50 + 5 + 5 + 4 + 10 + 15 + 20 + 25 = 134, plafonné
  );
  assert.equal(
    cropQuality(wheat, {
      force: 10,
      intelligence: 0,
      conservation: false,
      ankou: false,
      bonSens: false,
      soc: false,
      cultivatorPercent: 10,
    }),
    62.5, // 50 + 2,5 + 10
  );
  console.log('✓ cultures : qualité');
}

// --- Champs de culture : rendement
{
  const wheat = findCrop('ble');
  assert.ok(wheat);
  assert.equal(cropYield(wheat, 50), 6);
  assert.equal(cropYield(wheat, 100), 12);
  assert.equal(cropYield(wheat, 50, true), 4);
  assert.equal(cropYield(wheat, 100, true), 8);
  assert.equal(cropYield(wheat, 20), 6); // plancher à 50 %
  assert.equal(cropYield(wheat, 250), 12); // plafond à 100 %

  const hops = findCrop('houblon');
  assert.ok(hops);
  assert.equal(cropYield(hops, 100), 10);
  assert.equal(cropYield(hops, 50), 10);
  console.log('✓ cultures : rendement');
}

// --- Champs de culture : cycle complet (blé, qualité 50 %)
{
  const result = computeCropCycle({
    cropId: 'ble',
    secondField: false,
    force: 0,
    intelligence: 0,
    conservation: false,
    ankou: false,
    bonSens: false,
    soc: false,
    cultivatorPercent: 0,
    seedPrice: 10,
    producePrice: 10,
    salary: 0,
  });

  assert.equal(result.field.id, 'ble');
  assert.equal(result.quality, 50);
  assert.equal(result.yieldQty, 6);
  assert.equal(result.revenue, 60);
  assert.equal(result.seedCost, 10);
  assert.equal(result.salaries, 0);
  assert.equal(result.costs, 10);
  assert.equal(result.profit, 50);
  assert.equal(result.profitPerDay, 5);
  assert.equal(result.hours, 30);
  assert.equal(result.energy, 300);
  console.log('✓ cultures : cycle complet');
}

// --- Champs de culture : second champ et salaires
{
  const result = computeCropCycle({
    cropId: 'vignes',
    secondField: true,
    force: 20,
    intelligence: 20,
    conservation: true,
    ankou: true,
    bonSens: true,
    soc: false,
    cultivatorPercent: 25,
    seedPrice: 0,
    producePrice: 5,
    salary: 12,
  });

  assert.equal(result.quality, 100); // 50 + 5 + 5 + 4 + 10 + 15 + 25
  assert.equal(result.yieldQty, 20); // 10 × 2
  assert.equal(result.seedCost, 0);
  assert.equal(result.salaries, 36);
  assert.equal(result.revenue, 100);
  assert.equal(result.profit, 64);
  console.log('✓ cultures : second champ');
}

// --- Élevages : rendements de base
{
  assert.equal(herdMilkPerOperation(0), 1);
  assert.equal(herdMilkPerOperation(20), 2);
  assert.equal(herdMilkPerOperation(57), 2);

  const sheep = findHerd('moutons');
  const pig = findHerd('cochons');
  const goat = findHerd('chevres');
  assert.ok(sheep && pig && goat);

  assert.equal(herdCarcasses(sheep, 3), 3);
  assert.equal(herdCarcasses(sheep, 3, true), 2);
  assert.equal(herdCarcasses(sheep, 8, true), 6);
  assert.equal(herdCarcasses(goat, 8), 8);
  assert.equal(herdExpectedSize(sheep, 0), 1);
  assert.ok(Math.abs(herdExpectedSize(sheep, 20) - 7) < 1e-9);
  assert.equal(herdExpectedSize(sheep, 100), 8);
  console.log('✓ élevages : rendements');
}

// --- Élevages : mortalité documentée et non documentée
{
  const pig = findHerd('cochons');
  const sheep = findHerd('moutons');
  const goat = findHerd('chevres');
  assert.ok(pig && sheep && goat);

  assert.equal(herdDailyMortality(pig, 9), 0);
  assert.equal(herdDailyMortality(pig, 10), 2);
  assert.equal(herdDailyMortality(pig, 15), 30);
  assert.equal(herdDailyMortality(pig, 16), 35);
  assert.equal(herdDailyMortality(sheep, 6), 0);
  assert.equal(herdDailyMortality(sheep, 7), 8);
  assert.equal(herdDailyMortality(goat, 12), 0);
  assert.equal(herdCumulativeMortality(goat, 50), 0);
  assert.ok(Math.abs(herdCumulativeMortality(pig, 10) - 2) < 1e-9);
  assert.ok(Math.abs(herdCumulativeMortality(sheep, 8) - 17.2) < 1e-9); // 1 - 0,92 × 0,90
  console.log('✓ élevages : mortalité');
}

// --- Élevages : cycle cochons sans traite
{
  const result = computeHerdCycle({
    herdId: 'cochons',
    animals: [
      { enabled: true, purchaseDay: 1, slaughterAge: 12, size: 3 },
      { enabled: true, purchaseDay: 1, slaughterAge: 12, size: 3 },
      { enabled: false, purchaseDay: 1, slaughterAge: 12, size: 8 },
    ],
    milkEvery: 0,
    intelligence: 20,
    secondField: false,
    feedCorn: false,
    animalPrice: 25,
    knifePrice: 20,
    bucketPrice: 50,
    milkPrice: 10,
    carcassPrice: 30,
    cornPrice: 2.5,
    milkSalary: 0,
    slaughterSalary: 0,
  });

  assert.equal(result.activeAnimals, 2);
  assert.equal(result.cycleDays, 12);
  assert.equal(result.operations, 0);
  assert.equal(result.milkQty, 0);
  assert.equal(result.carcasses, 6);
  assert.equal(result.revenue, 180);
  assert.equal(result.animalCost, 50);
  assert.equal(result.toolCost, 20);
  assert.equal(result.feedCost, 0);
  assert.equal(result.costs, 70);
  assert.equal(result.profit, 110);
  console.log('✓ élevages : cycle cochons');
}

// --- Élevages : nourriture au maïs
{
  const result = computeHerdCycle({
    herdId: 'cochons',
    animals: [
      { enabled: true, purchaseDay: 1, slaughterAge: 12, size: 4 },
      { enabled: true, purchaseDay: 1, slaughterAge: 10, size: 4 },
    ],
    milkEvery: 0,
    intelligence: 0,
    secondField: false,
    feedCorn: true,
    animalPrice: 25,
    knifePrice: 20,
    bucketPrice: 50,
    milkPrice: 0,
    carcassPrice: 30,
    cornPrice: 2.5,
    milkSalary: 0,
    slaughterSalary: 0,
  });

  assert.equal(result.feedCost, 22 * 2.5); // 12 + 10 jours
  assert.equal(result.carcasses, 8);
  console.log('✓ élevages : nourriture au maïs');
}

// --- Élevages : cycle moutons (tonte tous les 4 jours)
{
  const result = computeHerdCycle({
    herdId: 'moutons',
    animals: Array.from({ length: 4 }, () => ({
      enabled: true,
      purchaseDay: 1,
      slaughterAge: 12,
      size: 3,
    })),
    milkEvery: 4,
    intelligence: 20,
    secondField: false,
    feedCorn: false,
    animalPrice: 35,
    knifePrice: 20,
    bucketPrice: 0,
    milkPrice: 10,
    carcassPrice: 30,
    cornPrice: 0,
    milkSalary: 0,
    slaughterSalary: 0,
  });

  assert.deepEqual(result.slaughterConflicts, [{ day: 12, indices: [0, 1, 2, 3] }]);
  assert.equal(result.operations, 8); // 4 moutons × 2 tontes (pas de tonte le jour de l'abattage)
  assert.equal(result.milkQty, 16); // 2 pelotes par tonte
  assert.equal(result.carcasses, 12);
  assert.equal(result.revenue, 520);
  assert.equal(result.animalCost, 140);
  assert.equal(result.toolCost, 20); // 4 abattages, 1 couteau
  assert.equal(result.profit, 360);
  console.log('✓ élevages : cycle moutons');
}

// --- Brebis : pas de tonte le jour de l'abattage (12 j → 2, 13 j → 3)
{
  const shearingsAt = (slaughterAge: number) =>
    computeHerdCycle({
      herdId: 'moutons',
      animals: [{ enabled: true, purchaseDay: 1, slaughterAge, size: 1 }],
      milkEvery: 4,
      intelligence: 20,
      secondField: false,
      feedCorn: false,
      animalPrice: 35,
      knifePrice: 17,
      bucketPrice: 0,
      milkPrice: 9,
      carcassPrice: 30,
      cornPrice: 0,
      milkSalary: 19,
      slaughterSalary: 0,
    }).perAnimal[0].operations;

  assert.equal(shearingsAt(11), 2);
  assert.equal(shearingsAt(12), 2);
  assert.equal(shearingsAt(13), 3);
  console.log('✓ brebis : pas de tonte le jour de l’abattage');
}

// --- Rucher : table d'humeur et récolte
{
  assert.equal(APIARY_MOODS.length, 9);
  assert.equal(apiaryMood(0).honey, 0);
  assert.equal(apiaryMood(8).honey, 8);
  assert.equal(apiaryMood(8).wax, 1);
  assert.equal(apiaryMood(3).jelly, 0.01);
  assert.equal(apiaryMood(99).level, 8);

  const result = computeApiary({
    hives: 4,
    moodLevel: 8,
    harvests: 1,
    secondField: false,
    hivePrice: 45,
    smokerPrice: 30,
    honeyPrice: 10,
    waxPrice: 20,
    jellyPrice: 100,
  });

  assert.equal(result.honeyPerHive, 8);
  assert.equal(result.honeyQty, 32);
  assert.equal(result.waxQty, 4);
  assert.ok(Math.abs(result.jellyQty - 0.24) < 1e-9);
  assert.equal(result.revenue, 424); // 320 + 80 + 24
  assert.equal(result.hiveCost, 180);
  assert.equal(result.smokerCost, 30);
  assert.equal(result.costs, 210);
  assert.equal(result.profit, 214);
  console.log('✓ rucher : récolte');
}

// --- Rucher : second champ et plafonds
{
  const result = computeApiary({
    hives: 9,
    moodLevel: 8,
    harvests: 2,
    secondField: true,
    hivePrice: 45,
    smokerPrice: 0,
    honeyPrice: 10,
    waxPrice: 0,
    jellyPrice: 0,
  });

  assert.equal(result.hives, 4);
  assert.equal(result.harvests, 2);
  assert.equal(result.honeyPerHive, 6); // 8 × 0,85 arrondi au sol
  assert.equal(result.honeyQty, 48);
  console.log('✓ rucher : second champ');
}

// --- Jeux de données complets
{
  assert.equal(CROP_FIELDS.length, 7);
  assert.equal(HERD_RULES.length, 3);
  assert.ok(CROP_FIELDS.every((field) => field.cycleDays > 0));
  assert.ok(HERD_RULES.every((herd) => herd.maxAnimals === 4));
  console.log('✓ données : champs et élevages');
}

// --- Métiers d'échoppe : recettes et catalogue
{
  const ids = [
    'boucher',
    'boulanger',
    'charpentier',
    'cidriculteur',
    'distillateur',
    'forgeron',
    'fromager',
    'meunier',
    'oleiculteur',
    'sculpteur',
    'tisserand',
    'viniculteur',
  ];
  assert.deepEqual(Object.keys(CRAFT_SHOPS).sort(), [...ids].sort());
  for (const id of ids) {
    const craft = findCraft(id);
    assert.ok(craft, id);
    assert.equal(craft.id, id);
    assert.ok(craft.bonus.length > 0, `${id} : bonus manquant`);
    assert.ok(craft.recipes.length >= 1, `${id} : recettes insuffisantes`);
    for (const recipe of craft.recipes) {
      assert.ok(recipe.name.length > 0, `${id} : recette sans nom`);
      assert.ok(recipe.inputs.length > 0, `${id} / ${recipe.name} : sans matière`);
      assert.ok(recipe.hours > 0, `${id} / ${recipe.name} : durée nulle`);
      assert.ok(recipe.energy > 0, `${id} / ${recipe.name} : énergie nulle`);
    }
  }
  console.log('✓ métiers : données de recettes');
}

{
  // Les recettes sont regroupées par palier, sans groupe vide, et sans perte.
  for (const craft of Object.values(CRAFT_SHOPS)) {
    const groups = craftRecipesByTier(craft);
    assert.ok(groups.length > 0, `${craft.id} : aucun palier`);
    const total = groups.reduce((sum, group) => sum + group.recipes.length, 0);
    assert.equal(total, craft.recipes.length, `${craft.id} : recettes perdues au tri`);
    assert.ok(groups.every((group) => group.recipes.length > 0));
  }
  console.log('✓ métiers : regroupement par palier');
}

{
  // Chaque métier est publié dans les Échoppes et pointe vers son calculateur.
  const echoppes = findCategory('echoppes');
  assert.ok(echoppes);
  const available = echoppes.tools.filter((tool) => tool.status === 'available');
  for (const id of Object.keys(CRAFT_SHOPS)) {
    const tool = available.find((entry) => entry.slug === id);
    assert.ok(tool, `${id} non disponible`);
    assert.equal(tool.kind, 'craft');
    assert.equal(tool.href ?? `/seneschal/echoppes/${tool.slug}`, `/seneschal/echoppes/${id}`);
  }
  console.log('✓ métiers : présence dans le catalogue');
}

{
  assert.equal(findCraft('inexistant'), undefined);
  assert.equal(findCraft(undefined), undefined);
  console.log('✓ métiers : identifiants inconnus');
}

{
  assert.deepEqual(parseCraftInput('2 sacs de farine'), { qty: 2, label: 'sacs de farine' });
  assert.deepEqual(parseCraftInput('1 quintal de pierres'), { qty: 1, label: 'quintal de pierres' });
  assert.equal(
    craftRecipeOutput({ name: 'test', inputs: [], hours: 1, energy: 1, output: 6 }),
    6,
  );
  console.log('✓ métiers : analyse des matières');
}

{
  // 6 miches : 2 sacs à 10 écus + 1 stère à 5 écus, vente à 3 écus.
  const result = computeCraftProduction({
    craftId: 'boulanger',
    recipeName: 'Miches de pain',
    batch: 1,
    prices: { 'sacs de farine': 10, 'stère de bois': 5 },
    outputPrice: 3,
    intelligence: 0,
    virtuePercent: 0,
    skillPercent: 0,
  });
  assert.equal(result.outputQty, 6);
  assert.equal(result.ingredientCost, 25);
  assert.equal(result.revenue, 18);
  assert.equal(result.profit, -7);
  assert.equal(result.totalHours, 2.4);
  assert.equal(result.energy, 10);
  console.log('✓ métiers : marge et coûts');
}

{
  assert.equal(craftTimeReduction(0, 0, 0), 0);
  assert.equal(Math.round(craftTimeReduction(255, 9.5, 50) * 1000) / 1000, 0.795);
  console.log('✓ métiers : réductions de temps');
}
