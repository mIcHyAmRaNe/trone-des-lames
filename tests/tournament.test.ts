import assert from 'node:assert/strict';
import { computeStandings, bracketSeeds, statusOf, roundOfSlot } from '../src/lib/tournament.ts';
import type { Fighter, Match } from '../src/lib/db.ts';

const F = (id: number, name: string, grp: string): Fighter => ({ id, name, grp, seed: id });
const M = (id: number, slot: number, a: number, b: number, w: number, aS: number, bS: number, forfeit = 0): Match => ({
  id, phase: 'group', slot, grp: null, a_id: a, b_id: b, winner_id: w,
  a_score: aS, b_score: bS, forfeit, played: 1,
});

// --- 1. Basic wins + points ordering
{
  const fighters = [F(1, 'A1', 'A'), F(2, 'A2', 'A'), F(3, 'A3', 'A'), F(4, 'A4', 'A')];
  const matches: Match[] = [
    { ...M(1, 1, 1, 2, 1, 24, 10), grp: 'A' },
    { ...M(2, 2, 3, 4, 3, 20, 12), grp: 'A' },
    { ...M(3, 3, 1, 3, 1, 18, 15), grp: 'A' },
    { ...M(4, 4, 2, 4, 2, 22, 9), grp: 'A' },
    { ...M(5, 5, 1, 4, 1, 21, 14), grp: 'A' },
    { ...M(6, 6, 2, 3, 3, 11, 19), grp: 'A' },
  ];
  const s = computeStandings(fighters, matches).A;
  assert.equal(s[0].name, 'A1'); // 3 wins
  assert.equal(s[0].wins, 3);
  assert.equal(s[0].points, 63);
  assert.equal(s[1].name, 'A3'); // 2 wins
  assert.equal(s[1].wins, 2);
  assert.equal(s[1].points, 54);
  assert.equal(s[2].name, 'A2');
  assert.equal(s[2].wins, 1);
  assert.equal(s[3].name, 'A4');
  assert.equal(s[3].wins, 0);
  assert.equal(s[0].qualified, true);
  assert.equal(s[1].qualified, true);
  assert.equal(s[2].qualified, false);
  console.log('✓ wins + points');
}

// --- 2. Equal wins, points decide
{
  const fighters = [F(1, 'P1', 'A'), F(2, 'P2', 'A'), F(3, 'P3', 'A'), F(4, 'P4', 'A')];
  const matches: Match[] = [
    { ...M(1, 1, 1, 2, 1, 20, 5), grp: 'A' },
    { ...M(2, 2, 3, 4, 3, 18, 6), grp: 'A' },
    { ...M(3, 3, 1, 3, 3, 10, 30), grp: 'A' },
    { ...M(4, 4, 2, 4, 2, 22, 4), grp: 'A' },
    { ...M(5, 5, 1, 4, 1, 19, 7), grp: 'A' },
    { ...M(6, 6, 2, 3, 2, 17, 9), grp: 'A' },
  ];
  const s = computeStandings(fighters, matches).A;
  // P1: 2 wins 49pts, P2: 2 wins 44pts, P3: 2 wins 57pts
  assert.equal(s[0].name, 'P3');
  assert.equal(s[0].points, 57);
  assert.equal(s[1].name, 'P1');
  assert.equal(s[2].name, 'P2');
  console.log('✓ points tiebreak');
}

// --- 3. Head-to-head when wins and points equal
{
  const fighters = [F(1, 'H1', 'A'), F(2, 'H2', 'A'), F(3, 'H3', 'A'), F(4, 'H4', 'A')];
  const matches: Match[] = [
    { ...M(1, 1, 1, 2, 1, 20, 10), grp: 'A' },
    { ...M(2, 2, 3, 4, 3, 20, 10), grp: 'A' },
    { ...M(3, 3, 1, 3, 3, 10, 20), grp: 'A' },
    { ...M(4, 4, 2, 4, 2, 20, 10), grp: 'A' },
    { ...M(5, 5, 1, 4, 1, 20, 10), grp: 'A' },
    { ...M(6, 6, 2, 3, 2, 20, 10), grp: 'A' },
  ];
  const s = computeStandings(fighters, matches).A;
  // H1 2W/50, H3 2W/50, H2 2W/50... all tied. H1 beat H3, H3 beat H2, H2 beat H1.
  // Cycle: h2h returns 0 for non-pair comparisons; ensure no crash and 6 rows.
  assert.equal(s.length, 4);
  console.log('✓ head-to-head cycle no crash');
}

