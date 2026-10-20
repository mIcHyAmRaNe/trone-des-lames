/**
 * Seeds a fully simulated "Classique" edition: 16 fighters, group draw,
 * 24 group duels (one forfeit), bracket, and played quarter-finals.
 * Usage: node tests/seed.mjs [baseUrl] [--allow-remote]
 *
 * WARNING: this wipes the database it talks to. It refuses any non-local host
 * unless --allow-remote is passed.
 */
const BASE = process.argv[2] ?? 'http://localhost:4321';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'trone';

if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(BASE) && !process.argv.includes('--allow-remote')) {
  console.error(`Refusé : ${BASE} n'est pas un serveur local. Ajoutez --allow-remote pour forcer.`);
  process.exit(1);
}

let cookie = '';

async function req(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

// Deterministic pseudo-random so reruns look the same.
let seed = 20261019;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const between = (min, max) => Math.round(min + rnd() * (max - min));

const FIGHTERS = [
  { name: 'Sabdel', strength: 0.92 },
  { name: 'Harvey_specture', strength: 0.88 },
  { name: 'Grimm_de_Fer', strength: 0.8 },
  { name: 'Lysandra', strength: 0.78 },
  { name: 'Thorne', strength: 0.74 },
  { name: 'Maelis', strength: 0.7 },
  { name: 'Corvus', strength: 0.66 },
  { name: 'Isolde', strength: 0.62 },
  { name: 'Bran_le_Borgne', strength: 0.58 },
  { name: 'Seraphine', strength: 0.54 },
  { name: 'Dorian', strength: 0.5 },
  { name: 'Nyx', strength: 0.46 },
  { name: 'Aldric', strength: 0.42 },
  { name: 'Vesper', strength: 0.36 },
  { name: 'Kael', strength: 0.3 },
  { name: 'Morgane', strength: 0.24 },
];

const strengthOf = new Map();

/** Two plausible duel scores; the stronger fighter is favoured, not guaranteed. */
function duelScore(aId, bId) {
  const sa = strengthOf.get(aId) ?? 0.5;
  const sb = strengthOf.get(bId) ?? 0.5;
  const edge = sa - sb;

  let a = between(15, 25) + Math.round(edge * 6);
  let b = between(15, 25) - Math.round(edge * 6);
  a = Math.max(6, Math.min(30, a));
  b = Math.max(6, Math.min(30, b));

  if (a === b) a += rnd() > 0.5 ? 1 : -1;
  return { a, b };
}

async function main() {
  console.log(`Seed → ${BASE}`);

  await req('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: PASSWORD }) });
  await req('/api/admin/reset', { method: 'POST', body: JSON.stringify({ what: 'all' }) });

  for (const f of FIGHTERS) {
    const { id } = await req('/api/admin/fighters', {
      method: 'POST',
      body: JSON.stringify({ name: f.name }),
    });
    strengthOf.set(id, f.strength);
  }
  console.log(`  ${FIGHTERS.length} combattants inscrits`);

  await req('/api/admin/draw', { method: 'POST' });
  let state = await req('/api/tournament?slug=classique');
  console.log('  groupes tirés');

  // --- Group stage ---------------------------------------------------------
  const groupMatches = state.matches.filter((m) => m.phase === 'group');
  const results = [];

  // One forfeit, on a fighter's 3rd bout, to exercise the rule end to end.
  const forfeitMatch = groupMatches.find((m) => m.slot % 2 === 0) ?? groupMatches[1];

  for (const m of groupMatches) {
    if (!m.a || !m.b) continue;
    if (m.id === forfeitMatch.id) {
      results.push({ id: m.id, forfeit: true, forfeitLoserId: m.a.id });
      continue;
    }
    const { a, b } = duelScore(m.a.id, m.b.id);
    results.push({ id: m.id, aScore: a, bScore: b });
  }

  await req('/api/admin/match', { method: 'POST', body: JSON.stringify({ results }) });
  state = await req('/api/tournament?slug=classique');
  console.log(`  ${groupMatches.length} duels de poules validés (dont 1 forfait)`);

  // --- Bracket -------------------------------------------------------------
  await req('/api/admin/bracket', { method: 'POST' });
  state = await req('/api/tournament?slug=classique');

  const qf = state.matches.filter((m) => m.phase === 'qf').sort((a, b) => a.slot - b.slot);
  const qfResults = qf.map((m) => {
    const { a, b } = duelScore(m.a.id, m.b.id);
    return { id: m.id, aScore: a, bScore: b };
  });

  await req('/api/admin/match', { method: 'POST', body: JSON.stringify({ results: qfResults }) });
  state = await req('/api/tournament?slug=classique');
  console.log('  4 quarts de finale validés');

  // --- Report --------------------------------------------------------------
  const playedQf = state.matches.filter((m) => m.phase === 'qf').sort((a, b) => a.slot - b.slot);
  const fmt = (m) =>
    `${m.a.name} ${m.forfeit ? '(forfait)' : `${m.aScore} – ${m.bScore}`} ${m.b.name}`;

  console.log('\nClassements');
  for (const g of ['A', 'B', 'C', 'D']) {
    console.log(`  Groupe ${g}`);
    for (const row of state.standings[g]) {
      const tag = row.qualified ? ' ★' : '';
      console.log(`    ${row.rank}. ${row.name.padEnd(18)} ${row.wins}V  ${row.points} pts${tag}`);
    }
  }

  console.log('\nQuarts de finale');
  for (const m of playedQf) {
    const winner = m.winnerId === m.a.id ? m.a.name : m.b.name;
    console.log(`  QF${m.slot}: ${fmt(m)}  → ${winner}`);
  }

  const sf = state.matches.filter((m) => m.phase === 'sf').sort((a, b) => a.slot - b.slot);
  console.log('\nDemi-finales (à jouer)');
  for (const m of sf) console.log(`  SF${m.slot}: ${m.a?.name ?? '?'} vs ${m.b?.name ?? '?'}`);

  const fin = state.matches.find((m) => m.phase === 'final');
  if (fin) console.log(`\nFinale : ${fin.a?.name ?? '?'} vs ${fin.b?.name ?? '?'}`);

  console.log(`\nPrêt : ${BASE}/tournoi`);
}

main().catch((e) => {
  console.error('Seed échoué :', e.message);
  process.exit(1);
});
