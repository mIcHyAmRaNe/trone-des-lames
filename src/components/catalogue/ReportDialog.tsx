import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { REPORT_REASONS, type ReportReason } from '../../lib/catalog-submit';
import SelectField from '../ui/Select';
import { FIELD_INPUT } from './fields';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Signale un objet du catalogue (doublon, données fausses, à supprimer). */
export default function ReportDialog({
  itemId,
  itemLabel,
  onClose,
  onSubmitted,
}: {
  itemId: string;
  itemLabel: string;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [message, setMessage] = useState('');
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uid = useId();
  const titleId = `${uid}-title`;
  const cardRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes?.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError('Choisissez un motif.');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          reason,
          message: message.trim() || undefined,
          website: trap,
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      if (res.ok) return onSubmitted(`Signalement envoyé pour « ${itemLabel} ». Merci.`);
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (data?.error === 'already-reported') {
        return setError('Un signalement de ce type est déjà ouvert sur cet objet.');
      }
      if (data?.error === 'rate-limited') {
        return setError('Trop de signalements pour le moment. Réessayez plus tard.');
      }
      if (data?.error === 'bot') return setError('Envoi refusé.');
      setError(`L’envoi a échoué (erreur ${res.status}). Réessayez.`);
    } catch {
      setError('Serveur injoignable. Vérifiez votre connexion et réessayez.');
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="card-dark texture-noise my-auto w-full max-w-md border border-gold/20 shadow-deep"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gold/15 px-5 py-4">
          <div className="min-w-0">
            <p className="label-caps">Signalement</p>
            <h2 id={titleId} className="mt-1 truncate font-display text-lg tracking-[0.04em] text-parchment">
              {itemLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="-mr-1 -mt-1 flex h-9 w-9 flex-none items-center justify-center border border-gold/25 text-gold-light transition-colors hover:border-gold/60 hover:bg-gold/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-5 py-5">
          <label htmlFor={`${uid}-reason`} className="label-caps">
            Motif
          </label>
          <SelectField
            inputId={`${uid}-reason`}
            ariaLabel="Motif"
            value={reason}
            onChange={(v) => setReason(v as ReportReason)}
            placeholder="Choisir…"
            options={REPORT_REASONS.map(([value, text]) => ({ value, label: text }))}
            className="mt-1.5"
          />

          <label htmlFor={`${uid}-message`} className="label-caps mt-4 block">
            Détail (optionnel)
          </label>
          <textarea
            id={`${uid}-message`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Le doublon, ce qui est faux, pourquoi supprimer…"
            className={`${FIELD_INPUT} mt-1.5`}
          />

          <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
            <label htmlFor={`${uid}-website`}>Site web</label>
            <input id={`${uid}-website`} value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" />
          </div>

          {error && (
            <p role="alert" className="mt-4 border border-blood/40 bg-blood/10 px-3 py-2 text-xs leading-relaxed text-blood-light">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-ghost px-5 py-2.5" disabled={busy}>
              Annuler
            </button>
            <button type="submit" disabled={busy} className="btn-gold px-5 py-2.5 disabled:opacity-50">
              {busy ? 'Envoi…' : 'Signaler'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(dialog, document.body);
}