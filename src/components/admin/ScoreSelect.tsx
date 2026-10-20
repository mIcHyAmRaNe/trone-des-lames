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

const GOLD = '#c9a227';
const PARCHMENT = '#e8ddc7';
const DIM = '#a89d88';

const baseStyles: StylesConfig<Option, false> = {
  control: (base, state) => ({
    ...base,
    background: '#0d0b0a',
    borderColor: state.isFocused ? GOLD : 'rgba(201,162,39,0.22)',
    borderRadius: 4,
    minHeight: 30,
    fontSize: 12,
    boxShadow: 'none',
    transition: 'border-color 120ms',
    ':hover': { borderColor: state.isFocused ? GOLD : 'rgba(201,162,39,0.5)' },
  }),
  valueContainer: (base) => ({ ...base, padding: '0 6px' }),
  singleValue: (base) => ({
    ...base,
    color: PARCHMENT,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 12,
  }),
  input: (base) => ({ ...base, color: PARCHMENT, margin: 0, padding: 0, fontSize: 12 }),
  placeholder: (base) => ({ ...base, color: 'rgba(168,157,136,0.4)', fontSize: 12 }),
  menu: (base) => ({
    ...base,
    background: '#1f1915',
    border: '1px solid rgba(201,162,39,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    zIndex: 60,
  }),
  menuList: (base) => ({ ...base, padding: 0, maxHeight: 200 }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'rgba(201,162,39,0.16)' : 'transparent',
    color: state.isSelected ? '#e8c96a' : DIM,
    fontSize: 12,
    padding: '6px 10px',
    cursor: 'pointer',
    ':active': { background: 'rgba(201,162,39,0.24)' },
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({
    ...base,
    color: 'rgba(201,162,39,0.7)',
    padding: 4,
    ':hover': { color: GOLD },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'rgba(168,157,136,0.6)',
    padding: 4,
    ':hover': { color: PARCHMENT },
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

const theme = (t: any) => ({
  ...t,
  colors: {
    ...t.colors,
    primary: GOLD,
    primary75: 'rgba(201,162,39,0.75)',
    primary50: 'rgba(201,162,39,0.5)',
    primary25: 'rgba(201,162,39,0.15)',
    neutral0: '#0d0b0a',
    neutral5: '#16120f',
    neutral10: '#1f1915',
    neutral20: 'rgba(201,162,39,0.22)',
    neutral30: 'rgba(201,162,39,0.4)',
    neutral40: DIM,
    neutral50: DIM,
    neutral60: PARCHMENT,
    neutral70: PARCHMENT,
    neutral80: PARCHMENT,
    neutral90: PARCHMENT,
    danger: '#8b1e1e',
    dangerLight: 'rgba(139,30,30,0.3)',
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
            color: isWinner ? '#e8c96a' : PARCHMENT,
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
            background: '#0d0b0a',
            borderColor: state.isFocused ? '#8b1e1e' : 'rgba(139,30,30,0.5)',
            borderRadius: 4,
            minHeight: 28,
            fontSize: 12,
            boxShadow: 'none',
            ':hover': { borderColor: '#8b1e1e' },
          }),
          dropdownIndicator: (base) => ({
            ...base,
            color: 'rgba(139,30,30,0.9)',
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
