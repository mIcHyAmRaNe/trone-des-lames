import React, { useEffect, useMemo, useState } from 'react';
import { submissionDiff, fieldValue, SUBMISSION_FIELDS } from '../../lib/catalog-submit.js';
import type { Submission } from '../../lib/catalog-submit.js';
import CatalogReports from './CatalogReports';
import type { Lang } from '../../i18n';

type StatusTab = 'pending' | 'approved' | 'rejected';

const STATUS_TABS: { value: StatusTab; labelKey: string }[] = [
  { value: 'pending', labelKey: 'tabPending' },
  { value: 'approved', labelKey: 'tabApproved' },
  { value: 'rejected', labelKey: 'tabRejected' },
];

interface StrMap {
  loading: string;
  loadError: (status: number) => string;
  networkError: string;
  pendingCount: (n: number) => string;
  allClear: string;
  noPending: string;
  diffLabel: string;
  sourceLabel: string;
  noteLabel: string;
  notePlaceholder: string;
  noteAria: string;
  approve: string;
  reject: string;
  approved: (name: string) => string;
  rejected: (name: string) => string;
  actionError: (action: string, id: string, status: number) => string;
  kindCreate: string;
  kindEdit: string;
  searchPlaceholder: string;
  tabPending: string;
  tabApproved: string;
  tabRejected: string;
  emptyState: string;
  decidedBy: string;
  decidedAt: string;
  adminNoteLabel: string;
  submittedBy: string;
  submittedAt: string;
  viewItem: string;
  noResults: string;
}

const STR: Record<Lang, StrMap> = {
  fr: {
    loading: 'Chargement…',
    loadError: (status: number): string => `Impossible de charger (erreur ${status}).`,
    networkError: 'Serveur injoignable. Vérifiez votre connexion.',
    pendingCount: (n: number): string => `${n} soumission${n > 1 ? 's' : ''} en attente`,
    allClear: 'Tout est à jour.',
    noPending: 'Aucune soumission en attente.',
    diffLabel: 'Diff',
    sourceLabel: 'source',
    noteLabel: 'note',
    notePlaceholder: 'Note de modération (optionnelle)',
    noteAria: 'Note de modération',
    approve: 'Approuver',
    reject: 'Rejeter',
    approved: (name: string): string => `« ${name} » approuvé.`,
    rejected: (name: string): string => `« ${name} » rejeté.`,
    actionError: (action: string, id: string, status: number): string => `Échec (${action} ${id} : erreur ${status}).`,
    kindCreate: 'Création',
    kindEdit: 'Modification',
    searchPlaceholder: 'Rechercher (nom, auteur, ID…)',
    tabPending: 'En attente',
    tabApproved: 'Approuvées',
    tabRejected: 'Rejetées',
    emptyState: 'Aucune soumission.',
    decidedBy: 'par',
    decidedAt: 'le',
    adminNoteLabel: 'Note admin :',
    submittedBy: 'par',
    submittedAt: 'le',
    viewItem: 'Voir la fiche',
    noResults: 'Aucun résultat.',
  },
  en: {
    loading: 'Loading…',
    loadError: (status: number): string => `Could not load (error ${status}).`,
    networkError: 'Server unreachable. Check your connection.',
    pendingCount: (n: number): string => `${n} submission${n > 1 ? 's' : ''} pending`,
    allClear: 'All up to date.',
    noPending: 'No pending submissions.',
    diffLabel: 'Diff',
    sourceLabel: 'source',
    noteLabel: 'note',
    notePlaceholder: 'Moderation note (optional)',
    noteAria: 'Moderation note',
    approve: 'Approve',
    reject: 'Reject',
    approved: (name: string): string => `“${name}” approved.`,
    rejected: (name: string): string => `“${name}” rejected.`,
    actionError: (action: string, id: string, status: number): string => `Failed (${action} ${id}: error ${status}).`,
    kindCreate: 'Creation',
    kindEdit: 'Edit',
    searchPlaceholder: 'Search (name, author, ID…)',
    tabPending: 'Pending',
    tabApproved: 'Approved',
    tabRejected: 'Rejected',
    emptyState: 'No submissions.',
    decidedBy: 'by',
    decidedAt: 'on',
    adminNoteLabel: 'Admin note:',
    submittedBy: 'by',
    submittedAt: 'on',
    viewItem: 'View item',
    noResults: 'No results.',
  },
};

