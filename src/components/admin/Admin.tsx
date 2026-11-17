import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../../i18n';
import { locale } from '../../i18n';
import type { TournamentState } from '../../lib/state';
import { parsePoints } from '../../lib/format';
import { GROUPS } from '../../lib/tournament';
import { ForfeitSelect, ScoreSelect } from './ScoreSelect';
import CatalogAdmin from '../catalogue/CatalogAdmin';
import type { AgendaEvent } from '../../lib/events';

type Match = TournamentState['matches'][number];

const STR = {
  fr: {
    sessionExpired: 'Session expirée. Reconnectez-vous.',
    genericError: 'Une erreur est survenue',
    tabs: { tournoi: 'Tournoi', agenda: 'Agenda', catalog: 'Catalogue' },
    loading: 'Chargement',
    adminSpace: 'Espace administrateur',
    tournamentTitle: 'Gestion du tournoi',
    agendaTitle: "Gestion de l'agenda",
    signOut: 'Déconnexion',
    signedOut: 'Déconnecté',
    navAria: "Sections de l'administration",
    closeToast: 'Fermer la notification',
    restricted: 'Accès restreint',
    loginTitle: 'Connexion administrateur',
    password: 'Mot de passe',
    signingIn: 'Connexion…',
    enter: 'Entrer',
    loginFailed: 'Connexion impossible',
    fighters: 'Combattants',
    nameRequired: 'Saisissez un nom',
    registered: (name: string) => `« ${name} » inscrit`,
    addFailed: 'Ajout impossible',
    fighterName: 'Nom du combattant',
    newFighterName: 'Nom du nouveau combattant',
    add: 'Ajouter',
    fullNote: 'Seize combattants inscrits. Supprimez-en un pour en ajouter un autre.',
    lockedNote: 'Le tirage a eu lieu : les combattants ne peuvent plus être retirés.',
    noFighters: 'Aucun combattant inscrit.',
    newNameFor: (name: string) => `Nouveau nom pour ${name}`,
    nameChanged: 'Nom modifié',
    renameFailed: 'Renommage impossible',
    cancel: 'Annuler',
    dupName: 'Nom en double',
    duplicate: 'Doublon',
    rename: (name: string) => `Renommer ${name}`,
    renameLocked: 'Le tirage a eu lieu : le nom ne peut plus être modifié',
    edit: 'Modifier',
    deleteName: (name: string) => `Supprimer ${name}`,
    fighterRemoved: 'Combattant supprimé',
    delShort: 'Suppr.',
    draw: 'Tirage au sort',
    groupsDrawn: 'Les groupes ont été tirés. Saisissez les résultats dans la section suivante.',
    drawConfirm: 'Tirer au sort les 4 groupes ? Cette action est définitive.',
    drawGroups: 'Tirer au sort les groupes',
    groupsDrawnMsg: 'Groupes tirés au sort',
    drawLayout: 'Les 16 combattants seront répartis en 4 groupes de 4.',
    missingFighters: (n: number) =>
      `Il manque ${n} combattant${n > 1 ? 's' : ''} pour lancer le tirage.`,
    finalPhase: 'Phase finale',
    bracketConfirm: 'Générer les quarts de finale à partir du classement ?',
    generateQf: 'Générer les quarts',
    qfGenerated: 'Quarts de finale générés',
    bracketLayout: 'Tableau : 1er A – 2e B · 1er B – 2e A · 1er C – 2e D · 1er D – 2e C.',
    bracketWait: 'Tous les duels de poules doivent être validés.',
    groupMatches: 'Duels de poules',
    validatedCount: (played: number, total: number) => `${played} / ${total} validés`,
    enterPendingPoints: 'Saisissez les points des duels à valider',
    validateCountTitle: (n: number) => `Valider ${n} duel${n > 1 ? 's' : ''} en un seul enregistrement`,
    validating: 'Validation…',
    validateAll: 'Tout valider',
    validateAllCount: (n: number) => `Tout valider (${n})`,
    groupLocked:
      'Le tableau final est généré : les résultats de poules ne peuvent plus être modifiés. Pour corriger un résultat, utilisez « Effacer les résultats » dans la section Réinitialisation.',
    groupLabel: (g: string) => `GROUPE ${g}`,
    rounds: { qf: 'Quarts de finale', sf: 'Demi-finales', final: 'Grande finale' },
    bracketResetNote:
      'Modifier un quart réinitialise la demi-finale et la finale concernées si le vainqueur change.',
    groupsDoneNote:
      'Tous les duels de poules sont validés. Vous pouvez générer les quarts de finale.',
    matchesValidated: (n: number) => `${n} duel${n > 1 ? 's' : ''} validé${n > 1 ? 's' : ''}`,
    resultValidated: 'Résultat validé',
    update: 'Mettre à jour',
    validate: 'Valider',
    tieError: 'Points identiques : un duel doit désigner un vainqueur.',
    forfeitWhoError: 'Indiquez qui déclare forfait.',
    winnerPrefix: 'Vainqueur : ',
    winByForfeit: '  -  victoire par forfait',
    autoSelected: ' (sélection automatique)',
    enterBoth: 'Saisissez les points des deux combattants.',
    forfeitTag: 'forfait',
    forfeit: 'Forfait',
    winnerShort: 'Vainqueur',
    pointsFor: (name: string) => `Points de ${name}`,
    thisFighter: 'ce combattant',
    agenda: 'Agenda',
    eventsCount: (n: number) => `${n} événement${n > 1 ? 's' : ''}`,
    eventPublished: 'Événement publié',
    createFailed: 'Création impossible',
    eventName: "Nom de l'animation",
    playerName: 'Nom du joueur',
    town: 'Ville',
    county: 'Comté',
    startDate: 'Date de début',
    endDate: 'Date de fin',
    forumLink: 'Lien du sujet forum',
    publishEvent: "Publier l'événement",
    loadingShort: 'Chargement…',
    noEvents: "Aucun événement pour l'instant.",
    pending: 'En attente',
    publishedStatus: 'Publié',
    eventApproved: 'Événement approuvé',
    approve: 'Approuver',
    deleteEventConfirm: (title: string) => `Supprimer « ${title} » ?`,
    eventDeleted: 'Événement supprimé',
    editEvent: (title: string) => `Modifier « ${title} »`,
    save: 'Enregistrer',
    eventUpdated: 'Événement modifié',
    updateFailed: 'Modification impossible',
    dupEvent: 'La même animation a été soumise plusieurs fois',
    reset: 'Réinitialisation',
    clearResultsNote:
      'Efface les résultats et le tableau final. Conserve les combattants et les groupes.',
    clearResultsConfirm: 'Effacer tous les résultats et le tableau final ?',
    resultsCleared: 'Résultats effacés',
    clearResults: 'Effacer les résultats',
    resetAllNote: 'Efface tout : combattants, groupes, duels et tableau. Action irréversible.',
    resetAllConfirm: 'Tout effacer ? Combattants, groupes et résultats seront supprimés.',
    tournamentReset: 'Tournoi réinitialisé',
    resetAll: 'Tout réinitialiser',
  },
  en: {
    sessionExpired: 'Session expired. Please sign in again.',
    genericError: 'An error occurred',
    tabs: { tournoi: 'Tournament', agenda: 'Agenda', catalog: 'Catalogue' },
    loading: 'Loading',
    adminSpace: 'Administrator area',
    tournamentTitle: 'Tournament management',
    agendaTitle: 'Agenda management',
    signOut: 'Sign out',
    signedOut: 'Signed out',
    navAria: 'Administration sections',
    closeToast: 'Dismiss notification',
    restricted: 'Restricted access',
    loginTitle: 'Administrator sign-in',
    password: 'Password',
    signingIn: 'Signing in…',
    enter: 'Sign in',
    loginFailed: 'Could not sign in',
    fighters: 'Fighters',
    nameRequired: 'Enter a name',
    registered: (name: string) => `${name} registered`,
    addFailed: 'Could not add',
    fighterName: 'Fighter name',
    newFighterName: 'New fighter name',
    add: 'Add',
    fullNote: 'Sixteen fighters registered. Remove one to add another.',
    lockedNote: 'The draw has taken place: fighters can no longer be removed.',
    noFighters: 'No fighters registered.',
    newNameFor: (name: string) => `New name for ${name}`,
    nameChanged: 'Name changed',
    renameFailed: 'Could not rename',
    cancel: 'Cancel',
    dupName: 'Duplicate name',
    duplicate: 'Duplicate',
    rename: (name: string) => `Rename ${name}`,
    renameLocked: 'The draw has taken place: the name can no longer be changed',
    edit: 'Edit',
    deleteName: (name: string) => `Delete ${name}`,
    fighterRemoved: 'Fighter removed',
    delShort: 'Del.',
    draw: 'Draw',
    groupsDrawn: 'The groups have been drawn. Enter the results in the section below.',
    drawConfirm: 'Draw the 4 groups? This action is final.',
    drawGroups: 'Draw the groups',
    groupsDrawnMsg: 'Groups drawn',
    drawLayout: 'The 16 fighters will be split into 4 groups of 4.',
    missingFighters: (n: number) =>
      `${n} more fighter${n > 1 ? 's' : ''} needed to start the draw.`,
    finalPhase: 'Knockout stage',
    bracketConfirm: 'Generate the quarter-finals from the group standings?',
    generateQf: 'Generate quarter-finals',
    qfGenerated: 'Quarter-finals generated',
    bracketLayout: 'Bracket: 1st A – 2nd B · 1st B – 2nd A · 1st C – 2nd D · 1st D – 2nd C.',
    bracketWait: 'All group matches must be validated.',
    groupMatches: 'Group matches',
    validatedCount: (played: number, total: number) => `${played} / ${total} validated`,
    enterPendingPoints: 'Enter the points for the matches to validate',
    validateCountTitle: (n: number) => `Validate ${n} match${n > 1 ? 'es' : ''} in a single save`,
    validating: 'Validating…',
    validateAll: 'Validate all',
    validateAllCount: (n: number) => `Validate all (${n})`,
    groupLocked:
      'The final bracket has been generated: group results can no longer be edited. To correct a result, use “Clear results” in the Reset section.',
    groupLabel: (g: string) => `GROUP ${g}`,
    rounds: { qf: 'Quarter-finals', sf: 'Semi-finals', final: 'Grand final' },
    bracketResetNote:
      'Editing a quarter-final resets the affected semi-final and final if the winner changes.',
    groupsDoneNote:
      'All group matches are validated. You can generate the quarter-finals.',
    matchesValidated: (n: number) => `${n} match${n > 1 ? 'es' : ''} validated`,
    resultValidated: 'Result validated',
    update: 'Update',
    validate: 'Validate',
    tieError: 'Identical points: a match must have a winner.',
    forfeitWhoError: 'Indicate who forfeits.',
    winnerPrefix: 'Winner: ',
    winByForfeit: '  -  win by forfeit',
    autoSelected: ' (automatic selection)',
    enterBoth: 'Enter the points for both fighters.',
    forfeitTag: 'forfeit',
    forfeit: 'Forfeit',
    winnerShort: 'Winner',
    pointsFor: (name: string) => `Points for ${name}`,
    thisFighter: 'this fighter',
    agenda: 'Agenda',
    eventsCount: (n: number) => `${n} event${n > 1 ? 's' : ''}`,
    eventPublished: 'Event published',
    createFailed: 'Could not create',
    eventName: 'Event name',
    playerName: 'Player name',
    town: 'Town',
    county: 'County',
    startDate: 'Start date',
    endDate: 'End date',
    forumLink: 'Forum thread link',
    publishEvent: 'Publish event',
    loadingShort: 'Loading…',
    noEvents: 'No events yet.',
    pending: 'Pending',
    publishedStatus: 'Published',
    eventApproved: 'Event approved',
    approve: 'Approve',
    deleteEventConfirm: (title: string) => `Delete “${title}”?`,
    eventDeleted: 'Event deleted',
    editEvent: (title: string) => `Edit ${title}`,
    save: 'Save',
    eventUpdated: 'Event updated',
    updateFailed: 'Could not update',
    dupEvent: 'The same animation was submitted more than once',
    reset: 'Reset',
    clearResultsNote: 'Clears the results and the final bracket. Keeps the fighters and groups.',
    clearResultsConfirm: 'Clear all results and the final bracket?',
    resultsCleared: 'Results cleared',
    clearResults: 'Clear results',
    resetAllNote: 'Clears everything: fighters, groups, matches and bracket. Irreversible.',
    resetAllConfirm: 'Clear everything? Fighters, groups and results will be deleted.',
    tournamentReset: 'Tournament reset',
    resetAll: 'Reset everything',
  },
};

