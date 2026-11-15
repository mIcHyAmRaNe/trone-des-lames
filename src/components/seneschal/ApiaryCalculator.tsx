import { useMemo, useState } from "react";
import type { Lang } from "../../i18n";
import { APIARY_MOODS, APIARY_RULES, apiaryMood, computeApiary } from "../../lib/seneschal";
import { formatPoints } from "../../lib/format";
import { FieldSelect, MoneyField, Toggle, Line, Total, type Option } from "./controls";

interface CalcState {
  hives: number;
  moodLevel: number;
  harvests: string;
  secondField: boolean;
  hivePrice: string;
  smokerPrice: string;
  honeyPrice: string;
  waxPrice: string;
  jellyPrice: string;
}

const money = (raw: string): number => {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const moodOptions: Option[] = APIARY_MOODS.map((mood) => ({
  value: mood.level,
  label: `${mood.level}  -  ${mood.label}`,
}));

const STR = {
  fr: {
    apiary: "Le rucher",
    hiveCount: "Nombre de ruches",
    maxHives: "Quatre ruches au maximum par rucher.",
    secondField: "Second champ (−15 %)",
    secondFieldHint: "Le miel récolté par ruche est réduit de 15 %.",
    beeMood: "L’humeur des abeilles",
    currentMood: "Humeur du moment",
    perHiveHarvest: "Par ruche et par récolte :",
    potsOfHoney: (n: number) => `pot${n > 1 ? "s" : ""} de miel,`,
    waxAnd: "cire et",
    jellyExpected: "gelée en espérance.",
    moodNote: (drop: number) =>
      `L’humeur baisse de ${drop} niveaux après chaque récolte ; l’entretien aux fleurs est gratuit.`,
    harvest: "La récolte",
    harvestCount: "Nombre de récoltes",
    harvestsSuffix: "récoltes",
    harvestNote: (drop: number) =>
      `Comptez une récolte par passage ; l’humeur repart ensuite ${drop} niveaux plus bas.`,
    market: "Le marché",
    honeyJar: "Pot de miel",
    beeswax: "Cire d’abeille",
    royalJelly: "Gelée royale",
    hivePurchase: "Ruche (à l’achat)",
    smoker: "Enfumoir",
    results: "Résultats",
    reset: "Réinitialiser",
    netProfit: "Bénéfice net",
    perHive: "Par ruche",
    mood: "Humeur",
    harvestSection: "Récolte",
    honey: "Miel",
    waxExpected: "Cire (espérée)",
    jellyExpectedShort: "Gelée (espérée)",
    harvests: "Récoltes",
    jars: (n: string) => `${n} pots`,
    revenue: "Recettes",
    costs: "Coûts",
    total: "Total",
    honeyLine: (qty: string) => `${qty} pots ×`,
    waxLine: (qty: string) => `${qty} cires ×`,
    jellyLine: (qty: string) => `${qty} gelées ×`,
    hiveLine: (n: number) => `${n} ruche${n > 1 ? "s" : ""} ×`,
  },
  en: {
    apiary: "The apiary",
    hiveCount: "Number of hives",
    maxHives: "Four hives at most per apiary.",
    secondField: "Second field (−15%)",
    secondFieldHint: "Honey harvested per hive is reduced by 15%.",
    beeMood: "Bee mood",
    currentMood: "Current mood",
    perHiveHarvest: "Per hive and per harvest:",
    potsOfHoney: (n: number) => `jar${n > 1 ? "s" : ""} of honey,`,
    waxAnd: "wax and",
    jellyExpected: "jelly expected.",
    moodNote: (drop: number) =>
      `Mood drops by ${drop} levels after each harvest; tending the flowers is free.`,
    harvest: "The harvest",
    harvestCount: "Number of harvests",
    harvestsSuffix: "harvests",
    harvestNote: (drop: number) =>
      `Count one harvest per session; mood then starts ${drop} levels lower.`,
    market: "The market",
    honeyJar: "Jar of honey",
    beeswax: "Beeswax",
    royalJelly: "Royal jelly",
    hivePurchase: "Hive (purchase price)",
    smoker: "Bee smoker",
    results: "Results",
    reset: "Reset",
    netProfit: "Net profit",
    perHive: "Per hive",
    mood: "Mood",
    harvestSection: "Harvest",
    honey: "Honey",
    waxExpected: "Wax (expected)",
    jellyExpectedShort: "Jelly (expected)",
    harvests: "Harvests",
    jars: (n: string) => `${n} jars`,
    revenue: "Revenue",
    costs: "Costs",
    total: "Total",
    honeyLine: (qty: string) => `${qty} jars ×`,
    waxLine: (qty: string) => `${qty} wax ×`,
    jellyLine: (qty: string) => `${qty} jelly ×`,
    hiveLine: (n: number) => `${n} hive${n > 1 ? "s" : ""} ×`,
  },
};

const createDefault = (): CalcState => ({
  hives: 1,
  moodLevel: 8,
  harvests: "1",
  secondField: false,
  hivePrice: String(APIARY_RULES.hivePrice),
  smokerPrice: "0",
  honeyPrice: "10",
  waxPrice: "20",
  jellyPrice: "100",
});

export default function ApiaryCalculator({ lang = "fr" }: { lang?: Lang }) {
  const s = STR[lang];
  const [state, setState] = useState<CalcState>(createDefault);

  const patch = <K extends keyof CalcState>(key: K, value: CalcState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const result = useMemo(
    () =>
      computeApiary({
        hives: state.hives,
        moodLevel: state.moodLevel,
        harvests: Math.max(1, Math.round(money(state.harvests)) || 1),
        secondField: state.secondField,
        hivePrice: money(state.hivePrice),
        smokerPrice: money(state.smokerPrice),
        honeyPrice: money(state.honeyPrice),
        waxPrice: money(state.waxPrice),
        jellyPrice: money(state.jellyPrice),
      }),
    [state],
  );

  const mood = apiaryMood(state.moodLevel);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-5">
        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">{s.apiary}</legend>

          <div className="mt-1 space-y-4">
            <div>
              <p
                id="rucher-nombre"
                className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
              >
                {s.hiveCount}
              </p>
              <div
                role="group"
                aria-labelledby="rucher-nombre"
                className="mt-1.5 grid grid-cols-4 gap-1.5"
              >
                {Array.from({ length: APIARY_RULES.maxHives }, (_, i) => i + 1).map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={state.hives === count}
                    onClick={() => patch("hives", count)}
                    className={`border py-1.5 font-display text-sm tabular-nums transition-colors ${
                      state.hives === count
                        ? "border-gold bg-gold/15 text-gold-light"
                        : "border-gold/20 bg-ink/50 text-parchment-dim hover:border-gold/45 hover:text-parchment"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[0.625rem] text-parchment-dim/70">{s.maxHives}</p>
            </div>

            <Toggle
              id="rucher-second-champ"
              checked={state.secondField}
              onChange={(checked) => patch("secondField", checked)}
              label={s.secondField}
              hint={s.secondFieldHint}
            />
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">{s.beeMood}</legend>

          <div className="mt-1 space-y-4">
            <FieldSelect
              id="rucher-humeur"
              label={s.currentMood}
              value={state.moodLevel}
              options={moodOptions}
              onChange={(value) => patch("moodLevel", value)}
            />

            <p className="text-[0.6875rem] leading-relaxed text-parchment-dim">
              {s.perHiveHarvest}{" "}
              <span className="font-display text-sm text-gold-light">
                {formatPoints(result.honeyPerHive)}
              </span>{" "}
              {s.potsOfHoney(result.honeyPerHive)},{" "}
              <span className="font-display text-sm text-gold-light">
                {formatPoints(mood.wax)}
              </span>{" "}
              {s.waxAnd}{" "}
              <span className="font-display text-sm text-gold-light">
                {formatPoints(mood.jelly)}
              </span>{" "}
              {s.jellyExpected}
            </p>

            <p className="border-l-2 border-gold/50 bg-gold/[0.06] px-3 py-2 text-[0.6875rem] leading-snug text-parchment-dim">
              {s.moodNote(APIARY_RULES.harvestMoodDrop)}
            </p>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">{s.harvest}</legend>

          <div className="mt-1">
            <MoneyField
              id="rucher-recoltes"
              label={s.harvestCount}
              value={state.harvests}
              onChange={(value) => patch("harvests", value)}
              suffix={s.harvestsSuffix}
            />
            <p className="mt-2 text-[0.625rem] leading-snug text-parchment-dim/70">
              {s.harvestNote(APIARY_RULES.harvestMoodDrop)}
            </p>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">{s.market}</legend>

          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            <MoneyField
              id="rucher-prix-miel"
              label={s.honeyJar}
              value={state.honeyPrice}
              onChange={(value) => patch("honeyPrice", value)}
            />
            <MoneyField
              id="rucher-prix-cire"
              label={s.beeswax}
              value={state.waxPrice}
              onChange={(value) => patch("waxPrice", value)}
            />
            <MoneyField
              id="rucher-prix-gelee"
              label={s.royalJelly}
              value={state.jellyPrice}
              onChange={(value) => patch("jellyPrice", value)}
            />
            <MoneyField
              id="rucher-prix-ruche"
              label={s.hivePurchase}
              value={state.hivePrice}
              onChange={(value) => patch("hivePrice", value)}
            />
            <MoneyField
              id="rucher-prix-enfumoir"
              label={s.smoker}
              value={state.smokerPrice}
              onChange={(value) => patch("smokerPrice", value)}
            />
          </div>
        </fieldset>
      </div>

      <aside
        className="card-dark texture-noise min-w-0 p-5 sm:p-6"
        aria-labelledby="rucher-resultats-titre"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="rucher-resultats-titre" className="label-caps">
            {s.results}
          </h2>
          <button
            type="button"
            onClick={() => setState(createDefault())}
            className="border border-gold/25 px-2.5 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-parchment-dim transition-colors hover:border-gold/50 hover:text-parchment"
          >
            {s.reset}
          </button>
        </div>

        <div aria-live="polite" className="mt-4">
          <p className="text-[0.5625rem] uppercase tracking-[0.18em] text-parchment-dim">
            {s.netProfit}
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
                {s.perHive}
              </dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                {formatPoints(result.profitPerHive)}
              </dd>
            </div>
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">
                {s.mood}
              </dt>
              <dd className="mt-0.5 font-display text-sm text-parchment">{result.mood.label}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">{s.harvestSection}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            {[
              { label: s.honey, value: s.jars(formatPoints(result.honeyQty)) },
              { label: s.waxExpected, value: formatPoints(result.waxQty) },
              { label: s.jellyExpectedShort, value: formatPoints(result.jellyQty) },
              { label: s.harvests, value: formatPoints(result.harvests) },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">
                  {item.label}
                </dt>
                <dd className="font-display text-sm tabular-nums text-parchment">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">{s.revenue}</p>
          <dl className="mt-2 space-y-1.5">
            <Line
              label={`${s.honeyLine(formatPoints(result.honeyQty))} ${formatPoints(
                money(state.honeyPrice),
              )}`}
              value={result.honeyQty * money(state.honeyPrice)}
            />
            <Line
              label={`${s.waxLine(formatPoints(result.waxQty))} ${formatPoints(
                money(state.waxPrice),
              )}`}
              value={result.waxQty * money(state.waxPrice)}
            />
            <Line
              label={`${s.jellyLine(formatPoints(result.jellyQty))} ${formatPoints(
                money(state.jellyPrice),
              )}`}
              value={result.jellyQty * money(state.jellyPrice)}
            />
          </dl>
          <Total label={s.total} value={result.revenue} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">{s.costs}</p>
          <dl className="mt-2 space-y-1.5">
            <Line
              label={`${s.hiveLine(result.hives)} ${formatPoints(money(state.hivePrice))}`}
              value={result.hiveCost}
            />
            <Line label={s.smoker} value={result.smokerCost} />
          </dl>
          <Total label={s.total} value={result.costs} />
        </div>

        <p className="mt-4 border-l-2 border-gold/50 bg-gold/[0.06] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-parchment-dim">
          {s.moodNote(APIARY_RULES.harvestMoodDrop)}
        </p>
      </aside>
    </div>
  );
}