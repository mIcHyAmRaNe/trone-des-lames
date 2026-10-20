import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TournamentState } from '../../lib/state';
import { parsePoints } from '../../lib/format';
import { GROUPS } from '../../lib/tournament';
import { ForfeitSelect, ScoreSelect } from './ScoreSelect';

type Match = TournamentState['matches'][number];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw new Error('Session expirée. Reconnectez-vous.');
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? 'Une erreur est survenue');
  return data;
}

type Draft = { a: string; b: string; forfeit: boolean; forfeitLoserId: number | null };

function draftOf(match: Match): Draft {
  return {
    a: match.aScore == null ? '' : String(match.aScore).replace('.', ','),
    b: match.bScore == null ? '' : String(match.bScore).replace('.', ','),
    forfeit: match.forfeit,
    // Stored winnerId is the winner; the forfeiting fighter is the other one.
    forfeitLoserId:
      match.forfeit && match.played && match.winnerId != null
        ? match.winnerId === match.a?.id
          ? (match.b?.id ?? null)
          : (match.a?.id ?? null)
        : null,
  };
}

function analyze(match: Match, draft: Draft) {
  const pa = parsePoints(draft.a);
  const pb = parsePoints(draft.b);
  const tie = !draft.forfeit && pa != null && pb != null && pa === pb;
  const ready = draft.forfeit
    ? draft.forfeitLoserId != null
    : pa != null && pb != null && pa !== pb;

  const winner = draft.forfeit
    ? draft.forfeitLoserId === match.a?.id
      ? match.b
      : match.a
    : pa != null && pb != null && pa !== pb
      ? pa > pb
        ? match.a
        : match.b
      : null;

  const initial = draftOf(match);
  const dirty =
    draft.a !== initial.a ||
    draft.b !== initial.b ||
    draft.forfeit !== initial.forfeit ||
    (draft.forfeit && draft.forfeitLoserId !== initial.forfeitLoserId);

  return { pa, pb, tie, ready, winner, dirty };
}

