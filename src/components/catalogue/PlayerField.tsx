import { useEffect, useRef, useState } from 'react';
import { FIELD_INPUT } from './fields';
import type { Lang } from '../../i18n';

export const PSEUDO_KEY = 'tdl:pseudo';

type Status = 'idle' | 'checking' | 'ok' | 'missing' | 'unavailable';

const STR = {
  fr: {
    checking: 'Vérification…',
    ok: 'Pseudo trouvé ✓',
    missing: 'Pseudo introuvable dans le jeu',
    unavailable: 'Le jeu est injoignable, réessayez plus tard',
    label: 'Pseudo Renaissance Kingdoms',
    hint: 'Vérifié automatiquement, aucun mot de passe demandé.',
  },
  en: {
    checking: 'Checking…',
    ok: 'Name found ✓',
    missing: 'Name not found in the game',
    unavailable: 'Game unavailable, try again later',
    label: 'Renaissance Kingdoms name',
    hint: 'Checked automatically, no password required.',
  },
};

const NOTE = 'mt-1 block text-[0.6875rem] leading-snug text-parchment-dim/60';

/**
 * Pseudo Renaissance Kingdoms du proposeur. Le serveur revérifie l'existence
 * avant d'enregistrer ; ici on prévient tôt, en interrogeant la fiche publique.
 */
export default function PlayerField({
  id,
  value,
  onChange,
  error,
  describedBy,
  lang = 'fr',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  describedBy?: string;
  lang?: Lang;
}) {
  const s = STR[lang];
  const [status, setStatus] = useState<Status>('idle');
  const [checked, setChecked] = useState('');
  const lastChecked = useRef('');

  // Pseudo mémorisé : le contributeur régulier ne le retape pas.
  useEffect(() => {
    const saved = localStorage.getItem(PSEUDO_KEY);
    if (saved) onChange(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const login = value.trim();
    if (!login || login.length < 3 || login === checked) return;
    const timer = setTimeout(() => {
      lastChecked.current = login;
      setStatus('checking');
      fetch(`/api/garde-robe/fiche?login=${encodeURIComponent(login)}`)
        .then((r) => {
          if (lastChecked.current !== login) return;
          setChecked(login);
          setStatus(r.ok ? 'ok' : r.status === 404 ? 'missing' : 'unavailable');
          if (r.ok) localStorage.setItem(PSEUDO_KEY, login);
        })
        .catch(() => {
          if (lastChecked.current === login) setStatus('unavailable');
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [value, checked]);

  const help =
    status === 'checking'
      ? s.checking
      : status === 'ok'
        ? s.ok
        : status === 'missing'
          ? s.missing
          : status === 'unavailable'
            ? s.unavailable
            : s.hint;

  return (
    <div>
      <label htmlFor={id} className="label-caps">
        {s.label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={lang === 'fr' ? 'ex. Morggane' : 'ex. Morggane'}
        autoComplete="username"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={[`${id}-help`, describedBy].filter(Boolean).join(' ') || `${id}-help`}
        className={`${FIELD_INPUT} mt-1.5`}
      />
      <span
        id={`${id}-help`}
        className={`${NOTE} ${
          status === 'missing' || error ? 'text-blood-light' : status === 'ok' ? 'text-emerald-500' : ''
        }`}
        role="status"
      >
        {help}
        {error && <span className="ml-2 text-blood-light">✗ {error}</span>}
      </span>
    </div>
  );
}