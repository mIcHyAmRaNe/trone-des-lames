import CreatableSelect from 'react-select/creatable';
import Select from 'react-select';
import type { StylesConfig } from 'react-select';
import { parsePoints } from '../../lib/format';
import type { Lang } from '../../i18n';
import { alpha, makeTheme, usePalette, type Palette } from '../ui/Select';

type Option = { value: string; label: string };
type FighterOption = { value: string; label: string };

/** Common point totals, offered as shortcuts. Any other value can still be typed. */
const OPTIONS: Option[] = Array.from({ length: 8 }, (_, i) => {
  const v = String(18 + i);
  return { value: v, label: v };
});

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

const STR = {
  fr: {
    scorePlaceholder: ' - ',
    scoreNoOptions: 'Saisissez un nombre',
    scoreInvalid: 'Valeur invalide',
    scoreCreateLabel: (input: string) => `Utiliser ${input.trim()}`,
    forfeitPlaceholder: 'Qui déclare forfait ?',
    forfeitNoOptions: 'Aucun combattant',
  },
  en: {
    scorePlaceholder: ' - ',
    scoreNoOptions: 'Enter a number',
    scoreInvalid: 'Invalid value',
    scoreCreateLabel: (input: string) => `Use ${input.trim()}`,
    forfeitPlaceholder: 'Who forfeits?',
    forfeitNoOptions: 'No fighters',
  },
};

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
  lang = 'fr',
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  isWinner?: boolean;
  lang?: Lang;
}) {
  const s = STR[lang];
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
        placeholder={s.scorePlaceholder}
        options={OPTIONS}
        value={value ? { value, label: value } : null}
        onChange={(opt) => onChange(opt?.value ?? '')}
        isValidNewOption={(input) => parsePoints(input) != null}
        formatCreateLabel={(input) => s.scoreCreateLabel(input)}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? s.scoreInvalid : s.scoreNoOptions
        }
      />
    </div>
  );
}

/** Selects which fighter forfeits  -  always a deliberate, explicit choice. */
export function ForfeitSelect({
  options,
  value,
  onChange,
  lang = 'fr',
}: {
  options: FighterOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  lang?: Lang;
}) {
  const s = STR[lang];
  const p = usePalette();
  const baseStyles = makeBaseStyles(p);
  const theme = makeTheme(p);
  const valueStr = value != null ? String(value) : null;
  return (
    <div className="w-40 flex-none">
      <Select
        aria-label={lang === 'fr' ? 'Combattant déclarant forfait' : 'Fighter who forfeits'}
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
        placeholder={s.forfeitPlaceholder}
        options={options}
        value={valueStr ? options.find((o) => o.value === valueStr) ?? null : null}
        onChange={(opt) => onChange(opt ? Number(opt.value) : null)}
        isSearchable={false}
        isClearable
        noOptionsMessage={() => s.forfeitNoOptions}
      />
    </div>
  );
}