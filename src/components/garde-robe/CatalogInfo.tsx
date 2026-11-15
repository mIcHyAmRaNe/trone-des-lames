import { useState } from "react";
import type { Lang } from "../../i18n";
import { CATEGORIES, type Catalog, categoryOf } from "../../lib/wardrobe";

const STR = {
  fr: {
    aria: "Informations sur le catalogue",
    title: "Le catalogue",
    items: "Objets référencés",
    sexes: "Hommes / Femmes",
    categories: "Catégories",
    variants: "Déclinaisons",
    snapshot: "Instantané",
    updated: "Dernière mise à jour",
    note:
      "Instantané du jeu, régénéré régulièrement : un objet absent du catalogue ne peut pas être essayé.",
    orphans: "Catégories hors garde-robe",
  },
  en: {
    aria: "Catalogue information",
    title: "The catalogue",
    items: "Referenced items",
    sexes: "Men / Women",
    categories: "Categories",
    variants: "Variants",
    snapshot: "Snapshot",
    updated: "Last updated",
    note:
      "A snapshot of the game, refreshed regularly: an item missing from the catalogue cannot be tried.",
    orphans: "Categories outside the wardrobe",
  },
};

function when(iso: string | undefined, lang: Lang): string {
  if (!iso) return " - ";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(lang === "en" ? "en-GB" : "fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

/**
 * Bulle d'information au survol / focus : sur quoi travaille exactement la
 * garde-robe. Les compteurs et la fraîcheur viennent du fichier catalogue
 * lui-même : ils ne peuvent pas mentir.
 */
export default function CatalogInfo({
  catalog,
  lang = "fr",
}: {
  catalog: Catalog | null;
  lang?: Lang;
}) {
  const [open, setOpen] = useState(false);
  const s = STR[lang];
  const locale = lang === "en" ? "en-GB" : "fr-FR";

  const all = catalog ? [...catalog.sexes.M, ...catalog.sexes.F] : [];
  // Mêmes règles que la table du catalogue : un objet porté par les deux sexes
  // ne compte qu'une fois, sinon les deux pages affichent des totaux différents.
  const merged = new Map(all.map((i) => [i.id, i]));
  const male = catalog?.sexes.M.length ?? 0;
  const female = catalog?.sexes.F.length ?? 0;
  const total = merged.size;
  const present = new Set(all.map(categoryOf));
  const categories = CATEGORIES.filter((c) => present.has(c.key)).length;
  const orphans = [...present].filter((k) => !CATEGORIES.some((c) => c.key === k));
  const variants = [...merged.values()].reduce(
    (n, i) => n + Math.max(i.declinaisons.length, 1),
    0,
  );

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label={s.aria}
        aria-expanded={open}
        className="grid h-6 w-6 flex-none cursor-pointer place-items-center border border-gold/25 text-parchment-dim transition-colors hover:border-gold hover:text-gold-light"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5v.5" />
        </svg>
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-2 w-72 border border-gold/25 bg-ink-3 p-3.5 text-xs leading-relaxed text-parchment-dim shadow-deep"
        >
          <span className="mb-2 block font-display text-sm font-semibold tracking-[0.06em] text-parchment">
            {s.title}
          </span>
          <span className="block space-y-1">
            <span className="flex justify-between">
              <span>{s.items}</span>
              <b className="font-semibold tabular-nums text-parchment">{total.toLocaleString(locale)}</b>
            </span>
            <span className="flex justify-between">
              <span>{s.sexes}</span>
              <b className="font-semibold tabular-nums text-parchment">
                {male} / {female}
              </b>
            </span>
            <span className="flex justify-between">
              <span>{s.categories}</span>
              <b className="font-semibold tabular-nums text-parchment">{categories}</b>
            </span>
            <span className="flex justify-between">
              <span>{s.variants}</span>
              <b className="font-semibold tabular-nums text-parchment">{variants.toLocaleString(locale)}</b>
            </span>
            <span className="mt-2 flex justify-between border-t border-gold/15 pt-1.5">
              <span>{s.snapshot}</span>
              <b className="text-parchment">{when(catalog?.generatedAt, lang)}</b>
            </span>
            <span className="flex justify-between">
              <span>{s.updated}</span>
              <b className="text-parchment">{when(catalog?.refreshedAt, lang)}</b>
            </span>
          </span>
          <span className="mt-2 block border-t border-gold/15 pt-2">
            {s.note}
          </span>
          {orphans.length > 0 && (
            <span className="mt-1.5 block text-gold-light/80">
              {s.orphans}: {orphans.join(", ")}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
