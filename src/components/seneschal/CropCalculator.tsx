import { useMemo, useState } from "react";
import {
  CROP_FIELDS,
  computeCropCycle,
  findCrop,
  type CropField,
} from "../../lib/seneschal";
import { formatPoints } from "../../lib/format";
import { FieldSelect, MoneyField, Toggle, Line, Total, type Option } from "./controls";

interface CalcState {
  secondField: boolean;
  force: number;
  intelligence: number;
  conservation: boolean;
  ankou: boolean;
  bonSens: boolean;
  soc: boolean;
  cultivatorPercent: number;
  seedPrice: string;
  producePrice: string;
  salary: string;
}

/** Prix minimums du wiki, semence / récolte. */
const BASE_PRICES: Record<string, [number, number]> = {
  ble: [10, 10],
  orge: [8, 8],
  mais: [2.5, 2],
  legumes: [0, 5],
  oliviers: [0, 10],
  vignes: [0, 5],
  houblon: [10, 10],
};

const money = (raw: string): number => {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const statOptions: Option[] = Array.from({ length: 21 }, (_, i) => ({
  value: i,
  label: i === 20 ? `${i} — maximum` : String(i),
}));

const cultivatorOptions: Option[] = [0, 5, 10, 15, 20, 25].map((value) => ({
  value,
  label: value === 0 ? "Aucun" : `${value} %`,
}));

const createDefault = (field: CropField): CalcState => {
  const [seed, produce] = BASE_PRICES[field.id] ?? [0, 0];
  return {
    secondField: false,
    force: 20,
    intelligence: 20,
    conservation: false,
    ankou: false,
    bonSens: false,
    soc: false,
    cultivatorPercent: 0,
    seedPrice: String(seed),
    producePrice: String(produce),
    salary: "0",
  };
};

export default function CropCalculator({ cropId }: { cropId: string }) {
  const field = findCrop(cropId) ?? CROP_FIELDS[0];
  const [state, setState] = useState<CalcState>(() => createDefault(field));

  const patch = <K extends keyof CalcState>(key: K, value: CalcState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const result = useMemo(
    () =>
      computeCropCycle({
        cropId: field.id,
        secondField: state.secondField,
        force: state.force,
        intelligence: state.intelligence,
        conservation: state.conservation,
        ankou: state.ankou,
        bonSens: state.bonSens,
        soc: state.soc,
        cultivatorPercent: state.cultivatorPercent,
        seedPrice: money(state.seedPrice),
        producePrice: money(state.producePrice),
        salary: money(state.salary),
      }),
    [field.id, state],
  );

  const qualityMax = Math.min(
    100,
    50 + Object.values(field.quality).reduce((sum, value) => sum + value, 0),
  );
  const quality = field.quality;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-5">
        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Le champ</legend>

          <div className="mt-1 space-y-4">
            {quality.force > 0 || quality.intelligence > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {quality.force > 0 ? (
                  <FieldSelect
                    id="crop-force"
                    label="Force"
                    value={state.force}
                    options={statOptions}
                    onChange={(value) => patch("force", value)}
                    hint={`Jusqu’à +${formatPoints(quality.force)} % de qualité.`}
                  />
                ) : null}
                {quality.intelligence > 0 ? (
                  <FieldSelect
                    id="crop-intelligence"
                    label="Intelligence"
                    value={state.intelligence}
                    options={statOptions}
                    onChange={(value) => patch("intelligence", value)}
                    hint={`Jusqu’à +${formatPoints(quality.intelligence)} % de qualité.`}
                  />
                ) : null}
              </div>
            ) : null}

            {quality.conservation > 0 || quality.ankou > 0 || quality.bonSens > 0 || quality.soc > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {quality.conservation > 0 ? (
                  <Toggle
                    id="crop-conservation"
                    checked={state.conservation}
                    onChange={(checked) => patch("conservation", checked)}
                    label={`Conservation (+${formatPoints(quality.conservation)} %)`}
                    hint="Vertu de prédilection du champ."
                  />
                ) : null}
                {quality.ankou > 0 ? (
                  <Toggle
                    id="crop-ankou"
                    checked={state.ankou}
                    onChange={(checked) => patch("ankou", checked)}
                    label={`Faux de l’Ankou (+${formatPoints(quality.ankou)} %)`}
                  />
                ) : null}
                {quality.bonSens > 0 ? (
                  <Toggle
                    id="crop-bon-sens"
                    checked={state.bonSens}
                    onChange={(checked) => patch("bonSens", checked)}
                    label={`Bon sens paysan (+${formatPoints(quality.bonSens)} %)`}
                  />
                ) : null}
                {quality.soc > 0 ? (
                  <Toggle
                    id="crop-soc"
                    checked={state.soc}
                    onChange={(checked) => patch("soc", checked)}
                    label={`Soc (+${formatPoints(quality.soc)} %)`}
                    hint="La charrue améliore la qualité du champ."
                  />
                ) : null}
              </div>
            ) : null}

            {quality.cultivator > 0 ? (
              <FieldSelect
                id="crop-cultivateur"
                label="Cultivateur"
                value={state.cultivatorPercent}
                options={cultivatorOptions}
                onChange={(value) => patch("cultivatorPercent", value)}
                hint={`Jusqu’à +${formatPoints(quality.cultivator)} % de qualité.`}
              />
            ) : null}

            <Toggle
              id="crop-second-champ"
              checked={state.secondField}
              onChange={(checked) => patch("secondField", checked)}
              label="Second champ"
              hint="La récolte du champ secondaire suit son propre rendement, réduit selon le wiki."
            />

            <p className="text-[0.6875rem] leading-relaxed text-parchment-dim">
              Qualité maximale de ce champ :{" "}
              <span className="font-display text-sm text-gold-light">
                {formatPoints(qualityMax)} %
              </span>
              . La récolte part de 50 % et double à 100 %.
            </p>

            <div className="border-t border-gold/10 pt-4">
              <MoneyField
                id="crop-salaire"
                label="Salaire par session de travail"
                value={state.salary}
                onChange={(value) => patch("salary", value)}
              />
              <p className="mt-2 text-[0.625rem] leading-snug text-parchment-dim/70">
                Laissez à 0 si vous travaillez vous-même. Un cycle compte{" "}
                {field.workSessions} session{field.workSessions > 1 ? "s" : ""} de{" "}
                {field.hoursPerSession} h.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Le marché</legend>

          <div className="mt-1 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {field.seed ? (
                <MoneyField
                  id="crop-prix-semence"
                  label={`Semence — ${field.seed}`}
                  value={state.seedPrice}
                  onChange={(value) => patch("seedPrice", value)}
                />
              ) : null}
              <MoneyField
                id="crop-prix-produit"
                label={`${field.produce} (à la vente)`}
                value={state.producePrice}
                onChange={(value) => patch("producePrice", value)}
              />
            </div>
          </div>
        </fieldset>
      </div>

      <aside
        className="card-dark texture-noise min-w-0 p-5 sm:p-6"
        aria-labelledby="crop-resultats-titre"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="crop-resultats-titre" className="label-caps">
            Résultats
          </h2>
          <button
            type="button"
            onClick={() => setState(createDefault(field))}
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
                Qualité du champ
              </dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                {formatPoints(round1(result.quality))} %
              </dd>
            </div>
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">
                Récolte attendue
              </dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                {formatPoints(result.yieldQty)}{" "}
                <span className="text-[0.625rem] font-normal text-parchment-dim">
                  {field.produce.toLowerCase()}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Recettes</p>
          <dl className="mt-2 space-y-1.5">
            <Line
              label={`${formatPoints(result.yieldQty)} × ${formatPoints(
                money(state.producePrice),
              )} — ${field.produce.toLowerCase()}`}
              value={result.revenue}
            />
          </dl>
          <Total label="Total" value={result.revenue} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Coûts</p>
          <dl className="mt-2 space-y-1.5">
            {field.seed ? (
              <Line
                label={`Semence × ${formatPoints(money(state.seedPrice))}`}
                value={result.seedCost}
              />
            ) : (
              <Line label="Semence — aucun semis" value={0} />
            )}
            <Line
              label={`${field.workSessions} session${field.workSessions > 1 ? "s" : ""} × ${formatPoints(
                money(state.salary),
              )}`}
              value={result.salaries}
            />
          </dl>
          <Total label="Total" value={result.costs} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Cycle</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            {[
              { label: "Jours", value: `${field.cycleDays}` },
              { label: "Sessions", value: `${field.workSessions}` },
              { label: "Heures", value: `${formatPoints(result.hours)} h` },
              { label: "Énergie", value: `${formatPoints(result.energy)} PE` },
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

        {field.fixedYield !== undefined || field.note ? (
          <p className="mt-4 border-l-2 border-gold/50 bg-gold/[0.06] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-parchment-dim">
            {field.note ??
              `Récolte fixe de ${formatPoints(field.fixedYield ?? 0)} unités par cycle, quelle que soit la qualité.`}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
