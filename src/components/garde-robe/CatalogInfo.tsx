import { useState } from "react";
import { type Catalog, orphanSlots } from "../../lib/wardrobe";

function when(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Bulle d'information au survol / focus : sur quoi travaille exactement la
 * garde-robe. Les compteurs et la fraîcheur viennent du fichier catalogue
 * lui-même : ils ne peuvent pas mentir.
 */
export default function CatalogInfo({ catalog }: { catalog: Catalog | null }) {
  const [open, setOpen] = useState(false);

  const all = catalog ? [...catalog.sexes.M, ...catalog.sexes.F] : [];
  // Mêmes règles que la table du catalogue : un objet porté par les deux sexes
  // ne compte qu'une fois, sinon les deux pages affichent des totaux différents.
  const merged = new Map(all.map((i) => [i.id, i]));
  const male = catalog?.sexes.M.length ?? 0;
  const female = catalog?.sexes.F.length ?? 0;
  const total = merged.size;
  const slots = new Set(all.map((i) => i.slot)).size;
  const orphans = catalog ? orphanSlots(all.map((i) => i.slot)) : [];
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
        aria-label="Informations sur le catalogue"
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
            Le catalogue
          </span>
          <span className="block space-y-1">
            <span className="flex justify-between">
              <span>Objets référencés</span>
              <b className="font-semibold tabular-nums text-parchment">{total.toLocaleString("fr-FR")}</b>
            </span>
            <span className="flex justify-between">
              <span>Hommes / Femmes</span>
              <b className="font-semibold tabular-nums text-parchment">
                {male} / {female}
              </b>
            </span>
            <span className="flex justify-between">
              <span>Emplacements</span>
              <b className="font-semibold tabular-nums text-parchment">{slots}</b>
            </span>
            <span className="flex justify-between">
              <span>Déclinaisons</span>
              <b className="font-semibold tabular-nums text-parchment">{variants.toLocaleString("fr-FR")}</b>
            </span>
            <span className="mt-2 flex justify-between border-t border-gold/15 pt-1.5">
              <span>Instantané</span>
              <b className="text-parchment">{when(catalog?.generatedAt)}</b>
            </span>
            <span className="flex justify-between">
              <span>Dernière mise à jour</span>
              <b className="text-parchment">{when(catalog?.refreshedAt)}</b>
            </span>
          </span>
          <span className="mt-2 block border-t border-gold/15 pt-2">
            Instantané du jeu, régénéré régulièrement : un objet absent du
            catalogue ne peut pas être essayé.
          </span>
          {orphans.length > 0 && (
            <span className="mt-1.5 block text-gold-light/80">
              Emplacements hors sections : {orphans.join(", ")}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
