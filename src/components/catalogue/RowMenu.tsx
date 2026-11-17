import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '../../i18n';

const MENU_WIDTH = 184;

const STR = {
  fr: {
    copyAsset: 'Copier le nom d\'asset',
    copied: 'Copié !',
  },
  en: {
    copyAsset: 'Copy asset name',
    copied: 'Copied!',
  },
};

/**
 * Menu « ⋮ » d'une ligne du catalogue. Rendu dans un portail en position fixe :
 * la carte du tableau est en `overflow-hidden`, un menu absolu y serait coupé.
 */
export default function RowMenu({
  label,
  editDisabled,
  onEdit,
  onReport,
  assetName,
  lang = 'fr',
}: {
  label: string;
  /** Une proposition est déjà en attente sur cet objet. */
  editDisabled: boolean;
  onEdit: () => void;
  onReport: () => void;
  /** Nom d'asset CDN à copier (ex: capeOriental). */
  assetName?: string;
  lang?: Lang;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (open) return setOpen(false);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    first?.focus();

    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[next].focus();
    };
    // Un menu en position fixe se désaligne au moindre défilement : on ferme.
    const close = () => setOpen(false);

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const item =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-parchment-dim transition-colors hover:bg-gold/10 hover:text-parchment disabled:pointer-events-none disabled:opacity-40';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions pour « ${label} »`}
        className="inline-flex h-8 w-8 items-center justify-center border border-transparent text-parchment-dim transition-colors hover:border-gold/30 hover:text-gold-light"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions pour « ${label} »`}
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-50 border border-gold/25 bg-ink-2 py-1 shadow-deep"
          >
            {assetName && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigator.clipboard.writeText(assetName);
                  // Feedback visuel temporaire
                  const btn = document.activeElement as HTMLButtonElement;
                  if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = STR[lang].copied;
                    setTimeout(() => { btn.textContent = originalText; }, 1500);
                  }
                }}
                className={item}
              >
                {STR[lang].copyAsset}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              disabled={editDisabled}
              title={editDisabled ? 'Une proposition est déjà en attente.' : undefined}
              className={item}
            >
              Modifier
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onReport();
              }}
              className={item}
            >
              Signaler
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}