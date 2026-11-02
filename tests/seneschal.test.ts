import assert from 'node:assert/strict';
import {
  COW_RULES,
  computeCowCycle,
  cowCarcasses,
  cowCumulativeMortality,
  cowDailyMortality,
  cowExpectedSize,
  cowMilkPerMilking,
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
  assert.equal(result.milkingOperations, 5);
  assert.equal(result.bucketUses, 20);
  assert.equal(result.buckets, 1);
  assert.equal(result.knives, 1);
  assert.equal(result.milkBottles, 40);
  assert.equal(result.carcasses, 12);
  assert.equal(result.revenue, 760);
  assert.equal(result.costs, 250);
  assert.equal(result.profit, 510);
  assert.equal(result.profitPerCow, 127.5);
  assert.equal(result.profitPerDay, 34);
  console.log('✓ cycle synchronisé');
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
  assert.equal(result.milkingOperations, 16);
  assert.equal(result.bucketUses, 20);
  assert.equal(result.milkBottles, 40);
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

  assert.equal(result.salaries, 5 * 12 + 12);
  console.log('✓ salaires et deniers');
}