// --- 4. Forfeit points: 1st = 18, 2nd = repeat 1st, 3rd = average
{
  const fighters = [F(1, 'W', 'A'), F(2, 'X', 'A'), F(3, 'Y', 'A'), F(4, 'Z', 'A')];
  const matches: Match[] = [
    { ...M(1, 1, 1, 2, 1, 22, 9), grp: 'A' },
    { ...M(2, 2, 3, 4, 3, 15, 8), grp: 'A' },
    { ...M(3, 3, 1, 3, 1, 0, 0, 1), grp: 'A' }, // forfeit, W's 2nd bout -> 22
    { ...M(4, 4, 2, 4, 2, 12, 7), grp: 'A' },
    { ...M(5, 5, 1, 4, 1, 0, 0, 1), grp: 'A' }, // forfeit, W's 3rd bout -> (22+22)/2 = 22
    { ...M(6, 6, 2, 3, 3, 13, 16), grp: 'A' },
  ];
  const s = computeStandings(fighters, matches).A;
  const w = s.find((x) => x.name === 'W')!;
  assert.equal(w.wins, 3);
  assert.equal(w.points, 66); // 22 + 22 + 22
  console.log('✓ forfeit repeat points');
}

// --- 5. Forfeit 3rd bout with non-integer average
{
  const fighters = [F(1, 'W', 'A'), F(2, 'X', 'A'), F(3, 'Y', 'A'), F(4, 'Z', 'A')];
  const matches: Match[] = [
    { ...M(1, 1, 1, 2, 1, 19, 9), grp: 'A' },
    { ...M(2, 2, 3, 4, 3, 15, 8), grp: 'A' },
    { ...M(3, 3, 1, 3, 1, 16, 10), grp: 'A' },
    { ...M(4, 4, 2, 4, 2, 12, 7), grp: 'A' },
    { ...M(5, 5, 1, 4, 1, 0, 0, 1), grp: 'A' }, // (19+16)/2 = 17.5
    { ...M(6, 6, 2, 3, 3, 13, 16), grp: 'A' },
  ];
  const s = computeStandings(fighters, matches).A;
  const w = s.find((x) => x.name === 'W')!;
  assert.equal(w.points, 52.5); // 19 + 16 + 17.5
  console.log('✓ forfeit average 17,5');
}

// --- 6. Forfeit on 1st bout = 18
{
  const fighters = [F(1, 'W', 'A'), F(2, 'X', 'A'), F(3, 'Y', 'A'), F(4, 'Z', 'A')];
  const matches: Match[] = [
    { ...M(1, 1, 1, 2, 1, 0, 0, 1), grp: 'A' },
    { ...M(2, 2, 3, 4, 3, 15, 8), grp: 'A' },
    { ...M(3, 3, 1, 3, 1, 20, 10), grp: 'A' },
    { ...M(4, 4, 2, 4, 2, 12, 7), grp: 'A' },
    { ...M(5, 5, 1, 4, 1, 25, 10), grp: 'A' },
    { ...M(6, 6, 2, 3, 3, 13, 16), grp: 'A' },
  ];
  const s = computeStandings(fighters, matches).A;
  const w = s.find((x) => x.name === 'W')!;
  assert.equal(w.points, 63); // 18 + 20 + 25
  console.log('✓ forfeit 18 on first bout');
}

// --- 7. Bracket seeding
{
  const standings = {
    A: [
      { fighterId: 101, name: 'A1', wins: 3, points: 60, rank: 1, qualified: true },
      { fighterId: 102, name: 'A2', wins: 2, points: 50, rank: 2, qualified: true },
    ],
    B: [
      { fighterId: 201, name: 'B1', wins: 3, points: 60, rank: 1, qualified: true },
      { fighterId: 202, name: 'B2', wins: 2, points: 50, rank: 2, qualified: true },
    ],
    C: [
      { fighterId: 301, name: 'C1', wins: 3, points: 60, rank: 1, qualified: true },
      { fighterId: 302, name: 'C2', wins: 2, points: 50, rank: 2, qualified: true },
    ],
    D: [
      { fighterId: 401, name: 'D1', wins: 3, points: 60, rank: 1, qualified: true },
      { fighterId: 402, name: 'D2', wins: 2, points: 50, rank: 2, qualified: true },
    ],
  };
  const seeds = bracketSeeds(standings);
  assert.deepEqual(seeds, [
    [101, 202], // QF1: 1A - 2B
    [201, 102], // QF2: 1B - 2A
    [301, 402], // QF3: 1C - 2D
    [401, 302], // QF4: 1D - 2C
  ]);
  console.log('✓ bracket seeding');
}

// --- 8. Round mapping
{
  assert.equal(roundOfSlot(1), 1);
  assert.equal(roundOfSlot(2), 1);
  assert.equal(roundOfSlot(3), 2);
  assert.equal(roundOfSlot(4), 2);
  assert.equal(roundOfSlot(5), 3);
  assert.equal(roundOfSlot(6), 3);
  console.log('✓ roundOfSlot');
}

// --- 9. Status
{
  assert.equal(statusOf([], false), 'setup');
  console.log('✓ status');
}

console.log('\nAll tournament logic tests passed.');
