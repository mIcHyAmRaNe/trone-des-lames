import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Lang } from '../../i18n';
import { buildSheetsXlsx } from '../../lib/xlsx';
import SelectField, { type Option } from '../ui/Select';

type WikiLang = 'fr' | 'en';
type Sexe = 'Mixte' | 'M' | 'F';

type WikiItem = {
  page: string;
  pageUrl: string;
  name: string;
  nameFr: string | null;
  section: string;
  slot: string;
  category: string;
  type: string;
  sexe: Sexe;
  sexes: ('M' | 'F')[];
  group: string | null;
  images: number;
  cdn: string[];
};

type LoadState = { status: 'loading' | 'ok' | 'missing' | 'error'; items: WikiItem[] };

type SexeFilter = 'all' | Sexe;
type CdnFilter = 'all' | 'with' | 'without';

const PER_PAGE = 80;

const STR = {
  fr: {
    loading: 'Chargement du catalogue wiki…',
    missing: (l: WikiLang) => `Le fichier /rk/wiki-${l}.json n’a pas encore été généré.`,
    loadError: 'Le catalogue wiki n’a pas pu être chargé.',
    retry: 'Réessayer',
    subTabsAria: 'Catalogues wiki',
    tabFr: 'Wiki FR',
    tabEn: 'Wiki EN',
    statTotal: 'Objets',
    statWithCdn: 'Avec CDN',
    statWithoutCdn: 'Sans CDN',
    search: 'Recherche',
    searchPlaceholder: 'Nom, page, section, emplacement…',
    section: 'Section',
    allSections: 'Toutes les sections',
    sexe: 'Sexe',
    sexeAll: 'Tous',
    cdn: 'CDN',
    cdnAll: 'Tous',
    cdnWith: 'Avec',
    cdnWithout: 'Sans',
    reset: 'Réinitialiser',
    export: 'Exporter Excel',
    exportTitle: (n: number) => `Exporter les ${n} lignes filtrées`,
    results: (shown: number, total: number) => `${shown} sur ${total} objets`,
    noMatch: 'Aucun objet ne correspond à ces filtres.',
    emptyCatalog: 'Ce catalogue ne contient aucun objet.',
    swipe: 'Faites glisser le tableau pour voir toutes les colonnes.',
    colPage: 'Page',
    colName: 'Nom',
    colNameFr: 'Nom FR',
    colSection: 'Section',
    colSlot: 'Emplacement',
    colSexe: 'Sexe',
    colType: 'Type',
    colImages: 'Images',
    colCdn: 'CDN',
    colCdnUrls: 'URLs CDN',
    copy: 'Copier',
    copied: 'Copié',
    copyAria: (name: string) => `Copier les URLs CDN de ${name}`,
    prev: 'Précédent',
    next: 'Suivant',
    pageOf: (a: number, b: number) => `Page ${a} sur ${b}`,
    paginationAria: 'Pagination du catalogue wiki',
    none: '—',
    badgeNoCdn: 'sans CDN',
    badgeNoCdnTitle: 'Aucune URL CDN trouvée sur cette page wiki.',
    badgeGroupTitle: (g: string) => `Élément de ${g}`,
  },
  en: {
    loading: 'Loading the wiki catalogue…',
    missing: (l: WikiLang) => `The file /rk/wiki-${l}.json has not been generated yet.`,
    loadError: 'The wiki catalogue could not be loaded.',
    retry: 'Try again',
    subTabsAria: 'Wiki catalogues',
    tabFr: 'Wiki FR',
    tabEn: 'Wiki EN',
    statTotal: 'Items',
    statWithCdn: 'With CDN',
    statWithoutCdn: 'Without CDN',
    search: 'Search',
    searchPlaceholder: 'Name, page, section, slot…',
    section: 'Section',
    allSections: 'All sections',
    sexe: 'Sex',
    sexeAll: 'All',
    cdn: 'CDN',
    cdnAll: 'All',
    cdnWith: 'With',
    cdnWithout: 'Without',
    reset: 'Reset',
    export: 'Export Excel',
    exportTitle: (n: number) => `Export the ${n} filtered rows`,
    results: (shown: number, total: number) => `${shown} of ${total} items`,
    noMatch: 'No item matches these filters.',
    emptyCatalog: 'This catalogue contains no items.',
    swipe: 'Swipe the table sideways to see every column.',
    colPage: 'Page',
    colName: 'Name',
    colNameFr: 'French name',
    colSection: 'Section',
    colSlot: 'Slot',
    colSexe: 'Sex',
    colType: 'Type',
    colImages: 'Images',
    colCdn: 'CDN',
    colCdnUrls: 'CDN URLs',
    copy: 'Copy',
    copied: 'Copied',
    copyAria: (name: string) => `Copy the CDN URLs of ${name}`,
    prev: 'Previous',
    next: 'Next',
    pageOf: (a: number, b: number) => `Page ${a} of ${b}`,
    paginationAria: 'Wiki catalogue pagination',
    none: '—',
    badgeNoCdn: 'no CDN',
    badgeNoCdnTitle: 'No CDN URL found on this wiki page.',
    badgeGroupTitle: (g: string) => `Part of ${g}`,
  },
};

