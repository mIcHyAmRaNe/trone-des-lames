import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lang } from '../../i18n';
import { sexeLabel, slotLabel, type CatalogItem } from '../../lib/wardrobe';
import {
  payloadFromItem,
  type Sex,
  type SubmissionError,
  type SubmissionPayload,
} from '../../lib/catalog-submit';
import { FIELD_HELP, FIELD_INPUT, parseNumberList, parseTextList, slotOptions } from './fields';
import PlayerField from './PlayerField';
import SelectField from '../ui/Select';

const HELP = 'mt-1 block text-[0.6875rem] leading-snug text-parchment-dim/60';

/** Segments de sexe : Mixte = M + F, un seul choix possible comme dans le jeu. */
export const SEXE_CHOICES: { value: 'Mixte' | Sex; sexes: Sex[] }[] = [
  { value: 'Mixte', sexes: ['M', 'F'] },
  { value: 'F', sexes: ['F'] },
  { value: 'M', sexes: ['M'] },
];

export function sexeChoiceLabel(value: 'Mixte' | Sex, lang: Lang = 'fr'): string {
  if (value === 'Mixte') return lang === 'en' ? 'Both' : 'Mixte';
  return sexeLabel(value, lang);
}

const ERROR = 'mt-1 block text-[0.6875rem] leading-snug text-blood-light';

