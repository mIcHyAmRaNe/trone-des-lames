import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Select from "react-select";
import {
  COW_RULES,
  COW_SIZES,
  computeCowCycle,
  cowExpectedSize,
  cowMilkPerMilking,
} from "../../lib/seneschal";
import { formatPoints } from "../../lib/format";
import { menuPortalStyle, selectClassNames } from "../garde-robe/selectTheme";

type Option = { value: number; label: string };

interface CowRow {
  enabled: boolean;
  purchaseDay: number;
  slaughterAge: number;
  size: number;
}

interface CalcState {
  cows: CowRow[];
  synchronized: boolean;
  milkEvery: number;
  intelligence: number;
  secondField: boolean;
  /** Montants saisis en texte : garder « 38, » en cours de frappe. */
  cowPrice: string;
  bucketPrice: string;
  knifePrice: string;
  milkPrice: string;
  carcassPrice: string;
  milkingSalary: string;
  slaughterSalary: string;
}

const DEFAULT_COW: CowRow = { enabled: true, purchaseDay: 1, slaughterAge: 17, size: 2 };

const createDefault = (): CalcState => ({
  cows: Array.from({ length: COW_RULES.maxCows }, () => ({ ...DEFAULT_COW })),
  synchronized: true,
  milkEvery: 3,
  intelligence: 20,
  secondField: false,
  cowPrice: String(COW_RULES.price),
  bucketPrice: "50",
  knifePrice: "20",
  milkPrice: "10",
  carcassPrice: "30",
  milkingSalary: "0",
  slaughterSalary: "0",
});

