import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import { loadCatalog, type Catalog, type CatalogItem } from '../lib/wardrobe';
import type { Sex, SubmissionError } from '../lib/catalog-submit';
import CatalogEditDialog, { SEXE_CHOICES, sexeChoiceLabel } from './catalogue/CatalogEditDialog';
import PlayerField from './catalogue/PlayerField';
import { FIELD_HELP, FIELD_INPUT, parseNumberList, slotOptions } from './catalogue/fields';

/** Nom comparable : sans accents, article initial, ni ponctuation. */
function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^(?:le |la |les |l'|un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');
}

const HELP = 'mt-1 block text-[0.6875rem] leading-snug text-parchment-dim/60';
const LABEL = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-parchment-dim/60';
const SELECT = `${FIELD_INPUT} mt-1.5 [&>option]:bg-ink-2 [&>option]:text-parchment`;

const STR = {
  fr: {
    // General
    catalogLoadError: 'Le catalogue n\'a pas pu être chargé. Réessayez.',
    sending: 'Envoi en cours…',
    zIndexError: 'zIndex : entrez des nombres séparés par des virgules ou des espaces.',
    declinaisonsError: 'Déclinaisons : entrez des nombres séparés par des virgules ou des espaces.',
    nameRequired: 'Renseignez au moins le nom d\'asset ou le nom affiché.',
    alreadyExists: (label: string) => `Déjà au catalogue (${label})  -  utilisez « Proposer une modification » ci-dessus.`,
    duplicatePending: (by: string) => `Déjà proposé par ${by}, en attente de validation.`,
    unchanged: 'Aucun changement par rapport à la fiche existante.',
    unknownPlayer: (login: string) => `Aucun personnage « ${login} » sur Renaissance Kingdoms. Vérifiez votre pseudo.`,
    rkUnavailable: 'Le jeu ne répond pas pour vérifier le pseudo. Réessayez dans un instant.',
    rateLimited: 'Trop de propositions en attente  -  attendez la validation.',
    invalidFields: 'Champs invalides.',
    genericError: (status: number) => `Erreur ${status}. Réessayez.`,
    success: 'Objet soumis ! Un administrateur va l\'examiner.',
    networkError: 'Serveur injoignable. Vérifiez votre connexion et réessayez.',
    // Form
    loginNote: 'Aucun mot de passe n\'est demandé : seule l\'existence du personnage est vérifiée.',
    duplicateFound: 'Cet objet est déjà au catalogue : ',
    proposeEdit: 'Proposer une modification',
    assetName: 'Nom d\'asset CDN',
    assetPlaceholder: 'ex. collierMarchand',
    nameFr: 'Nom affiché FR (optionnel)',
    nameFrPlaceholder: 'ex. Collier du Marchand',
    nameFrHelp: 'Nom visible dans la garde-robe et le catalogue.',
    nameEn: 'Nom affiché EN (optionnel)',
    nameEnPlaceholder: 'ex. Merchant Necklace',
    nameEnHelp: 'Nom anglais du jeu, s\'il existe.',
    slot: 'Emplacement (requis)',
    slotChoose: 'Choisir…',
    sexes: 'Sexes (requis)',
    zIndex: 'zIndex (optionnel*)',
    zIndexPlaceholder: 'ex. 42 ou 40, 41',
    declinaisons: 'Déclinaisons (optionnel)',
    declinaisonsPlaceholder: 'ex. 0 1 2',
    sourceUrl: 'URL CDN (optionnel)',
    sourceUrlPlaceholder: 'https://…',
    note: 'Note (optionnel)',
    notePlaceholder: 'Infos pour l\'admin (ex. source wiki)…',
    submit: 'Envoyer la proposition',
    // Error messages from server
    fieldError: {
      sexes: 'Sélectionnez au moins un sexe (M ou F).',
      nom: 'Nom d\'asset trop long (120 max).',
      nameFr: 'Nom FR trop long (160 max).',
      nameEn: 'Nom EN trop long (160 max).',
      slot: 'Emplacement trop long (40 max).',
      maxValues: (field: string) => `${field} : 64 valeurs max.`,
      numRange: (field: string) => `${field} : nombres entre 0 et 100000.`,
      slotsMasques: 'Slots masqués : 20 max, 40 caractères chacun.',
      nomOrZIndex: 'Un objet doit avoir un nom d\'asset OU au moins un zIndex.',
      itemIdRequired: 'ID objet requis pour une modification.',
      itemNotFound: 'Objet introuvable dans le catalogue.',
    },
  },
  en: {
    // General
    catalogLoadError: 'Could not load catalogue. Please try again.',
    sending: 'Sending…',
    zIndexError: 'zIndex: enter numbers separated by commas or spaces.',
    declinaisonsError: 'Declinaisons: enter numbers separated by commas or spaces.',
    nameRequired: 'Provide at least the asset name or displayed name.',
    alreadyExists: (label: string) => `Already in catalogue (${label})  -  use "Propose edit" above.`,
    duplicatePending: (by: string) => `Already proposed by ${by}, pending review.`,
    unchanged: 'No change compared to existing entry.',
    unknownPlayer: (login: string) => `No character named « ${login} » on Renaissance Kingdoms. Check your name.`,
    rkUnavailable: 'Game not responding to verify name. Try again shortly.',
    rateLimited: 'Too many pending proposals  -  wait for approval.',
    invalidFields: 'Invalid fields.',
    genericError: (status: number) => `Error ${status}. Try again.`,
    success: 'Item submitted! An admin will review it.',
    networkError: 'Server unreachable. Check your connection and try again.',
    // Form
    loginNote: 'No password is asked for: only the character\'s existence is verified.',
    duplicateFound: 'This item is already in the catalogue: ',
    proposeEdit: 'Propose edit',
    assetName: 'CDN asset name',
    assetPlaceholder: 'ex. merchantNecklace',
    nameFr: 'FR display name (optional)',
    nameFrPlaceholder: 'ex. Collier du Marchand',
    nameFrHelp: 'Name shown in wardrobe and catalogue.',
    nameEn: 'EN display name (optional)',
    nameEnPlaceholder: 'ex. Merchant Necklace',
    nameEnHelp: 'English game name, if it exists.',
    slot: 'Slot (required)',
    slotChoose: 'Choose…',
    sexes: 'Sexes (required)',
    zIndex: 'zIndex (optional*)',
    zIndexPlaceholder: 'ex. 42 or 40, 41',
    declinaisons: 'Colour variants (optional)',
    declinaisonsPlaceholder: 'ex. 0 1 2',
    sourceUrl: 'CDN URL (optional)',
    sourceUrlPlaceholder: 'https://…',
    note: 'Note (optional)',
    notePlaceholder: 'Info for admin (e.g. wiki source)…',
    submit: 'Submit proposal',
    // Error messages from server
    fieldError: {
      sexes: 'Select at least one sex (M or F).',
      nom: 'Asset name too long (120 max).',
      nameFr: 'FR name too long (160 max).',
      nameEn: 'EN name too long (160 max).',
      slot: 'Slot too long (40 max).',
      maxValues: (field: string) => `${field}: 64 values max.`,
      numRange: (field: string) => `${field}: numbers between 0 and 100000.`,
      slotsMasques: 'Hidden slots: 20 max, 40 characters each.',
      nomOrZIndex: 'An item needs an asset name OR at least one zIndex.',
      itemIdRequired: 'Item ID required for an edit.',
      itemNotFound: 'Item not found in the catalogue.',
    },
  },
};

