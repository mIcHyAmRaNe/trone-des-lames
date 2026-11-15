import type { ReactNode } from "react";
import Select from "react-select";
import { menuPortalStyle, selectClassNames } from "../garde-robe/selectTheme";
import { formatPoints } from "../../lib/format";

export type Option = { value: number; label: string };

export function FieldSelect({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  options: Option[];
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
        {label}
      </label>
      <Select<Option, false>
        unstyled inputId={id} options={options}
        value={options.find((o) => o.value === value) ?? null}
        onChange={(option) => onChange(option?.value ?? value)}
        isSearchable={false} menuPlacement="auto"
        menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
        styles={{ menuPortal: menuPortalStyle }}
        classNames={{ ...selectClassNames, container: () => "mt-1.5 min-w-0" }}
        placeholder=" - "
      />
      {hint ? <p className="mt-1 text-[0.625rem] leading-snug text-parchment-dim/70">{hint}</p> : null}
    </div>
  );
}

export function MoneyField({
  id, label, value, onChange, suffix = "écus",
}: { id: string; label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id} type="number" inputMode="decimal" min={0} step={0.01} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gold/20 bg-ink/60 py-1.5 pl-2.5 pr-12 text-sm tabular-nums text-parchment transition-colors [appearance:textfield] hover:border-gold/40 focus:border-gold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim/60">
          {suffix}
        </span>
      </div>
    </div>
  );
}

export function Toggle({ id, checked, onChange, label, hint }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="relative mt-0.5 h-5 w-9 flex-none border border-gold/30 bg-ink/60 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-3 after:w-3 after:bg-parchment-dim after:transition-all after:content-[''] peer-checked:border-gold peer-checked:bg-gold/15 peer-checked:after:translate-x-4 peer-checked:after:bg-gold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold" />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-parchment">{label}</span>
        {hint ? <span className="mt-0.5 block text-[0.625rem] leading-snug text-parchment-dim/70">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Line({ label, value, strong }: { label: ReactNode; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-[0.6875rem] leading-snug text-parchment-dim">{label}</dt>
      <dd className={`flex-none font-display text-sm tabular-nums ${strong ? "text-gold-light" : "text-parchment"}`}>
        {formatPoints(value)}
      </dd>
    </div>
  );
}

export function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-gold/10 pt-2">
      <span className="text-[0.5rem] uppercase tracking-[0.14em] text-parchment-dim">{label}</span>
      <span className="font-display text-sm tabular-nums text-parchment">{formatPoints(value)}</span>
    </div>
  );
}
