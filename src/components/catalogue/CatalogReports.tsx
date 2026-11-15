import { useEffect, useState } from 'react';
import { REPORT_REASONS, type Report } from '../../lib/catalog-submit';
import type { Lang } from '../../i18n';

const STR = {
  fr: {
    title: 'Signalements',
    empty: 'Aucun signalement ouvert.',
    count: (n: number) => `${n} signalement${n > 1 ? 's' : ''} ouvert${n > 1 ? 's' : ''}.`,
    processed: 'Traité',
    processing: '...',
    dateLocale: 'fr-FR',
  },
  en: {
    title: 'Reports',
    empty: 'No open reports.',
    count: (n: number) => `${n} report${n > 1 ? 's' : ''} open.`,
    processed: 'Processed',
    processing: '...',
    dateLocale: 'en-GB',
  },
};

const reasonLabel = (reason: Report['reason'], lang: Lang) => {
  if (lang === 'en') {
    const enLabels: Record<string, string> = {
      'duplicate': 'Duplicate',
      'wrong-data': 'Wrong data',
      'missing': 'Missing info',
      'other': 'Other',
    };
    return enLabels[reason] ?? reason;
  }
  return REPORT_REASONS.find(([key]) => key === reason)?.[1] ?? reason;
};

export default function CatalogReports({ lang = 'fr' }: { lang?: Lang }) {
  const s = STR[lang];
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    fetch('/api/reports?status=open')
      .then((r) => (r.ok ? (r.json() as Promise<Report[]>) : Promise.reject(r.status)))
      .then(setRows)
      .catch(() => setError(true));
  }

  useEffect(refresh, []);

  async function close(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/reports/${id}/close`, { method: 'POST' });
      setRows((current) => current?.filter((r) => r.id !== id) ?? null);
    } finally {
      setBusy(null);
    }
  }

  if (error) return null;
  if (rows === null) return null;

  return (
    <section className="mt-10" aria-labelledby="reports-title">
      <h2 id="reports-title" className="font-display text-xl tracking-[0.04em] text-parchment">
        {s.title}
      </h2>
      <p className="mt-1 text-xs text-parchment-dim">
        {rows.length === 0 ? s.empty : s.count(rows.length)}
      </p>
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="card-dark texture-noise flex flex-wrap items-start justify-between gap-3 border border-gold/10 p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="text-parchment">
                  <span className="mr-2 inline-block border border-gold/30 px-1.5 py-px text-[0.5625rem] uppercase tracking-[0.14em] text-gold-light">
                    {reasonLabel(r.reason, lang)}
                  </span>
                  {r.itemLabel}
                </p>
                {r.message && <p className="mt-1 text-xs text-parchment-dim">{r.message}</p>}
                <p className="mt-1 text-[0.6875rem] text-parchment-dim/60">
                  {new Date(r.createdAt).toLocaleString(s.dateLocale)} · {r.itemId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => close(r.id)}
                disabled={busy === r.id}
                className="btn-ghost !py-1 !text-xs flex-none border-gold/20 disabled:opacity-50"
              >
                {busy === r.id ? s.processing : s.processed}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}