export default function SubmitForm({ lang = 'fr' }: { lang?: Lang }) {
  const s = STR[lang];
  const help = FIELD_HELP[lang];
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [login, setLogin] = useState('');
  const [nom, setNom] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [slot, setSlot] = useState('');
  const [sexe, setSexe] = useState<'Mixte' | Sex>('Mixte');
  const [zIndex, setZIndex] = useState('');
  const [declinaisons, setDeclinaisons] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [note, setNote] = useState('');
  const [trap, setTrap] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [editing, setEditing] = useState<{ item: CatalogItem; sexes: Sex[] } | null>(null);

  const openedAt = useRef(Date.now());

  useEffect(() => {
    loadCatalog()
      .then(setCatalog)
      .catch(() => setMessage(s.catalogLoadError));
  }, [s.catalogLoadError]);

  const items = useMemo(
    () => (catalog ? [...catalog.sexes.M, ...catalog.sexes.F] : []),
    [catalog],
  );
  const slots = useMemo(() => slotOptions(items.map((i) => i.slot)), [items]);
  const sexes: Sex[] = sexe === 'Mixte' ? ['M', 'F'] : [sexe];

  // Doublon éventuel avec un objet déjà référencé (même asset ou même nom affiché).
  const duplicate = useMemo(() => {
    const n = nom.trim().toLowerCase();
    const fr = nameFr.trim() ? normalizeName(nameFr) : null;
    const en = nameEn.trim() ? normalizeName(nameEn) : null;
    if (!n && !fr && !en) return null;
    return (
      items.find((it) => {
        if (n && it.nom?.toLowerCase() === n) return true;
        if (fr && it.nameFr && normalizeName(it.nameFr) === fr) return true;
        if (en && it.nameEn && normalizeName(it.nameEn) === en) return true;
        return false;
      }) ?? null
    );
  }, [items, nom, nameFr, nameEn]);

  function openEdit(item: CatalogItem) {
    setMessage('');
    setOk(false);
    setEditing({
      item,
      sexes: [
        ...(catalog?.sexes.M.some((i) => i.id === item.id) ? (['M'] as Sex[]) : []),
        ...(catalog?.sexes.F.some((i) => i.id === item.id) ? (['F'] as Sex[]) : []),
      ],
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOk(false);
    const z = parseNumberList(zIndex);
    if (z === null) return setMessage(s.zIndexError);
    const d = parseNumberList(declinaisons);
    if (d === null) return setMessage(s.declinaisonsError);
    if (!nom.trim() && !nameFr.trim()) {
      return setMessage(s.nameRequired);
    }
    setBusy(true);
    setMessage(s.sending);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'create',
          login: login.trim(),
          item: {
            sexes,
            nom: nom.trim() || null,
            nameEn: nameEn.trim() || null,
            nameFr: nameFr.trim() || null,
            slot: slot.trim(),
            zIndex: z,
            declinaisons: d,
            slotsMasques: [],
            dependCouleurPeau: false,
            dependPostureMainG: false,
            dependPostureMainD: false,
            sourceUrl: sourceUrl.trim() || null,
            note: note.trim() || null,
          },
          website: trap,
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as SubmissionError | null;
        if (data?.error === 'already-exists') {
          return setMessage(s.alreadyExists(data.label));
        }
        if (data?.error === 'duplicate-pending') {
          return setMessage(s.duplicatePending(data.submittedBy));
        }
        if (data?.error === 'unchanged') return setMessage(s.unchanged);
        if (data?.error === 'unknown-player') {
          return setMessage(s.unknownPlayer(data.login));
        }
        if (data?.error === 'rk-unavailable') {
          return setMessage(s.rkUnavailable);
        }
        if (data?.error === 'rate-limited') {
          return setMessage(s.rateLimited);
        }
        if (data?.error === 'invalid item') {
          return setMessage(Object.values(data.fields ?? {}).join(' ') || s.invalidFields);
        }
        return setMessage(s.genericError(res.status));
      }
      setOk(true);
      setMessage(s.success);
      setNom('');
      setNameFr('');
      setNameEn('');
      setSlot('');
      setZIndex('');
      setDeclinaisons('');
      setSourceUrl('');
      setNote('');
    } catch {
      setMessage(s.networkError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="card-dark texture-noise rounded-lg p-6">
        <PlayerField
          id="submit-login"
          value={login}
          onChange={setLogin}
          error={undefined}
          lang={lang}
        />
        <p className="mt-1 text-[0.6875rem] leading-snug text-parchment-dim/60">
          {s.loginNote}
        </p>

        {duplicate && (
          <div className="mt-4 border border-gold/40 bg-gold/[0.08] px-4 py-3">
            <p className="text-sm text-parchment">
              {s.duplicateFound}
              <span className="font-semibold">
                {duplicate.nameFr ?? duplicate.nameEn ?? duplicate.nom ?? duplicate.id}
              </span>{' '}
              <span className="text-parchment-dim">({duplicate.id})</span>
            </p>
            <button
              type="button"
              onClick={() => openEdit(duplicate)}
              className="btn-ghost mt-3 !px-3 !py-1.5 text-[0.625rem] tracking-[0.14em]"
            >
              {s.proposeEdit}
            </button>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-parchment-dim">
            <span className={LABEL}>{s.assetName}</span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={s.assetPlaceholder}
              className={`${FIELD_INPUT} mt-1.5`}
            />
            <span className={HELP}>{help.nom}</span>
          </label>
          <label className="block text-sm text-parchment-dim">
            <span className={LABEL}>{s.nameFr}</span>
            <input
              value={nameFr}
              onChange={(e) => setNameFr(e.target.value)}
              placeholder={s.nameFrPlaceholder}
              className={`${FIELD_INPUT} mt-1.5`}
            />
            <span className={HELP}>{s.nameFrHelp}</span>
          </label>
          <label className="block text-sm text-parchment-dim">
            <span className={LABEL}>{s.nameEn}</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={s.nameEnPlaceholder}
              className={`${FIELD_INPUT} mt-1.5`}
            />
            <span className={HELP}>{s.nameEnHelp}</span>
          </label>
          <label className="block text-sm text-parchment-dim">
            <span className={LABEL}>{s.slot}</span>
            <select
              value={slot}
              required
              onChange={(e) => setSlot(e.target.value)}
              className={SELECT}
            >
              <option value="">{s.slotChoose}</option>
              {slots.map((sl) => (
                <option key={sl} value={sl}>
                  {sl}
                </option>
              ))}
            </select>
            <span className={HELP}>{help.slot}</span>
          </label>
          <fieldset className="sm:col-span-2 text-sm text-parchment-dim">
            <legend className={LABEL}>{s.sexes}</legend>
            <div className="inline-flex gap-px border border-gold/25 bg-gold/25">
              {SEXE_CHOICES.map((choice) => (
                <label
                  key={choice.value}
                  className={`cursor-pointer px-4 py-1.5 text-sm transition-colors ${
                    sexe === choice.value
                      ? 'bg-gold text-on-gold'
                      : 'bg-ink/60 text-parchment-dim hover:text-parchment'
                  }`}
                >
                  <input
                    type="radio"
                    name="sexes"
                    value={choice.value}
                    checked={sexe === choice.value}
                    onChange={() => setSexe(choice.value)}
                    className="sr-only"
                  />
                  {sexeChoiceLabel(choice.value, lang)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm text-parchment-dim">
            <span className={LABEL}>{s.zIndex}</span>
            <input
              value={zIndex}
              onChange={(e) => setZIndex(e.target.value)}
              placeholder={s.zIndexPlaceholder}
              inputMode="numeric"
              className={`${FIELD_INPUT} mt-1.5`}
            />
            <span className={HELP}>{help.zIndex}</span>
          </label>
          <label className="block text-sm text-parchment-dim">
            <span className={LABEL}>{s.declinaisons}</span>
            <input
              value={declinaisons}
              onChange={(e) => setDeclinaisons(e.target.value)}
              placeholder={s.declinaisonsPlaceholder}
              inputMode="numeric"
              className={`${FIELD_INPUT} mt-1.5`}
            />
            <span className={HELP}>{help.declinaisons}</span>
          </label>
          <label className="block text-sm text-parchment-dim">
            <span className={LABEL}>{s.sourceUrl}</span>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              type="url"
              placeholder={s.sourceUrlPlaceholder}
              inputMode="url"
              autocomplete="url"
              className={`${FIELD_INPUT} mt-1.5`}
            />
          </label>
          <label className="block text-sm text-parchment-dim">
            <span className={LABEL}>{s.note}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={s.notePlaceholder}
              rows={2}
              className={`${FIELD_INPUT} mt-1.5 resize-none`}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className="btn-gold flex-none disabled:opacity-50">
            {busy ? s.sending : s.submit}
          </button>
          <p className="text-[0.625rem] uppercase tracking-[0.14em] text-parchment-dim/60">
            <span className="text-gold" aria-hidden="true">*</span> Champs obligatoires
          </p>
        </div>

        {message && (
          <p
            className={`mt-4 text-sm leading-snug ${
              ok ? 'text-emerald-500' : 'text-blood-light'
            }`}
            role="alert"
          >
            {message}
          </p>
        )}
      </form>

      {editing && (
        <CatalogEditDialog
          item={editing.item}
          sexes={editing.sexes}
          slots={slots}
          label={editing.item.nameFr ?? editing.item.nameEn ?? editing.item.nom ?? editing.item.id}
          lang={lang}
          onClose={() => setEditing(null)}
          onSubmitted={(msg) => {
            setEditing(null);
            setMessage(msg);
          }}
        />
      )}
    </>
  );
}