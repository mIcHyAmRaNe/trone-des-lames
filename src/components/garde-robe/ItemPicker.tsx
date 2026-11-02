import { useMemo, useState } from "react";
import Select, { components, type GroupBase } from "react-select";
import { type CatalogItem, itemHaystack, itemLabel, shadeColor, slotLabel } from "../../lib/wardrobe";
import { menuPortalStyle, selectClassNames } from "./selectTheme";

// Sélecteur à recherche sur react-select : options groupées par emplacement,
// aperçu au survol sans engagement, pastilles de teinte cliquables en ligne,
// mode multi à puces retirables pour les slots cumulables.
//
// Le menu est rendu dans document.body (menuPortalTarget, z-index 70) : il
// échappe aux débordements des cartes et flotte au-dessus de l'en-tête collant.
//
// Les composants personnalisés vivent au niveau du module, à dessein : définis
// dans le composant, ils changeraient d'identité à chaque rendu et react-select
// remonterait le menu en haut de la liste à chaque survol (aperçu). Des
// identités stables + des données dynamiques passées par selectProps.meta
// conservent la position de défilement pendant l'exploration.

interface Opt {
  value: string;
  label: string;
  item: CatalogItem;
}

interface Props {
  items: CatalogItem[];
  /** Mode simple : idItem porté, ou "". Mode multi : idItems portés. */
  value: string | string[];
  /** Les slots cumulables reçoivent isMulti avec puces retirables. */
  multi?: boolean;
  /** Choix simple, choix de teinte, ou retrait (null). */
  onChange: (id: string | null, declinaison?: number) => void;
  /** Ajout / retrait / vidage en mode multi. */
  onMultiChange?: (ids: string[]) => void;
  /** Survol seul. `null` quand le pointeur repart ; n'engage jamais. */
  onPreview?: (id: string | null) => void;
  /** Survol seul, avec la teinte survolée. */
  onPreviewColour?: (id: string, declinaison: number) => void;
  showSlot?: boolean;
  placeholder?: string;
  id?: string;
}

interface Meta {
  showSlot?: boolean;
  shown: number;
  capped: boolean;
  selected: number;
  onPreview?: (id: string | null) => void;
  onPreviewColour?: (id: string, declinaison: number) => void;
  onPickShade: (id: string, declinaison: number) => void;
  onResetInput: () => void;
}

function WikiOption(props: any) {
  const o = props.data as Opt;
  const it = o.item;
  const meta = props.selectProps.meta as Meta;
  const shades = it.declinaisons.length > 1 ? it.declinaisons : [];
  return (
    <components.Option {...props}>
      <div
        className="flex items-center gap-2"
        // L'aperçu part toujours de l'objet SURVOLÉ et de sa première teinte —
        // jamais de l'objet actuellement porté.
        onMouseEnter={() => meta.onPreviewColour?.(it.id, it.declinaisons[0] ?? 0)}
      >
        <span className="min-w-0 flex-1 truncate">{o.label}</span>
        {meta.showSlot && (
          <span className="flex-none text-[0.6875rem] text-parchment-dim/70">
            {slotLabel(it.slot)}
          </span>
        )}
        {shades.length > 0 && (
          <span className="flex flex-none gap-1" onMouseDown={(e) => e.stopPropagation()}>
            {shades.map((d) => (
              <button
                key={d}
                type="button"
                onMouseEnter={() => meta.onPreviewColour?.(it.id, d)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  meta.onPickShade(it.id, d);
                }}
                title={`Teinte ${d} — ${o.label}`}
                className="flex cursor-pointer items-center gap-1 border border-gold/25 bg-ink/60 px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-parchment transition-colors hover:bg-gold hover:text-ink"
              >
                <span aria-hidden="true" className="h-2 w-2" style={{ backgroundColor: shadeColor(d) }} />
                {d}
              </button>
            ))}
          </span>
        )}
      </div>
    </components.Option>
  );
}

