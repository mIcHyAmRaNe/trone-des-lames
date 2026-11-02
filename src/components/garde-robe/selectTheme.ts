import type { StylesConfig } from "react-select";

// Thème partagé de tous les menus react-select de la garde-robe. Chaque Select
// reçoit `unstyled` : les classNames portent la mise en page (Tailwind), les
// styles ne servent qu'aux pseudo-éléments (pastilles de teinte), que les
// classNames ne savent pas exprimer.
export const selectClassNames = {
  container: () => "min-w-0",
  control: () =>
    "flex min-w-0 items-center border border-gold/20 bg-ink/60 px-2.5 py-1 transition-colors hover:border-gold/40 focus-within:border-gold",
  valueContainer: () => "flex min-w-0 flex-wrap items-center gap-1",
  placeholder: () => "truncate text-sm text-parchment-dim/60",
  singleValue: () => "truncate text-sm text-parchment",
  input: () => "text-sm text-parchment",
  menu: () =>
    "mt-1.5 overflow-hidden border border-gold/25 bg-ink-3 shadow-deep",
  menuList: () => "max-h-72 overflow-y-auto py-1",
  groupHeading: () =>
    "px-2.5 pb-1 pt-2 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-gold/80",
  option: (st: any) =>
    `cursor-pointer px-2.5 py-1.5 text-sm transition-colors ${
      st.isFocused ? "bg-gold/15 text-gold-light" : "text-parchment"
    }`,
  multiValue: () => "flex items-center border border-gold/30 bg-gold/10",
  multiValueLabel: () => "px-1.5 py-0.5 text-xs text-gold-light",
  multiValueRemove: () =>
    "cursor-pointer px-1 text-gold/70 transition-colors hover:text-parchment",
  clearIndicator: () =>
    "cursor-pointer px-1.5 text-parchment-dim/60 transition-colors hover:text-parchment",
  dropdownIndicator: () =>
    "cursor-pointer px-1.5 text-parchment-dim/60 transition-colors hover:text-parchment",
  indicatorSeparator: () => "hidden",
  noOptionsMessage: () => "px-2.5 py-4 text-center text-sm text-parchment-dim",
};

// Le menu est rendu dans document.body (menuPortalTarget) pour échapper aux
// débordements des cartes et flotter au-dessus de l'en-tête collant.
export const menuPortalStyle = (base: any) => ({ ...base, zIndex: 70 });

export const dot = (color: string) => ({
  ":before": {
    backgroundColor: color,
    borderRadius: 10,
    content: '" "',
    display: "block",
    height: 10,
    marginRight: 8,
    width: 10,
  },
});

// Pastille de couleur devant l'option et devant la valeur choisie (teintes).
export function dotStyles<T>(getColor: (data: T) => string): StylesConfig<T, false> {
  return {
    menuPortal: menuPortalStyle,
    option: (base, st) => ({
      ...base,
      ...dot(getColor(st.data)),
      display: "flex",
      alignItems: "center",
    }),
    singleValue: (base, st) => ({
      ...base,
      ...dot(getColor(st.data)),
      display: "flex",
      alignItems: "center",
    }),
  };
}
