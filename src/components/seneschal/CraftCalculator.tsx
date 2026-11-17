import { useMemo, useState } from "react";
import Select from "react-select";
import {
  computeCraftProduction,
  craftRecipeOutput,
  craftRecipesByTier,
  parseCraftInput,
  type CraftShop,
} from "../../lib/seneschal";
import { formatPoints } from "../../lib/format";
import { MoneyField, Line, Total } from "./controls";
import SelectField from "../ui/Select";

const money = (raw: string): number => {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const inputId = (label: string): string =>
  `mat-${label.normalize("NFD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`;

const formatDuration = (hours: number): string => {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
};

const selectClassNames = {
  container: () => "mt-1.5 min-w-0",
  control: () =>
    "flex min-w-0 items-center border border-gold/20 bg-ink/60 px-2.5 py-1 transition-colors hover:border-gold/40 focus-within:border-gold",
  valueContainer: () => "flex min-w-0 flex-wrap items-center gap-1",
  singleValue: () => "truncate text-sm text-parchment",
  input: () => "text-sm text-parchment",
  menu: () => "mt-1.5 overflow-hidden border border-gold/25 bg-ink-3 shadow-deep",
  menuList: () => "max-h-72 overflow-y-auto py-1",
  groupHeading: () => "px-2.5 py-1 text-[0.5rem] uppercase tracking-[0.14em] text-gold/60",
  option: (state: any) =>
    `cursor-pointer px-2.5 py-1.5 text-sm transition-colors ${
      state.isFocused ? "bg-gold/15 text-gold-light" : "text-parchment"
    }`,
};

export default function CraftCalculator({ craft }: { craft: CraftShop }) {
  const [recipeName, setRecipeName] = useState(craft.recipes[0].name);
  const [batchStr, setBatchStr] = useState("1");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [outputPriceStr, setOutputPriceStr] = useState("0");
  const [intelligenceStr, setIntelligenceStr] = useState("0");
  const [virtue, setVirtue] = useState(0);
  const [skill, setSkill] = useState(0);

  const recipe = craft.recipes.find((entry) => entry.name === recipeName) ?? craft.recipes[0];
  const materials = recipe.inputs.map(parseCraftInput);
  const unitPrices = useMemo(() => {
    const parsed: Record<string, number> = {};
    for (const [label, value] of Object.entries(prices)) parsed[label] = money(value);
    return parsed;
  }, [prices]);

  const result = useMemo(
    () =>
      computeCraftProduction({
        craftId: craft.id,
        recipeName: recipe.name,
        batch: money(batchStr) || 1,
        prices: unitPrices,
        outputPrice: money(outputPriceStr),
        intelligence: money(intelligenceStr),
        virtuePercent: virtue,
        skillPercent: skill,
      }),
    [craft.id, recipe.name, batchStr, unitPrices, outputPriceStr, intelligenceStr, virtue, skill],
  );

  const groups = craftRecipesByTier(craft).map((group) => ({
    label: group.label,
    options: group.recipes.map((entry) => ({
      value: entry.name,
      label: `${entry.name} · ${formatDuration(entry.hours)}`,
    })),
  }));
  const selectedOption =
    groups.flatMap((group) => group.options).find((option) => option.value === recipe.name) ??
    null;

  const reset = () => {
    setRecipeName(craft.recipes[0].name);
    setBatchStr("1");
    setPrices({});
    setOutputPriceStr("0");
    setIntelligenceStr("0");
    setVirtue(0);
    setSkill(0);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-5">
        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">La production</legend>
          <div className="mt-1 space-y-4">
            <div>
              <label
                htmlFor="craft-prod"
                className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
              >
                Recette
              </label>
              <Select
                unstyled
                inputId="craft-prod"
                options={groups}
                value={selectedOption}
                onChange={(option: any) => setRecipeName(option?.value ?? recipe.name)}
                isSearchable
                isClearable={false}
                menuPlacement="auto"
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 70 }) }}
                classNames={selectClassNames}
                placeholder="Choisissez une recette..."
              />
            </div>

            <div className="rounded border border-gold/15 bg-ink/40 p-3 text-xs leading-relaxed text-parchment-dim">
              <span className="font-display text-sm text-parchment">{recipe.name}</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">
                {craftRecipeOutput(recipe)} unité{craftRecipeOutput(recipe) > 1 ? "s" : ""}
              </span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{formatDuration(recipe.hours)}</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{recipe.energy} PE</span>
              {recipe.note ? (
                <p className="mt-1 text-[0.625rem] leading-snug text-parchment-dim/70">
                  {recipe.note}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Quantité</legend>
          <div className="mt-1">
            <MoneyField
              id="batch"
              label="Nombre de fournées"
              value={batchStr}
              onChange={setBatchStr}
              suffix="lots"
            />
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Matières premières</legend>
          <p className="mb-3 text-[0.625rem] leading-snug text-parchment-dim/70">
            Prix d’achat à l’unité. Laissez 0 pour ignorer une matière.
          </p>
          <div className="mt-1 space-y-3">
            {materials.map((material) => (
              <MoneyField
                key={material.label}
                id={inputId(material.label)}
                label={`${material.qty} × ${material.label}`}
                value={prices[material.label] ?? ""}
                onChange={(value) =>
                  setPrices((previous) => ({ ...previous, [material.label]: value }))
                }
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Prix de vente</legend>
          <div className="mt-1">
            <MoneyField
              id="prix-vente"
              label="Prix par unité produite (en écus)"
              value={outputPriceStr}
              onChange={setOutputPriceStr}
            />
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Bonus de temps</legend>
          <div className="mt-1 space-y-4">
            <p className="border-l-2 border-gold/30 pl-2 text-[0.625rem] leading-snug text-parchment-dim/80">
              Bonus du métier : {craft.bonus}
            </p>
            <MoneyField
              id="intelligence"
              label="Intelligence (0 – 255)"
              value={intelligenceStr}
              onChange={setIntelligenceStr}
              suffix="pts"
            />
            <div>
              <p className="mb-1.5 text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                Don de soi
              </p>
              <div className="flex gap-2">
                {[0, 1.5, 9.5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVirtue(value)}
                    className={`flex-1 border py-1.5 text-xs transition-colors ${
                      virtue === value
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-gold/20 bg-ink/40 text-parchment-dim hover:border-gold/40"
                    }`}
                  >
                    {value === 0 ? "Aucune" : `${formatPoints(value)} %`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="skill"
                className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
              >
                Compétence d’atelier
              </label>
              <SelectField
                inputId="skill"
                options={[
                  { value: "0", label: "Aucune" },
                  { value: "10", label: "−10 %" },
                  { value: "20", label: "−20 %" },
                  { value: "25", label: "−25 %" },
                  { value: "50", label: "−50 %" },
                ]}
                value={String(skill)}
                onChange={(value) => setSkill(Number(value))}
                ariaLabel="Compétence d’atelier"
                placeholder="Aucune"
                size="sm"
                className="mt-1.5 w-full"
              />
            </div>
            <p className="text-[0.625rem] leading-snug text-parchment-dim/60">
              Intelligence et vertu réduisent la durée de 0 à 20 % et de 0 à 9,5 %. La compétence
              dépend du métier (Pierre à aiguiser, Pétrissage musclé, Spécialités régionales…).
            </p>
          </div>
        </fieldset>
      </div>

      <aside className="card-dark texture-noise min-w-0 p-5 sm:p-6" aria-labelledby="craft-resultat">
        <div className="flex items-center justify-between gap-3">
          <h2 id="craft-resultat" className="label-caps">
            Résultats
          </h2>
          <button
            type="button"
            onClick={reset}
            className="border border-gold/25 px-2.5 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-parchment-dim transition-colors hover:border-gold/50 hover:text-parchment"
          >
            Réinitialiser
          </button>
        </div>

        <div aria-live="polite" className="mt-4">
          <p className="text-[0.5625rem] uppercase tracking-[0.18em] text-parchment-dim">
            Marge nette
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
                Par heure
              </dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                {formatPoints(result.profitPerHour)}
              </dd>
            </div>
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">
                Par unité
              </dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                {formatPoints(result.profitPerUnit)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Recettes</p>
          <dl className="mt-2 space-y-1.5">
            <Line
              label={`${formatPoints(result.outputQty)} × ${formatPoints(money(outputPriceStr))}`}
              value={result.revenue}
            />
          </dl>
          <Total label="Total recettes" value={result.revenue} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Dépenses</p>
          <dl className="mt-2 space-y-1.5">
            {result.lines.map((line) => (
              <Line
                key={line.label}
                label={`${formatPoints(line.qty)} × ${formatPoints(line.unitPrice)}  -  ${line.label}`}
                value={line.cost}
              />
            ))}
          </dl>
          <Total label="Total matières" value={result.ingredientCost} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Cycle</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">
                Durée / fournée
              </dt>
              <dd className="font-display text-sm tabular-nums text-parchment">
                {formatDuration(result.hoursPerBatch)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">
                Durée totale
              </dt>
              <dd className="font-display text-sm tabular-nums text-parchment">
                {formatDuration(result.totalHours)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">
                Réduction
              </dt>
              <dd className="font-display text-sm tabular-nums text-parchment">
                {formatPoints(Math.round(result.reduction * 1000) / 10)} %
              </dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">
                Unités sorties
              </dt>
              <dd className="font-display text-sm tabular-nums text-parchment">
                {formatPoints(result.outputQty)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">
                PE dépensée
              </dt>
              <dd className="font-display text-sm tabular-nums text-parchment">
                {formatPoints(result.energy)}
              </dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">
                Coût / unité
              </dt>
              <dd className="font-display text-sm tabular-nums text-parchment">
                {formatPoints(result.costPerUnit)}
              </dd>
            </div>
          </dl>
        </div>

        {result.profit < 0 ? (
          <p className="mt-4 border-l-2 border-blood bg-blood/10 px-2.5 py-1.5 text-[0.6875rem] leading-snug text-blood-light">
            Marge négative : le prix de vente ne couvre pas les matières premières.
          </p>
        ) : null}

        <p className="mt-4 text-[0.625rem] leading-snug text-parchment-dim/60">
          Estimations hors coût du temps et de l’énergie. Source : wiki Renaissance Kingdoms,
          relevé d’octobre 2026.
        </p>
      </aside>
    </div>
  );
}
