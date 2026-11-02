import { useEffect, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import Select from 'react-select';
import type { StylesConfig } from 'react-select';
import { parsePoints } from '../../lib/format';

type Option = { value: string; label: string };
type FighterOption = { value: number; label: string };

/** Common point totals, offered as shortcuts. Any other value can still be typed. */
const OPTIONS: Option[] = Array.from({ length: 8 }, (_, i) => {
  const v = String(18 + i);
  return { value: v, label: v };
});

type Palette = {
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

// Dark values mirror the tokens: react-select needs real colours at runtime,
// so the first paint stays on-brand until the CSS variables are read.
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

/** Palette follows the `data-theme` attribute so the menus match the page. */
function usePalette(): Palette {
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

const alpha = (color: string, percent: number) =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`;

const makeBaseStyles = (p: Palette): StylesConfig<Option, false> => ({
  control: (base, state) => ({
    ...base,
    background: p.ink,
    borderColor: state.isFocused ? p.gold : alpha(p.gold, 22),
    borderRadius: 4,
    minHeight: 30,
    fontSize: 12,
    boxShadow: 'none',
    transition: 'border-color 120ms',
    ':hover': { borderColor: state.isFocused ? p.gold : alpha(p.gold, 50) },
  }),
  valueContainer: (base) => ({ ...base, padding: '0 6px' }),
  singleValue: (base) => ({
    ...base,
    color: p.parchment,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 12,
  }),
  input: (base) => ({ ...base, color: p.parchment, margin: 0, padding: 0, fontSize: 12 }),
  placeholder: (base) => ({ ...base, color: alpha(p.dim, 40), fontSize: 12 }),
  menu: (base) => ({
    ...base,
    background: p.ink3,
    border: `1px solid ${alpha(p.gold, 30)}`,
    borderRadius: 4,
    overflow: 'hidden',
    zIndex: 60,
  }),
  menuList: (base) => ({ ...base, padding: 0, maxHeight: 200 }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? alpha(p.gold, 16) : 'transparent',
    color: state.isSelected ? p.goldLight : p.dim,
    fontSize: 12,
    padding: '6px 10px',
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
});

const makeTheme = (p: Palette) => (t: any) => ({
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

/**
 * Score combobox: pick a common total from the list or type any value
 * (decimals with a comma or a dot are both accepted).
 */
export function ScoreSelect({
  value,
  onChange,
  disabled,
  label,
  isWinner,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  isWinner?: boolean;
}) {
  const p = usePalette();
  const baseStyles = makeBaseStyles(p);
  const theme = makeTheme(p);
  return (
    <div className="w-[6.75rem] flex-none">
      <CreatableSelect
        aria-label={label}
        classNamePrefix="tdl"
        isDisabled={disabled}
        isClearable
        isSearchable
        openMenuOnFocus
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        menuPosition="fixed"
        theme={theme}
        styles={{
          ...baseStyles,
          singleValue: (base) => ({
            ...base,
            color: isWinner ? p.goldLight : p.parchment,
            fontWeight: isWinner ? 600 : 400,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 12,
          }),
        }}
        placeholder="—"
        options={OPTIONS}
        value={value ? { value, label: value } : null}
        onChange={(opt) => onChange(opt?.value ?? '')}
        isValidNewOption={(input) => parsePoints(input) != null}
        formatCreateLabel={(input) => `Utiliser ${input.trim()}`}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? 'Valeur invalide' : 'Saisissez un nombre'
        }
      />
    </div>
  );
}

/** Selects which fighter forfeits — always a deliberate, explicit choice. */
export function ForfeitSelect({
  options,
  value,
  onChange,
}: {
  options: FighterOption[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const p = usePalette();
  const baseStyles = makeBaseStyles(p);
  const theme = makeTheme(p);
  return (
    <div className="w-40 flex-none">
      <Select
        aria-label="Combattant déclarant forfait"
        classNamePrefix="tdl-forfeit"
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        menuPosition="fixed"
        theme={theme}
        styles={{
          ...baseStyles,
          control: (base, state) => ({
            ...base,
            background: p.ink,
            borderColor: state.isFocused ? p.blood : alpha(p.blood, 50),
            borderRadius: 4,
            minHeight: 28,
            fontSize: 12,
            boxShadow: 'none',
            ':hover': { borderColor: p.blood },
          }),
          dropdownIndicator: (base) => ({
            ...base,
            color: alpha(p.blood, 90),
            padding: 4,
          }),
        }}
        placeholder="Qui déclare forfait ?"
        options={options}
        value={options.find((o) => o.value === value) ?? null}
        onChange={(opt) => onChange((opt as FighterOption | null)?.value ?? null)}
        isSearchable={false}
        isClearable
        noOptionsMessage={() => 'Aucun combattant'}
      />
    </div>
  );
}
