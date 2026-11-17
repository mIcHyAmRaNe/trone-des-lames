import { useEffect, useState } from 'react';
import Select from 'react-select';
import type { StylesConfig } from 'react-select';
import type { Lang } from '../../i18n';

/**
 * Sélecteur thémé du site. Remplace les `<select>` natifs : react-select
 * apporte la saisie au clavier pour filtrer les options (et un menu stylé,
 * là où `<option>` reste blanc sur certains systèmes).
 *
 * `size="field"` reprend l'aspect de `FIELD_INPUT` (formulaires) ;
 * `size="sm"` celui des petits contrôles (calculateurs).
 */

export type Option = { value: string; label: string };
export type SelectSize = 'field' | 'sm';

export type Palette = {
  gold: string;
  goldLight: string;
  parchment: string;
  dim: string;
  ink: string;
  ink2: string;
  ink3: string;
  blood: string;
  bloodLight: string;
};

// Valeurs sombres alignées sur les tokens : react-select a besoin de vraies
// couleurs au premier rendu, avant lecture des variables CSS.
const FALLBACK: Palette = {
  gold: '#c9a227',
  goldLight: '#e8c96a',
  parchment: '#e8ddc7',
  dim: '#a89d88',
  ink: '#0d0b0a',
  ink2: '#16120f',
  ink3: '#1f1915',
  blood: '#8b1e1e',
  bloodLight: '#d0877e',
};

export const alpha = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`;

function readPalette(): Palette {
  if (typeof document === 'undefined') return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const read = (token: string, fallback: string) =>
    cs.getPropertyValue(`--color-${token}`).trim() || fallback;
  return {
    gold: read('gold', FALLBACK.gold),
    goldLight: read('gold-light', FALLBACK.goldLight),
    parchment: read('parchment', FALLBACK.parchment),
    dim: read('parchment-dim', FALLBACK.dim),
    ink: read('ink', FALLBACK.ink),
    ink2: read('ink-2', FALLBACK.ink2),
    ink3: read('ink-3', FALLBACK.ink3),
    blood: read('blood', FALLBACK.blood),
    bloodLight: read('blood-light', FALLBACK.bloodLight),
  };
}

/** La palette suit l'attribut `data-theme` pour rester dans le thème courant. */
export function usePalette(): Palette {
  const [palette, setPalette] = useState<Palette>(FALLBACK);
  useEffect(() => {
    const sync = () => setPalette(readPalette());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return palette;
}

export const makeTheme = (p: Palette) => (t: any) => ({
  ...t,
  colors: {
    ...t.colors,
    primary: p.gold,
    primary75: alpha(p.gold, 75),
    primary50: alpha(p.gold, 50),
    primary25: alpha(p.gold, 15),
    neutral0: p.ink,
    neutral5: p.ink2,
    neutral10: p.ink3,
    neutral20: alpha(p.gold, 22),
    neutral30: alpha(p.gold, 40),
    neutral40: p.dim,
    neutral50: p.dim,
    neutral60: p.parchment,
    neutral70: p.parchment,
    neutral80: p.parchment,
    neutral90: p.parchment,
    danger: p.blood,
    dangerLight: alpha(p.blood, 30),
  },
});

/** Styles de base : `minHeight`, taille de police et paddings par variante. */
export function selectStyles(
  p: Palette,
  size: SelectSize = 'field',
): StylesConfig<Option, false> {
  const field = size === 'field';
  const height = field ? 40 : 34;
  const pad = field ? '0 12px' : '0 10px';
  const font = field ? 14 : 13;
  return {
    control: (base, state) => ({
      ...base,
      background: alpha(p.ink, 60),
      borderColor: state.isFocused ? alpha(p.gold, 60) : alpha(p.gold, 25),
      borderRadius: 0,
      minHeight: height,
      fontSize: font,
      boxShadow: 'none',
      transition: 'border-color 120ms',
      ':hover': { borderColor: state.isFocused ? alpha(p.gold, 60) : alpha(p.gold, 40) },
    }),
    valueContainer: (base) => ({ ...base, padding: pad }),
    singleValue: (base) => ({ ...base, color: p.parchment, fontSize: font }),
    input: (base) => ({ ...base, color: p.parchment, margin: 0, padding: 0, fontSize: font }),
    placeholder: (base) => ({ ...base, color: alpha(p.dim, 50), fontSize: font }),
    menu: (base) => ({
      ...base,
      background: p.ink3,
      border: `1px solid ${alpha(p.gold, 30)}`,
      borderRadius: 0,
      overflow: 'hidden',
      zIndex: 60,
    }),
    menuList: (base) => ({ ...base, padding: 0, maxHeight: 260 }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? alpha(p.gold, 16) : 'transparent',
      color: state.isSelected ? p.goldLight : p.dim,
      fontSize: font,
      padding: field ? '8px 12px' : '6px 10px',
      cursor: 'pointer',
      ':active': { background: alpha(p.gold, 24) },
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base) => ({
      ...base,
      color: alpha(p.gold, 70),
      padding: 4,
      ':hover': { color: p.gold },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: alpha(p.dim, 60),
      padding: 4,
      ':hover': { color: p.parchment },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };
}

export default function SelectField({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  inputId,
  isClearable = false,
  isDisabled = false,
  size = 'field',
  className,
  styles,
  lang = 'fr',
}: {
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  /** Lie le contrôle à un `<label htmlFor>`. */
  inputId?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
  size?: SelectSize;
  /** Classes du conteneur (largeur, marges). */
  className?: string;
  /** Surcharges ponctuelles (couleur de bordure…). */
  styles?: Partial<StylesConfig<Option, false>>;
  lang?: Lang;
}) {
  const p = usePalette();
  return (
    <div className={className}>
      <Select
        inputId={inputId}
        aria-label={ariaLabel}
        classNamePrefix="tdl"
        isDisabled={isDisabled}
        isClearable={isClearable}
        isSearchable
        openMenuOnFocus
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        menuPosition="fixed"
        theme={makeTheme(p)}
        styles={{ ...selectStyles(p, size), ...styles }}
        placeholder={placeholder}
        options={options}
        value={options.find((o) => o.value === value) ?? null}
        onChange={(opt) => onChange(opt?.value ?? '')}
        noOptionsMessage={() =>
          lang === 'en' ? 'No matching option' : 'Aucune option correspondante'
        }
      />
    </div>
  );
}