function CountMenuList(props: any) {
  const meta = props.selectProps.meta as Meta;
  return (
    <components.MenuList {...props}>
      <div onMouseLeave={() => meta.onPreview?.(null)}>{props.children}</div>
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-gold/15 bg-ink-2 px-2.5 py-1.5 text-[0.6875rem] text-parchment-dim">
        <span>
          {meta.shown} objet{meta.shown > 1 ? "s" : ""} affiché{meta.shown > 1 ? "s" : ""}
          {meta.capped ? " · 200 premiers" : ""}
        </span>
        {meta.selected > 0 && (
          <span className="flex-none">
            {meta.selected} sélectionné{meta.selected > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </components.MenuList>
  );
}

function NoMatch(props: any) {
  const meta = props.selectProps.meta as Meta;
  return (
    <components.NoOptionsMessage {...props}>
      <p>Aucun objet ne correspond.</p>
      <button
        type="button"
        onClick={meta.onResetInput}
        className="mt-2 cursor-pointer border border-gold/40 px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gold-light transition-colors hover:border-gold hover:bg-gold/10"
      >
        Effacer la recherche
      </button>
    </components.NoOptionsMessage>
  );
}

// Références stables : mêmes objets à chaque rendu, donc `components` ne
// change jamais d'identité.
const pickerComponents = {
  Option: WikiOption,
  MenuList: CountMenuList,
  NoOptionsMessage: NoMatch,
};

export default function ItemPicker({
  items,
  value,
  multi,
  onChange,
  onMultiChange,
  onPreview,
  onPreviewColour,
  showSlot,
  placeholder,
  id,
}: Props) {
  const [input, setInput] = useState("");
  const searchPh = placeholder ?? "Rechercher un objet…";

  const allOpts = useMemo<Opt[]>(
    () => items.map((it) => ({ value: it.id, label: itemLabel(it), item: it })),
    [items],
  );
  const byId = useMemo(() => new Map(allOpts.map((o) => [o.value, o])), [allOpts]);

  // Requête vide : tout est proposé (200 premiers) — la liste apparaît toujours.
  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    const list = !q ? allOpts : allOpts.filter((o) => itemHaystack(o.item).includes(q));
    return list.slice(0, 200);
  }, [allOpts, input]);

  const grouped = useMemo<GroupBase<Opt>[]>(() => {
    const buckets = new Map<string, Opt[]>();
    for (const o of filtered) {
      const g = slotLabel(o.item.slot);
      const b = buckets.get(g);
      if (b) b.push(o);
      else buckets.set(g, [o]);
    }
    return [...buckets].map(([label, options]) => ({ label, options }));
  }, [filtered]);

  const selectValue = multi
    ? (value as string[]).map((v) => byId.get(v)).filter((o): o is Opt => !!o)
    : (byId.get(value as string) ?? null);

  function handleChange(next: unknown) {
    if (multi) {
      onMultiChange?.(((next as Opt[] | null) ?? []).map((o) => o.value));
    } else {
      const o = next as Opt | null;
      onChange(o ? o.value : null);
    }
  }

  // Valeurs fraîches à chaque rendu, sans importance : seuls les *types* de
  // composants provoquent un remontage, et ils vivent au niveau du module.
  const meta: Meta = {
    showSlot,
    shown: filtered.length,
    capped: items.length > 200,
    selected: multi && Array.isArray(value) ? value.length : 0,
    onPreview,
    onPreviewColour,
    onPickShade: (optId, declinaison) => onChange(optId, declinaison),
    onResetInput: () => setInput(""),
  };

  return (
    <Select<Opt, boolean>
      unstyled
      inputId={id}
      options={grouped}
      value={selectValue as any}
      onChange={handleChange}
      inputValue={input}
      onInputChange={(v, m) => {
        if (m.action === "input-change") setInput(v);
      }}
      onMenuClose={() => {
        setInput("");
        onPreview?.(null);
      }}
      filterOption={() => true}
      isMulti={!!multi}
      isClearable
      isSearchable
      placeholder={searchPh}
      menuPlacement="auto"
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      styles={{ menuPortal: menuPortalStyle }}
      components={pickerComponents}
      {...{ meta }}
      classNames={selectClassNames}
    />
  );
}
