/**
 * End-to-end API smoke test against a running dev server.
 * Usage: node tests/e2e.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:4321';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'trone';

let cookie = '';
let pass = 0;
let fail = 0;

function check(name, cond, extra = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

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
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

console.log(`\nE2E → ${BASE}\n`);

// 1. public state
let r = await req('/api/tournament?slug=classique');
check('GET /api/tournament → 200', r.status === 200, `got ${r.status}`);
check('edition classique', r.body?.edition?.slug === 'classique');

// 2. auth required
r = await req('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: 'X' }) });
check('POST fighters sans session → 401', r.status === 401, `got ${r.status}`);

// 3. login
r = await req('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) });
check('mauvais mot de passe → 401', r.status === 401, `got ${r.status}`);

r = await req('/api/admin/session', { method: 'POST', body: JSON.stringify({ password: PASSWORD }) });
check('login → 200', r.status === 200, `got ${r.status}`);

r = await req('/api/admin/session');
check('GET session → 200', r.status === 200, `got ${r.status}`);

// 4. reset all
r = await req('/api/admin/reset', { method: 'POST', body: JSON.stringify({ what: 'all' }) });
check('reset all → 200', r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);

// 5. add 16 fighters
const names = [
  'Sabdel', 'Harvey_specture', 'Grimm', 'Lysandra',
  'Thorne', 'Maelis', 'Corvus', 'Isolde',
  'Bran', 'Seraphine', 'Dorian', 'Nyx',
  'Aldric', 'Vesper', 'Kael', 'Morgane',
];
for (const name of names) {
  r = await req('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name }) });
  if (r.status !== 201) break;
}
check('16 combattants ajoutés', r.status === 201, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: 'Seizieme+' }) });
check('17e combattant refusé → 400', r.status === 400, `got ${r.status}`);

// 6. draw
r = await req('/api/admin/draw', { method: 'POST' });
check('tirage au sort → 200', r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/admin/draw', { method: 'POST' });
check('second tirage refusé → 409', r.status === 409, `got ${r.status}`);

r = await req('/api/tournament?slug=classique');
const st = r.body;
check('4 groupes de 4', ['A', 'B', 'C', 'D'].every((g) => st.fighters.filter((f) => f.grp === g).length === 4));
check('24 matchs de poules', st.matches.filter((m) => m.phase === 'group').length === 24);
check('statut = groups', st.edition.status === 'groups', st.edition.status);

// 7. play all group matches, first fighter wins with varied points
const groupMatches = st.matches.filter((m) => m.phase === 'group');
for (const [i, m] of groupMatches.entries()) {
  r = await req('/api/admin/match', {
    method: 'POST',
    body: JSON.stringify({
      id: m.id,
      winnerId: m.a.id,
      aScore: 18 + (i % 8),
      bScore: 10 + (i % 5),
      forfeit: false,
    }),
  });
  if (r.status !== 200) {
    check(`match ${m.id} enregistré`, false, `got ${r.status} ${JSON.stringify(r.body)}`);
    break;
  }
}
check('24 matchs enregistrés', true);

r = await req('/api/tournament?slug=classique');
check('tous les matchs joués', r.body.matches.filter((m) => m.phase === 'group').every((m) => m.played));
check('8 qualifiés', ['A', 'B', 'C', 'D'].every((g) => r.body.standings[g].filter((s) => s.qualified).length === 2));

// 8. bracket
r = await req('/api/admin/bracket', { method: 'POST' });
check('génération bracket → 200', r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/tournament?slug=classique');
const qf = r.body.matches.filter((m) => m.phase === 'qf');
const sf = r.body.matches.filter((m) => m.phase === 'sf');
const fin = r.body.matches.filter((m) => m.phase === 'final');
check('4 quarts', qf.length === 4);
check('2 demies', sf.length === 2);
check('1 finale', fin.length === 1);
check('quarts peuplés', qf.every((m) => m.a && m.b));
check('demies vides', sf.every((m) => !m.a && !m.b));
check('finale vide', fin.every((m) => !m.a && !m.b));

// 9. no same-group QF
const groupOf = new Map(r.body.fighters.map((f) => [f.id, f.grp]));
check(
  'aucun quart entre même groupe',
  qf.every((m) => groupOf.get(m.a.id) !== groupOf.get(m.b.id)),
  JSON.stringify(qf.map((m) => [groupOf.get(m.a.id), groupOf.get(m.b.id)])),
);

// 10. play QFs → SFs populate per rules
const qfBySlot = new Map(qf.map((m) => [m.slot, m]));
for (const m of qf) {
  r = await req('/api/admin/match', {
    method: 'POST',
    body: JSON.stringify({ id: m.id, winnerId: m.a.id, aScore: 20, bScore: 12, forfeit: false }),
  });
  check(`QF${m.slot} validé`, r.status === 200, `got ${r.status}`);
}

r = await req('/api/tournament?slug=classique');
const sf2 = r.body.matches.filter((m) => m.phase === 'sf').sort((a, b) => a.slot - b.slot);
check('SF1 = vainqueur QF1 + QF3', sf2[0].a?.id === qfBySlot.get(1).a.id && sf2[0].b?.id === qfBySlot.get(3).a.id, JSON.stringify([sf2[0].a, sf2[0].b]));
check('SF2 = vainqueur QF2 + QF4', sf2[1].a?.id === qfBySlot.get(2).a.id && sf2[1].b?.id === qfBySlot.get(4).a.id);

// 11. play SFs → final
for (const m of sf2) {
  r = await req('/api/admin/match', {
    method: 'POST',
    body: JSON.stringify({ id: m.id, winnerId: m.b.id, aScore: 14, bScore: 21, forfeit: false }),
  });
  check(`SF${m.slot} validé`, r.status === 200, `got ${r.status}`);
}

r = await req('/api/tournament?slug=classique');
const finalM = r.body.matches.find((m) => m.phase === 'final');
check('finale peuplée', finalM.a?.id === sf2[0].b.id && finalM.b?.id === sf2[1].b.id);

// 12. champion
r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({ id: finalM.id, winnerId: finalM.b.id, aScore: 19, bScore: 22, forfeit: false }),
});
check('finale validée', r.status === 200, `got ${r.status}`);

r = await req('/api/tournament?slug=classique');
check('statut = done', r.body.edition.status === 'done', r.body.edition.status);
check('champion défini', r.body.edition.champion?.id === finalM.b.id, JSON.stringify(r.body.edition.champion));

// 13. logout
r = await req('/api/admin/session', { method: 'DELETE' });
check('logout → 200', r.status === 200);
r = await req('/api/admin/session');
check('session révoquée → 401', r.status === 401, `got ${r.status}`);

// 14. public pages render
for (const page of ['/', '/tournoi', '/reglement', '/admin']) {
  const res = await fetch(BASE + page);
  const html = await res.text();
  check(`GET ${page} → 200`, res.status === 200, `got ${res.status}`);
  check(`${page} contient le titre`, html.includes('TRÔNE') || html.includes('Trône'), '');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
