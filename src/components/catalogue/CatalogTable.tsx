import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type Catalog,
  type CatalogItem,
  SEXE_LABEL,
  itemHaystack,
  itemLabel,
  loadCatalog,
  slotLabel,
} from '../../lib/wardrobe';

const PER_PAGE = 80;

type SexeValue = 'Mixte' | 'M' | 'F';
type SexeFilter = '' | SexeValue;

interface Row {
  id: string;
  name: string;
  slot: string;
  sexe: SexeValue;
  zIndex: string;
  variants: number;
  haystack: string;
}

const nf = new Intl.NumberFormat('fr-FR');
const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const plural = (n: number) => (n > 1 ? 's' : '');

/** Fusionne M et F par id : un objet présent des deux côtés devient « Mixte ». */
function buildRows(catalog: Catalog): Row[] {
  const byId = new Map<string, { m?: CatalogItem; f?: CatalogItem }>();
  for (const m of catalog.sexes.M) byId.set(m.id, { ...byId.get(m.id), m });
  for (const f of catalog.sexes.F) byId.set(f.id, { ...byId.get(f.id), f });
  const rows: Row[] = [];
  for (const [id, pair] of byId) {
    const item = pair.m ?? pair.f!;
    rows.push({
      id,
      name: itemLabel(item),
      slot: item.slot,
      sexe: pair.m && pair.f ? 'Mixte' : pair.m ? 'M' : 'F',
      zIndex: item.zIndex.join(', '),
      variants: item.declinaisons.length || 1,
      haystack: itemHaystack(item),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return rows;
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

export default function CatalogTable() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState('');
  const [sexe, setSexe] = useState<SexeFilter>('');
  const [page, setPage] = useState(1);

  const fetchCatalog = useCallback(() => {
    setError(null);
    loadCatalog()
      .then(setCatalog)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Le catalogue n’a pas pu être chargé.');
      });
  }, []);

  useEffect(fetchCatalog, [fetchCatalog]);

  const rows = useMemo(() => (catalog ? buildRows(catalog) : []), [catalog]);

  const slots = useMemo(
    () =>
      [...new Set(rows.map((r) => r.slot))].sort((a, b) =>
        slotLabel(a).localeCompare(slotLabel(b), 'fr'),
      ),
    [rows],
  );

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!slot || r.slot === slot) &&
          (!sexe || r.sexe === sexe) &&
          (!needle || r.haystack.includes(needle)),
      ),
    [rows, slot, sexe, needle],
  );

  const stats = useMemo(
    () => ({
      items: rows.length,
      slots: slots.length,
      variants: rows.reduce((n, r) => n + r.variants, 0),
    }),
    [rows, slots],
  );

  // Retour à la première page dès qu'un filtre change.
  useEffect(() => {
    setPage(1);
  }, [query, slot, sexe]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const hasFilter = needle !== '' || slot !== '' || sexe !== '';

  const reset = () => {
    setQuery('');
    setSlot('');
    setSexe('');
  };

  if (error) {
    return (
      <div className="card-dark texture-noise px-6 py-16 text-center">
        <p className="font-display text-lg tracking-[0.06em] text-parchment">
          Le catalogue n’a pas pu être chargé
        </p>
        <p className="mt-2 text-sm text-parchment-dim">{error}</p>
        <button type="button" onClick={fetchCatalog} className="btn-ghost mt-6">
          Réessayer
        </button>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="card-dark texture-noise p-4 sm:p-6">
        <p className="sr-only" role="status">
          Chargement du catalogue…
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
      <div className="mb-8 grid grid-cols-3 gap-px border border-gold/15 bg-gold/15">
        {(
          [
            [stats.items, 'Objets référencés'],
            [stats.slots, 'Emplacements'],
            [stats.variants, 'Déclinaisons'],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="bg-ink-2/70 px-3 py-5 text-center sm:px-6">
            <p className="font-display text-xl font-bold tabular-nums text-gold-light sm:text-3xl">
              {nf.format(value)}
            </p>
            <p className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-gold sm:text-[0.6875rem]">
              {label}
            </p>
          </div>
        ))}
      </div>
      <p className="mb-6 text-right text-[0.625rem] uppercase tracking-[0.16em] text-parchment-dim/60">
        Relevé du {dateFormat.format(new Date(catalog.generatedAt))}
      </p>

      {/* Filtres */}
      <div className="card-dark texture-noise p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="min-w-0 flex-1">
            <label htmlFor="catalogue-recherche" className="label-caps">
              Recherche
            </label>
            <div className="relative mt-1.5">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/60" />
              <input
                id="catalogue-recherche"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, emplacement, français ou anglais…"
                className="w-full border border-gold/25 bg-ink/60 py-2.5 pl-9 pr-3 text-sm text-parchment placeholder:text-parchment-dim/50 focus:border-gold/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="sm:w-52">
            <label htmlFor="catalogue-slot" className="label-caps">
              Emplacement
            </label>
            <div className="relative mt-1.5">
              <select
                id="catalogue-slot"
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="w-full appearance-none border border-gold/25 bg-ink/60 py-2.5 pl-3 pr-9 text-sm text-parchment focus:border-gold/60 focus:outline-none [&>option]:bg-ink-2 [&>option]:text-parchment"
              >
                <option value="">Tous</option>
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {slotLabel(s)}
                  </option>
                ))}
              </select>
              <Chevron className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/60" />
            </div>
          </div>

          <div className="sm:w-40">
            <label htmlFor="catalogue-sexe" className="label-caps">
              Sexe
            </label>
            <div className="relative mt-1.5">
              <select
                id="catalogue-sexe"
                value={sexe}
                onChange={(e) => setSexe(e.target.value as SexeFilter)}
                className="w-full appearance-none border border-gold/25 bg-ink/60 py-2.5 pl-3 pr-9 text-sm text-parchment focus:border-gold/60 focus:outline-none [&>option]:bg-ink-2 [&>option]:text-parchment"
              >
                <option value="">Tous</option>
                <option value="Mixte">Mixte</option>
                <option value="M">Homme</option>
                <option value="F">Femme</option>
              </select>
              <Chevron className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gold/60" />
            </div>
          </div>

          {hasFilter && (
            <button type="button" onClick={reset} className="btn-ghost mt-2 sm:mb-0.5 sm:mt-0">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Annonce du nombre de résultats */}
      <p className="mt-4 text-sm text-parchment-dim" role="status">
        {filtered.length === rows.length
          ? `${nf.format(rows.length)} objet${plural(rows.length)} référencé${plural(rows.length)}`
          : `${nf.format(filtered.length)} objet${plural(filtered.length)} sur ${nf.format(rows.length)}`}
      </p>

      {filtered.length === 0 ? (
        <div className="card-dark texture-noise mt-4 px-6 py-14 text-center">
          <SearchIcon className="mx-auto h-8 w-8 text-gold/40" />
          <p className="mt-4 font-display text-lg tracking-[0.06em] text-parchment">
            Aucun objet ne correspond à ces critères
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-parchment-dim">
            Essayez un autre mot-clé — le catalogue accepte les noms français comme anglais — ou
            réinitialisez les filtres.
          </p>
          <button type="button" onClick={reset} className="btn-ghost mt-6">
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="card-dark texture-noise mt-4 overflow-hidden">
          <p className="border-b border-gold/10 bg-ink/40 px-4 py-2 text-[0.6875rem] text-parchment-dim/70 sm:hidden">
            Faites glisser le tableau pour voir toutes les colonnes.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <caption className="sr-only">
                Catalogue des objets de garde-robe de Renaissance Kingdoms
              </caption>
              <thead>
                <tr className="border-b border-gold/20 bg-gold/[0.04]">
                  <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    Nom
                  </th>
                  <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    Emplacement
                  </th>
                  <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    Sexe
                  </th>
                  <th scope="col" className="px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    zIndex
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-gold">
                    Déclinaisons
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gold/10 transition-colors last:border-b-0 hover:bg-gold/[0.04]"
                  >
                    <td className="px-4 py-2.5 font-medium text-parchment">{r.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block border border-gold/20 px-2 py-0.5 text-[0.6875rem] text-parchment-dim">
                        {slotLabel(r.slot)}
                      </span>
                    </td>
                    <td className={r.sexe === 'Mixte' ? 'px-4 py-2.5 text-gold-light/90' : 'px-4 py-2.5 text-parchment-dim'}>
                      {r.sexe === 'Mixte' ? 'Mixte' : SEXE_LABEL[r.sexe]}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-parchment-dim/60">{r.zIndex}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-parchment-dim">
                      {nf.format(r.variants)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <nav aria-label="Pagination du catalogue" className="mt-6 flex items-center justify-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current <= 1}
            className="btn-ghost px-4 py-2.5 disabled:pointer-events-none disabled:opacity-40"
          >
            <Chevron className="h-3.5 w-3.5 rotate-90" />
            Précédent
          </button>
          <p className="text-sm tabular-nums text-parchment-dim">
            Page {nf.format(current)} sur {nf.format(pageCount)}
          </p>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount}
            className="btn-ghost px-4 py-2.5 disabled:pointer-events-none disabled:opacity-40"
          >
            Suivant
            <Chevron className="h-3.5 w-3.5 -rotate-90" />
          </button>
        </nav>
      )}
    </div>
  );
}