function payload(match: Match, draft: Draft) {
  const { pa, pb, ready } = analyze(match, draft);
  if (!ready) return null;
  return {
    id: match.id,
    aScore: draft.forfeit ? null : pa,
    bScore: draft.forfeit ? null : pb,
    forfeit: draft.forfeit,
    forfeitLoserId: draft.forfeit ? draft.forfeitLoserId : null,
  };
}

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<TournamentState | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const notify = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const refresh = useCallback(async () => {
    setState((await api('/api/tournament?slug=classique')) as TournamentState);
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
        return true;
      } catch (e) {
        notify('err', e instanceof Error ? e.message : 'Une erreur est survenue');
        return false;
      }
    },
    [refresh, notify],
  );

  if (authed === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        <span className="text-xs uppercase tracking-[0.14em] text-parchment-dim">Chargement</span>
      </div>
    );
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
    <div className="space-y-8">
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
      {state && <DuelPanel state={state} run={run} phase="group" />}
      {state && <DuelPanel state={state} run={run} phase="bracket" />}
      {state && <ResetPanel run={run} />}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Toast({
  toast,
  onClose,
}: {
  toast: { kind: 'ok' | 'err'; msg: string } | null;
  onClose: () => void;
}) {
  if (!toast) return null;
  const ok = toast.kind === 'ok';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 items-start gap-3 rounded-lg border px-4 py-3 shadow-2xl backdrop-blur-md ${
        ok ? 'border-gold/50 bg-ink-3/95' : 'border-blood/70 bg-ink-3/95'
      }`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full text-[0.625rem] font-bold ${
          ok ? 'bg-gold text-ink' : 'bg-blood text-parchment'
        }`}
        aria-hidden="true"
      >
        {ok ? '✓' : '!'}
      </span>
      <p className="flex-1 text-sm leading-snug text-parchment">{toast.msg}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la notification"
        className="-mr-1 -mt-1 flex-none rounded p-1 text-parchment-dim transition-colors hover:text-parchment"
      >
        ✕
      </button>
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
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <form onSubmit={submit} className="card-dark texture-noise rounded-lg p-7">
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
          required
          className="w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors focus:border-gold aria-invalid:border-blood"
        />

        {error && (
          <p id="login-error" role="alert" className="mt-3 flex items-start gap-2 text-xs text-blood">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-gold mt-5 w-full disabled:opacity-50">
          {busy ? 'Connexion…' : 'Entrer'}
        </button>
      </form>
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, okMsg: string) => Promise<boolean>;

function Section({
  title,
  meta,
  children,
  action,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="card-dark texture-noise overflow-hidden rounded-lg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/20 px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-sm tracking-[0.16em] text-gold">{title}</h2>
          {meta && <span className="text-[0.625rem] uppercase tracking-[0.14em] text-parchment-dim">{meta}</span>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Fighters({ state, run }: { state: TournamentState; run: Run }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');

  const locked = state.matches.length > 0;
  const full = state.fighters.length >= 16;

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const f of state.fighters) {
      const key = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [state.fighters]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value) {
      setError('Saisissez un nom');
      return;
    }
    try {
      await api('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: value }) });
      setName('');
      setError('');
      await run(async () => {}, `« ${value} » inscrit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajout impossible');
    }
  }

  return (
    <Section title="Combattants" meta={`${state.fighters.length} / 16`}>
      {!locked && (
        <form onSubmit={add} className="mb-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                placeholder="Nom du combattant"
                maxLength={40}
                aria-label="Nom du nouveau combattant"
                aria-invalid={error ? true : undefined}
                disabled={full}
                className={`w-full rounded border bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/40 disabled:opacity-50 ${
                  error ? 'border-blood' : 'border-gold/25 focus:border-gold'
                }`}
              />
              {error && (
                <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-blood">
                  <span aria-hidden="true">⚠</span>
                  {error}
                </p>
              )}
            </div>
            <button type="submit" disabled={full || !name.trim()} className="btn-gold flex-none disabled:opacity-40">
              Ajouter
            </button>
          </div>
          {full && (
            <p className="mt-2 text-xs text-parchment-dim">
              Seize combattants inscrits. Supprimez-en un pour en ajouter un autre.
            </p>
          )}
        </form>
      )}

      {locked && (
        <p className="mb-4 rounded border border-gold/20 bg-gold/[0.05] px-3 py-2 text-xs text-parchment-dim">
          Le tirage a eu lieu : les combattants ne peuvent plus être retirés.
        </p>
      )}

      {state.fighters.length === 0 ? (
        <p className="py-6 text-center text-sm text-parchment-dim">Aucun combattant inscrit.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {state.fighters.map((f) => {
            const key = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            const dup = duplicates.has(key);
            return (
              <li
                key={f.id}
                className={`flex items-center gap-2 rounded border px-3 py-2 ${
                  dup ? 'border-blood/60 bg-blood/[0.06]' : 'border-gold/10 bg-ink/40'
                }`}
              >
                {f.grp && (
                  <span className="flex-none rounded-sm border border-gold/40 px-1.5 py-0.5 text-[0.5rem] font-bold text-gold">
                    {f.grp}
                  </span>
                )}

                {editing === f.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setEditError('');
                      }}
                      maxLength={40}
                      aria-label={`Nouveau nom pour ${f.name}`}
                      aria-invalid={editError ? true : undefined}
                      className={`min-w-0 flex-1 rounded border bg-ink px-2 py-1 text-sm text-parchment outline-none ${
                        editError ? 'border-blood' : 'border-gold/25 focus:border-gold'
                      }`}
                    />
                    <button
                      type="button"
                      className="flex-none text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-gold"
                      onClick={async () => {
                        try {
                          await api('/api/admin/fighters', {
                            method: 'PATCH',
                            body: JSON.stringify({ id: f.id, name: editName.trim() }),
                          });
                          setEditing(null);
                          setEditError('');
                          await run(async () => {}, 'Nom modifié');
                        } catch (err) {
                          setEditError(err instanceof Error ? err.message : 'Renommage impossible');
                        }
                      }}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim"
                      onClick={() => {
                        setEditing(null);
                        setEditError('');
                      }}
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-parchment">{f.name}</span>
                    {dup && (
                      <span
                        className="flex-none text-[0.5rem] uppercase tracking-[0.1em] text-blood"
                        title="Nom en double"
                      >
                        Doublon
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Renommer ${f.name}`}
                      disabled={locked}
                      title={locked ? 'Le tirage a eu lieu : le nom ne peut plus être modifié' : undefined}
                      className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim transition-colors hover:text-gold disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-parchment-dim"
                      onClick={() => {
                        setEditing(f.id);
                        setEditName(f.name);
                        setEditError('');
                      }}
                    >
                      Modifier
                    </button>
                    {!locked && (
                      <button
                        type="button"
                        aria-label={`Supprimer ${f.name}`}
                        className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-blood transition-colors hover:text-red-400"
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
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function DrawPanel({ state, run }: { state: TournamentState; run: Run }) {
  const hasDraw = state.matches.length > 0;
  const missing = 16 - state.fighters.length;
  const [busy, setBusy] = useState(false);

  return (
    <Section title="Tirage au sort">
      {hasDraw ? (
        <p className="text-sm text-parchment-dim">
          Les groupes ont été tirés. Saisissez les résultats dans la section suivante.
        </p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={missing !== 0 || busy}
            className="btn-gold flex-none disabled:opacity-40"
            onClick={() => {
              if (!window.confirm('Tirer au sort les 4 groupes ? Cette action est définitive.')) return;
              setBusy(true);
              void run(() => api('/api/admin/draw', { method: 'POST' }), 'Groupes tirés au sort').finally(() =>
                setBusy(false),
              );
            }}
          >
            Tirer au sort les groupes
          </button>
          <p className="text-xs text-parchment-dim">
            {missing === 0
              ? 'Les 16 combattants seront répartis en 4 groupes de 4.'
              : `Il manque ${missing} combattant${missing > 1 ? 's' : ''} pour lancer le tirage.`}
          </p>
        </div>
      )}
    </Section>
  );
}

function DuelPanel({ state, run, phase }: { state: TournamentState; run: Run; phase: 'group' | 'bracket' }) {
  const matches = state.matches.filter((m) =>
    phase === 'group' ? m.phase === 'group' : m.phase !== 'group',
  );
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState(false);
  // Once the final bracket exists, group results are read-only (the API rejects edits with 409).
  const locked = phase === 'group' && state.matches.some((m) => m.phase !== 'group');

  // Drop drafts for matches that no longer exist.
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<number, Draft> = {};
      for (const m of matches) next[m.id] = prev[m.id] ?? draftOf(m);
      return next;
    });
  }, [state]);

  const setOne = useCallback(
    (id: number, match: Match) => (patch: Partial<Draft>) =>
      setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? draftOf(match)), ...patch } })),
    [],
  );

  const pending = matches.filter((m) => {
    const d = drafts[m.id] ?? draftOf(m);
    const { ready, dirty } = analyze(m, d);
    return ready && (!m.played || dirty);
  });

  async function saveAll() {
    const results = matches
      .map((m) => payload(m, drafts[m.id] ?? draftOf(m)))
      .filter((p) => p != null);
    if (results.length === 0) return;
    setBusy(true);
    const ok = await run(
      () => api('/api/admin/match', { method: 'POST', body: JSON.stringify({ results }) }),
      `${results.length} duel${results.length > 1 ? 's' : ''} validé${results.length > 1 ? 's' : ''}`,
    );
    setBusy(false);
    if (ok) setDrafts({});
  }

  if (phase === 'bracket') {
    const hasBracket = matches.length > 0;
    const groupsDone =
      state.matches.filter((m) => m.phase === 'group').length > 0 &&
      state.matches.filter((m) => m.phase === 'group').every((m) => m.played);

    if (!hasBracket) {
      return (
        <Section title="Phase finale">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={!groupsDone || busy}
              className="btn-gold flex-none disabled:opacity-40"
              onClick={() => {
                if (!window.confirm('Générer les quarts de finale à partir du classement ?')) return;
                setBusy(true);
                void run(() => api('/api/admin/bracket', { method: 'POST' }), 'Quarts de finale générés').finally(() =>
                  setBusy(false),
                );
              }}
            >
              Générer les quarts
            </button>
            <p className="text-xs leading-relaxed text-parchment-dim">
              {groupsDone
                ? 'Tableau : 1er A – 2e B · 1er B – 2e A · 1er C – 2e D · 1er D – 2e C.'
                : 'Tous les duels de poules doivent être validés.'}
            </p>
          </div>
        </Section>
      );
    }
  }

  if (matches.length === 0) return null;

  const played = matches.filter((m) => m.played).length;
  const rounds: { phase: string; label: string }[] = [
    { phase: 'qf', label: 'Quarts de finale' },
    { phase: 'sf', label: 'Demi-finales' },
    { phase: 'final', label: 'Grande finale' },
  ];

  return (
    <Section
      title={phase === 'group' ? 'Duels de poules' : 'Phase finale'}
      meta={`${played} / ${matches.length} validés`}
      action={
        <button
          type="button"
          onClick={saveAll}
          disabled={busy || pending.length === 0 || locked}
          title={
            pending.length === 0
              ? 'Saisissez les points des duels à valider'
              : `Valider ${pending.length} duel(s) en un seul enregistrement`
          }
          className="btn-gold px-3 py-1.5 text-[0.625rem] disabled:opacity-35"
        >
          {busy
            ? 'Validation…'
            : pending.length === 0
              ? 'Tout valider'
              : `Tout valider (${pending.length})`}
        </button>
      }
    >
      {phase === 'group' ? (
        <div className="space-y-7">
          {locked && (
            <p className="rounded border border-gold/20 bg-gold/[0.05] px-3 py-2 text-xs text-parchment-dim">
              Le tableau final est généré : les résultats de poules ne peuvent plus être modifiés. Pour corriger un
              résultat, utilisez « Effacer les résultats » dans la section Réinitialisation.
            </p>
          )}
          {GROUPS.map((g) => {
            const rows = matches.filter((m) => m.grp === g).sort((a, b) => a.slot - b.slot);
            if (rows.length === 0) return null;
            return (
              <div key={g}>
                <h3 className="mb-2 font-display text-xs tracking-[0.18em] text-gold">GROUPE {g}</h3>
                <div className="space-y-2">
                  {rows.map((m) => (
                    <DuelEditor
                      key={m.id}
                      match={m}
                      draft={drafts[m.id] ?? draftOf(m)}
                      patch={setOne(m.id, m)}
                      run={run}
                      locked={locked}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {rounds.map(({ phase: p, label }) => {
            const rows = matches.filter((m) => m.phase === p).sort((a, b) => a.slot - b.slot);
            if (rows.length === 0) return null;
            return (
              <div key={p}>
                <h3 className="mb-2 font-display text-xs tracking-[0.18em] text-gold">{label}</h3>
                <div className="space-y-2">
                  {rows.map((m) => (
                    <DuelEditor
                      key={m.id}
                      match={m}
                      draft={drafts[m.id] ?? draftOf(m)}
                      patch={setOne(m.id, m)}
                      run={run}
                      locked={locked}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-[0.6875rem] leading-relaxed text-parchment-dim/70">
            Modifier un quart réinitialise la demi-finale et la finale concernées si le vainqueur change.
          </p>
        </div>
      )}

      {phase === 'group' && played === matches.length && (
        <p className="mt-5 rounded border border-gold/30 bg-gold/[0.05] px-3 py-2 text-xs text-gold">
          Tous les duels de poules sont validés. Vous pouvez générer les quarts de finale.
        </p>
      )}
    </Section>
  );
}

function DuelEditor({
  match,
  draft,
  patch,
  run,
  locked,
}: {
  match: Match;
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
  run: Run;
  locked: boolean;
}) {
  const { pa, pb, tie, ready, winner, dirty } = analyze(match, draft);

  function save() {
    const body = payload(match, draft);
    if (!body) return;
    void run(
      () => api('/api/admin/match', { method: 'POST', body: JSON.stringify(body) }),
      'Résultat validé',
    );
  }

  return (
    <div
      className={`rounded border px-3 py-3 transition-colors ${
        match.played ? 'border-gold/30 bg-gold/[0.045]' : 'border-gold/10 bg-ink/30'
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <ScoreRow
            fighter={match.a}
            value={draft.a}
            onChange={(v) => patch({ a: v })}
            disabled={draft.forfeit || locked}
            forfeit={draft.forfeit}
            isWinner={
              draft.forfeit
                ? draft.forfeitLoserId != null && draft.forfeitLoserId !== match.a?.id
                : pa != null && pb != null && pa > pb
            }
            isLoser={!draft.forfeit && pa != null && pb != null && pa < pb}
            isForfeitLoser={draft.forfeit && draft.forfeitLoserId === match.a?.id}
          />
          <ScoreRow
            fighter={match.b}
            value={draft.b}
            onChange={(v) => patch({ b: v })}
            disabled={draft.forfeit || locked}
            forfeit={draft.forfeit}
            isWinner={
              draft.forfeit
                ? draft.forfeitLoserId != null && draft.forfeitLoserId !== match.b?.id
                : pa != null && pb != null && pb > pa
            }
            isLoser={!draft.forfeit && pa != null && pb != null && pb < pa}
            isForfeitLoser={draft.forfeit && draft.forfeitLoserId === match.b?.id}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-none">
          {!locked && <ForfeitControl match={match} draft={draft} patch={patch} />}
          <button
            type="button"
            onClick={save}
            disabled={locked || !ready || (match.played && !dirty)}
            className="btn-gold flex-none px-4 py-2 text-[0.625rem] disabled:opacity-35"
          >
            {match.played ? 'Mettre à jour' : 'Valider'}
          </button>
        </div>
      </div>

      <div className="mt-2 min-h-[1.1rem] text-[0.6875rem] leading-snug">
        {tie && (
          <p role="alert" className="flex items-center gap-1.5 text-blood">
            <span aria-hidden="true">⚠</span>
            Points identiques : un duel doit désigner un vainqueur.
          </p>
        )}
        {draft.forfeit && draft.forfeitLoserId == null && (
          <p role="alert" className="flex items-center gap-1.5 text-blood">
            <span aria-hidden="true">⚠</span>
            Indiquez qui déclare forfait.
          </p>
        )}
        {winner && ready && (
          <p className="text-parchment-dim">
            Vainqueur : <span className="font-semibold text-gold">{winner.name}</span>
            {draft.forfeit ? ' — victoire par forfait' : !match.played ? ' (sélection automatique)' : ''}
          </p>
        )}
        {!ready && !tie && !draft.forfeit && (
          <p className="text-parchment-dim/60">Saisissez les points des deux combattants.</p>
        )}
      </div>
    </div>
  );
}

function ScoreRow({
  fighter,
  value,
  onChange,
  disabled,
  forfeit,
  isWinner,
  isLoser,
  isForfeitLoser,
}: {
  fighter: { id: number; name: string } | null;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  forfeit: boolean;
  isWinner: boolean;
  isLoser: boolean;
  isForfeitLoser: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded border px-3 py-2 transition-colors ${
        isWinner
          ? 'border-gold/70 bg-gold/10'
          : isForfeitLoser
            ? 'border-blood/60 bg-blood/[0.07]'
            : 'border-gold/15'
      }`}
    >
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          isWinner
            ? 'font-semibold text-gold-light'
            : isLoser || isForfeitLoser
              ? 'text-parchment-dim/70 line-through'
              : 'text-parchment-dim'
        }`}
      >
        {fighter?.name ?? '—'}
        {isForfeitLoser && (
          <span className="ml-1.5 text-[0.5rem] uppercase tracking-wider text-blood no-underline">forfait</span>
        )}
      </span>

      <div className="flex w-[6.75rem] flex-none justify-end">
        {forfeit ? (
          <span
            className={`text-[0.625rem] uppercase tracking-[0.1em] ${
              isForfeitLoser ? 'text-blood' : 'text-gold-light'
            }`}
          >
            {isForfeitLoser ? 'Forfait' : 'Vainqueur'}
          </span>
        ) : (
          <ScoreSelect
            value={value}
            onChange={onChange}
            disabled={disabled}
            label={`Points de ${fighter?.name ?? 'ce combattant'}`}
            isWinner={isWinner}
          />
        )}
      </div>
    </div>
  );
}

function ForfeitControl({
  match,
  draft,
  patch,
}: {
  match: Match;
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim">
        <input
          type="checkbox"
          checked={draft.forfeit}
          onChange={(e) => patch({ forfeit: e.target.checked, forfeitLoserId: null })}
          className="accent-gold"
        />
        Forfait
      </label>

      {draft.forfeit && (
        <ForfeitSelect
          options={[match.a, match.b]
            .filter((f) => f != null)
            .map((f) => ({ value: f!.id, label: f!.name }))}
          value={draft.forfeitLoserId}
          onChange={(id) => patch({ forfeitLoserId: id })}
        />
      )}
    </div>
  );
}

function ResetPanel({ run }: { run: Run }) {
  return (
    <Section title="Réinitialisation">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-parchment-dim">
          Efface les résultats et le tableau final. Conserve les combattants et les groupes.
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