const INITIAL: Record<WikiLang, LoadState> = {
  fr: { status: 'loading', items: [] },
  en: { status: 'loading', items: [] },
};

/** Minuscules sans accents, pour que « Épée » réponde à « epee ». */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function columnsFor(rows: WikiItem[]) {
  return [
    { header: 'Page', values: rows.map((r) => r.page) },
    { header: 'Nom', values: rows.map((r) => r.name) },
    { header: 'Nom FR', values: rows.map((r) => r.nameFr ?? '') },
    { header: 'Section', values: rows.map((r) => r.section) },
    { header: 'Emplacement', values: rows.map((r) => r.slot) },
    { header: 'Sexe', values: rows.map((r) => r.sexe) },
    { header: 'Type', values: rows.map((r) => r.type) },
    { header: 'Images', values: rows.map((r) => String(r.images)) },
    { header: 'CDN', values: rows.map((r) => String(r.cdn.length)) },
    { header: 'URLs CDN', values: rows.map((r) => r.cdn.join('\n')) },
    { header: 'URL page', values: rows.map((r) => r.pageUrl) },
  ];
}

export default function WikiCatalogAdmin({ lang = 'fr' }: { lang?: Lang }) {
  const s = STR[lang];
  const [tab, setTab] = useState<WikiLang>('fr');
  const [catalogs, setCatalogs] = useState<Record<WikiLang, LoadState>>(INITIAL);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');
  const [sexe, setSexe] = useState<SexeFilter>('all');
  const [cdn, setCdn] = useState<CdnFilter>('all');
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const nf = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB');

  const load = useCallback(async (l: WikiLang) => {
    setCatalogs((prev) => ({ ...prev, [l]: { status: 'loading', items: [] } }));
    try {
      const res = await fetch(`/rk/wiki-${l}.json`, { cache: 'no-store' });
      if (res.status === 404) {
        setCatalogs((prev) => ({ ...prev, [l]: { status: 'missing', items: [] } }));
        return;
      }
      if (!res.ok) {
        setCatalogs((prev) => ({ ...prev, [l]: { status: 'error', items: [] } }));
        return;
      }
      const data = await res.json();
      const items = Array.isArray(data?.items) ? (data.items as WikiItem[]) : [];
      setCatalogs((prev) => ({ ...prev, [l]: { status: 'ok', items } }));
    } catch {
      setCatalogs((prev) => ({ ...prev, [l]: { status: 'error', items: [] } }));
    }
  }, []);

  useEffect(() => {
    void load('fr');
    void load('en');
  }, [load]);

  // La section et la pagination ne survivent pas au changement de catalogue.
  useEffect(() => {
    setSection('');
    setPage(1);
  }, [tab]);

  useEffect(() => {
    setPage(1);
  }, [query, section, sexe, cdn]);

  const active = catalogs[tab];
  const items = active.items;

  const sections = useMemo(
    () => [...new Set(items.map((r) => r.section).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const sectionOptions = useMemo<Option[]>(
    () => [
      { value: '', label: s.allSections, count: items.length },
      ...sections.map((value) => ({
        value,
        label: value,
        count: items.filter((r) => r.section === value).length,
      })),
    ],
    [items, sections, s.allSections],
  );
  const sexeOptions = useMemo<Option[]>(
    () => [
      { value: 'all', label: s.sexeAll, count: items.length },
      ...(['Mixte', 'M', 'F'] as const).map((value) => ({
        value,
        label: value,
        count: items.filter((r) => r.sexe === value).length,
      })),
    ],
    [items, s.sexeAll],
  );
  const cdnOptions = useMemo<Option[]>(
    () => [
      { value: 'all', label: s.cdnAll, count: items.length },
      { value: 'with', label: s.cdnWith, count: items.filter((r) => r.cdn.length > 0).length },
      { value: 'without', label: s.cdnWithout, count: items.filter((r) => r.cdn.length === 0).length },
    ],
    [items, s.cdnAll, s.cdnWith, s.cdnWithout],
  );

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return items.filter(
      (r) =>
        (!needle ||
          normalize(`${r.name} ${r.page} ${r.section} ${r.slot}`).includes(needle)) &&
        (!section || r.section === section) &&
        (sexe === 'all' || r.sexe === sexe) &&
        (cdn === 'all' || (cdn === 'with' ? r.cdn.length > 0 : r.cdn.length === 0)),
    );
  }, [items, query, section, sexe, cdn]);

  const stats = useMemo(
    () => ({
      total: items.length,
      withCdn: items.filter((r) => r.cdn.length > 0).length,
      withoutCdn: items.filter((r) => r.cdn.length === 0).length,
    }),
    [items],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const hasFilter = query.trim() !== '' || section !== '' || sexe !== 'all' || cdn !== 'all';

  const reset = () => {
    setQuery('');
    setSection('');
    setSexe('all');
    setCdn('all');
  };

  const exportXlsx = () => {
    const withoutCdn = filtered.filter((r) => r.cdn.length === 0);
    const bytes = buildSheetsXlsx([
      { name: 'Catalogue', columns: columnsFor(filtered) },
      { name: 'Sans CDN', columns: columnsFor(withoutCdn) },
    ]);
    const url = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `wiki-${tab}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const copyUrls = (key: string, urls: string[]) => {
    navigator.clipboard
      .writeText(urls.join('\n'))
      .then(() => {
        setCopied(key);
        window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
      })
      .catch(() => {
        // Presse-papiers refusé : le détail reste lisible au survol.
      });
  };

  const inputCls =
    'w-full rounded border border-gold/25 bg-ink px-3 py-2.5 text-sm text-parchment outline-none transition-colors placeholder:text-parchment-dim/50 focus:border-gold';

  return (
    <div>
      {/* Sous-onglets FR / EN */}
      <nav aria-label={s.subTabsAria} className="flex gap-1 border-b border-gold/15">
        {(['fr', 'en'] as const).map((l) => {
          const state = catalogs[l];
          const count = state.status === 'ok' ? nf(state.items.length) : null;
          return (
            <button
              key={l}
              type="button"
              aria-pressed={tab === l}
              onClick={() => setTab(l)}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.14em] transition-colors ${
                tab === l
                  ? 'bg-gold/[0.05] text-gold'
                  : 'text-parchment-dim hover:bg-gold/[0.03] hover:text-parchment'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1 w-1 rotate-45 ${tab === l ? 'bg-gold' : 'bg-gold/30'}`}
              />
              {l === 'fr' ? s.tabFr : s.tabEn}
              <span
                className={`h-5 min-w-5 rounded-full px-1.5 text-[0.5rem] font-bold tabular-nums ${
                  tab === l ? 'bg-gold text-ink' : 'bg-gold/15 text-gold'
                } inline-flex items-center justify-center`}
              >
                {count ?? '—'}
              </span>
              {tab === l && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent"
                />
              )}
            </button>
          );
        })}
      </nav>

      {active.status === 'loading' ? (
        <div className="card-dark texture-noise mt-4 p-6">
          <p className="sr-only" role="status">
            {s.loading}
          </p>
          <div className="animate-pulse space-y-3" aria-hidden="true">
            <div className="h-16 bg-gold/[0.06]" />
            <div className="h-10 bg-gold/[0.05]" />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-4 bg-gold/[0.04]" />
            ))}
          </div>
        </div>
      ) : active.status === 'missing' || active.status === 'error' ? (
        <div className="card-dark texture-noise mt-4 px-6 py-14 text-center">
          <p className="font-display text-lg tracking-[0.06em] text-parchment">
            {active.status === 'missing' ? s.missing(tab) : s.loadError}
          </p>
          <button type="button" onClick={() => void load(tab)} className="btn-ghost mt-6">
            {s.retry}
          </button>
        </div>
      ) : (
        <>
          {/* Bandeau de chiffres */}
          <div className="mt-6 grid grid-cols-3 gap-px border border-gold/15 bg-gold/15">
            {(
              [
                [stats.total, s.statTotal],
                [stats.withCdn, s.statWithCdn],
                [stats.withoutCdn, s.statWithoutCdn],
              ] as const
            ).map(([value, label]) => (
              <div key={label} className="bg-ink-2/70 px-3 py-5 text-center sm:px-6">
                <p className="font-display text-xl font-bold tabular-nums text-gold-light sm:text-3xl">
                  {nf(value)}
                </p>
                <p className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-gold sm:text-[0.6875rem]">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div className="card-dark texture-noise mt-6 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <label htmlFor="wiki-recherche" className="label-caps">
                  {s.search}
                </label>
                <input
                  id="wiki-recherche"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={s.searchPlaceholder}
                  className={`${inputCls} mt-1.5`}
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="wiki-section" className="label-caps">
                  {s.section}
                </label>
                <SelectField
                  inputId="wiki-section"
                  ariaLabel={s.section}
                  lang={lang}
                  size="sm"
                  isClearable
                  options={sectionOptions}
                  value={section}
                  onChange={setSection}
                  placeholder={s.allSections}
                  className="mt-1.5"
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="wiki-sexe" className="label-caps">
                  {s.sexe}
                </label>
                <SelectField
                  inputId="wiki-sexe"
                  ariaLabel={s.sexe}
                  lang={lang}
                  size="sm"
                  options={sexeOptions}
                  value={sexe}
                  onChange={(v) => setSexe(v as SexeFilter)}
                  className="mt-1.5"
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="wiki-cdn" className="label-caps">
                  {s.cdn}
                </label>
                <SelectField
                  inputId="wiki-cdn"
                  ariaLabel={s.cdn}
                  lang={lang}
                  size="sm"
                  options={cdnOptions}
                  value={cdn}
                  onChange={(v) => setCdn(v as CdnFilter)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {hasFilter ? (
                <button type="button" onClick={reset} className="btn-ghost px-4 py-2">
                  {s.reset}
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={exportXlsx}
                disabled={filtered.length === 0}
                title={s.exportTitle(filtered.length)}
                className="btn-gold px-4 py-2 disabled:opacity-40"
              >
                {s.export}
              </button>
            </div>
          </div>

          {/* Annonce du nombre de résultats */}
          <p className="mt-4 text-sm text-parchment-dim" role="status">
            {s.results(filtered.length, items.length)}
          </p>

          {filtered.length === 0 ? (
            <div className="card-dark texture-noise mt-3 px-6 py-12 text-center">
              <p className="font-display text-lg tracking-[0.06em] text-parchment">
                {items.length === 0 ? s.emptyCatalog : s.noMatch}
              </p>
              {items.length > 0 && (
                <button type="button" onClick={reset} className="btn-ghost mt-5">
                  {s.reset}
                </button>
              )}
            </div>
          ) : (
            <div className="card-dark texture-noise mt-3 overflow-hidden">
              <p className="border-b border-gold/10 bg-ink/40 px-4 py-2 text-[0.6875rem] text-parchment-dim/70 sm:hidden">
                {s.swipe}
              </p>
              <div className="max-h-[70vh] overflow-auto">
                <table
                  className={`w-full text-left text-sm ${tab === 'en' ? 'min-w-[72rem]' : 'min-w-[64rem]'}`}
                >
                  <caption className="sr-only">
                    {tab === 'fr' ? 'Extraction brute du wiki francophone' : 'Raw extraction of the English wiki'}
                  </caption>
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-gold/20 bg-ink-3">
                      {[
                        s.colPage,
                        s.colName,
                        ...(tab === 'en' ? [s.colNameFr] : []),
                        s.colSection,
                        s.colSlot,
                        s.colSexe,
                        s.colType,
                        s.colImages,
                        s.colCdn,
                        s.colCdnUrls,
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="whitespace-nowrap px-3 py-3 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-gold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const key = `${tab}-${current}-${i}-${r.pageUrl}`;
                      return (
                        <tr
                          key={key}
                          className="border-b border-gold/10 align-top transition-colors hover:bg-gold/[0.035]"
                        >
                          <td className="px-3 py-2.5">
                            <a
                              href={r.pageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={r.page}
                              className="block max-w-[11rem] truncate text-gold transition-colors hover:text-gold-light hover:underline"
                            >
                              {r.page}
                            </a>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="block max-w-[14rem] truncate font-medium text-parchment" title={r.name}>
                                {r.name}
                              </span>
                              {r.group && (
                                <span
                                  title={s.badgeGroupTitle(r.group)}
                                  className="inline-block whitespace-nowrap border border-gold/20 px-1.5 py-px align-[0.15em] text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-gold/70"
                                >
                                  {r.group}
                                </span>
                              )}
                              {r.cdn.length === 0 && (
                                <span
                                  title={s.badgeNoCdnTitle}
                                  className="inline-block whitespace-nowrap border border-gold/40 px-1.5 py-px align-[0.15em] text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-gold-light/90"
                                >
                                  {s.badgeNoCdn}
                                </span>
                              )}
                            </div>
                          </td>
                          {tab === 'en' && (
                            <td className="px-3 py-2.5">
                              <span className="block max-w-[12rem] truncate text-parchment-dim" title={r.nameFr ?? undefined}>
                                {r.nameFr || s.none}
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-parchment-dim">
                            <span className="block max-w-[10rem] truncate" title={r.section}>
                              {r.section || s.none}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-parchment-dim">
                            <span className="block max-w-[10rem] truncate" title={r.slot}>
                              {r.slot || s.none}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5">
                            <span
                              className={`inline-flex min-w-5 items-center justify-center rounded-sm border px-1.5 py-0.5 text-[0.625rem] font-semibold ${
                                r.sexe === 'Mixte'
                                  ? 'border-gold/25 text-parchment-dim'
                                  : 'border-gold/45 text-gold-light'
                              }`}
                            >
                              {r.sexe}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-parchment-dim">
                            <span className="block max-w-[9rem] truncate" title={r.type}>
                              {r.type || s.none}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-parchment-dim">{r.images}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`tabular-nums font-semibold ${r.cdn.length === 0 ? 'text-blood' : 'text-gold-light'}`}
                              title={r.cdn.length === 0 ? s.cdnWithout : `${r.cdn.length} ${s.colCdnUrls}`}
                            >
                              {r.cdn.length}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {r.cdn.length === 0 ? (
                              <span className="text-parchment-dim/50">{s.none}</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span
                                  className="block max-w-[16rem] truncate font-mono text-[0.6875rem] text-parchment-dim/80"
                                  title={r.cdn.join('\n')}
                                >
                                  {r.cdn[0]}
                                  {r.cdn.length > 1 && (
                                    <span className="text-gold"> · +{r.cdn.length - 1}</span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyUrls(key, r.cdn)}
                                  aria-label={s.copyAria(r.name)}
                                  className="flex-none text-[0.5625rem] font-bold uppercase tracking-[0.12em] text-gold transition-colors hover:text-gold-light"
                                >
                                  {copied === key ? s.copied : s.copy}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pageCount > 1 && (
            <nav
              aria-label={s.paginationAria}
              className="mt-6 flex items-center justify-center gap-4 sm:gap-6"
            >
              <button
                type="button"
                onClick={() => setPage(current - 1)}
                disabled={current <= 1}
                className="btn-ghost px-4 py-2.5 disabled:pointer-events-none disabled:opacity-40"
              >
                {s.prev}
              </button>
              <p className="text-sm tabular-nums text-parchment-dim">
                {s.pageOf(current, pageCount)}
              </p>
              <button
                type="button"
                onClick={() => setPage(current + 1)}
                disabled={current >= pageCount}
                className="btn-ghost px-4 py-2.5 disabled:pointer-events-none disabled:opacity-40"
              >
                {s.next}
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
