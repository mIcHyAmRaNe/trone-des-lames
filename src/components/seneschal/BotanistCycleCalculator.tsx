import { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import {
  BOTANIST_PLANT_PRODUCE,
  BOTANIST_PLANTS,
  BOTANIST_RECIPES,
  botanistRecipesForPlant,
  computeBotanistCycle,
} from "../../lib/seneschal";
import { formatPoints } from "../../lib/format";
import { MoneyField, Toggle, Line, Total } from "./controls";

const money = (raw: string): number => {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const DEFAULT_PLANT = "guedes";
const DEFAULT_RECIPE =
  botanistRecipesForPlant(DEFAULT_PLANT)[0]?.id ?? BOTANIST_RECIPES[0].id;

const range = (min: number, max: number): string =>
  min === max ? formatPoints(min) : `${formatPoints(min)} – ${formatPoints(max)}`;

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

const selectClassNames = {
  container: () => "mt-1.5 min-w-0",
  control: () => "flex min-w-0 items-center border border-gold/20 bg-ink/60 px-2.5 py-1 transition-colors hover:border-gold/40 focus-within:border-gold",
  valueContainer: () => "flex min-w-0 flex-wrap items-center gap-1",
  singleValue: () => "truncate text-sm text-parchment",
  input: () => "text-sm text-parchment",
  menu: () => "mt-1.5 overflow-hidden border border-gold/25 bg-ink-3 shadow-deep",
  menuList: () => "max-h-72 overflow-y-auto py-1",
  option: (st: any) => `cursor-pointer px-2.5 py-1.5 text-sm transition-colors ${st.isFocused ? "bg-gold/15 text-gold-light" : "text-parchment"}`,
};

const defaultPrices = (recipeId: string, produceKey: string | undefined) => {
  const recipe = BOTANIST_RECIPES.find((r) => r.id === recipeId);
  return recipe
    ? Object.fromEntries(
        recipe.ingredients
          .filter((ingredient) => ingredient.key !== produceKey)
          .map((ingredient) => [ingredient.key, "10"]),
      )
    : {};
};

export default function BotanistCycleCalculator() {
  const [plantKey, setPlantKey] = useState(DEFAULT_PLANT);
  const [recipeId, setRecipeId] = useState(DEFAULT_RECIPE);
  const [potsStr, setPotsStr] = useState("5");
  const [harvestsStr, setHarvestsStr] = useState("5");
  const [potPriceStr, setPotPriceStr] = useState("10");
  const [outputPriceStr, setOutputPriceStr] = useState("2");
  const [growth, setGrowth] = useState(0); // 0 | 10 | 20 | 30
  const [intelligenceStr, setIntelligenceStr] = useState("0");
  const [virtue, setVirtue] = useState(0); // 0 | 1.5 | 9.5
  const [skill, setSkill] = useState(0); // 0 | 10 | 20 | 30
  const [colorantBonus, setColorantBonus] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    defaultPrices(DEFAULT_RECIPE, BOTANIST_PLANT_PRODUCE[DEFAULT_PLANT]),
  );

  const plant = BOTANIST_PLANTS.find((entry) => entry.key === plantKey) ?? BOTANIST_PLANTS[0];
  const recipes = useMemo(() => botanistRecipesForPlant(plant.key), [plant.key]);
  const recipe = recipes.find((entry) => entry.id === recipeId) ?? recipes[0] ?? BOTANIST_RECIPES[0];
  const produceKey = BOTANIST_PLANT_PRODUCE[plant.key];

  // Une recette qui ne consomme pas la culture choisie est remplacée par la première qui le fait.
  useEffect(() => {
    if (!recipes.some((entry) => entry.id === recipeId)) {
      setRecipeId(recipes[0]?.id ?? BOTANIST_RECIPES[0].id);
    }
  }, [recipes, recipeId]);

  // Conserve les prix saisis, initialise les nouvelles matières à 10 écus.
  useEffect(() => {
    setPrices((prev) => {
      const next: Record<string, string> = {};
      for (const ingredient of recipe.ingredients) {
        if (ingredient.key === produceKey) continue;
        next[ingredient.key] = prev[ingredient.key] ?? "10";
      }
      return next;
    });
  }, [recipe.id, produceKey]);

  const result = useMemo(() => {
    const parsedPrices: Record<string, number> = {};
    for (const [key, value] of Object.entries(prices)) parsedPrices[key] = money(value);
    return computeBotanistCycle({
      plantKey: plant.key,
      recipeId: recipe.id,
      pots: money(potsStr) || 1,
      harvestsPerPot: money(harvestsStr) || 1,
      potPrice: money(potPriceStr),
      prices: parsedPrices,
      outputPrice: money(outputPriceStr),
      growthReductionPercent: plant.kind === "epice" ? 0 : growth,
      intelligence: Math.round(money(intelligenceStr)) || 0,
      virtuePercent: virtue,
      skillPercent: skill,
      colorantBonus,
    });
  }, [plant.key, plant.kind, recipe.id, potsStr, harvestsStr, potPriceStr, prices, outputPriceStr, growth, intelligenceStr, virtue, skill, colorantBonus]);

  const otherIngredients = recipe.ingredients.filter((ingredient) => ingredient.key !== produceKey);

  const plantOptions = BOTANIST_PLANTS.map((entry) => ({ value: entry.key, label: entry.label }));
  const selectedPlant = plantOptions.find((option) => option.value === plant.key) ?? plantOptions[0];

  const recipeOptions = recipes.map((entry) => ({
    value: entry.id,
    label: `${entry.name} · ${formatHours(entry.hours)}`,
  }));
  const selectedRecipe = recipeOptions.find((option) => option.value === recipe.id) ?? recipeOptions[0];

  const growthSkill = plant.kind === "fleur" ? "Floriculteur" : "Pépiniériste";
  const growthTarget = plant.kind === "fleur" ? "la pousse des fleurs" : "la pousse des arbres et buissons";

  const reset = () => {
    setPlantKey(DEFAULT_PLANT);
    setRecipeId(DEFAULT_RECIPE);
    setPotsStr("5");
    setHarvestsStr("5");
    setPotPriceStr("10");
    setOutputPriceStr("2");
    setGrowth(0);
    setIntelligenceStr("0");
    setVirtue(0);
    setSkill(0);
    setColorantBonus(false);
    setPrices(defaultPrices(DEFAULT_RECIPE, BOTANIST_PLANT_PRODUCE[DEFAULT_PLANT]));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Inputs */}
      <div className="min-w-0 space-y-5">
        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">La culture</legend>
          <div className="mt-1 space-y-4">
            <div>
              <label htmlFor="cycle-culture" className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                Culture
              </label>
              <Select
                unstyled inputId="cycle-culture"
                options={plantOptions}
                value={selectedPlant}
                onChange={(opt: any) => {
                  const key = opt?.value ?? plant.key;
                  const nextPlant = BOTANIST_PLANTS.find((entry) => entry.key === key) ?? plant;
                  setPlantKey(nextPlant.key);
                  if (nextPlant.kind === "epice") setGrowth(0);
                }}
                isSearchable isClearable={false}
                menuPlacement="auto"
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 70 }) }}
                classNames={selectClassNames}
                placeholder="Choisissez une culture..."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyField id="cycle-pots" label="Pots cultivés" value={potsStr} onChange={setPotsStr} suffix="pots" />
              <MoneyField id="cycle-harvests" label="Cueillettes par pot" value={harvestsStr} onChange={setHarvestsStr} suffix="par pot" />
            </div>

            <p className="text-[0.625rem] leading-snug text-parchment-dim/60">
              Rendement : {plant.yieldMin === plant.yieldMax ? formatPoints(plant.yieldMin) : `${formatPoints(plant.yieldMin)} à ${formatPoints(plant.yieldMax)}`} par pot
              <span className="mx-1.5 text-gold/40">·</span>
              pousse {formatHours(plant.hours)}
              <span className="mx-1.5 text-gold/40">·</span>
              arrosage toutes les {plant.waterEvery} h
            </p>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">La production</legend>
          <div className="mt-1 space-y-4">
            <div>
              <label htmlFor="cycle-recipe" className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                Production
              </label>
              <Select
                unstyled inputId="cycle-recipe"
                options={recipeOptions}
                value={selectedRecipe}
                onChange={(opt: any) => setRecipeId(opt?.value ?? recipe.id)}
                isSearchable isClearable={false}
                menuPlacement="auto"
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                styles={{ menuPortal: (base: any) => ({ ...base, zIndex: 70 }) }}
                classNames={selectClassNames}
                placeholder="Choisissez une production..."
              />
            </div>

            {/* Recipe summary */}
            <div className="rounded bg-ink/40 border border-gold/15 p-3 text-xs text-parchment-dim leading-relaxed">
              <span className="font-display text-sm text-parchment">{recipe.name}</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{result.outputPerBatch} unité{result.outputPerBatch > 1 ? "s" : ""} / lot</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{formatHours(recipe.hours)}</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{recipe.xp} XP</span>
              <span className="mx-2 text-gold/40">·</span>
              <span className="tabular-nums">{recipe.energy} PE</span>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {recipe.ingredients.map((ingredient) => (
                  <span key={ingredient.key} className="tabular-nums">
                    {ingredient.qty} × {ingredient.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Matières premières</legend>
          <div className="mt-1 space-y-3">
            <MoneyField id="cycle-pot-price" label="Prix d’un pot de culture" value={potPriceStr} onChange={setPotPriceStr} />
            {otherIngredients.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {otherIngredients.map((ingredient) => (
                  <MoneyField
                    key={ingredient.key}
                    id={`cycle-mat-${ingredient.key}`}
                    label={`${ingredient.qty} × ${ingredient.label}`}
                    value={prices[ingredient.key] ?? ""}
                    onChange={(value) => setPrices((prev) => ({ ...prev, [ingredient.key]: value }))}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[0.625rem] leading-snug text-parchment-dim/60">
                Aucune matière à acheter : la récolte des pots suffit.
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Prix de vente</legend>
          <div className="mt-1">
            <MoneyField id="cycle-prix-vente" label="Prix par unité (en écus)" value={outputPriceStr} onChange={setOutputPriceStr} />
          </div>
        </fieldset>

        <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
          <legend className="label-caps px-2">Bonus de fabrication</legend>
          <div className="mt-1 space-y-4">
            {plant.kind === "epice" ? (
              <p className="text-[0.625rem] text-parchment-dim">Aucune compétence ne réduit la pousse des épices.</p>
            ) : (
              <div>
                <label className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                  {growthSkill}
                </label>
                <div className="mt-1.5 flex gap-2">
                  {[
                    { value: 0, label: "Aucune" },
                    { value: 10, label: "−10 %" },
                    { value: 20, label: "−20 %" },
                    { value: 30, label: "−30 %" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGrowth(option.value)}
                      className={`flex-1 border py-1.5 text-xs transition-colors ${growth === option.value ? "border-gold bg-gold/15 text-gold" : "border-gold/20 bg-ink/40 text-parchment-dim hover:border-gold/40"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[0.625rem] text-parchment-dim/60">Réduit {growthTarget}.</p>
              </div>
            )}

            <MoneyField id="cycle-intelligence" label="Intelligence (0 – 255)" value={intelligenceStr} onChange={setIntelligenceStr} suffix="pts" />
            <div>
              <label className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                Vertu · Don de soi
              </label>
              <div className="mt-1.5 flex gap-2">
                {[0, 1.5, 9.5].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setVirtue(option)}
                    className={`flex-1 border py-1.5 text-xs transition-colors ${virtue === option ? "border-gold bg-gold/15 text-gold" : "border-gold/20 bg-ink/40 text-parchment-dim hover:border-gold/40"}`}
                  >
                    {option === 0 ? "Aucune" : `${formatPoints(option)} %`}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[0.625rem] text-parchment-dim/60">Intelligence : {formatPoints(Math.round(Math.round(money(intelligenceStr)) || 0) / 255 * 20)} % de réduction du temps.</p>

            {recipe.trim ? (
              <div className="mt-3">
                <label htmlFor="cycle-skill" className="block text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                  Jardinier
                </label>
                <select id="cycle-skill" value={skill} onChange={(e) => setSkill(Number(e.target.value))}
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
              <p className="mt-2 text-[0.625rem] text-parchment-dim">Jardinier ne s’applique pas à cette production.</p>
            )}

            {recipe.ingredients.some((ingredient) => ingredient.key.startsWith("bouquet")) ? (
              <div className="mt-3 border-t border-gold/10 pt-3">
                <Toggle
                  id="cycle-broyeur"
                  checked={colorantBonus}
                  onChange={setColorantBonus}
                  label="Broyeur de couleurs"
                  hint="+1 colorant par lot de fleurs"
                />
              </div>
            ) : null}
          </div>
        </fieldset>
      </div>

      {/* Results */}
      <aside className="card-dark texture-noise min-w-0 p-5 sm:p-6" aria-labelledby="cycle-resultat-titre">
        <div className="flex items-center justify-between gap-3">
          <h2 id="cycle-resultat-titre" className="label-caps">Résultats</h2>
          <button
            type="button"
            onClick={reset}
            className="border border-gold/25 px-2.5 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-parchment-dim transition-colors hover:border-gold/50 hover:text-parchment"
          >
            Réinitialiser
          </button>
        </div>

        <div aria-live="polite" className="mt-4">
          <p className="text-[0.5625rem] uppercase tracking-[0.18em] text-parchment-dim">Bénéfice net</p>
          <p className={`mt-1 font-display text-[2rem] font-bold leading-none tabular-nums sm:text-4xl ${result.profitMax >= 0 ? "text-gold-light" : "text-blood-light"}`}>
            {range(result.profitMin, result.profitMax)}
            <span className="ml-1.5 align-baseline text-sm font-normal tracking-normal text-parchment-dim">écus</span>
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-2">
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">Recettes</dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">{range(result.revenueMin, result.revenueMax)}</dd>
            </div>
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">Récolte</dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">{range(result.harvestMin, result.harvestMax)}</dd>
            </div>
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">Unités produites</dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">{range(result.outputMin, result.outputMax)}</dd>
            </div>
            <div className="border border-gold/15 bg-ink/40 px-2.5 py-2">
              <dt className="text-[0.5rem] uppercase tracking-[0.12em] text-parchment-dim">Par heure (max)</dt>
              <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">{formatPoints(result.profitPerHour)}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Coûts</p>
          <dl className="mt-2 space-y-1.5">
            <Line label={`${result.pots} × ${formatPoints(money(potPriceStr))} — Pots de culture`} value={result.potCost} />
            {otherIngredients.map((ingredient) => (
              <Line
                key={ingredient.key}
                label={`${formatPoints(ingredient.qty * result.batchMax)} × ${formatPoints(money(prices[ingredient.key] ?? ""))} — ${ingredient.label}`}
                value={ingredient.qty * result.batchMax * money(prices[ingredient.key] ?? "")}
              />
            ))}
          </dl>
          <Total label="Total coûts" value={result.potCost + result.otherCost} />
        </div>

        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="label-caps">Le cycle</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">Pousse</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatHours(result.growthHours)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">Fabrication</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatHours(result.craftHours)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">Total</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatHours(result.totalHours)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">Lots</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{range(result.batchMin, result.batchMax)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">XP gagnée</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatPoints(result.xp)}</dd>
            </div>
            <div>
              <dt className="text-[0.5rem] uppercase leading-snug tracking-[0.1em] text-parchment-dim/80">PE dépensée</dt>
              <dd className="font-display text-sm tabular-nums text-parchment">{formatPoints(result.energy)}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-4 text-[0.625rem] leading-snug text-parchment-dim/70">
          Fabrication et matières premières sont calculées sur la récolte maximale ; le bénéfice couvre le rendement minimal et maximal.
        </p>

        {result.profitMin < 0 ? (
          <p className="mt-4 border-l-2 border-blood bg-blood/10 px-2.5 py-1.5 text-[0.6875rem] leading-snug text-blood-light">
            Bénéfice négatif au rendement minimal : ajustez le prix de vente ou réduisez les matières.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
