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
  const text = await res.text();
  let body = null;
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

r = await req('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: 'Sabdel' }) });
check('nom en double refusé → 409', r.status === 409, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: '  sabdel  ' }) });
check('doublon insensible casse/espaces → 409', r.status === 409, `got ${r.status}`);

r = await req('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: 'SÀBDEL' }) });
check('doublon insensible aux accents → 409', r.status === 409, `got ${r.status}`);

r = await req('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: 'Seizieme+' }) });
check('17e combattant refusé → 409', r.status === 409, `got ${r.status}`);

r = await req('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: '' }) });
check('nom vide refusé → 400', r.status === 400, `got ${r.status}`);

// 6. draw
r = await req('/api/admin/draw', { method: 'POST' });
check('tirage au sort → 200', r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/admin/draw', { method: 'POST' });
check('second tirage refusé → 409', r.status === 409, `got ${r.status}`);

r = await req('/api/admin/fighters?id=1', { method: 'DELETE' });
check('suppression après tirage refusée → 409', r.status === 409, `got ${r.status}`);

r = await req('/api/tournament?slug=classique');
const st = r.body;
check('4 groupes de 4', ['A', 'B', 'C', 'D'].every((g) => st.fighters.filter((f) => f.grp === g).length === 4));
check('24 matchs de poules', st.matches.filter((m) => m.phase === 'group').length === 24);
check('statut = groups', st.edition.status === 'groups', st.edition.status);
check('aucun qualifié avant la fin des poules', ['A', 'B', 'C', 'D'].every((g) => st.standings[g].every((s) => !s.qualified)));

// 7. validation rules
const gm = st.matches.filter((m) => m.phase === 'group');
const first = gm[0];

r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({ id: first.id, aScore: 20, bScore: 20 }),
});
check('points égaux refusés → 400', r.status === 400, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/admin/match', { method: 'POST', body: JSON.stringify({ id: first.id, aScore: 20 }) });
check('points manquants refusés → 400', r.status === 400, `got ${r.status}`);

r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({ id: first.id, forfeit: true }),
});
check('forfait sans perdant refusé → 400', r.status === 400, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({ id: 999999, aScore: 20, bScore: 10 }),
});
check('duel inexistant → 404', r.status === 404, `got ${r.status}`);

// 8. winner is derived from points (no manual winner)
r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({ id: first.id, aScore: 22, bScore: 14 }),
});
check('validation sans winnerId → 200', r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/tournament?slug=classique');
let saved = r.body.matches.find((m) => m.id === first.id);
check('vainqueur = plus haut score', saved.winnerId === first.a.id, `${saved.winnerId} vs ${first.a.id}`);
check('scores enregistrés', saved.aScore === 22 && saved.bScore === 14);

// 9. forfeit: winner is the other fighter
const second = gm[1];
r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({ id: second.id, forfeit: true, forfeitLoserId: second.a.id }),
});
check('forfait avec perdant → 200', r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);

r = await req('/api/tournament?slug=classique');
saved = r.body.matches.find((m) => m.id === second.id);
check('forfait : adversaire vainqueur', saved.winnerId === second.b.id, `${saved.winnerId} vs ${second.b.id}`);
check('forfait marqué', saved.forfeit === true);

// 10. batch validation is all-or-nothing
const remaining = gm.slice(2);
const batch = remaining.map((m, i) => ({
  id: m.id,
  aScore: 18 + (i % 8),
  bScore: 10 + (i % 5),
}));
r = await req('/api/admin/match', { method: 'POST', body: JSON.stringify({ results: batch }) });
check('batch de 22 duels → 200', r.status === 200, `got ${r.status} ${JSON.stringify(r.body)}`);
check('batch retourne le nombre validé', r.body?.saved === 22, JSON.stringify(r.body));

r = await req('/api/tournament?slug=classique');
check('24 duels joués', r.body.matches.filter((m) => m.phase === 'group').every((m) => m.played));
check('8 qualifiés', ['A', 'B', 'C', 'D'].every((g) => r.body.standings[g].filter((s) => s.qualified).length === 2));

// batch with one invalid row must not write anything
const gmA = r.body.matches.filter((m) => m.phase === 'group' && m.grp === 'A');
r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({
    results: [
      { id: gmA[0].id, aScore: 30, bScore: 10 },
      { id: gmA[1].id, aScore: 5, bScore: 5 },
    ],
  }),
});
check('batch invalide refusé → 400', r.status === 400, `got ${r.status}`);

