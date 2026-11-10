import { useMemo, useState } from "react";
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
  label: `${mood.level} — ${mood.label}`,
}));

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

export default function ApiaryCalculator() {
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
          <legend className="label-caps px-2">Le rucher</legend>

          <div className="mt-1 space-y-4">
            <div>
              <p
                id="rucher-nombre"
                className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
              >
                Nombre de ruches
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
              <p className="mt-1.5 text-[0.625rem] text-parchment-dim/70">
                Quatre ruches au maximum par rucher.
              </p>
            </div>

            <Toggle
              id="rucher-second-champ"
              checked={state.secondField}
              onChange={(checked) => patch("secondField", checked)}
              label="Second champ (−15 %)"
              hint="Le miel récolté par ruche est réduit de 15 %."
            />
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">L’humeur des abeilles</legend>

          <div className="mt-1 space-y-4">
            <FieldSelect
              id="rucher-humeur"
              label="Humeur du moment"
              value={state.moodLevel}
              options={moodOptions}
              onChange={(value) => patch("moodLevel", value)}
            />

            <p className="text-[0.6875rem] leading-relaxed text-parchment-dim">
              Par ruche et par récolte :{" "}
              <span className="font-display text-sm text-gold-light">
                {formatPoints(result.honeyPerHive)}
              </span>{" "}
              pot{result.honeyPerHive > 1 ? "s" : ""} de miel,{" "}
              <span className="font-display text-sm text-gold-light">
                {formatPoints(mood.wax)}
              </span>{" "}
              cire et{" "}
              <span className="font-display text-sm text-gold-light">
                {formatPoints(mood.jelly)}
              </span>{" "}
              gelée en espérance.
            </p>

            <p className="border-l-2 border-gold/50 bg-gold/[0.06] px-3 py-2 text-[0.6875rem] leading-snug text-parchment-dim">
              L’humeur baisse de {APIARY_RULES.harvestMoodDrop} niveaux après chaque récolte ;
              l’entretien aux fleurs est gratuit.
            </p>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">La récolte</legend>

          <div className="mt-1">
            <MoneyField
              id="rucher-recoltes"
              label="Nombre de récoltes"
              value={state.harvests}
              onChange={(value) => patch("harvests", value)}
              suffix="récoltes"
            />
            <p className="mt-2 text-[0.625rem] leading-snug text-parchment-dim/70">
              Comptez une récolte par passage ; l’humeur repart ensuite {APIARY_RULES.harvestMoodDrop}{" "}
              niveaux plus bas.
            </p>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Le marché</legend>

          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            <MoneyField
              id="rucher-prix-miel"
              label="Pot de miel"
              value={state.honeyPrice}
              onChange={(value) => patch("honeyPrice", value)}
            />
            <MoneyField
              id="rucher-prix-cire"
              label="Cire d’abeille"
              value={state.waxPrice}
              onChange={(value) => patch("waxPrice", value)}
            />
            <MoneyField
              id="rucher-prix-gelee"
              label="Gelée royale"
              value={state.jellyPrice}
              onChange={(value) => patch("jellyPrice", value)}
            />
            <MoneyField
              id="rucher-prix-ruche"
              label="Ruche (à l’achat)"
              value={state.hivePrice}
              onChange={(value) => patch("hivePrice", value)}
            />
            <MoneyField
              id="rucher-prix-enfumoir"
              label="Enfumoir"
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
                Par ruche
              </dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                {formatPoints(result.profitPerHive)}
              </dd>
            </div>
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">
                Humeur
              </dt>
              <dd className="mt-0.5 font-display text-sm text-parchment">{result.mood.label}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Récolte</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            {[
              { label: "Miel", value: `${formatPoints(result.honeyQty)} pots` },
              { label: "Cire (espérée)", value: formatPoints(result.waxQty) },
              { label: "Gelée (espérée)", value: formatPoints(result.jellyQty) },
              { label: "Récoltes", value: formatPoints(result.harvests) },
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
          <p className="label-caps">Recettes</p>
          <dl className="mt-2 space-y-1.5">
            <Line
              label={`${formatPoints(result.honeyQty)} pots × ${formatPoints(
                money(state.honeyPrice),
              )}`}
              value={result.honeyQty * money(state.honeyPrice)}
            />
            <Line
              label={`${formatPoints(result.waxQty)} cires × ${formatPoints(
                money(state.waxPrice),
              )}`}
              value={result.waxQty * money(state.waxPrice)}
            />
            <Line
              label={`${formatPoints(result.jellyQty)} gelées × ${formatPoints(
                money(state.jellyPrice),
              )}`}
              value={result.jellyQty * money(state.jellyPrice)}
            />
          </dl>
          <Total label="Total" value={result.revenue} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Coûts</p>
          <dl className="mt-2 space-y-1.5">
            <Line
              label={`${result.hives} ruche${result.hives > 1 ? "s" : ""} × ${formatPoints(
                money(state.hivePrice),
              )}`}
              value={result.hiveCost}
            />
            <Line label="Enfumoir" value={result.smokerCost} />
          </dl>
          <Total label="Total" value={result.costs} />
        </div>

        <p className="mt-4 border-l-2 border-gold/50 bg-gold/[0.06] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-parchment-dim">
          L’humeur baisse de {APIARY_RULES.harvestMoodDrop} niveaux après chaque récolte ;
          l’entretien aux fleurs est gratuit.
        </p>
      </aside>
    </div>
  );
}
