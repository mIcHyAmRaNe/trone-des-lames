import { useEffect, useState } from 'react';
import React from 'react';
import { submissionDiff, fieldValue, SUBMISSION_FIELDS } from '../../lib/catalog-submit.js';
import type { Submission } from '../../lib/catalog-submit.js';
import CatalogReports from './CatalogReports';
import type { Lang } from '../../i18n';

const STR = {
  fr: {
    loading: 'Chargement…',
    loadError: (status: number) => `Impossible de charger (erreur ${status}).`,
    networkError: 'Serveur injoignable. Vérifiez votre connexion.',
    pendingCount: (n: number) => `<b className="text-parchment">${n}</b> en attente`,
    allClear: 'Tout est à jour.',
    noPending: 'Aucune soumission en attente.',
    diffLabel: 'Diff',
    sourceLabel: 'source',
    noteLabel: 'note',
    notePlaceholder: 'Note optionnelle',
    noteAria: 'Note de modération',
    approve: 'Approuver',
    reject: 'Rejeter',
    approved: (name: string) => `« ${name} » approuvé.`,
    rejected: (name: string) => `« ${name} » rejeté.`,
    actionError: (action: string, id: string, status: number) => `Échec (${action} ${id} : erreur ${status}).`,
    kindCreate: 'Création',
    kindEdit: 'Modification',
  },
  en: {
    loading: 'Loading…',
    loadError: (status: number) => `Could not load (error ${status}).`,
    networkError: 'Server unreachable. Check your connection.',
    pendingCount: (n: number) => `<b className="text-parchment">${n}</b> pending`,
    allClear: 'All up to date.',
    noPending: 'No pending submissions.',
    diffLabel: 'Diff',
    sourceLabel: 'source',
    noteLabel: 'note',
    notePlaceholder: 'Optional note',
    noteAria: 'Moderation note',
    approve: 'Approve',
    reject: 'Reject',
    approved: (name: string) => `“${name}” approved.`,
    rejected: (name: string) => `“${name}” rejected.`,
    actionError: (action: string, id: string, status: number) => `Failed (${action} ${id}: error ${status}).`,
    kindCreate: 'Creation',
    kindEdit: 'Edit',
  },
};

export default function CatalogAdmin({ lang = 'fr' }: { lang?: Lang }) {
  const s = STR[lang];
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [message, setMessage] = useState(s.loading);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch('/api/submissions?status=pending');
      if (!res.ok) return setMessage(s.loadError(res.status));
      setRows(await res.json());
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
      setMessage(label(rows?.find(r => r.id === id)?.payload.nameFr ?? id));
      refresh();
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) {
    return (
      <div className="card-dark texture-noise rounded-lg p-6" role="status" aria-live="polite">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/3 rounded bg-gold/[0.07]" />
          <div className="h-20 rounded-xl bg-gold/[0.05]" />
          <div className="h-20 rounded-xl bg-gold/[0.05]" />
        </div>
        <p className="mt-3 text-xs text-parchment-dim">{message}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card-dark texture-noise flex items-center justify-between gap-2 rounded-lg border border-gold/15 px-4 py-2.5">
        <p className="text-sm text-parchment-dim" role="status">
          {message || <>{s.pendingCount(rows.length)}</>}
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="card-dark texture-noise mt-3 rounded-lg p-10 text-center">
          <p className="font-display text-xl text-parchment">{s.allClear}</p>
          <p className="mt-1 text-xs text-parchment-dim">{s.noPending}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((sub) => (
            <li key={sub.id} className="card-dark texture-noise rounded-lg border border-gold/10 p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-base font-semibold text-parchment">
                  {sub.kind === 'create' ? s.kindCreate : s.kindEdit}  -  {sub.payload.nameFr ?? sub.payload.nom ?? sub.targetKey}
                </span>
                <span className="text-[0.6875rem] text-parchment-dim">{sub.submittedBy} · {new Date(sub.submittedAt).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</span>
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
            </li>
          ))}
        </ul>
      )}

      <CatalogReports lang={lang} />
    </div>
  );
}