async function api(path: string, init?: RequestInit, lang: Lang = 'fr') {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (res.status === 401) throw new Error(STR[lang].sessionExpired);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? STR[lang].genericError);
  return data;
}

type Draft = { a: string; b: string; forfeit: boolean; forfeitLoserId: number | null };

function draftOf(match: Match): Draft {
  return {
    a: match.aScore == null ? '' : String(match.aScore).replace('.', ','),
    b: match.bScore == null ? '' : String(match.bScore).replace('.', ','),
    forfeit: match.forfeit,
    forfeitLoserId:
      match.forfeit && match.played && match.winnerId != null
        ? match.winnerId === match.a?.id
          ? match.b?.id ?? null
          : match.a?.id ?? null
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

type AdminView = 'tournoi' | 'agenda' | 'catalog';

const ADMIN_TABS = [
  { view: 'tournoi', href: '/admin', labelKey: 'tournoi' },
  { view: 'agenda', href: '/admin/agenda', labelKey: 'agenda' },
  { view: 'catalog', href: '/admin/catalog', labelKey: 'catalog' },
] as const;

type PendingCounts = { catalog: number; agenda: number };

export default function Admin({ view, lang = 'fr' }: { view: AdminView; lang?: Lang }) {
  const s = STR[lang];
  const isTournoi = view === 'tournoi';
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<TournamentState | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({ catalog: 0, agenda: 0 });

  async function fetchPendingCounts() {
    try {
      const [subRes, evRes] = await Promise.all([
        fetch('/api/submissions?status=pending'),
        fetch('/api/admin/events'),
      ]);
      if (subRes.ok) {
        const subs = await subRes.json();
        setPendingCounts((c) => ({ ...c, catalog: subs.length }));
      }
      if (evRes.ok) {
        const { events } = await evRes.json();
        const pending = events.filter((e: { status: string }) => e.status === 'pending').length;
        setPendingCounts((c) => ({ ...c, agenda: pending }));
      }
    } catch {
      // silencieux
    }
  }

  const notify = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const refresh = useCallback(async () => {
    if (!isTournoi) return;
    setState((await api('/api/tournament?slug=classique', undefined, lang)) as TournamentState);
  }, [isTournoi, lang]);

  useEffect(() => {
    api('/api/admin/session', undefined, lang)
      .then(() => {
        setAuthed(true);
        fetchPendingCounts();
        return refresh();
      })
      .catch(() => setAuthed(false));
  }, [refresh, lang]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, okMsg: string) => {
      try {
        await fn();
        await refresh();
        notify('ok', okMsg);
        return true;
      } catch (e) {
        notify('err', e instanceof Error ? e.message : s.genericError);
        return false;
      }
    },
    [refresh, notify, s.genericError],
  );

  // Rafraîchir les badges quand on change de vue (catalog/agenda)
  useEffect(() => {
    if (view === 'catalog' || view === 'agenda') {
      fetchPendingCounts();
    }
  }, [view, lang]);

  if (authed === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        <span className="text-xs uppercase tracking-[0.14em] text-parchment-dim">{s.loading}</span>
      </div>
    );
  }

  if (!authed) {
    return (
      <Login onDone={() => { setAuthed(true); void refresh(); }} lang={lang} />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-caps">{s.adminSpace}</p>
          <h1 className="mt-1 font-display text-2xl tracking-[0.06em] text-parchment">
            {isTournoi ? s.tournamentTitle : s.agendaTitle}
          </h1>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            void run(async () => {
              await api('/api/admin/session', { method: 'DELETE' }, lang);
              setAuthed(false);
            }, s.signedOut)
          }
        >
          {s.signOut}
        </button>
      </div>

      <nav aria-label={s.navAria} className="flex gap-1 border-b border-gold/15">
        {ADMIN_TABS.map((tab) => {
          const count = tab.view === 'catalog' ? pendingCounts.catalog : tab.view === 'agenda' ? pendingCounts.agenda : 0;
          return (
            <a
              key={tab.view}
              href={tab.href}
              aria-current={tab.view === view ? 'page' : undefined}
              className={`relative inline-flex items-center gap-2 px-3 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] transition-colors sm:px-5 sm:tracking-[0.18em] ${
                tab.view === view
                  ? 'bg-gold/[0.05] text-gold'
                  : 'text-parchment-dim hover:bg-gold/[0.03] hover:text-parchment'
              }`}
            >
              <span
                className={`h-1 w-1 rotate-45 ${tab.view === view ? 'bg-gold' : 'bg-gold/30'}`}
                aria-hidden="true"
              />
              <span className="flex items-center gap-1.5">
                {s.tabs[tab.view]}
                {count > 0 && (
                  <span className="h-5 min-w-5 flex items-center justify-center rounded-full px-1.5 text-[0.5rem] font-bold bg-blood text-parchment animate-pulse">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </span>
              {tab.view === view && (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent"
                  aria-hidden="true"
                />
              )}
            </a>
          );
        })}
      </nav>

      {view === 'catalog' ? (
        <CatalogAdmin lang={lang} onPendingChange={fetchPendingCounts} />
      ) : isTournoi ? (
        <>
          {state && <Fighters state={state} run={run} lang={lang} />}
          {state && <DrawPanel state={state} run={run} lang={lang} />}
          {state && <DuelPanel state={state} run={run} phase="group" lang={lang} />}
          {state && <DuelPanel state={state} run={run} phase="bracket" lang={lang} />}
          {state && <ResetPanel run={run} lang={lang} />}
        </>
      ) : (
        <Agenda run={run} lang={lang} />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} lang={lang} />
    </div>
  );
}

function Toast({
  toast,
  onClose,
  lang = 'fr',
}: {
  toast: { kind: 'ok' | 'err'; msg: string } | null;
  onClose: () => void;
  lang?: Lang;
}) {
  if (!toast) return null;
  const s = STR[lang];
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
        aria-label={s.closeToast}
        className="-mr-1 -mt-1 flex-none rounded p-1 text-parchment-dim transition-colors hover:text-parchment"
      >
        ✕
      </button>
    </div>
  );
}

function Login({ onDone, lang = 'fr' }: { onDone: () => void; lang?: Lang }) {
  const s = STR[lang];
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ password }) }, lang);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : s.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <form onSubmit={submit} className="card-dark texture-noise rounded-lg p-7">
        <p className="label-caps">{s.restricted}</p>
        <h1 className="mt-2 font-display text-xl tracking-[0.06em] text-parchment">{s.loginTitle}</h1>
        <div className="rule-gold my-5"></div>

        <label htmlFor="password" className="mb-2 block text-xs uppercase tracking-[0.14em] text-parchment-dim">
          {s.password}
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
          {busy ? s.signingIn : s.enter}
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

