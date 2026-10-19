import { useEffect, useState, useCallback } from 'react';
import type { TournamentState } from '../../lib/state';
import { formatPoints } from '../../lib/format';

type Phase = 'group' | 'qf' | 'sf' | 'final';
type Match = TournamentState['matches'][number];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(data.error ?? 'Erreur inconnue');
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<TournamentState | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const notify = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    const data = await api('/api/tournament?slug=classique');
    setState(data as TournamentState);
  }, []);

  useEffect(() => {
    api('/api/admin/session')
      .then(() => {
        setAuthed(true);
        return refresh();
      })
      .catch(() => setAuthed(false));
  }, [refresh]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg: string) => {
      try {
        await fn();
        await refresh();
        notify('ok', okMsg);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        if (msg === 'UNAUTHORIZED') {
          setAuthed(false);
          notify('err', 'Session expirée');
        } else {
          notify('err', msg);
        }
      }
    },
    [refresh, notify],
  );

  if (authed === null) {
    return <p className="py-16 text-center text-sm text-parchment-dim">Chargement…</p>;
  }

  if (!authed) {
    return (
      <Login
        onDone={() => {
          setAuthed(true);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-caps">Espace administrateur</p>
          <h1 className="mt-1 font-display text-2xl tracking-[0.06em] text-parchment">Gestion du tournoi</h1>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            void run(async () => {
              await api('/api/admin/session', { method: 'DELETE' });
              setAuthed(false);
            }, 'Déconnecté')
          }
        >
          Déconnexion
        </button>
      </div>

      {state && <Fighters state={state} run={run} />}
      {state && <DrawPanel state={state} run={run} />}
      {state && <GroupMatchesPanel state={state} run={run} />}
      {state && <BracketPanel state={state} run={run} />}
      {state && <ResetPanel run={run} />}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 border px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] ${
            toast.kind === 'ok'
              ? 'border-gold/60 bg-ink-3 text-gold'
              : 'border-blood bg-ink-3 text-blood'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ password }) });
      onDone();
    } catch (err) {
      setError(err instanceof Error && err.message !== 'UNAUTHORIZED' ? err.message : 'Mot de passe incorrect');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <form onSubmit={submit} className="card-dark texture-noise p-7">
        <p className="label-caps">Accès restreint</p>
        <h1 className="mt-2 font-display text-xl tracking-[0.06em] text-parchment">Connexion administrateur</h1>
        <div className="rule-gold my-5"></div>

        <label htmlFor="password" className="mb-2 block text-xs uppercase tracking-[0.14em] text-parchment-dim">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none focus:border-gold"
        />

        {error && <p className="mt-3 text-xs text-blood">{error}</p>}

        <button type="submit" disabled={busy} className="btn-gold mt-5 w-full disabled:opacity-50">
          {busy ? 'Connexion…' : 'Entrer'}
        </button>
      </form>
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, okMsg: string) => Promise<void>;

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="card-dark texture-noise">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 px-5 py-3">
        <h2 className="font-display text-sm tracking-[0.16em] text-gold">{title}</h2>
        {meta && <span className="text-[0.625rem] uppercase tracking-[0.14em] text-parchment-dim">{meta}</span>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Fighters({ state, run }: { state: TournamentState; run: Run }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const locked = state.matches.length > 0;
  const full = state.fighters.length >= 16;

  return (
    <Section title="Combattants" meta={`${state.fighters.length} / 16`}>
      {!locked && (
        <form
          className="mb-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = name.trim();
            if (!value) return;
            void run(async () => {
              await api('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: value }) });
              setName('');
            }, 'Combattant ajouté');
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du combattant"
            maxLength={40}
            disabled={full}
            className="flex-1 border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none focus:border-gold disabled:opacity-50"
          />
          <button type="submit" disabled={full || !name.trim()} className="btn-gold disabled:opacity-40">
            Ajouter
          </button>
        </form>
      )}

      {locked && (
        <p className="mb-4 text-xs text-parchment-dim">
          Le tirage a eu lieu : les noms ne sont plus modifiables.
        </p>
      )}

      {state.fighters.length === 0 ? (
        <p className="py-6 text-center text-sm text-parchment-dim">Aucun combattant inscrit.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {state.fighters.map((f) => (
            <li key={f.id} className="flex items-center gap-2 border border-gold/10 bg-ink/40 px-3 py-2">
              {f.grp && (
                <span className="flex-none border border-gold/40 px-1.5 py-0.5 text-[0.5rem] font-bold text-gold">
                  {f.grp}
                </span>
              )}

              {editing === f.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={40}
                    className="min-w-0 flex-1 border border-gold/25 bg-ink px-2 py-1 text-sm text-parchment outline-none focus:border-gold"
                  />
                  <button
                    type="button"
                    className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-gold"
                    onClick={() =>
                      void run(async () => {
                        await api('/api/admin/fighters', {
                          method: 'PATCH',
                          body: JSON.stringify({ id: f.id, name: editName.trim() }),
                        });
                        setEditing(null);
                      }, 'Nom modifié')
                    }
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim"
                    onClick={() => setEditing(null)}
                  >
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-parchment">{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Renommer ${f.name}`}
                    className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim hover:text-gold"
                    onClick={() => {
                      setEditing(f.id);
                      setEditName(f.name);
                    }}
                  >
                    Modifier
                  </button>
                  {!locked && (
                    <button
                      type="button"
                      aria-label={`Supprimer ${f.name}`}
                      className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-blood hover:text-red-400"
                      onClick={() =>
                        void run(
                          () => api(`/api/admin/fighters?id=${f.id}`, { method: 'DELETE' }),
                          'Combattant supprimé',
                        )
                      }
                    >
                      Suppr.
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DrawPanel({ state, run }: { state: TournamentState; run: Run }) {
  const hasDraw = state.matches.length > 0;
  const ready = state.fighters.length === 16;

  return (
    <Section title="Tirage au sort">
      {hasDraw ? (
        <p className="text-sm text-parchment-dim">
          Les groupes ont été tirés. Rendez-vous dans les duels de poules pour saisir les résultats.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={!ready}
            className="btn-gold disabled:opacity-40"
            onClick={() => {
              if (!window.confirm('Tirer au sort les 4 groupes ? Cette action est définitive.')) return;
              void run(() => api('/api/admin/draw', { method: 'POST' }), 'Groupes tirés au sort');
            }}
          >
            Tirer au sort les groupes
          </button>
          <p className="text-xs text-parchment-dim">
            {ready ? 'Les 16 combattants seront répartis en 4 groupes de 4.' : `Il manque ${16 - state.fighters.length} combattant(s).`}
          </p>
        </div>
      )}
    </Section>
  );
}

function GroupMatchesPanel({ state, run }: { state: TournamentState; run: Run }) {
  const groups = ['A', 'B', 'C', 'D'];
  const groupMatches = state.matches.filter((m) => m.phase === 'group');
  if (groupMatches.length === 0) return null;

  const allPlayed = groupMatches.every((m) => m.played);

  return (
    <Section title="Duels de poules" meta={`${groupMatches.filter((m) => m.played).length} / 24`}>
      <div className="space-y-6">
        {groups.map((g) => {
          const rows = groupMatches.filter((m) => m.grp === g).sort((a, b) => a.slot - b.slot);
          return (
            <div key={g}>
              <h3 className="mb-2 font-display text-xs tracking-[0.18em] text-gold">GROUPE {g}</h3>
              <div className="space-y-2">
                {rows.map((m) => (
                  <MatchEditor key={m.id} match={m} run={run} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {allPlayed && (
        <p className="mt-5 border-l-2 border-gold pl-3 text-xs text-parchment-dim">
          Tous les duels de poules sont joués. Vous pouvez générer les quarts de finale.
        </p>
      )}
    </Section>
  );
}

function MatchEditor({ match, run }: { match: Match; run: Run }) {
  const [winner, setWinner] = useState<number | null>(match.winnerId);
  const [aScore, setAScore] = useState<string>(match.aScore?.toString() ?? '');
  const [bScore, setBScore] = useState<string>(match.bScore?.toString() ?? '');
  const [forfeit, setForfeit] = useState(match.forfeit);

  const dirty =
    winner !== match.winnerId ||
    aScore !== (match.aScore?.toString() ?? '') ||
    bScore !== (match.bScore?.toString() ?? '') ||
    forfeit !== match.forfeit;

  function save() {
    if (!winner) return;
    void run(
      () =>
        api('/api/admin/match', {
          method: 'POST',
          body: JSON.stringify({
            id: match.id,
            winnerId: winner,
            aScore: forfeit ? null : aScore === '' ? null : Number(aScore),
            bScore: forfeit ? null : bScore === '' ? null : Number(bScore),
            forfeit,
          }),
        }),
      'Résultat enregistré',
    );
  }

  return (
    <div
      className={`border px-3 py-3 ${
        match.played ? 'border-gold/25 bg-gold/[0.04]' : 'border-gold/10'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setWinner(match.a?.id ?? null)}
            aria-pressed={winner === match.a?.id}
            className={`flex items-center justify-between gap-2 border px-3 py-2 text-left text-sm transition-colors ${
              winner === match.a?.id
                ? 'border-gold bg-gold/10 text-gold-light'
                : 'border-gold/15 text-parchment-dim hover:border-gold/40'
            }`}
          >
            <span className="min-w-0 truncate">{match.a?.name ?? '—'}</span>
            <input
              type="number"
              step="0.5"
              min="0"
              inputMode="decimal"
              value={aScore}
              disabled={forfeit}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setAScore(e.target.value)}
              aria-label={`Points de ${match.a?.name ?? 'A'}`}
              className="w-16 flex-none border border-gold/20 bg-ink px-1.5 py-1 text-right text-xs tabular-nums text-parchment outline-none focus:border-gold disabled:opacity-40"
            />
          </button>

          <button
            type="button"
            onClick={() => setWinner(match.b?.id ?? null)}
            aria-pressed={winner === match.b?.id}
            className={`flex items-center justify-between gap-2 border px-3 py-2 text-left text-sm transition-colors ${
              winner === match.b?.id
                ? 'border-gold bg-gold/10 text-gold-light'
                : 'border-gold/15 text-parchment-dim hover:border-gold/40'
            }`}
          >
            <span className="min-w-0 truncate">{match.b?.name ?? '—'}</span>
            <input
              type="number"
              step="0.5"
              min="0"
              inputMode="decimal"
              value={bScore}
              disabled={forfeit}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setBScore(e.target.value)}
              aria-label={`Points de ${match.b?.name ?? 'B'}`}
              className="w-16 flex-none border border-gold/20 bg-ink px-1.5 py-1 text-right text-xs tabular-nums text-parchment outline-none focus:border-gold disabled:opacity-40"
            />
          </button>
        </div>

        <label className="flex flex-none items-center gap-2 text-[0.625rem] uppercase tracking-[0.12em] text-parchment-dim">
          <input
            type="checkbox"
            checked={forfeit}
            onChange={(e) => {
              setForfeit(e.target.checked);
              if (e.target.checked) {
                setAScore('');
                setBScore('');
              }
            }}
            className="accent-gold"
          />
          Forfait
        </label>

        <button
          type="button"
          onClick={save}
          disabled={!winner || (!dirty && match.played)}
          className="btn-gold flex-none px-4 py-2 text-[0.625rem] disabled:opacity-35"
        >
          {match.played ? 'Modifier' : 'Valider'}
        </button>
      </div>

      {forfeit && (
        <p className="mt-2 text-[0.625rem] leading-relaxed text-parchment-dim/80">
          Forfait : points calculés automatiquement selon la règle (18 / points du 1er duel / moyenne des deux premiers).
        </p>
      )}

      {match.played && !dirty && (
        <p className="mt-2 text-[0.625rem] uppercase tracking-[0.12em] text-gold/70">
          Enregistré — vainqueur : {match.winnerId === match.a?.id ? match.a?.name : match.b?.name}
          {match.forfeit ? ' (forfait)' : ` · ${formatPoints(match.aScore)} – ${formatPoints(match.bScore)}`}
        </p>
      )}
    </div>
  );
}

function BracketPanel({ state, run }: { state: TournamentState; run: Run }) {
  const groupMatches = state.matches.filter((m) => m.phase === 'group');
  const bracket = state.matches.filter((m) => m.phase !== 'group');
  const canGenerate = groupMatches.length > 0 && groupMatches.every((m) => m.played);

  if (bracket.length === 0) {
    return (
      <Section title="Phase finale">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={!canGenerate}
            className="btn-gold disabled:opacity-40"
            onClick={() => {
              if (!window.confirm('Générer les quarts de finale à partir du classement ?')) return;
              void run(() => api('/api/admin/bracket', { method: 'POST' }), 'Quarts de finale générés');
            }}
          >
            Générer les quarts
          </button>
          <p className="text-xs text-parchment-dim">
            {canGenerate
              ? 'Le tableau sera créé selon les règles : 1er A – 2e B, 1er B – 2e A, 1er C – 2e D, 1er D – 2e C.'
              : 'Tous les duels de poules doivent être validés.'}
          </p>
        </div>
      </Section>
    );
  }

  const rounds: { phase: Phase; label: string }[] = [
    { phase: 'qf', label: 'Quarts de finale' },
    { phase: 'sf', label: 'Demi-finales' },
    { phase: 'final', label: 'Grande finale' },
  ];

  return (
    <Section title="Phase finale">
      <div className="space-y-6">
        {rounds.map(({ phase, label }) => {
          const rows = bracket.filter((m) => m.phase === phase).sort((a, b) => a.slot - b.slot);
          if (rows.length === 0) return null;
          return (
            <div key={phase}>
              <h3 className="mb-2 font-display text-xs tracking-[0.18em] text-gold">{label}</h3>
              <div className="space-y-2">
                {rows.map((m) => (
                  <BracketEditor key={m.id} match={m} run={run} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function BracketEditor({ match, run }: { match: Match; run: Run }) {
  const [winner, setWinner] = useState<number | null>(match.winnerId);
  const [aScore, setAScore] = useState(match.aScore?.toString() ?? '');
  const [bScore, setBScore] = useState(match.bScore?.toString() ?? '');
  const [forfeit, setForfeit] = useState(match.forfeit);

  const ready = match.a != null && match.b != null;

  return (
    <div className="border border-gold/10 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          {[match.a, match.b].map((f, i) => (
            <button
              key={i}
              type="button"
              disabled={!f}
              onClick={() => f && setWinner(f.id)}
              aria-pressed={f ? winner === f.id : false}
              className={`flex items-center justify-between gap-2 border px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
                f && winner === f.id
                  ? 'border-gold bg-gold/10 text-gold-light'
                  : 'border-gold/15 text-parchment-dim hover:border-gold/40'
              }`}
            >
              <span className="min-w-0 truncate">{f?.name ?? 'En attente'}</span>
              <input
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                value={i === 0 ? aScore : bScore}
                disabled={!f || forfeit}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => (i === 0 ? setAScore(e.target.value) : setBScore(e.target.value))}
                aria-label={`Points de ${f?.name ?? (i === 0 ? 'A' : 'B')}`}
                className="w-16 flex-none border border-gold/20 bg-ink px-1.5 py-1 text-right text-xs tabular-nums text-parchment outline-none focus:border-gold disabled:opacity-40"
              />
            </button>
          ))}
        </div>

        <label className="flex flex-none items-center gap-2 text-[0.625rem] uppercase tracking-[0.12em] text-parchment-dim">
          <input
            type="checkbox"
            checked={forfeit}
            onChange={(e) => {
              setForfeit(e.target.checked);
              if (e.target.checked) {
                setAScore('');
                setBScore('');
              }
            }}
            className="accent-gold"
          />
          Forfait
        </label>

        <button
          type="button"
          disabled={!winner || !ready}
          className="btn-gold flex-none px-4 py-2 text-[0.625rem] disabled:opacity-35"
          onClick={() =>
            void run(
              () =>
                api('/api/admin/match', {
                  method: 'POST',
                  body: JSON.stringify({
                    id: match.id,
                    winnerId: winner,
                    aScore: forfeit ? null : aScore === '' ? null : Number(aScore),
                    bScore: forfeit ? null : bScore === '' ? null : Number(bScore),
                    forfeit,
                  }),
                }),
              'Résultat enregistré',
            )
          }
        >
          Valider
        </button>
      </div>
    </div>
  );
}

function ResetPanel({ run }: { run: Run }) {
  return (
    <Section title="Zone de réinitialisation">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-parchment-dim">
          Efface les résultats des duels et le tableau final, mais conserve les combattants et les groupes.
        </p>
        <button
          type="button"
          className="btn-ghost flex-none border-blood/60 text-blood hover:bg-blood/10"
          onClick={() => {
            if (!window.confirm('Effacer tous les résultats et le tableau final ?')) return;
            void run(
              () => api('/api/admin/reset', { method: 'POST', body: JSON.stringify({ what: 'results' }) }),
              'Résultats effacés',
            );
          }}
        >
          Effacer les résultats
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-gold/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-parchment-dim">
          Efface tout : combattants, groupes, duels et tableau. Action irréversible.
        </p>
        <button
          type="button"
          className="btn-ghost flex-none border-blood/60 text-blood hover:bg-blood/10"
          onClick={() => {
            if (!window.confirm('Tout effacer ? Combattants, groupes et résultats seront supprimés.')) return;
            void run(
              () => api('/api/admin/reset', { method: 'POST', body: JSON.stringify({ what: 'all' }) }),
              'Tournoi réinitialisé',
            );
          }}
        >
          Tout réinitialiser
        </button>
      </div>
    </Section>
  );
}