r = await req('/api/tournament?slug=classique');
check(
  'batch invalide : rien écrit',
  r.body.matches.find((m) => m.id === gmA[0].id).aScore !== 30,
  'la première ligne a été écrite',
);

// 11. bracket
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

const groupOf = new Map(r.body.fighters.map((f) => [f.id, f.grp]));
check(
  'aucun quart entre même groupe',
  qf.every((m) => groupOf.get(m.a.id) !== groupOf.get(m.b.id)),
  JSON.stringify(qf.map((m) => [groupOf.get(m.a.id), groupOf.get(m.b.id)])),
);

// 12. QFs feed the right SFs
const qfBySlot = new Map(qf.map((m) => [m.slot, m]));
r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({
    results: qf.map((m) => ({ id: m.id, aScore: 20, bScore: 12 })),
  }),
});
check('4 quarts validés en un appel', r.status === 200, `got ${r.status}`);

r = await req('/api/tournament?slug=classique');
const sf2 = r.body.matches.filter((m) => m.phase === 'sf').sort((a, b) => a.slot - b.slot);
check(
  'SF1 = vainqueur QF1 + QF3',
  sf2[0].a?.id === qfBySlot.get(1).a.id && sf2[0].b?.id === qfBySlot.get(3).a.id,
  JSON.stringify([sf2[0].a, sf2[0].b]),
);
check(
  'SF2 = vainqueur QF2 + QF4',
  sf2[1].a?.id === qfBySlot.get(2).a.id && sf2[1].b?.id === qfBySlot.get(4).a.id,
  JSON.stringify([sf2[1].a, sf2[1].b]),
);

// 13. changing a QF winner clears the downstream SF
r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({ id: qfBySlot.get(1).id, aScore: 10, bScore: 25 }),
});
check('quart modifié → 200', r.status === 200);

r = await req('/api/tournament?slug=classique');
const sfAfter = r.body.matches.filter((m) => m.phase === 'sf').sort((a, b) => a.slot - b.slot);
check('SF1 reçoit le nouveau vainqueur', sfAfter[0].a?.id === qfBySlot.get(1).b.id, JSON.stringify(sfAfter[0].a));

// 14. play SFs and final
for (const m of sfAfter) {
  r = await req('/api/admin/match', {
    method: 'POST',
    body: JSON.stringify({ id: m.id, aScore: 14, bScore: 21 }),
  });
  check(`SF${m.slot} validée`, r.status === 200, `got ${r.status}`);
}

r = await req('/api/tournament?slug=classique');
const finalM = r.body.matches.find((m) => m.phase === 'final');
check('finale peuplée', finalM.a?.id === sfAfter[0].b.id && finalM.b?.id === sfAfter[1].b.id);

r = await req('/api/admin/match', {
  method: 'POST',
  body: JSON.stringify({ id: finalM.id, aScore: 19, bScore: 22 }),
});
check('finale validée', r.status === 200, `got ${r.status}`);

r = await req('/api/tournament?slug=classique');
check('statut = done', r.body.edition.status === 'done', r.body.edition.status);
check('champion défini', r.body.edition.champion?.id === finalM.b.id, JSON.stringify(r.body.edition.champion));

// 15. reset results keeps fighters
r = await req('/api/admin/reset', { method: 'POST', body: JSON.stringify({ what: 'results' }) });
check('reset résultats → 200', r.status === 200);
r = await req('/api/tournament?slug=classique');
check('combattants conservés', r.body.fighters.length === 16);
check('duels remis à zéro', r.body.matches.filter((m) => m.phase === 'group').every((m) => !m.played));
check('bracket supprimé', r.body.matches.filter((m) => m.phase !== 'group').length === 0);

// 16. logout
r = await req('/api/admin/session', { method: 'DELETE' });
check('logout → 200', r.status === 200);
r = await req('/api/admin/session');
check('session révoquée → 401', r.status === 401, `got ${r.status}`);

// 17. public pages
for (const page of ['/', '/tournoi', '/reglement', '/admin']) {
  const res = await fetch(BASE + page);
  const html = await res.text();
  check(`GET ${page} → 200`, res.status === 200, `got ${res.status}`);
  check(`${page} contient le titre`, html.includes('TRÔNE') || html.includes('Trône'), '');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