export interface CatalogEditDialogProps {
  item: CatalogItem;
  /** Sexes où l'objet existe actuellement. */
  sexes: Sex[];
  /** Emplacements connus du catalogue, pour la liste déroulante. */
  slots: string[];
  label: string;
  lang?: Lang;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

const FOCUSABLE =
  'summary, a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CatalogEditDialog({
  item,
  sexes,
  slots,
  label,
  lang = 'fr',
  onClose,
  onSubmitted,
}: CatalogEditDialogProps) {
  const initial = payloadFromItem(item, sexes);
  const help = FIELD_HELP[lang];

  const [login, setLogin] = useState('');
  const [nameFr, setNameFr] = useState(initial.nameFr ?? '');
  const [nameEn, setNameEn] = useState(initial.nameEn ?? '');
  const [nom, setNom] = useState(initial.nom ?? '');
  const [slot, setSlot] = useState(initial.slot);
  const [selectedSexes, setSelectedSexes] = useState<Sex[]>(sexes);
  const [zIndex, setZIndex] = useState(initial.zIndex.join(', '));
  const [declinaisons, setDeclinaisons] = useState(initial.declinaisons.join(' '));
  const [slotsMasques, setSlotsMasques] = useState(initial.slotsMasques.join(', '));
  const [dependCouleurPeau, setDependCouleurPeau] = useState(initial.dependCouleurPeau);
  const [dependPostureMainG, setDependPostureMainG] = useState(initial.dependPostureMainG);
  const [dependPostureMainD, setDependPostureMainD] = useState(initial.dependPostureMainD);
  const [sourceUrl, setSourceUrl] = useState('');
  const [note, setNote] = useState('');
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const uid = useId();
  const titleId = `${uid}-title`;
  const cardRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const closeSuccessRef = useRef<HTMLButtonElement>(null);
  const openedAt = useRef(Date.now());

  // Focus initial, blocage du défilement, restitution du focus au champ d'origine.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (sent) closeSuccessRef.current?.focus();
  }, [sent]);

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
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === cardRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const sexeValue = selectedSexes.length === 2 ? 'Mixte' : selectedSexes[0] ?? '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (selectedSexes.length === 0) {
      setFormError(lang === 'en' ? 'Choose at least one sex.' : 'Indiquez au moins un sexe.');
      return;
    }
    if (!slot.trim()) {
      setFieldErrors({
        slot: lang === 'en' ? 'Choose a slot.' : 'Choisissez un emplacement.',
      });
      return;
    }
    const z = parseNumberList(zIndex);
    if (z === null) {
      setFieldErrors({
        zIndex:
          lang === 'en'
            ? 'Enter numbers separated by commas or spaces.'
            : 'Entrez des nombres séparés par des virgules ou des espaces.',
      });
      return;
    }
    const d = parseNumberList(declinaisons);
    if (d === null) {
      setFieldErrors({
        declinaisons:
          lang === 'en'
            ? 'Enter numbers separated by commas or spaces.'
            : 'Entrez des nombres séparés par des virgules ou des espaces.',
      });
      return;
    }

    const payload: SubmissionPayload = {
      sexes: selectedSexes,
      nom: nom.trim() || null,
      nameFr: nameFr.trim() || null,
      nameEn: nameEn.trim() || null,
      slot: slot.trim(),
      zIndex: z,
      declinaisons: d,
      slotsMasques: parseTextList(slotsMasques),
      dependCouleurPeau,
      dependPostureMainG,
      dependPostureMainD,
      sourceUrl: sourceUrl.trim() || null,
      note: note.trim() || null,
    };

    setBusy(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'edit',
          itemId: item.id,
          item: payload,
          login: login.trim(),
          website: trap,
          elapsedMs: Date.now() - openedAt.current,
        }),
      });

      if (res.status === 429) {
        setFormError(
          lang === 'en'
            ? 'Too many proposals pending  -  wait for review.'
            : 'Trop de propositions en attente  -  attendez la validation.',
        );
        return;
      }

      if (res.ok) {
        setSent(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as SubmissionError | null;
      if (!data || !('error' in data)) {
        setFormError(
          lang === 'en'
            ? `Sending failed (error ${res.status}). Try again.`
            : `L’envoi a échoué (erreur ${res.status}). Réessayez.`,
        );
        return;
      }

      switch (data.error) {
        case 'unchanged':
          setFormError(
            lang === 'en'
              ? 'No change: edit at least one field.'
              : 'Aucun changement : modifiez au moins un champ.',
          );
          return;
        case 'duplicate-pending':
          setFormError(
            lang === 'en'
              ? `A proposal by ${data.submittedBy} is already pending for this item.`
              : `Une proposition de ${data.submittedBy} est déjà en attente pour cet objet.`,
          );
          return;
        case 'already-exists':
          setFormError(
            lang === 'en' ? 'This item is already in the catalogue.' : 'Cet objet est déjà au catalogue.',
          );
          return;
        case 'invalid item':
          setFieldErrors(data.fields ?? {});
          setFormError(
            lang === 'en' ? 'Some fields need correcting.' : 'Certains champs doivent être corrigés.',
          );
          return;
        case 'rate-limited':
          setFormError(
            lang === 'en'
              ? 'Too many proposals pending  -  wait for review.'
              : 'Trop de propositions en attente  -  attendez la validation.',
          );
          return;
        case 'unknown-player':
          setFormError(
            lang === 'en'
              ? `No character “${data.login}” on Renaissance Kingdoms.`
              : `Aucun personnage « ${data.login} » sur Renaissance Kingdoms.`,
          );
          return;
        case 'rk-unavailable':
          setFormError(
            lang === 'en'
              ? 'The game is not responding, so the name cannot be checked. Try again in a moment.'
              : 'Le jeu ne répond pas pour vérifier le pseudo. Réessayez dans un instant.',
          );
          return;
        default:
          setFormError(lang === 'en' ? 'Sending failed. Try again.' : 'L’envoi a échoué. Réessayez.');
          return;
      }
    } catch {
      setFormError(
        lang === 'en'
          ? 'Server unreachable. Check your connection and try again.'
          : 'Serveur injoignable. Vérifiez votre connexion et réessayez.',
      );
    } finally {
      setBusy(false);
    }
  }

  // Appelé après un succès : le parent décide d'afficher le message et de fermer.
  useEffect(() => {
    if (sent)
      onSubmitted(
        lang === 'en' ? 'Edit sent for review.' : 'Modification envoyée pour validation.',
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent]);

  const errorFor = (key: string) =>
    fieldErrors[key] ? (
      <span id={`${uid}-${key}-error`} className={ERROR}>
        {fieldErrors[key]}
      </span>
    ) : null;
  const invalid = (key: string) => (fieldErrors[key] ? true : undefined);
  const describedBy = (key: string, helpId?: string) =>
    [helpId, fieldErrors[key] ? `${uid}-${key}-error` : null].filter(Boolean).join(' ') || undefined;

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm sm:items-center sm:p-6"
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
        className="card-dark texture-noise relative my-auto flex max-h-[85vh] w-full max-w-2xl flex-col border border-gold/20 shadow-deep"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gold/15 px-5 py-4">
          <div className="min-w-0">
            <p className="label-caps">{lang === 'en' ? 'Proposal' : 'Proposition'}</p>
            <h2
              id={titleId}
              className="mt-1 truncate font-display text-lg font-semibold tracking-[0.04em] text-parchment"
            >
              {lang === 'en' ? 'Edit' : 'Modifier'}  -  {label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close the window' : 'Fermer la fenêtre'}
            className="-mr-1 -mt-1 flex h-9 w-9 flex-none items-center justify-center border border-gold/25 text-gold-light transition-colors hover:border-gold/60 hover:bg-gold/10"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {sent ? (
          <div className="px-5 py-12 text-center">
            <p className="font-display text-lg tracking-[0.04em] text-parchment">
              {lang === 'en' ? 'Edit sent for review.' : 'Modification envoyée pour validation.'}
            </p>
            <p className="mt-2 text-sm text-parchment-dim">
              {lang === 'en'
                ? 'It will appear in the catalogue once approved.'
                : 'Elle apparaîtra au catalogue une fois approuvée.'}
            </p>
            <button
              ref={closeSuccessRef}
              type="button"
              onClick={onClose}
              className="btn-ghost mt-6 px-6 py-2.5"
            >
              {lang === 'en' ? 'Close' : 'Fermer'}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <div className="overflow-y-auto px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${uid}-nameFr`} className="label-caps">
                    {lang === 'en' ? 'Name FR' : 'Nom FR'}
                  </label>
                  <input
                    ref={firstFieldRef}
                    id={`${uid}-nameFr`}
                    value={nameFr}
                    onChange={(e) => setNameFr(e.target.value)}
                    aria-invalid={invalid('nameFr')}
                    aria-describedby={describedBy('nameFr')}
                    className={`${FIELD_INPUT} mt-1.5`}
                  />
                  {errorFor('nameFr')}
                </div>

                <div>
                  <label htmlFor={`${uid}-nameEn`} className="label-caps">
                    {lang === 'en' ? 'Name EN' : 'Nom EN'}
                  </label>
                  <input
                    id={`${uid}-nameEn`}
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    aria-invalid={invalid('nameEn')}
                    aria-describedby={describedBy('nameEn')}
                    className={`${FIELD_INPUT} mt-1.5`}
                  />
                  {errorFor('nameEn')}
                </div>

                <div>
                  <label htmlFor={`${uid}-nom`} className="label-caps">
                    {lang === 'en' ? 'CDN asset' : 'Asset CDN'}
                  </label>
                  <input
                    id={`${uid}-nom`}
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder={lang === 'en' ? 'e.g. collierMarchand' : 'ex. collierMarchand'}
                    aria-invalid={invalid('nom')}
                    aria-describedby={describedBy('nom', `${uid}-nom-help`)}
                    className={`${FIELD_INPUT} mt-1.5`}
                  />
                  <span id={`${uid}-nom-help`} className={HELP}>
                    {help.nom}
                  </span>
                  {errorFor('nom')}
                </div>

                <div>
                  <label htmlFor={`${uid}-slot`} className="label-caps">
                    {lang === 'en' ? 'Slot' : 'Emplacement'}
                  </label>
                  <SelectField
                    inputId={`${uid}-slot`}
                    ariaLabel={lang === 'en' ? 'Slot' : 'Emplacement'}
                    value={slot}
                    onChange={setSlot}
                    placeholder={lang === 'en' ? 'Choose…' : 'Choisir…'}
                    options={[
                      { value: '', label: lang === 'en' ? 'Choose…' : 'Choisir…' },
                      ...slotOptions(slots, slot).map((value) => ({
                        value,
                        label: slotLabel(value, lang),
                      })),
                    ]}
                    lang={lang}
                    className="mt-1.5"
                  />
                  {errorFor('slot')}
                </div>

                <fieldset
                  className="sm:col-span-2"
                  aria-invalid={invalid('sexes')}
                  aria-describedby={describedBy('sexes')}
                >
                  <legend className="label-caps">{lang === 'en' ? 'Sexes' : 'Sexes'}</legend>
                  <div className="mt-2 inline-flex gap-px border border-gold/25 bg-gold/25">
                    {SEXE_CHOICES.map((choice) => (
                      <label
                        key={choice.value}
                        className={`cursor-pointer px-4 py-1.5 text-sm transition-colors ${
                          sexeValue === choice.value
                            ? 'bg-gold text-on-gold'
                            : 'bg-ink/60 text-parchment-dim hover:text-parchment'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${uid}-sexes`}
                          value={choice.value}
                          checked={sexeValue === choice.value}
                          onChange={() => setSelectedSexes(choice.sexes)}
                          className="sr-only"
                        />
                        {sexeChoiceLabel(choice.value, lang)}
                      </label>
                    ))}
                  </div>
                  {errorFor('sexes')}
                </fieldset>

                <div>
                  <label htmlFor={`${uid}-zIndex`} className="label-caps">
                    zIndex
                  </label>
                  <input
                    id={`${uid}-zIndex`}
                    value={zIndex}
                    onChange={(e) => setZIndex(e.target.value)}
                    placeholder={lang === 'en' ? 'e.g. 42 or 40, 41' : 'ex. 42 ou 40, 41'}
                    inputMode="numeric"
                    aria-invalid={invalid('zIndex')}
                    aria-describedby={describedBy('zIndex', `${uid}-zIndex-help`)}
                    className={`${FIELD_INPUT} mt-1.5`}
                  />
                  <span id={`${uid}-zIndex-help`} className={HELP}>
                    {help.zIndex}
                  </span>
                  {errorFor('zIndex')}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor={`${uid}-note`} className="label-caps">
                    {lang === 'en' ? 'Note for the admin' : 'Note pour l’admin'}
                  </label>
                  <textarea
                    id={`${uid}-note`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder={
                      lang === 'en'
                        ? 'What changes, where the information comes from…'
                        : 'Ce qui change, d’où vient l’information…'
                    }
                    className={`${FIELD_INPUT} mt-1.5`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <PlayerField
                    id={`${uid}-login`}
                    value={login}
                    onChange={setLogin}
                    error={fieldErrors.login}
                    lang={lang}
                  />
                </div>

                {/* Champ piège : hors écran, jamais atteint au clavier. */}
                <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
                  <label htmlFor={`${uid}-website`}>{lang === 'en' ? 'Website' : 'Site web'}</label>
                  <input
                    id={`${uid}-website`}
                    name="website"
                    value={trap}
                    onChange={(e) => setTrap(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
              </div>

              <details className="group mt-4 border border-gold/20 bg-ink/30">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-gold/[0.04] [&::-webkit-details-marker]:hidden">
                  <span className="label-caps flex-none">
                    {lang === 'en' ? 'Technical options' : 'Options techniques'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.6875rem] leading-snug text-parchment-dim/60">
                    {lang === 'en'
                      ? 'Colour variants, masked slots, layers, source link'
                      : 'Déclinaisons, slots masqués, calques, lien source'}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 flex-none text-gold transition-transform duration-200 group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>

                <div className="border-t border-gold/15 px-4 py-4">
                  <p className="text-[0.6875rem] leading-snug text-parchment-dim/70">
                    {lang === 'en'
                      ? 'Filled automatically by our scripts from the wiki when possible. Only fill this in if you know the value.'
                      : 'Rempli automatiquement par nos scripts depuis le wiki quand c’est possible. Ne complétez que si vous connaissez la valeur.'}
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`${uid}-declinaisons`} className="label-caps">
                        {lang === 'en' ? 'Colour variants' : 'Déclinaisons'}
                      </label>
                      <input
                        id={`${uid}-declinaisons`}
                        value={declinaisons}
                        onChange={(e) => setDeclinaisons(e.target.value)}
                        placeholder={lang === 'en' ? 'e.g. 0 1 2' : 'ex. 0 1 2'}
                        inputMode="numeric"
                        aria-invalid={invalid('declinaisons')}
                        aria-describedby={describedBy('declinaisons', `${uid}-declinaisons-help`)}
                        className={`${FIELD_INPUT} mt-1.5`}
                      />
                      <span id={`${uid}-declinaisons-help`} className={HELP}>
                        {help.declinaisons}
                      </span>
                      {errorFor('declinaisons')}
                    </div>

                    <div>
                      <label htmlFor={`${uid}-slotsMasques`} className="label-caps">
                        {lang === 'en' ? 'Masked slots' : 'Slots masqués'}
                      </label>
                      <input
                        id={`${uid}-slotsMasques`}
                        value={slotsMasques}
                        onChange={(e) => setSlotsMasques(e.target.value)}
                        placeholder={lang === 'en' ? 'e.g. Shirt, Cape' : 'ex. Chemise, Cape'}
                        aria-invalid={invalid('slotsMasques')}
                        aria-describedby={describedBy('slotsMasques', `${uid}-slotsMasques-help`)}
                        className={`${FIELD_INPUT} mt-1.5`}
                      />
                      <span id={`${uid}-slotsMasques-help`} className={HELP}>
                        {help.slotsMasques}
                      </span>
                      {errorFor('slotsMasques')}
                    </div>

                    <fieldset className="sm:col-span-2">
                      <legend className="label-caps">
                        {lang === 'en' ? 'Dependent layers' : 'Calques dépendants'}
                      </legend>
                      <div className="mt-2 space-y-2">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-parchment-dim">
                          <input
                            type="checkbox"
                            checked={dependCouleurPeau}
                            onChange={(e) => setDependCouleurPeau(e.target.checked)}
                            className="h-4 w-4 accent-gold"
                          />
                          {lang === 'en'
                            ? 'Layer changes with skin colour'
                            : 'Le calque change selon la couleur de peau'}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-parchment-dim">
                          <input
                            type="checkbox"
                            checked={dependPostureMainG}
                            onChange={(e) => setDependPostureMainG(e.target.checked)}
                            className="h-4 w-4 accent-gold"
                          />
                          {lang === 'en'
                            ? 'Layer cut by left hand posture'
                            : 'Le calque est découpé selon la posture main gauche'}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-parchment-dim">
                          <input
                            type="checkbox"
                            checked={dependPostureMainD}
                            onChange={(e) => setDependPostureMainD(e.target.checked)}
                            className="h-4 w-4 accent-gold"
                          />
                          {lang === 'en'
                            ? 'Layer cut by right hand posture'
                            : 'Le calque est découpé selon la posture main droite'}
                        </label>
                      </div>
                      <span className={HELP}>{help.depends}</span>
                    </fieldset>

                    <div className="sm:col-span-2">
                      <label htmlFor={`${uid}-sourceUrl`} className="label-caps">
                        {lang === 'en' ? 'Wiki source URL' : 'URL source wiki'}
                      </label>
                      <input
                        id={`${uid}-sourceUrl`}
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        inputMode="url"
                        placeholder={lang === 'en' ? 'https://wiki.renaissancekingdoms.com/…' : 'https://wiki.renaissancekingdoms.com/…'}
                        className={`${FIELD_INPUT} mt-1.5`}
                      />
                      <span className={HELP}>
                        {lang === 'en'
                          ? 'Link to the wiki page (FR or EN) describing the item. CDN URLs are filled automatically by our scripts.'
                          : 'Lien vers la page wiki (FR ou EN) qui décrit l\'objet. Les URLs CDN sont remplies automatiquement par nos scripts.'}
                      </span>
                    </div>
                  </div>
                </div>
              </details>

              {formError && (
                <p
                  role="alert"
                  className="mt-4 border border-blood/40 bg-blood/10 px-3 py-2 text-xs leading-relaxed text-blood-light"
                >
                  {formError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gold/15 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost px-5 py-2.5"
                disabled={busy}
              >
                {lang === 'en' ? 'Cancel' : 'Annuler'}
              </button>
              <button type="submit" disabled={busy} className="btn-gold px-5 py-2.5 disabled:opacity-50">
                {busy ? (lang === 'en' ? 'Sending…' : 'Envoi…') : lang === 'en' ? 'Send for review' : 'Envoyer pour validation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(dialog, document.body);
}