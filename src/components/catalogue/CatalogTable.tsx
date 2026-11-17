import { useCallback, useEffect, useMemo, useState } from 'react';
import { locale, nf, type Lang } from '../../i18n';
import {
  CATEGORIES,
  type Catalog,
  type CatalogItem,
  categoryLabel,
  categoryOf,
  hasCdn,
  hasZIndex,
  itemHaystack,
  itemLabel,
  loadCatalog,
  midasAssetUrls,
  sexeLabel,
} from '../../lib/wardrobe';
import type { PendingList, Sex } from '../../lib/catalog-submit';
import CatalogEditDialog from './CatalogEditDialog';
import ReportDialog from './ReportDialog';
import RowMenu from './RowMenu';
import SelectField from '../ui/Select';
import { slotOptions } from './fields';

const PER_PAGE = 80;

type SexeValue = 'Mixte' | 'M' | 'F';
type SexeFilter = '' | SexeValue;
/** Filtre « Données » : repère les fiches relevées au wiki qu'il reste à compléter. */
type DataFilter = '' | 'incomplete' | 'noCdn' | 'noZIndex';

const DATA_OPTIONS: Record<Lang, { value: DataFilter; label: string }[]> = {
  fr: [
    { value: '', label: 'Toutes' },
    { value: 'incomplete', label: 'À compléter' },
    { value: 'noCdn', label: 'Sans CDN' },
    { value: 'noZIndex', label: 'Sans zIndex' },
  ],
  en: [
    { value: '', label: 'All' },
    { value: 'incomplete', label: 'Incomplete' },
    { value: 'noCdn', label: 'No CDN' },
    { value: 'noZIndex', label: 'No zIndex' },
  ],
};

interface Row {
  id: string;
  name: string;
  category: string;
  sexe: SexeValue;
  /** Objets bruts par sexe, pour la modale de modification (non affichés). */
  items: { M?: CatalogItem; F?: CatalogItem };
  /** Sexes où l'objet existe actuellement. */
  sexes: Sex[];
  /** URL CDN complète du calque, une par sexe qui a un nom d'asset. */
  previews: string[];
  hasCdn: boolean;
  hasZIndex: boolean;
  zIndex: string;
  variants: number;
  haystack: string;
}

const plural = (n: number) => (n > 1 ? 's' : '');

