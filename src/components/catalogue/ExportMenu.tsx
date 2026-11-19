import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '../../i18n';

const MENU_WIDTH = 240;

/**
 * Menu « ⋮ » compact de la barre de filtres : l'export Excel n'occupe plus
 * qu'une icône. Portail en position fixe, comme RowMenu, car la carte du
 * tableau est en overflow-hidden.
 */
export default function ExportMenu({
  onExport,
  count,
  disabled,
  lang = 'fr',
}: {
  onExport: () => void;
  count: number;
  disabled: boolean;
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
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
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

  const label = lang === 'en' ? 'Export results' : 'Exporter les résultats';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`inline-flex h-8 w-8 items-center justify-center border border-gold/25 bg-ink/60 text-parchment-dim transition-colors hover:border-gold/60 hover:text-parchment sm:mb-0.5 ${
          open ? 'border-gold bg-gold text-on-gold' : ''
        }`}
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
            aria-label={label}
            style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="fixed z-50 border border-gold/25 bg-ink-2 py-1 shadow-deep"
          >
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onExport();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-parchment-dim transition-colors hover:bg-gold/10 hover:text-parchment disabled:pointer-events-none disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" />
              </svg>
              <span className="flex-1">{lang === 'en' ? 'Export to Excel' : 'Exporter en Excel'}</span>
              <span className="text-[0.625rem] tabular-nums text-gold/70">{count}</span>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