const money = (raw: string): number => {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const days = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;
const round1 = (n: number) => Math.round(n * 10) / 10;

const dayOptions: Option[] = Array.from({ length: 13 }, (_, i) => ({
  value: i + 1,
  label: `Jour ${i + 1}`,
}));

const ageOptions: Option[] = Array.from({ length: 31 }, (_, i) => ({
  value: i,
  label: days(i),
}));

const sizeOptions: Option[] = COW_SIZES.map((size) => ({ value: size.value, label: size.label }));

const intelligenceOptions: Option[] = Array.from({ length: 21 }, (_, i) => ({
  value: i,
  label: i === COW_RULES.intelligenceCap ? `${i} — rendement doublé` : String(i),
}));

const milkOptions: Option[] = [
  { value: 0, label: "Jamais" },
  { value: 1, label: "Tous les jours" },
  { value: 2, label: "Tous les 2 jours" },
  { value: 3, label: "Tous les 3 jours — optimal" },
  { value: 4, label: "Tous les 4 jours" },
];

function FieldSelect({
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
      <label
        htmlFor={id}
        className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
      >
        {label}
      </label>
      <Select<Option, false>
        unstyled
        inputId={id}
        options={options}
        value={options.find((option) => option.value === value) ?? null}
        onChange={(option) => onChange(option?.value ?? value)}
        isSearchable={false}
        menuPlacement="auto"
        menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
        styles={{ menuPortal: menuPortalStyle }}
        classNames={{ ...selectClassNames, container: () => "mt-1.5 min-w-0" }}
        placeholder="—"
      />
      {hint ? (
        <p className="mt-1 text-[0.625rem] leading-snug text-parchment-dim/70">{hint}</p>
      ) : null}
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border border-gold/20 bg-ink/60 py-1.5 pl-2.5 pr-11 text-sm tabular-nums text-parchment transition-colors [appearance:textfield] hover:border-gold/40 focus:border-gold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim/60">
          écus
        </span>
      </div>
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-5 w-9 flex-none border border-gold/30 bg-ink/60 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-3 after:w-3 after:bg-parchment-dim after:transition-all after:content-[''] peer-checked:border-gold peer-checked:bg-gold/15 peer-checked:after:translate-x-4 peer-checked:after:bg-gold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold"
      ></span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-parchment">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[0.625rem] leading-snug text-parchment-dim/70">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function Line({ label, value, strong }: { label: ReactNode; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-[0.6875rem] leading-snug text-parchment-dim">{label}</dt>
      <dd
        className={`flex-none font-display text-sm tabular-nums ${
          strong ? "text-gold-light" : "text-parchment"
        }`}
      >
        {formatPoints(value)}
      </dd>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-gold/10 pt-2">
      <span className="text-[0.5rem] uppercase tracking-[0.14em] text-parchment-dim">{label}</span>
      <span className="font-display text-sm tabular-nums text-parchment">{formatPoints(value)}</span>
    </div>
  );
}

export default function CowCalculator() {
  const [state, setState] = useState<CalcState>(createDefault);

  const patch = <K extends keyof CalcState>(key: K, value: CalcState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const patchCow = (index: number, changes: Partial<CowRow>) =>
    setState((current) => ({
      ...current,
      cows: current.cows.map((cow, i) => (i === index ? { ...cow, ...changes } : cow)),
    }));

  const patchAllCows = (changes: Partial<CowRow>) =>
    setState((current) => ({
      ...current,
      cows: current.cows.map((cow) => ({ ...cow, ...changes })),
    }));

  const activeCount = state.cows.filter((cow) => cow.enabled).length;
  const lead = state.cows[0] ?? DEFAULT_COW;

  const setCount = (count: number) =>
    setState((current) => ({
      ...current,
      cows: current.cows.map((cow, i) => ({ ...cow, enabled: i < count })),
    }));

  const result = useMemo(
    () =>
      computeCowCycle({
        cows: state.cows,
        milkEvery: state.milkEvery,
        intelligence: state.intelligence,
        secondField: state.secondField,
        cowPrice: money(state.cowPrice),
        bucketPrice: money(state.bucketPrice),
        knifePrice: money(state.knifePrice),
        milkPrice: money(state.milkPrice),
        carcassPrice: money(state.carcassPrice),
        milkingSalary: money(state.milkingSalary),
        slaughterSalary: money(state.slaughterSalary),
      }),
    [state],
  );

  const perMilking = cowMilkPerMilking(state.intelligence, state.secondField);
  const conservation = money(state.cowPrice) === COW_RULES.conservationPrice;
  const maxRisk = result.perCow.reduce((max, cow) => Math.max(max, cow.cumulativeRisk), 0);
  const totalFlow = result.revenue + result.costs;
  const revenueShare = totalFlow > 0 ? (result.revenue / totalFlow) * 100 : 0;

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-5">
          <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
            <legend className="label-caps px-2">Le troupeau</legend>

            <div className="mt-1 space-y-4">
              <div>
                <p
                  id="troupeau-nombre"
                  className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
                >
                  Nombre de vaches
                </p>
                <div
                  role="group"
                  aria-labelledby="troupeau-nombre"
                  className="mt-1.5 grid grid-cols-4 gap-1.5"
                >
                  {Array.from({ length: COW_RULES.maxCows }, (_, i) => i + 1).map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={activeCount === count}
                      onClick={() => setCount(count)}
                      className={`border py-1.5 font-display text-sm tabular-nums transition-colors ${
                        activeCount === count
                          ? "border-gold bg-gold/15 text-gold-light"
                          : "border-gold/20 bg-ink/50 text-parchment-dim hover:border-gold/45 hover:text-parchment"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[0.625rem] text-parchment-dim/70">
                  Quatre bêtes au maximum par champ.
                </p>
              </div>

              <Toggle
                id="troupeau-synchronise"
                checked={state.synchronized}
                onChange={(checked) => patch("synchronized", checked)}
                label="Troupeau synchronisé"
                hint="Même jour d’achat, âge et corpulence pour toutes les vaches."
              />

              {state.synchronized ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <FieldSelect
                    id="sync-achat"
                    label="Jour d’achat"
                    value={lead.purchaseDay}
                    options={dayOptions}
                    onChange={(value) => patchAllCows({ purchaseDay: value })}
                  />
                  <FieldSelect
                    id="sync-age"
                    label="Âge à l’abattage"
                    value={lead.slaughterAge}
                    options={ageOptions}
                    onChange={(value) => patchAllCows({ slaughterAge: value })}
                    hint={`Taille attendue si nourrie chaque jour : ${formatPoints(
                      round1(cowExpectedSize(lead.slaughterAge)),
                    )}`}
                  />
                  <FieldSelect
                    id="sync-taille"
                    label="Corpulence"
                    value={lead.size}
                    options={sizeOptions}
                    onChange={(value) => patchAllCows({ size: value })}
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="border-l-2 border-gold/50 bg-gold/[0.06] px-3 py-2 text-[0.6875rem] leading-snug text-parchment-dim">
                    La traite s’applique à toutes les vaches : décalez les achats
                    et vous perdrez du lait. Le calcul reste une estimation.
                  </p>

                  {state.cows.map((cow, i) => (
                    <div key={i} className="border border-gold/15 bg-ink/40 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          id={`cow-${i}`}
                          type="checkbox"
                          checked={cow.enabled}
                          onChange={(event) => patchCow(i, { enabled: event.target.checked })}
                          className="h-3.5 w-3.5 flex-none accent-gold"
                        />
                        <label
                          htmlFor={`cow-${i}`}
                          className="font-display text-xs tracking-[0.08em] text-parchment"
                        >
                          Vache {i + 1}
                        </label>
                        <span className="ml-auto text-[0.5625rem] uppercase tracking-[0.1em] text-parchment-dim/60">
                          attendu {formatPoints(round1(cowExpectedSize(cow.slaughterAge)))}
                        </span>
                      </div>

                      {cow.enabled ? (
                        <div className="mt-2.5 grid grid-cols-3 gap-2">
                          <FieldSelect
                            id={`cow-${i}-achat`}
                            label="Jour"
                            value={cow.purchaseDay}
                            options={dayOptions}
                            onChange={(value) => patchCow(i, { purchaseDay: value })}
                          />
                          <FieldSelect
                            id={`cow-${i}-age`}
                            label="Âge"
                            value={cow.slaughterAge}
                            options={ageOptions}
                            onChange={(value) => patchCow(i, { slaughterAge: value })}
                          />
                          <FieldSelect
                            id={`cow-${i}-taille`}
                            label="Taille"
                            value={cow.size}
                            options={sizeOptions}
                            onChange={(value) => patchCow(i, { size: value })}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
            <legend className="label-caps px-2">La traite</legend>

            <div className="mt-1 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldSelect
                  id="intelligence"
                  label="Intelligence"
                  value={state.intelligence}
                  options={intelligenceOptions}
                  onChange={(value) => patch("intelligence", value)}
                />
                <FieldSelect
                  id="frequence"
                  label="Fréquence de traite"
                  value={state.milkEvery}
                  options={milkOptions}
                  onChange={(value) => patch("milkEvery", value)}
                />
              </div>

              <p className="text-[0.6875rem] leading-relaxed text-parchment-dim">
                Rendement :{" "}
                <span className="font-display text-sm text-gold-light">{formatPoints(perMilking)}</span>{" "}
                bouteille{perMilking > 1 ? "s" : ""} par vache et par traite.
                {state.milkEvery === 0 ? " La traite est désactivée." : null}
              </p>

              <Toggle
                id="second-champ"
                checked={state.secondField}
                onChange={(checked) => patch("secondField", checked)}
                label="Second champ (−15 %)"
                hint="Lait et carcasses réduits de 15 %."
              />
            </div>
          </fieldset>

          <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
            <legend className="label-caps px-2">Le marché</legend>

            <div className="mt-1 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MoneyField
                  id="prix-lait"
                  label="Lait (par bouteille)"
                  value={state.milkPrice}
                  onChange={(value) => patch("milkPrice", value)}
                />
                <MoneyField
                  id="prix-carcasse"
                  label="Carcasse (par quintal)"
                  value={state.carcassPrice}
                  onChange={(value) => patch("carcassPrice", value)}
                />
                <MoneyField
                  id="prix-vache"
                  label="Vache (à l’achat)"
                  value={state.cowPrice}
                  onChange={(value) => patch("cowPrice", value)}
                />
                <MoneyField
                  id="prix-seau"
                  label="Seau cerclé"
                  value={state.bucketPrice}
                  onChange={(value) => patch("bucketPrice", value)}
                />
                <MoneyField
                  id="prix-couteau"
                  label="Couteau"
                  value={state.knifePrice}
                  onChange={(value) => patch("knifePrice", value)}
                />
              </div>

              <Toggle
                id="conservation"
                checked={conservation}
                onChange={(checked) =>
                  patch(
                    "cowPrice",
                    checked ? String(COW_RULES.conservationPrice) : String(COW_RULES.price),
                  )
                }
                label="Vertu Conservation"
                hint={`Vache à ${formatPoints(COW_RULES.conservationPrice)} écus au lieu de ${formatPoints(
                  COW_RULES.price,
                )}.`}
              />

              <details className="group border-t border-gold/10 pt-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim transition-colors hover:text-gold [&::-webkit-details-marker]:hidden">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3 flex-none transition-transform group-open:rotate-90"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden="true"
                  >
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                  Avancé — salaires
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MoneyField
                    id="salaire-traite"
                    label="Traite (par passage)"
                    value={state.milkingSalary}
                    onChange={(value) => patch("milkingSalary", value)}
                  />
                  <MoneyField
                    id="salaire-abattage"
                    label="Abattage (par bête)"
                    value={state.slaughterSalary}
                    onChange={(value) => patch("slaughterSalary", value)}
                  />
                </div>
                <p className="mt-2 text-[0.625rem] leading-snug text-parchment-dim/70">
                  Laissez à 0 si vous travaillez vous-même.
                </p>
              </details>
            </div>
          </fieldset>
        </div>

        <aside
          className="card-dark texture-noise min-w-0 p-5 sm:p-6"
          aria-labelledby="resultats-titre"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="resultats-titre" className="label-caps">
              Résultats
            </h2>
            <button
              type="button"
              onClick={() => setState(createDefault())}
              className="border border-gold/25 px-2.5 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-parchment-dim transition-colors hover:border-gold/50 hover:text-parchment"
            >
              Réinitialiser
            </button>
          </div>

          <div aria-live="polite" className="mt-4">
            <p className="text-[0.5625rem] uppercase tracking-[0.18em] text-parchment-dim">
              Bénéfice net
            </p>
            <p
              className={`mt-1 font-display text-[2rem] font-bold leading-none tabular-nums sm:text-4xl ${
                result.profit >= 0 ? "text-gold-light" : "text-blood-light"
              }`}
            >
              {formatPoints(result.profit)}
              <span className="ml-1.5 align-baseline text-sm font-normal tracking-normal text-parchment-dim">
                écus
              </span>
            </p>

            <dl className="mt-3 grid grid-cols-2 gap-2">
              <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
                <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">
                  Par jour
                </dt>
                <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                  {formatPoints(result.profitPerDay)}
                </dd>
              </div>
              <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
                <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">
                  Par vache
                </dt>
                <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                  {formatPoints(result.profitPerCow)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-5 border-t border-gold/15 pt-4">
            <p className="label-caps">Recettes</p>
            <dl className="mt-2 space-y-1.5">
              <Line
                label={`${formatPoints(result.milkBottles)} bouteilles × ${formatPoints(
                  money(state.milkPrice),
                )}`}
                value={result.milkRevenue}
              />
              <Line
                label={`${formatPoints(result.carcasses)} carcasses × ${formatPoints(
                  money(state.carcassPrice),
                )}`}
                value={result.carcassRevenue}
              />
            </dl>
            <Total label="Total" value={result.revenue} />
          </div>

          <div className="mt-5 border-t border-gold/15 pt-4">
            <p className="label-caps">Coûts</p>
            <dl className="mt-2 space-y-1.5">
              <Line
                label={`${result.activeCows} vache${result.activeCows > 1 ? "s" : ""} × ${formatPoints(
                  money(state.cowPrice),
                )}`}
                value={result.cowCost}
              />
              <Line
                label={`${result.buckets} seau${result.buckets > 1 ? "x" : ""} · ${result.knives} couteau${
                  result.knives > 1 ? "x" : ""
                }`}
                value={result.toolsCost}
              />
              <Line label="Salaires" value={result.salaries} />
            </dl>
            <Total label="Total" value={result.costs} />
          </div>

          {totalFlow > 0 ? (
            <div className="mt-4">
              <div className="flex h-1.5 w-full overflow-hidden bg-ink" aria-hidden="true">
                <div
                  className="h-full bg-gradient-to-r from-gold-dim to-gold"
                  style={{ width: `${revenueShare}%` }}
                ></div>
                <div className="h-full bg-blood/70" style={{ width: `${100 - revenueShare}%` }}></div>
              </div>
              <p className="mt-1.5 flex justify-between gap-3 text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim/70">
                <span>Recettes {formatPoints(result.revenue)}</span>
                <span>Coûts {formatPoints(result.costs)}</span>
              </p>
            </div>
          ) : null}

          <div className="mt-5 border-t border-gold/15 pt-4">
            <p className="label-caps">Cycle</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              {[
                { label: "Jours", value: result.cycleDays },
                { label: "Traites", value: result.milkingOperations },
                { label: "Utilisations de seau", value: result.bucketUses },
                { label: "Abattages", value: result.knifeUses },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">
                    {item.label}
                  </dt>
                  <dd className="font-display text-sm tabular-nums text-parchment">
                    {formatPoints(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-5 border-t border-gold/15 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="label-caps">Risque</p>
              <p className="font-display text-sm tabular-nums text-parchment">
                {formatPoints(round1(maxRisk))} %
              </p>
            </div>
            <p className="mt-1 text-[0.625rem] leading-snug text-parchment-dim/70">
              Risque cumulé de mortalité avant l’abattage, sur la vache la plus exposée.
            </p>
            {maxRisk >= 20 ? (
              <p className="mt-2 border-l-2 border-blood bg-blood/10 px-2.5 py-1.5 text-[0.6875rem] leading-snug text-blood-light">
                Risque élevé : abattez plus tôt pour limiter les pertes.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <section
        className="card-dark texture-noise mt-5 overflow-hidden"
        aria-labelledby="detail-titre"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gold/15 px-5 py-4">
          <h2 id="detail-titre" className="label-caps">
            Détail par vache
          </h2>
          <p className="text-[0.5625rem] uppercase tracking-[0.12em] text-parchment-dim/70">
            {result.activeCows} sur {state.cows.length} bêtes
          </p>
        </div>

        {result.perCow.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-parchment-dim">
            Aucune vache dans le troupeau.
          </p>
        ) : (
          <div className="overflow-x-auto px-5 pb-2">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-gold/15">
                  {[
                    "Vache",
                    "Achat",
                    "Abattage",
                    "Traites",
                    "Lait",
                    "Carcasses",
                    "Risque cumulé",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2.5 text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim first:pl-0 last:pr-0"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {result.perCow.map((cow) => (
                  <tr key={cow.index}>
                    <th
                      scope="row"
                      className="whitespace-nowrap px-3 py-2.5 text-left font-display text-xs tracking-[0.08em] text-parchment first:pl-0 last:pr-0"
                    >
                      Vache {cow.index + 1}
                    </th>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                      J{state.cows[cow.index]?.purchaseDay ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                      J{cow.slaughterDay}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                      {formatPoints(cow.milkings)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                      {formatPoints(cow.milkBottles)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                      {formatPoints(cow.carcasses)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2.5 text-sm tabular-nums first:pl-0 last:pr-0 ${
                        cow.cumulativeRisk >= 20 ? "text-blood-light" : "text-parchment-dim"
                      }`}
                    >
                      {formatPoints(round1(cow.cumulativeRisk))} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