function Fighters({ state, run, lang = 'fr' }: { state: TournamentState; run: Run; lang?: Lang }) {
  const s = STR[lang];
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
      setError(s.nameRequired);
      return;
    }
    try {
      await api('/api/admin/fighters', { method: 'POST', body: JSON.stringify({ name: value }) }, lang);
      setName('');
      setError('');
      await run(async () => {}, s.registered(value));
    } catch (err) {
      setError(err instanceof Error ? err.message : s.addFailed);
    }
  }

  return (
    <Section title={s.fighters} meta={`${state.fighters.length} / 16`}>
      {!locked && (
        <form onSubmit={add} className="mb-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder={s.fighterName}
                maxLength={40}
                aria-label={s.newFighterName}
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
              {s.add}
            </button>
          </div>
          {full && (
            <p className="mt-2 text-xs text-parchment-dim">{s.fullNote}</p>
          )}
        </form>
      )}

      {locked && (
        <p className="mb-4 rounded border border-gold/20 bg-gold/[0.05] px-3 py-2 text-xs text-parchment-dim">
          {s.lockedNote}
        </p>
      )}

      {state.fighters.length === 0 ? (
        <p className="py-6 text-center text-sm text-parchment-dim">{s.noFighters}</p>
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
                      onChange={(e) => { setEditName(e.target.value); setEditError(''); }}
                      maxLength={40}
                      aria-label={s.newNameFor(f.name)}
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
                          await api('/api/admin/fighters', { method: 'PATCH', body: JSON.stringify({ id: f.id, name: editName.trim() }) }, lang);
                          setEditing(null);
                          setEditError('');
                          await run(async () => {}, s.nameChanged);
                        } catch (err) {
                          setEditError(err instanceof Error ? err.message : s.renameFailed);
                        }
                      }}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim"
                      onClick={() => { setEditing(null); setEditError(''); }}
                    >
                      {s.cancel}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-parchment">{f.name}</span>
                    {dup && (
                      <span
                        className="flex-none text-[0.5rem] uppercase tracking-[0.1em] text-blood"
                        title={s.dupName}
                      >
                        {s.duplicate}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={s.rename(f.name)}
                      disabled={locked}
                      title={locked ? s.renameLocked : undefined}
                      className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim transition-colors hover:text-gold disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-parchment-dim"
                      onClick={() => { setEditing(f.id); setEditName(f.name); setEditError(''); }}
                    >
                      {s.edit}
                    </button>
                    {!locked && (
                      <button
                        type="button"
                        aria-label={s.deleteName(f.name)}
                        className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-blood transition-colors hover:text-blood-light"
                        onClick={() =>
                          void run(() => api(`/api/admin/fighters?id=${f.id}`, { method: 'DELETE' }, lang), s.fighterRemoved)
                        }
                      >
                        {s.delShort}
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

function DrawPanel({ state, run, lang = 'fr' }: { state: TournamentState; run: Run; lang?: Lang }) {
  const s = STR[lang];
  const hasDraw = state.matches.length > 0;
  const missing = 16 - state.fighters.length;
  const [busy, setBusy] = useState(false);

  return (
    <Section title={s.draw}>
      {hasDraw ? (
        <p className="text-sm text-parchment-dim">{s.groupsDrawn}</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={missing !== 0 || busy}
            className="btn-gold flex-none disabled:opacity-40"
            onClick={() => {
              if (!window.confirm(s.drawConfirm)) return;
              setBusy(true);
              void run(() => api('/api/admin/draw', { method: 'POST' }, lang), s.groupsDrawnMsg).finally(() =>
                setBusy(false),
              );
            }}
          >
            {s.drawGroups}
          </button>
          <p className="text-xs text-parchment-dim">
            {missing === 0 ? s.drawLayout : s.missingFighters(missing)}
          </p>
        </div>
      )}
    </Section>
  );
}

function DuelPanel({ state, run, phase, lang = 'fr' }: { state: TournamentState; run: Run; phase: 'group' | 'bracket'; lang?: Lang }) {
  const s = STR[lang];
  const matches = state.matches.filter((m) =>
    phase === 'group' ? m.phase === 'group' : m.phase !== 'group',
  );
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState(false);
  const locked = phase === 'group' && state.matches.some((m) => m.phase !== 'group');

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
      () => api('/api/admin/match', { method: 'POST', body: JSON.stringify({ results }) }, lang),
      s.matchesValidated(results.length),
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
        <Section title={s.finalPhase}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={!groupsDone || busy}
              className="btn-gold flex-none disabled:opacity-40"
              onClick={() => {
                if (!window.confirm(s.bracketConfirm)) return;
                setBusy(true);
                void run(() => api('/api/admin/bracket', { method: 'POST' }, lang), s.qfGenerated).finally(() =>
                  setBusy(false),
                );
              }}
            >
              {s.generateQf}
            </button>
            <p className="text-xs leading-relaxed text-parchment-dim">
              {groupsDone ? s.bracketLayout : s.bracketWait}
            </p>
          </div>
        </Section>
      );
    }
  }

  if (matches.length === 0) return null;

  const played = matches.filter((m) => m.played).length;
  const rounds: { phase: string; label: string }[] = [
    { phase: 'qf', label: s.rounds.qf },
    { phase: 'sf', label: s.rounds.sf },
    { phase: 'final', label: s.rounds.final },
  ];

  return (
    <Section
      title={phase === 'group' ? s.groupMatches : s.finalPhase}
      meta={s.validatedCount(played, matches.length)}
      action={
        <button
          type="button"
          onClick={saveAll}
          disabled={busy || pending.length === 0 || locked}
          title={
            pending.length === 0
              ? s.enterPendingPoints
              : s.validateCountTitle(pending.length)
          }
          className="btn-gold px-3 py-1.5 text-[0.625rem] disabled:opacity-35"
        >
          {busy
            ? s.validating
            : pending.length === 0
            ? s.validateAll
            : s.validateAllCount(pending.length)}
        </button>
      }
    >
      {phase === 'group' ? (
        <div className="space-y-7">
          {locked && (
            <p className="rounded border border-gold/20 bg-gold/[0.05] px-3 py-2 text-xs text-parchment-dim">
              {s.groupLocked}
            </p>
          )}
          {GROUPS.map((g) => {
            const rows = matches.filter((m) => m.grp === g).sort((a, b) => a.slot - b.slot);
            if (rows.length === 0) return null;
            return (
              <div key={g}>
                <h3 className="mb-2 font-display text-xs tracking-[0.18em] text-gold">{s.groupLabel(g)}</h3>
                <div className="space-y-2">
                  {rows.map((m) => (
                    <DuelEditor
                      key={m.id}
                      match={m}
                      draft={drafts[m.id] ?? draftOf(m)}
                      patch={setOne(m.id, m)}
                      run={run}
                      locked={locked}
                      lang={lang}
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
                      lang={lang}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-[0.6875rem] leading-relaxed text-parchment-dim/70">
            {s.bracketResetNote}
          </p>
        </div>
      )}

      {phase === 'group' && played === matches.length && (
        <p className="mt-5 rounded border border-gold/30 bg-gold/[0.05] px-3 py-2 text-xs text-gold">
          {s.groupsDoneNote}
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
  lang = 'fr',
}: {
  match: Match;
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
  run: Run;
  locked: boolean;
  lang?: Lang;
}) {
  const s = STR[lang];
  const { pa, pb, tie, ready, winner, dirty } = analyze(match, draft);

  function save() {
    const body = payload(match, draft);
    if (!body) return;
    void run(
      () => api('/api/admin/match', { method: 'POST', body: JSON.stringify(body) }, lang),
      s.resultValidated,
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
            lang={lang}
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
            lang={lang}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-none">
          {!locked && <ForfeitControl match={match} draft={draft} patch={patch} lang={lang} />}
          <button
            type="button"
            onClick={save}
            disabled={locked || !ready || (match.played && !dirty)}
            className="btn-gold flex-none px-4 py-2 text-[0.625rem] disabled:opacity-35"
          >
            {match.played ? s.update : s.validate}
          </button>
        </div>
      </div>

      <div className="mt-2 min-h-[1.1rem] text-[0.6875rem] leading-snug">
        {tie && (
          <p role="alert" className="flex items-center gap-1.5 text-blood">
            <span aria-hidden="true">⚠</span>
            {s.tieError}
          </p>
        )}
        {draft.forfeit && draft.forfeitLoserId == null && (
          <p role="alert" className="flex items-center gap-1.5 text-blood">
            <span aria-hidden="true">⚠</span>
            {s.forfeitWhoError}
          </p>
        )}
        {winner && ready && (
          <p className="text-parchment-dim">
            {s.winnerPrefix} <span className="font-semibold text-gold">{winner.name}</span>
            {draft.forfeit ? s.winByForfeit : !match.played ? s.autoSelected : ''}
          </p>
        )}
        {!ready && !tie && !draft.forfeit && (
          <p className="text-parchment-dim/60">{s.enterBoth}</p>
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
  lang = 'fr',
}: {
  fighter: { id: number; name: string } | null;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  forfeit: boolean;
  isWinner: boolean;
  isLoser: boolean;
  isForfeitLoser: boolean;
  lang?: Lang;
}) {
  const s = STR[lang];
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
        {fighter?.name ?? ' - '}
        {isForfeitLoser && (
          <span className="ml-1.5 text-[0.5rem] uppercase tracking-wider text-blood no-underline">{s.forfeitTag}</span>
        )}
      </span>

      <div className="flex w-[6.75rem] flex-none justify-end">
        {forfeit ? (
          <span
            className={`text-[0.625rem] uppercase tracking-[0.1em] ${
              isForfeitLoser ? 'text-blood' : 'text-gold-light'
            }`}
          >
            {isForfeitLoser ? s.forfeit : s.winnerShort}
          </span>
        ) : (
          <ScoreSelect
            value={value}
            onChange={onChange}
            disabled={disabled}
            label={s.pointsFor(fighter?.name ?? s.thisFighter)}
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
  lang = 'fr',
}: {
  match: Match;
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
  lang?: Lang;
}) {
  const s = STR[lang];
  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim">
        <input
          type="checkbox"
          checked={draft.forfeit}
          onChange={(e) => patch({ forfeit: e.target.checked, forfeitLoserId: null })}
          className="accent-gold"
        />
        {s.forfeit}
      </label>

      {draft.forfeit && (
        <ForfeitSelect
          options={[match.a, match.b]
            .filter((f) => f != null)
            .map((f) => ({ value: String(f!.id), label: f!.name }))}
          value={draft.forfeitLoserId}
          onChange={(id) => patch({ forfeitLoserId: id })}
        />
      )}
    </div>
  );
}

const EMPTY_EVENT_FORM = {
  title: '',
  rkName: '',
  city: '',
  county: '',
  forumUrl: '',
  startsOn: '',
  endsOn: '',
};

const EDIT_FIELDS = ['title', 'rkName', 'city', 'county', 'forumUrl', 'startsOn', 'endsOn'] as const;

type AdminEvent = AgendaEvent & { key: string };

function fmtRange(startsOn: string, endsOn: string, lang: Lang = 'fr') {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  const loc = locale(lang);
  const start = new Date(`${startsOn}T00:00:00Z`).toLocaleDateString(loc, opts);
  return startsOn === endsOn
    ? start
    : `${start} – ${new Date(`${endsOn}T00:00:00Z`).toLocaleDateString(loc, opts)}`;
}

function Agenda({ run, lang = 'fr' }: { run: Run; lang?: Lang }) {
  const s = STR[lang];
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [form, setForm] = useState(EMPTY_EVENT_FORM);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState(EMPTY_EVENT_FORM);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const refreshEvents = useCallback(async () => {
    const data = (await api('/api/admin/events', undefined, lang)) as { events: AdminEvent[] };
    setEvents(data.events);
  }, [lang]);

  useEffect(() => {
    refreshEvents().catch(() => setEvents([]));
  }, [refreshEvents]);

  const act = useCallback(
    (fn: () => Promise<unknown>, okMsg: string) =>
      run(async () => {
        await fn();
        await refreshEvents();
      }, okMsg),
    [run, refreshEvents],
  );

  const sorted = useMemo(() => {
    const list = events ?? [];
    return [...list].sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1));
  }, [events]);

  const upd = (k: keyof typeof EMPTY_EVENT_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError('');
  };

  const updDraft = (k: keyof typeof EMPTY_EVENT_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft((f) => ({ ...f, [k]: e.target.value }));
    setEditError('');
  };

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const ev of events ?? []) seen.set(ev.key, (seen.get(ev.key) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [events]);

  function startEdit(ev: AdminEvent) {
    setEditing(ev.id);
    setDraft({
      title: ev.title,
      rkName: ev.rkName,
      city: ev.city,
      county: ev.county,
      forumUrl: ev.forumUrl,
      startsOn: ev.startsOn,
      endsOn: ev.endsOn,
    });
    setEditError('');
  }

  async function saveEdit(ev: AdminEvent) {
    setSaving(true);
    try {
      await api('/api/admin/events', { method: 'PATCH', body: JSON.stringify({ id: ev.id, ...draft }) }, lang);
      setEditing(null);
      setEditError('');
      await act(async () => {}, s.eventUpdated);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : s.updateFailed);
    } finally {
      setSaving(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/admin/events', { method: 'POST', body: JSON.stringify(form) }, lang);
      setForm(EMPTY_EVENT_FORM);
      setError('');
      await act(async () => {}, s.eventPublished);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.createFailed);
    }
  }

  const inputCls =
    'w-full rounded border bg-ink px-3 py-2 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/40 focus:border-gold aria-invalid:border-blood';

  return (
    <Section
      title={s.agenda}
      meta={events ? s.eventsCount(events.length) : undefined}
    >
      <form onSubmit={submit} className="mb-5 grid gap-2 sm:grid-cols-2">
        <input
          value={form.title}
          onChange={upd('title')}
          placeholder={s.eventName}
          maxLength={100}
          required
          aria-label={s.eventName}
          aria-invalid={error ? true : undefined}
          className={`${inputCls} sm:col-span-2`}
        />
        <input
          value={form.rkName}
          onChange={upd('rkName')}
          placeholder={s.playerName}
          maxLength={60}
          required
          aria-label={s.playerName}
          className={inputCls}
        />
        <input
          value={form.city}
          onChange={upd('city')}
          placeholder={s.town}
          maxLength={60}
          required
          aria-label={s.town}
          className={inputCls}
        />
        <input
          value={form.county}
          onChange={upd('county')}
          placeholder={s.county}
          maxLength={60}
          required
          aria-label={s.county}
          className={inputCls}
        />
        <input
          value={form.startsOn}
          onChange={upd('startsOn')}
          type="date"
          required
          aria-label={s.startDate}
          className={inputCls}
        />
        <input
          value={form.endsOn}
          onChange={upd('endsOn')}
          type="date"
          required
          aria-label={s.endDate}
          className={inputCls}
        />
        <input
          value={form.forumUrl}
          onChange={upd('forumUrl')}
          type="url"
          placeholder={s.forumLink}
          maxLength={500}
          required
          aria-label={s.forumLink}
          className={`${inputCls} sm:col-span-2`}
        />
        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-blood sm:col-span-2">
            <span aria-hidden="true">⚠</span>
            {error}
          </p>
        )}
        <button type="submit" className="btn-gold sm:col-span-2">
          {s.publishEvent}
        </button>
      </form>

      {events === null ? (
        <p className="py-4 text-center text-sm text-parchment-dim">{s.loadingShort}</p>
      ) : sorted.length === 0 ? (
        <p className="py-4 text-center text-sm text-parchment-dim">{s.noEvents}</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((ev) => {
            const dup = duplicates.has(ev.key);
            const dirty = EDIT_FIELDS.some((k) => draft[k] !== ev[k]);
            return (
              <li
                key={ev.id}
                className={`flex flex-wrap items-center gap-2 rounded border px-3 py-2 ${
                  dup ? 'border-blood/60 bg-blood/[0.06]' : 'border-gold/10 bg-ink/40'
                }`}
              >
                {editing === ev.id ? (
                  <form
                    className="w-full"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(ev);
                    }}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`flex-none rounded-sm border px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider ${
                          ev.status === 'pending' ? 'border-blood/60 text-blood' : 'border-gold/40 text-gold'
                        }`}
                      >
                        {ev.status === 'pending' ? s.pending : s.publishedStatus}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-parchment">{ev.title}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={draft.title}
                        onChange={updDraft('title')}
                        placeholder={s.eventName}
                        maxLength={100}
                        required
                        autoFocus
                        aria-label={s.eventName}
                        aria-invalid={editError ? true : undefined}
                        className={`${inputCls} sm:col-span-2`}
                      />
                      <input
                        value={draft.rkName}
                        onChange={updDraft('rkName')}
                        placeholder={s.playerName}
                        maxLength={60}
                        required
                        aria-label={s.playerName}
                        className={inputCls}
                      />
                      <input
                        value={draft.city}
                        onChange={updDraft('city')}
                        placeholder={s.town}
                        maxLength={60}
                        required
                        aria-label={s.town}
                        className={inputCls}
                      />
                      <input
                        value={draft.county}
                        onChange={updDraft('county')}
                        placeholder={s.county}
                        maxLength={60}
                        required
                        aria-label={s.county}
                        className={inputCls}
                      />
                      <input
                        value={draft.startsOn}
                        onChange={updDraft('startsOn')}
                        type="date"
                        required
                        aria-label={s.startDate}
                        className={inputCls}
                      />
                      <input
                        value={draft.endsOn}
                        onChange={updDraft('endsOn')}
                        type="date"
                        required
                        aria-label={s.endDate}
                        className={inputCls}
                      />
                      <input
                        value={draft.forumUrl}
                        onChange={updDraft('forumUrl')}
                        type="url"
                        placeholder={s.forumLink}
                        maxLength={500}
                        required
                        aria-label={s.forumLink}
                        className={`${inputCls} sm:col-span-2`}
                      />
                    </div>
                    {editError && (
                      <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-blood">
                        <span aria-hidden="true">⚠</span>
                        {editError}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button type="submit" disabled={saving || !dirty} className="btn-gold disabled:opacity-40">
                        {s.save}
                      </button>
                      <button
                        type="button"
                        className="text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim transition-colors hover:text-gold"
                        onClick={() => {
                          setEditing(null);
                          setEditError('');
                        }}
                      >
                        {s.cancel}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span
                      className={`flex-none rounded-sm border px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider ${
                        ev.status === 'pending' ? 'border-blood/60 text-blood' : 'border-gold/40 text-gold'
                      }`}
                    >
                      {ev.status === 'pending' ? s.pending : s.publishedStatus}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-parchment">{ev.title}</span>
                    {dup && (
                      <span className="flex-none text-[0.5rem] uppercase tracking-[0.1em] text-blood" title={s.dupEvent}>
                        {s.duplicate}
                      </span>
                    )}
                    <span className="flex-none text-[0.6875rem] text-parchment-dim">
                      {fmtRange(ev.startsOn, ev.endsOn, lang)}
                    </span>
                    <span className="flex-none text-[0.6875rem] text-parchment-dim">
                      {ev.city} · {ev.county}
                    </span>
                    <span className="flex-none text-[0.6875rem] text-parchment-dim">RK : {ev.rkName}</span>
                    <a
                      href={ev.forumUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-gold hover:underline"
                    >
                      Forum
                    </a>
                    <button
                      type="button"
                      aria-label={s.editEvent(ev.title)}
                      className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-parchment-dim transition-colors hover:text-gold"
                      onClick={() => startEdit(ev)}
                    >
                      {s.edit}
                    </button>
                    {ev.status === 'pending' && (
                      <button
                        type="button"
                        className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-gold"
                        onClick={() =>
                          void act(
                            () =>
                              api('/api/admin/events', {
                                method: 'PATCH',
                                body: JSON.stringify({ id: ev.id, status: 'approved' }),
                              }, lang),
                            s.eventApproved,
                          )
                        }
                      >
                        {s.approve}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={s.deleteEventConfirm(ev.title)}
                      className="flex-none text-[0.625rem] uppercase tracking-[0.1em] text-blood transition-colors hover:text-blood-light"
                      onClick={() => {
                        if (!window.confirm(s.deleteEventConfirm(ev.title))) return;
                        void act(
                          () => api(`/api/admin/events?id=${ev.id}`, { method: 'DELETE' }, lang),
                          s.eventDeleted,
                        );
                      }}
                    >
                      {s.delShort}
                    </button>
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

function ResetPanel({ run, lang = 'fr' }: { run: Run; lang?: Lang }) {
  const s = STR[lang];
  const [busy, setBusy] = useState(false);

  return (
    <Section title={s.reset}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2 flex-1">
          <p className="text-xs leading-relaxed text-parchment-dim">{s.clearResultsNote}</p>
          <button
            type="button"
            disabled={busy}
            className="btn-ghost text-[0.625rem] disabled:opacity-35"
            onClick={() => {
              if (!window.confirm(s.clearResultsConfirm)) return;
              setBusy(true);
              void run(
                () => api('/api/admin/reset', { method: 'POST', body: JSON.stringify({ target: 'results' }) }, lang),
                s.resultsCleared,
              ).finally(() => setBusy(false));
            }}
          >
            {s.clearResults}
          </button>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <p className="text-xs leading-relaxed text-parchment-dim">{s.resetAllNote}</p>
          <button
            type="button"
            disabled={busy}
            className="btn-ghost text-[0.625rem] disabled:opacity-35"
            onClick={() => {
              if (!window.confirm(s.resetAllConfirm)) return;
              setBusy(true);
              void run(
                () => api('/api/admin/reset', { method: 'POST', body: JSON.stringify({ target: 'all' }) }, lang),
                s.tournamentReset,
              ).finally(() => setBusy(false));
            }}
          >
            {s.resetAll}
          </button>
        </div>
      </div>
    </Section>
  );
}