export default function CatalogAdmin({
  lang = 'fr',
  onPendingChange,
}: { lang?: Lang; onPendingChange?: () => void }) {
  const s = STR[lang];
  const [allRows, setAllRows] = useState<Submission[]>([]);
  const [message, setMessage] = useState(s.loading);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StatusTab>('pending');
  const [search, setSearch] = useState('');

  async function refresh() {
    try {
      const res = await fetch('/api/submissions');
      if (!res.ok) return setMessage(s.loadError(res.status));
      const data = await res.json();
      setAllRows(data);
      setMessage('');
    } catch {
      setMessage(s.networkError);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function act(id: string, action: 'approve' | 'reject') {
    setBusy(id + action);
    const note = notes[id]?.trim();
    try {
      const res = await fetch(`/api/submissions/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note ? { note } : {}),
      });
      if (!res.ok) return setMessage(s.actionError(action, id, res.status));
      const label = action === 'approve' ? s.approved : s.rejected;
      const sub = allRows.find((r) => r.id === id);
      setMessage(label(sub?.payload.nameFr ?? sub?.payload.nom ?? id));
      refresh();
      onPendingChange?.();
    } finally {
      setBusy(null);
    }
  }

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const r of allRows) c[r.status]++;
    return c;
  }, [allRows]);

  const filteredRows = useMemo(() => {
    let rows = allRows.filter((r) => r.status === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) =>
        r.id.toLowerCase().includes(q) ||
        r.submittedBy.toLowerCase().includes(q) ||
        r.payload.nameFr?.toLowerCase().includes(q) ||
        r.payload.nameEn?.toLowerCase().includes(q) ||
        r.payload.nom?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allRows, activeTab, search]);

  const dateLocale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  if (allRows.length === 0 && !message) {
    return (
      <div>
        <div className="card-dark texture-noise flex items-center justify-between gap-2 rounded-lg border border-gold/15 px-4 py-2.5">
          <p className="text-sm text-parchment-dim" role="status">
            {s.allClear}
          </p>
        </div>
        <CatalogReports lang={lang} />
      </div>
    );
  }

  return (
    <div>
      {/* Status filter tabs (local to catalogue admin) */}
      <nav aria-label={lang === 'fr' ? 'Filtres de statut' : 'Status filters'} className="flex gap-1">
        {STATUS_TABS.map((tab) => {
          const count = counts[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setActiveTab(tab.value); setSearch(''); }}
              className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.12em] transition-colors ${
                activeTab === tab.value
                  ? 'bg-gold/[0.08] text-gold'
                  : 'text-parchment-dim hover:bg-gold/[0.03] hover:text-parchment'
              }`}
            >
              {(s as unknown as Record<string, string>)[tab.labelKey]}
              {count > 0 && (
                <span className={`h-4 min-w-4 flex items-center justify-center rounded-full px-1.5 text-[0.5rem] font-bold ${
                  activeTab === tab.value
                    ? 'bg-gold text-ink'
                    : 'bg-gold/15 text-gold'
                }`}>
                {count}
              </span>
            )}
            </button>
          );
        })}
      </nav>

      {/* Search */}
      <div className="mt-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={s.searchPlaceholder}
          className="w-full sm:w-[22rem] rounded border border-gold/25 bg-ink/60 px-3 py-2 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-gold/60 focus:outline-none transition-colors"
          aria-label={s.searchPlaceholder}
        />
      </div>

      {/* Submissions list */}
      {filteredRows.length === 0 ? (
        <div className="card-dark texture-noise mt-3 rounded-lg p-10 text-center">
          <p className="font-display text-xl text-parchment">{activeTab === 'pending' ? s.allClear : s.emptyState}</p>
          <p className="mt-1 text-xs text-parchment-dim">
            {search.trim()
              ? s.noResults
              : activeTab === 'pending'
              ? s.noPending
              : undefined}
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3" role="list" aria-label={s[activeTab === 'pending' ? 'tabPending' : activeTab === 'approved' ? 'tabApproved' : 'tabRejected'] as keyof typeof s}>
          {filteredRows.map((sub) => {
            const statusBadge = sub.status === 'approved'
              ? <span className="h-5 px-2 flex items-center justify-center rounded-full text-[0.5rem] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{lang === 'fr' ? 'Approuvé' : 'Approved'}</span>
              : sub.status === 'rejected'
              ? <span className="h-5 px-2 flex items-center justify-center rounded-full text-[0.5rem] font-bold bg-blood/20 text-blood-light border border-blood/30">{lang === 'fr' ? 'Rejeté' : 'Rejected'}</span>
              : <span className="h-5 px-2 flex items-center justify-center rounded-full text-[0.5rem] font-bold bg-gold/20 text-gold border border-gold/30">{lang === 'fr' ? 'En attente' : 'Pending'}</span>;

            return (
              <li key={sub.id} className="card-dark texture-noise rounded-lg border border-gold/10 p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {statusBadge}
                    <span className="font-display text-base font-semibold text-parchment">
                      {sub.kind === 'create' ? s.kindCreate : s.kindEdit}  -  {sub.payload.nameFr ?? sub.payload.nom ?? sub.targetKey}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[0.6875rem] text-parchment-dim">
                    <span>
                      {s.submittedBy} {sub.submittedBy} · {s.submittedAt} {new Date(sub.submittedAt).toLocaleString(dateLocale)}
                    </span>
                    {sub.status !== 'pending' && sub.decidedBy && (
                      <span className="text-gold-light/80">
                        {s.decidedBy} {sub.decidedBy} · {s.decidedAt} {new Date(sub.decidedAt!).toLocaleString(dateLocale)}
                      </span>
                    )}
                  </div>
                </div>

              {sub.kind === 'edit' && sub.before && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-parchment-dim sm:grid-cols-[auto_1fr_auto_1fr]">
                  <dt className="font-semibold text-parchment">{s.diffLabel}</dt>
                  <dd />
                  {submissionDiff(sub.before, sub.payload).map((d) => (
                    <React.Fragment key={d.key}>
                      <dt className="text-gold-light/90">{d.label}</dt>
                      <dd className="font-mono text-[0.6875rem] tabular-nums">
                        {d.from !== ' - ' ? <span className="text-red-400 line-through pr-2">{d.from}</span> : null}
                        {d.to !== ' - ' ? <span className="text-emerald-400">{d.to}</span> : <span className="text-red-400">(supprimé)</span>}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}

              {sub.kind === 'create' && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-parchment-dim sm:grid-cols-[auto_1fr_auto_1fr]">
                  {SUBMISSION_FIELDS.map(([key, label]) => {
                    const v = fieldValue(sub.payload, key);
                    if (v === ' - ') return null;
                    return (
                      <React.Fragment key={key}>
                        <dt>{label}</dt>
                        <dd className="text-parchment-dim/80">{v}</dd>
                      </React.Fragment>
                    );
                  })}
                </dl>
              )}

              {(sub.payload.sourceUrl || sub.payload.note) && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-parchment-dim">
                  {sub.payload.sourceUrl && (
                    <>
                      <dt>{s.sourceLabel}</dt>
                      <dd className="truncate"><a href={sub.payload.sourceUrl} className="text-gold hover:underline">{sub.payload.sourceUrl}</a></dd>
                    </>
                  )}
                  {sub.payload.note && (
                    <>
                      <dt>{s.noteLabel}</dt><dd className="text-parchment-dim/80">{sub.payload.note}</dd>
                    </>
                  )}
                </dl>
              )}

              {sub.adminNote && (
                <p className="mt-2 text-[0.6875rem] text-parchment-dim/70">
                  <span className="font-semibold text-gold-light">{s.adminNoteLabel}</span> {sub.adminNote}
                </p>
              )}

              {sub.status === 'pending' && (
                <div className="mt-3 flex gap-1.5">
                  <input
                    value={notes[sub.id] ?? ''}
                    onChange={(e) => setNotes({ ...notes, [sub.id]: (e.target as HTMLInputElement).value })}
                    placeholder={s.notePlaceholder}
                    aria-label={s.noteAria}
                    className="field !py-1 !text-xs flex-1"
                  />
                  <button
                    onClick={() => act(sub.id, 'approve')}
                    disabled={busy !== null}
                    className="btn-gold !py-1 !text-xs flex-none disabled:opacity-50"
                  >
                    {busy === sub.id + 'approve' ? '...' : s.approve}
                  </button>
                  <button
                    onClick={() => act(sub.id, 'reject')}
                    disabled={busy !== null}
                    className="btn-ghost !py-1 !text-xs flex-none disabled:opacity-50 border-gold/20 text-parchment-dim hover:bg-gold/5"
                  >
                    {busy === sub.id + 'reject' ? '...' : s.reject}
                  </button>
                </div>
              )}
            </li>
          );
        })}
        </ul>
      )}

      <CatalogReports lang={lang} />
    </div>
  );
}