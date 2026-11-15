import { useMemo, useState, useEffect } from "react";
import Select from "react-select";
import {
  BOTANIST_RECIPES,
  BOTANIST_PLANTS,
  BOTANIST_SKILLS,
  computeBotanistProduction,
  botanistRecipeDuration,
  botanistTimeReduction,
  findBotanistRecipe,
  type BotanistRecipe,
} from "../../lib/seneschal";
import { formatPoints } from "../../lib/format";
import { FieldSelect, MoneyField, Toggle, Line, Total } from "./controls";

const money = (raw: string): number => {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const families = [
  { id: "savoir-faire", label: "Avec savoir-faire" },
  { id: "base", label: "De base" },
  { id: "colorants", label: "Doses de colorant" },
  { id: "teintures-capillaires", label: "Teintures capillaires" },
  { id: "teintures-pileuses", label: "Teintures pileuses" },
];

function recipeOptions() {
  return families.flatMap((f) => {
    const recipes = BOTANIST_RECIPES.filter((r) => r.family === f.id);
    return recipes.map((r) => ({
      value: r.id,
      label: `${r.name} · ${formatDuration(r.hours)}`,
      family: f.label,
    }));
  });
}

function formatDuration(hours: number): string {
  const h = Math.round(hours);
  const m = Math.round((hours - Math.floor(hours)) * 60);
  if (h === 0 && m > 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

function formatBatchDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

export default function BotanistCalculator() {
  const [recipeId, setRecipeId] = useState("dose-blanche");
  const [batchStr, setBatchStr] = useState("1");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [outputPriceStr, setOutputPriceStr] = useState("30");
  const [intelligenceStr, setIntelligenceStr] = useState("0");
  const [virtue, setVirtue] = useState(0); // 0 | 1.5 | 9.5
  const [skill, setSkill] = useState(0); // 0 | 10 | 20 | 30

  const recipe = useMemo(() => findBotanistRecipe(recipeId) ?? BOTANIST_RECIPES[0], [recipeId]);

  // Initialize prices when recipe changes: keep shared keys, set missing to 10
  useEffect(() => {
    const newPrices: Record<string, string> = {};
    for (const ing of recipe.ingredients) {
      newPrices[ing.key] = prices[ing.key] ?? "10";
    }
    setPrices(newPrices);
  }, [recipe.id]);

  const parsedPrices: Record<string, number> = {};
  for (const [k, v] of Object.entries(prices)) {
    parsedPrices[k] = money(v);
  }

  // Compute margin for the selected production
  const resultCorrect = useMemo(() => {
    return computeBotanistProduction({
      recipeId: recipe.id,
      batch: Math.min(99, Math.max(1, Math.round(money(batchStr)) || 1)),
      prices: parsedPrices,
      outputPrice: money(outputPriceStr),
      intelligence: Math.round(money(intelligenceStr)) || 0,
      virtuePercent: virtue,
      skillPercent: skill,
    });
  }, [recipe.id, batchStr, parsedPrices, outputPriceStr, intelligenceStr, virtue, skill]);

  const reduction = botanistTimeReduction(Math.round(money(intelligenceStr)) || 0, virtue, skill);

  const opts = recipeOptions();
  const selectedOption = opts.find((o) => o.value === recipe.id) ?? opts[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Inputs */}
      <div className="min-w-0 space-y-5">
        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">La production</legend>
          <div className="mt-1 space-y-4">
            <div>
              <label htmlFor="bot-prod" className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                Production
              </label>
              <Select
                unstyled inputId="bot-prod"
                options={opts}
                value={selectedOption}
                onChange={(opt: any) => setRecipeId(opt?.value ?? recipe.id)}
                isSearchable isClearable={false}
                menuPlacement="auto"
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 70 }) }}
                classNames={{
                  container: () => "mt-1.5 min-w-0",
                  control: () => "flex min-w-0 items-center border border-gold/20 bg-ink/60 px-2.5 py-1 transition-colors hover:border-gold/40 focus-within:border-gold",
                  valueContainer: () => "flex min-w-0 flex-wrap items-center gap-1",
                  singleValue: () => "truncate text-sm text-parchment",
                  input: () => "text-sm text-parchment",
                  menu: () => "mt-1.5 overflow-hidden border border-gold/25 bg-ink-3 shadow-deep",
                  menuList: () => "max-h-72 overflow-y-auto py-1",
                  option: (st: any) => `cursor-pointer px-2.5 py-1.5 text-sm transition-colors ${st.isFocused ? "bg-gold/15 text-gold-light" : "text-parchment"}`,
                }}
                placeholder="Choisissez une production..."
              />
            </div>

            {/* Recipe summary */}
            <div className="rounded bg-ink/40 border border-gold/15 p-3 text-xs text-parchment-dim leading-relaxed">
              <span className="font-display text-sm text-parchment">{recipe.name}</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{recipe.output} unité{recipe.output > 1 ? "s" : ""}</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{formatBatchDuration(recipe.hours)}</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{recipe.xp} XP</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{recipe.energy} PE</span>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {recipe.ingredients.map((ing) => (
                  <span key={ing.key} className="tabular-nums">
                    {ing.qty} × {ing.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Quantité</legend>
          <div className="mt-1">
            <MoneyField id="batch" label="Nombre de productions" value={batchStr} onChange={setBatchStr} suffix="unités" />
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Matières premières</legend>
          <div className="mt-1 space-y-3">
            {recipe.ingredients.map((ing) => (
              <MoneyField
                key={ing.key}
                id={`mat-${ing.key}`}
                label={`${ing.qty} × ${ing.label}`}
                value={prices[ing.key] ?? ""}
                onChange={(v) => setPrices((prev) => ({ ...prev, [ing.key]: v }))}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Prix de vente</legend>
          <div className="mt-1">
            <MoneyField id="prix-vente" label="Prix par unité (en écus)" value={outputPriceStr} onChange={setOutputPriceStr} />
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Bonus de temps</legend>
          <div className="mt-1 space-y-4">
            <MoneyField id="intelligence" label="Intelligence (0 – 255)" value={intelligenceStr} onChange={setIntelligenceStr} suffix="pts" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVirtue(0)}
                className={`flex-1 border py-1.5 text-xs transition-colors ${virtue === 0 ? "border-gold bg-gold/15 text-gold" : "border-gold/20 bg-ink/40 text-parchment-dim hover:border-gold/40"}`}
              >
                Aucune
              </button>
              <button
                type="button"
                onClick={() => setVirtue(1.5)}
                className={`flex-1 border py-1.5 text-xs transition-colors ${virtue === 1.5 ? "border-gold bg-gold/15 text-gold" : "border-gold/20 bg-ink/40 text-parchment-dim hover:border-gold/40"}`}
              >
                1,5 %
              </button>
              <button
                type="button"
                onClick={() => setVirtue(9.5)}
                className={`flex-1 border py-1.5 text-xs transition-colors ${virtue === 9.5 ? "border-gold bg-gold/15 text-gold" : "border-gold/20 bg-ink/40 text-parchment-dim hover:border-gold/40"}`}
              >
                9,5 %
              </button>
            </div>
            <p className="text-[0.625rem] text-parchment-dim/60">Intelligence : {formatPoints(Math.round(Math.round(money(intelligenceStr)) || 0) / 255 * 20)} % de réduction du temps.</p>

            {recipe.trim ? (
              <div className="mt-3">
                <label htmlFor="skill" className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                  Jardinier
                </label>
                <select id="skill" value={skill} onChange={(e) => setSkill(Number(e.target.value))}
                  className="mt-1.5 w-full border border-gold/20 bg-ink/60 px-2.5 py-1.5 text-sm text-parchment transition-colors hover:border-gold/40 focus:border-gold focus:outline-none"
                >
                  <option value={0}>Aucune</option>
                  <option value={10}>−10 %</option>
                  <option value={20}>−20 %</option>
                  <option value={30}>−30 %</option>
                </select>
                <p className="mt-1 text-[0.625rem] text-parchment-dim/60">La taille des arbres et buissons bénéficie de la réduction.</p>
              </div>
            ) : (
              <p className="mt-2 text-[0.625rem] text-parchment-dim">Aucune compétence ne réduit le temps de cette production.</p>
            )}
          </div>
        </fieldset>
      </div>

      {/* Results */}
      <aside className="card-dark texture-noise min-w-0 p-5 sm:p-6" aria-labelledby="bot-result-titre">
        <div className="flex items-center justify-between gap-3">
          <h2 id="bot-result-titre" className="label-caps">Résultats</h2>
          <button
            type="button"
            onClick={() => { setRecipeId("dose-blanche"); setBatchStr("1"); setOutputPriceStr("30"); setIntelligenceStr("0"); setVirtue(0); setSkill(0); setPrices({}); }}
            className="border border-gold/25 px-2.5 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-parchment-dim transition-colors hover:border-gold/50 hover:text-parchment"
          >
            Réinitialiser
          </button>
        </div>

        <div aria-live="polite" className="mt-4">
          <p className="text-[0.5625rem] uppercase tracking-[0.18em] text-parchment-dim">Marge nette</p>
          <p className={`mt-1 font-display text-[2rem] font-bold leading-none tabular-nums sm:text-4xl ${resultCorrect.profit >= 0 ? "text-gold-light" : "text-blood-light"}`}>
            {formatPoints(resultCorrect.profit)}
            <span className="ml-1.5 align-baseline text-sm font-normal tracking-normal text-parchment-dim">écus</span>
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-2">
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">Par heure</dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">{formatPoints(resultCorrect.profitPerHour)}</dd>
            </div>
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">Par unité</dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">{formatPoints(resultCorrect.profitPerUnit)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Recettes</p>
          <dl className="mt-2 space-y-1.5">
            <Line label={`${formatPoints(resultCorrect.outputQty)} × ${formatPoints(money(outputPriceStr))}`} value={resultCorrect.revenue} />
          </dl>
          <Total label="Total recettes" value={resultCorrect.revenue} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Coûts</p>
          <dl className="mt-2 space-y-1.5">
            {resultCorrect.lines.map((line) => (
              <Line key={line.key} label={`${formatPoints(line.qty)} × ${formatPoints(line.unitPrice)}  -  ${line.label}`} value={line.cost} />
            ))}
          </dl>
          <Total label="Total coûts" value={resultCorrect.ingredientCost} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Cycle</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">Durée / lot</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatBatchDuration(resultCorrect.hoursPerBatch)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">Durée totale</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatBatchDuration(resultCorrect.totalHours)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">Réduction</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatPoints(Math.round(reduction * 100) / 100)} %</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">XP gagnée</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatPoints(resultCorrect.xp)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">PE dépensée</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatPoints(resultCorrect.energy)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">Unités sorties</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatPoints(resultCorrect.outputQty)}</dd>
            </div>
          </dl>
        </div>

        {resultCorrect.profit < 0 ? (
          <p className="mt-4 border-l-2 border-blood bg-blood/10 px-2.5 py-1.5 text-[0.6875rem] leading-snug text-blood-light">
            Marge négative : ajustez le prix de vente ou réduisez le coût des matières.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