/** Fusionne M et F par id : un objet présent des deux côtés devient « Mixte ». */
function buildRows(catalog: Catalog, lang: Lang): Row[] {
  const byId = new Map<string, { m?: CatalogItem; f?: CatalogItem }>();
  for (const m of catalog.sexes.M) byId.set(m.id, { ...byId.get(m.id), m });
  for (const f of catalog.sexes.F) byId.set(f.id, { ...byId.get(f.id), f });
  const rows: Row[] = [];
  for (const [id, pair] of byId) {
    const item = pair.m ?? pair.f!;
    const previews = ([
      ['M', pair.m],
      ['F', pair.f],
    ] as const)
      .filter(([, it]) => it?.nom)
      .flatMap(([sexe, it]) => midasAssetUrls(it!, sexe));
    rows.push({
      id,
      name: itemLabel(item, lang),
      category: categoryOf(item),
      sexe: pair.m && pair.f ? 'Mixte' : pair.m ? 'M' : 'F',
      items: { M: pair.m, F: pair.f },
      sexes: [pair.m ? 'M' : null, pair.f ? 'F' : null].filter(Boolean) as Sex[],
      previews,
      hasCdn: hasCdn(item),
      hasZIndex: hasZIndex(item),
      zIndex: item.zIndex.join(', '),
      variants: item.declinaisons.length || 1,
      haystack: itemHaystack(item),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, locale(lang)));
  return rows;
}

/** Fiche relevée au wiki à laquelle il manque encore une donnée. */
const isIncompleteRow = (r: Row) => !r.hasCdn || !r.hasZIndex;

/** Données manquantes d'une fiche, en clair, pour le `title` du badge. */
function missingFields(row: Row, lang: Lang): string[] {
  return [
    ...(row.hasCdn ? [] : [lang === 'en' ? 'CDN asset name' : 'nom d’asset CDN']),
    ...(row.hasZIndex ? [] : ['zIndex']),
  ];
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
    </svg>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function CatalogTable({ lang = 'fr' }: { lang?: Lang }) {
  const format = useMemo(() => nf(lang), [lang]);
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale(lang), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [lang],
  );
  const mixte = lang === 'en' ? 'Both' : 'Mixte';

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sexe, setSexe] = useState<SexeFilter>('');
  const [data, setData] = useState<DataFilter>('');
  const [showCdn, setShowCdn] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | null>(null);
  const [reporting, setReporting] = useState<Row | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const refreshPending = useCallback(() => {
    fetch('/api/submissions/pending')
      .then((r) => (r.ok ? (r.json() as Promise<PendingList>) : null))
      .then((data) => {
        if (data) setPendingKeys(new Set(data.pending.map((p) => p.targetKey)));
      })
      .catch(() => {
        /* non connecté ou serveur injoignable : aucune information à afficher */
      });
  }, []);

  useEffect(refreshPending, [refreshPending]);

  const fetchCatalog = useCallback(() => {
    setError(null);
    loadCatalog()
      .then(setCatalog)
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? e.message
            : lang === 'en'
              ? 'The catalogue could not be loaded.'
              : 'Le catalogue n’a pas pu être chargé.',
        );
      });
  }, [lang]);

  useEffect(fetchCatalog, [fetchCatalog]);

  const rows = useMemo(() => (catalog ? buildRows(catalog, lang) : []), [catalog, lang]);

  // Emplacements existants, proposés dans la modale de modification.
  const slots = useMemo(
    () => slotOptions(rows.map((r) => (r.items.M ?? r.items.F)!.slot)),
    [rows],
  );

  // Catégories du jeu présentes dans le catalogue, dans leur ordre d'armoire.
  const categories = useMemo(() => {
    const present = new Set(rows.map((r) => r.category));
    return CATEGORIES.map((c) => c.key).filter((key) => present.has(key));
  }, [rows]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!category || r.category === category) &&
          (!sexe || r.sexe === sexe) &&
          (!data ||
            (data === 'incomplete' && isIncompleteRow(r)) ||
            (data === 'noCdn' && !r.hasCdn) ||
            (data === 'noZIndex' && !r.hasZIndex)) &&
          (!needle || r.haystack.includes(needle)),
      ),
    [rows, category, sexe, data, needle],
  );

  const stats = useMemo(
    () => ({
      items: rows.length,
      categories: categories.length,
      variants: rows.reduce((n, r) => n + r.variants, 0),
      incomplete: rows.filter(isIncompleteRow).length,
    }),
    [rows, categories],
  );

  // Retour à la première page dès qu'un filtre change.
  useEffect(() => {
    setPage(1);
  }, [query, category, sexe, data]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const hasFilter = needle !== '' || category !== '' || sexe !== '' || data !== '';

  const reset = () => {
    setQuery('');
    setCategory('');
    setSexe('');
    setData('');
  };

  if (error) {
    return (
      <div className="card-dark texture-noise px-6 py-16 text-center">
        <p className="font-display text-lg tracking-[0.06em] text-parchment">
          {lang === 'en' ? 'The catalogue could not be loaded' : 'Le catalogue n’a pas pu être chargé'}
        </p>
        <p className="mt-2 text-sm text-parchment-dim">{error}</p>
        <button type="button" onClick={fetchCatalog} className="btn-ghost mt-6">
          {lang === 'en' ? 'Try again' : 'Réessayer'}
        </button>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="card-dark texture-noise p-4 sm:p-6">
        <p className="sr-only" role="status">
          {lang === 'en' ? 'Loading the catalogue…' : 'Chargement du catalogue…'}
        </p>
        <div className="animate-pulse space-y-3" aria-hidden="true">
          <div className="flex gap-3">
            <div className="h-9 flex-1 bg-gold/[0.07]"></div>
            <div className="h-9 w-40 bg-gold/[0.07]"></div>
            <div className="h-9 w-32 bg-gold/[0.07]"></div>
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 flex-1 bg-gold/[0.05]"></div>
              <div className="h-4 w-28 bg-gold/[0.05]"></div>
              <div className="h-4 w-16 bg-gold/[0.05]"></div>
              <div className="h-4 w-20 bg-gold/[0.05]"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Bandeau de chiffres, calculé depuis le catalogue chargé */}
      <div className="mb-8 grid grid-cols-2 gap-px border border-gold/15 bg-gold/15 sm:grid-cols-4">
        {(
          [
            [stats.items, lang === 'en' ? 'Items listed' : 'Objets référencés'],
            [stats.categories, lang === 'en' ? 'Categories' : 'Catégories'],
            [stats.variants, lang === 'en' ? 'Colour variants' : 'Déclinaisons'],
            [stats.incomplete, lang === 'en' ? 'Incomplete' : 'À compléter'],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="bg-ink-2/70 px-3 py-5 text-center sm:px-6">
            <p className="font-display text-xl font-bold tabular-nums text-gold-light sm:text-3xl">
              {format.format(value)}
            </p>
            <p className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-gold sm:text-[0.6875rem]">
              {label}
            </p>
          </div>
        ))}
      </div>
      <p className="mb-6 text-right text-[0.625rem] uppercase tracking-[0.16em] text-parchment-dim/60">
        {lang === 'en' ? 'Captured on' : 'Relevé du'} {dateFormat.format(new Date(catalog.generatedAt))}
      </p>

      {/* Filtres */}
      <div className="card-dark texture-noise p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="min-w-0 flex-1">
            <label htmlFor="catalogue-recherche" className="label-caps">
              {lang === 'en' ? 'Search' : 'Recherche'}
            </label>
            <div className="relative mt-1.5">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/60" />
              <input
                id="catalogue-recherche"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  lang === 'en'
                    ? 'Name, slot, French or English…'
                    : 'Nom, emplacement, français ou anglais…'
                }
                className="w-full border border-gold/25 bg-ink/60 py-2.5 pl-9 pr-3 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-gold/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="sm:w-52">
            <label htmlFor="catalogue-category" className="label-caps">
              {lang === 'en' ? 'Category' : 'Catégorie'}
            </label>
            <SelectField
              inputId="catalogue-category"
              ariaLabel={lang === 'en' ? 'Category' : 'Catégorie'}
              value={category}
              onChange={setCategory}
              options={[
                { value: '', label: lang === 'en' ? 'All' : 'Toutes' },
                ...categories.map((key) => ({ value: key, label: categoryLabel(key, lang) })),
              ]}
              lang={lang}
              className="mt-1.5"
            />
          </div>

          <div className="sm:w-40">
            <label htmlFor="catalogue-sexe" className="label-caps">
              {lang === 'en' ? 'Sex' : 'Sexe'}
            </label>
            <SelectField
              inputId="catalogue-sexe"
              ariaLabel={lang === 'en' ? 'Sex' : 'Sexe'}
              value={sexe}
              onChange={(v) => setSexe(v as SexeFilter)}
              options={[
                { value: '', label: lang === 'en' ? 'All' : 'Tous' },
                { value: 'Mixte', label: mixte },
                { value: 'M', label: sexeLabel('M', lang) },
                { value: 'F', label: sexeLabel('F', lang) },
              ]}
              lang={lang}
              className="mt-1.5"
            />
          </div>

          <div className="sm:w-44">
            <label htmlFor="catalogue-donnees" className="label-caps">
              {lang === 'en' ? 'Data' : 'Données'}
            </label>
            <SelectField
              inputId="catalogue-donnees"
              ariaLabel={lang === 'en' ? 'Data' : 'Données'}
              value={data}
              onChange={(v) => setData(v as DataFilter)}
              options={DATA_OPTIONS[lang]}
              lang={lang}
              className="mt-1.5"
            />
          </div>

          <button
            type="button"
            aria-pressed={showCdn}
            onClick={() => setShowCdn((v) => !v)}
            title={lang === 'en' ? 'Show the CDN URLs of the layers' : 'Afficher les URLs CDN des calques'}
            className={`inline-flex w-full items-center justify-center gap-2 border px-4 py-2.5 text-[0.6875rem] font-bold uppercase leading-5 tracking-[0.16em] transition-colors sm:mb-0.5 sm:w-auto ${
              showCdn
                ? 'border-gold bg-gold text-on-gold'
                : 'border-gold/25 bg-ink/60 text-parchment-dim hover:border-gold/60 hover:text-parchment'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 ${showCdn ? 'bg-on-gold' : 'bg-gold/40'}`}
            />
            {lang === 'en' ? 'CDN URLs' : 'URLs CDN'}
          </button>

          {hasFilter && (
            <button type="button" onClick={reset} className="btn-ghost mt-2 sm:mb-0.5 sm:mt-0">
              {lang === 'en' ? 'Reset' : 'Réinitialiser'}
            </button>
          )}
        </div>
      </div>
      {/* Annonce du nombre de résultats */}
      <p className="mt-4 text-sm text-parchment-dim" role="status">
        {filtered.length === rows.length
          ? lang === 'en'
            ? `${format.format(rows.length)} item${plural(rows.length)} listed`
            : `${format.format(rows.length)} objet${plural(rows.length)} référencé${plural(rows.length)}`
          : lang === 'en'
            ? `${format.format(filtered.length)} of ${format.format(rows.length)} items`
            : `${format.format(filtered.length)} objet${plural(filtered.length)} sur ${format.format(rows.length)}`}
      </p>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-gold/40 bg-gold/[0.08] px-4 py-3"
        >
          <p className="text-sm text-parchment">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-gold-light transition-colors hover:text-parchment"
          >
            {lang === 'en' ? 'Close' : 'Fermer'}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card-dark texture-noise mt-4 px-6 py-14 text-center">
          <SearchIcon className="mx-auto h-8 w-8 text-gold/40" />
          <p className="mt-4 font-display text-lg tracking-[0.06em] text-parchment">
            {lang === 'en'
              ? 'No item matches these filters'
              : 'Aucun objet ne correspond à ces critères'}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-parchment-dim">
            {lang === 'en'
              ? 'Try another keyword  -  the catalogue accepts French and English names  -  or reset the filters.'
              : 'Essayez un autre mot-clé  -  le catalogue accepte les noms français comme anglais  -  ou réinitialisez les filtres.'}
          </p>
          <button type="button" onClick={reset} className="btn-ghost mt-6">
            {lang === 'en' ? 'Reset filters' : 'Réinitialiser les filtres'}
          </button>
        </div>
      ) : (
        <div className="card-dark texture-noise mt-4 overflow-hidden">
          <p className="border-b border-gold/10 bg-ink/40 px-4 py-2 text-[0.6875rem] text-parchment-dim/70 sm:hidden">
            {lang === 'en'
              ? 'Swipe the table sideways to see every column.'
              : 'Faites glisser le tableau pour voir toutes les colonnes.'}
          </p>
          <div className="overflow-x-auto">
            <table
              className={`w-full text-left text-sm ${showCdn ? 'min-w-[58rem]' : 'min-w-[46rem]'}`}
            >
              <caption className="sr-only">
                {lang === 'en'
                  ? 'Catalogue of Renaissance Kingdoms wardrobe items'
                  : 'Catalogue des objets de garde-robe de Renaissance Kingdoms'}
              </caption>
              <thead>
                <tr className="border-b border-gold/20 bg-gold/[0.04]">
                  <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    {lang === 'en' ? 'Name' : 'Nom'}
                  </th>
                  {showCdn && (
                    <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                      {lang === 'en' ? 'CDN URL' : 'URL CDN'}
                    </th>
                  )}
                  <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    {lang === 'en' ? 'Category' : 'Catégorie'}
                  </th>
                  <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    {lang === 'en' ? 'Sex' : 'Sexe'}
                  </th>
                  <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    zIndex
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    {lang === 'en' ? 'Colour variants' : 'Déclinaisons'}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    <span className="sr-only">{lang === 'en' ? 'Actions' : 'Actions'}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const missing = missingFields(r, lang);
                  const pending = pendingKeys.has(r.id);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-gold/10 transition-colors last:border-b-0 hover:bg-gold/[0.04]"
                    >
                      <td className="px-4 py-2.5 font-medium text-parchment">
                        {r.name}
                        {pending && (
                          <span
                            title={
                              lang === 'en'
                                ? 'A proposal for this item is already awaiting review.'
                                : 'Une proposition est déjà en attente de validation sur cet objet.'
                            }
                            className="ml-2 inline-block whitespace-nowrap border border-gold/25 px-1.5 py-px align-[0.15em] text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
                          >
                            {lang === 'en' ? 'pending' : 'en attente'}
                          </span>
                        )}
                        {missing.length > 0 && (
                          <span
                            title={
                              lang === 'en'
                                ? `Incomplete sheet: ${missing.join(' and ')} missing.`
                                : `Fiche à compléter : ${missing.join(' et ')} manquant${plural(missing.length)}.`
                            }
                            className="ml-2 inline-block whitespace-nowrap border border-gold/40 px-1.5 py-px align-[0.15em] text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-gold-light/90"
                          >
                            {lang === 'en' ? 'incomplete' : 'à compléter'}
                          </span>
                        )}
                      </td>
                      {showCdn && (
                        <td className="px-4 py-2.5">
                          {r.previews.length === 0 ? (
                            <span className="text-parchment-dim/40"> - </span>
                          ) : (
                            <ul className="space-y-1">
                              {r.previews.map((url) => (
                                <li key={url}>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block max-w-[17rem] break-all text-[0.625rem] leading-snug tabular-nums text-parchment-dim/70 underline decoration-gold/30 underline-offset-2 transition-colors hover:text-gold-light hover:decoration-gold/60"
                                  >
                                    {url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <span className="inline-block border border-gold/20 px-2 py-0.5 text-[0.6875rem] text-parchment-dim">
                          {categoryLabel(r.category, lang)}
                        </span>
                      </td>
                      <td className={r.sexe === 'Mixte' ? 'px-4 py-2.5 text-gold-light/90' : 'px-4 py-2.5 text-parchment-dim'}>
                        {r.sexe === 'Mixte' ? mixte : sexeLabel(r.sexe, lang)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-parchment-dim/60">{r.zIndex || ' - '}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-parchment-dim">
                        {format.format(r.variants)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <RowMenu
                          label={r.name}
                          lang={lang}
                          editDisabled={pending}
                          onEdit={() => {
                            setNotice(null);
                            setEditing(r);
                          }}
                          onReport={() => {
                            setNotice(null);
                            setReporting(r);
                          }}
                          assetName={r.items.M?.nom ?? r.items.F?.nom ?? undefined}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <nav
          aria-label={lang === 'en' ? 'Catalogue pagination' : 'Pagination du catalogue'}
          className="mt-6 flex items-center justify-center gap-4 sm:gap-6"
        >
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current <= 1}
            className="btn-ghost px-4 py-2.5 disabled:pointer-events-none disabled:opacity-40"
          >
            <Chevron className="h-3.5 w-3.5 rotate-90" />
            {lang === 'en' ? 'Previous' : 'Précédent'}
          </button>
          <p className="text-sm tabular-nums text-parchment-dim">
            {lang === 'en'
              ? `Page ${format.format(current)} of ${format.format(pageCount)}`
              : `Page ${format.format(current)} sur ${format.format(pageCount)}`}
          </p>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount}
            className="btn-ghost px-4 py-2.5 disabled:pointer-events-none disabled:opacity-40"
          >
            {lang === 'en' ? 'Next' : 'Suivant'}
            <Chevron className="h-3.5 w-3.5 -rotate-90" />
          </button>
        </nav>
      )}

      {editing && (
        <CatalogEditDialog
          item={editing.items.M ?? editing.items.F!}
          sexes={editing.sexes}
          slots={slots}
          label={editing.name}
          lang={lang}
          onClose={() => setEditing(null)}
          onSubmitted={(message) => {
            setNotice(message);
            setEditing(null);
            refreshPending();
          }}
        />
      )}

      {reporting && (
        <ReportDialog
          itemId={reporting.id}
          itemLabel={reporting.name}
          onClose={() => setReporting(null)}
          onSubmitted={(message) => {
            setNotice(message);
            setReporting(null);
          }}
        />
      )}
    </div>
  );
}