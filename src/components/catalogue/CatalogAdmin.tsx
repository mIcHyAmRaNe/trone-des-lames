import { useEffect, useState } from 'react';

interface Submission {
  id: string;
  submittedBy: string;
  submittedAt: string;
  item: {
    nom: string;
    nameFr?: string;
    slot: string;
    sexes: string[];
    zIndex: number[];
    sourceUrl?: string;
    note?: string;
  };
  note?: string;
}

export default function CatalogAdmin() {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [message, setMessage] = useState('Chargement…');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch('/api/submissions?status=pending');
      if (!res.ok) return setMessage(`Impossible de charger (erreur ${res.status}).`);
      setRows(await res.json());
      setMessage('');
    } catch {
      setMessage('Serveur injoignable. Vérifiez votre connexion.');
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
      if (!res.ok) return setMessage(`Échec (${action} ${id} : erreur ${res.status}).`);
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
          {message || <><b className="text-parchment">{rows.length}</b> en attente</>}
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="card-dark texture-noise mt-3 rounded-lg p-10 text-center">
          <p className="font-display text-xl text-parchment">Tout est à jour.</p>
          <p className="mt-1 text-xs text-parchment-dim">Aucune soumission en attente.</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((s) => (
            <li key={s.id} className="card-dark texture-noise rounded-lg border border-gold/10 p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-base font-semibold text-parchment">
                  {s.item.nameFr ?? s.item.nom}
                </span>
                <span className="text-[0.6875rem] text-parchment-dim">{s.submittedBy} · {new Date(s.submittedAt).toLocaleString('fr-FR')}</span>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-parchment-dim sm:grid-cols-[auto_1fr_auto_1fr]">
                <dt>nom</dt><dd className="text-parchment-dim/80">{s.item.nom}</dd>
                <dt>slot</dt><dd><span className="inline-block rounded border border-gold/20 px-1.5 py-0.5 text-[0.6875rem] text-parchment-dim">{s.item.slot}</span></dd>
                <dt>sexes</dt><dd className="text-parchment-dim/80">{s.item.sexes.join(', ')}</dd>
                <dt>zIndex</dt><dd className="tabular-nums text-parchment-dim/60">{s.item.zIndex.join(', ')}</dd>
                {s.item.sourceUrl && (
                  <>
                    <dt>source</dt>
                    <dd className="truncate"><a href={s.item.sourceUrl} className="text-gold hover:underline">{s.item.sourceUrl}</a></dd>
                  </>
                )}
                {(s.item.note || s.note) && (
                  <>
                    <dt>note</dt><dd className="text-parchment-dim/80">{s.item.note ?? s.note}</dd>
                  </>
                )}
              </dl>
              <div className="mt-3 flex gap-1.5">
                <input
                  value={notes[s.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [s.id]: (e.target as HTMLInputElement).value })}
                  placeholder="Note optionnelle"
                  aria-label="Note de modération"
                  className="field !py-1 !text-xs flex-1"
                />
                <button
                  onClick={() => act(s.id, 'approve')}
                  disabled={busy !== null}
                  className="btn-gold !py-1 !text-xs flex-none disabled:opacity-50"
                >
                  {busy === s.id + 'approve' ? '...' : 'Approuver'}
                </button>
                <button
                  onClick={() => act(s.id, 'reject')}
                  disabled={busy !== null}
                  className="btn-ghost !py-1 !text-xs flex-none disabled:opacity-50 border-gold/20 text-parchment-dim hover:bg-gold/5"
                >
                  {busy === s.id + 'reject' ? '...' : 'Rejeter'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
