import { useMemo, useState } from "react";
import {
  COW_SIZES,
  HERD_RULES,
  computeHerdCycle,
  findHerd,
  herdExpectedSize,
  herdMilkPerOperation,
  type HerdRules,
} from "../../lib/seneschal";
import { formatPoints } from "../../lib/format";
import { FieldSelect, MoneyField, Toggle, Line, Total, type Option } from "./controls";

interface HerdRow {
  enabled: boolean;
  purchaseDay: number;
  slaughterAge: number;
  size: number;
}

interface CalcState {
  animals: HerdRow[];
  synchronized: boolean;
  milkEvery: number;
  intelligence: number;
  secondField: boolean;
  feedCorn: boolean;
  animalPrice: string;
  knifePrice: string;
  bucketPrice: string;
  milkPrice: string;
  carcassPrice: string;
  cornPrice: string;
  milkSalary: string;
  slaughterSalary: string;
}

const money = (raw: string): number => {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const days = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;

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
  label: i === 20 ? `${i}  -  rendement doublé` : String(i),
}));

const frequencyOptions = (optimal: number): Option[] => [
  { value: 0, label: "Jamais" },
  ...Array.from({ length: 8 }, (_, i) => {
    const value = i + 1;
    const base = value === 1 ? "Tous les jours" : `Tous les ${value} jours`;
    return { value, label: value === optimal ? `${base}  -  optimal` : base };
  }),
];

const createDefault = (herd: HerdRules): CalcState => {
  const defaultAge = herd.idealAge || 12;
  return {
    animals: Array.from({ length: herd.maxAnimals }, () => ({
      enabled: true,
      purchaseDay: 1,
      slaughterAge: defaultAge,
      size: 2,
    })),
    synchronized: true,
    milkEvery: herd.milk?.every ?? 0,
    intelligence: 20,
    secondField: false,
    feedCorn: false,
    animalPrice: String(herd.price),
    knifePrice: "17",
    bucketPrice: "30",
    milkPrice: "10",
    carcassPrice: "30",
    cornPrice: "2.5",
    milkSalary: "0",
    slaughterSalary: "0",
  };
};

export default function HerdCalculator({ herdId }: { herdId: string }) {
  const herd = findHerd(herdId) ?? HERD_RULES[0];
  const [state, setState] = useState<CalcState>(() => createDefault(herd));

  const patch = <K extends keyof CalcState>(key: K, value: CalcState[K]) =>
    setState((current) => ({ ...current, [key]: value }));

  const patchAnimal = (index: number, changes: Partial<HerdRow>) =>
    setState((current) => ({
      ...current,
      animals: current.animals.map((animal, i) =>
        i === index ? { ...animal, ...changes } : animal,
      ),
    }));

  const patchAllAnimals = (changes: Partial<HerdRow>) =>
    setState((current) => ({
      ...current,
      animals: current.animals.map((animal) => ({ ...animal, ...changes })),
    }));

  const activeCount = state.animals.filter((animal) => animal.enabled).length;
  const lead =
    state.animals.find((animal) => animal.enabled) ??
    state.animals[0] ??
    { enabled: true, purchaseDay: 1, slaughterAge: 12, size: 2 };

  const setCount = (count: number) =>
    setState((current) => ({
      ...current,
      animals: current.animals.map((animal, i) => ({ ...animal, enabled: i < count })),
    }));

  const result = useMemo(() => {
    // Un seul abattage par jour : en mode synchronisé, on décale d'un jour par bête.
    const base =
      state.animals.find((animal) => animal.enabled) ??
      state.animals[0] ??
      { enabled: true, purchaseDay: 1, slaughterAge: 12, size: 2 };
    let rank = 0;
    const animals = state.synchronized
      ? state.animals.map((animal) =>
          animal.enabled
            ? {
                ...animal,
                purchaseDay: base.purchaseDay,
                size: base.size,
                slaughterAge: base.slaughterAge + rank++,
              }
            : animal,
        )
      : state.animals;

    return computeHerdCycle({
      herdId: herd.id,
      animals,
      milkEvery: state.milkEvery,
      intelligence: state.intelligence,
      secondField: state.secondField,
      feedCorn: state.feedCorn,
      animalPrice: money(state.animalPrice),
      knifePrice: money(state.knifePrice),
      bucketPrice: money(state.bucketPrice),
      milkPrice: money(state.milkPrice),
      carcassPrice: money(state.carcassPrice),
      cornPrice: money(state.cornPrice),
      milkSalary: money(state.milkSalary),
      slaughterSalary: money(state.slaughterSalary),
    });
  }, [herd.id, state]);

  const perOperation = herdMilkPerOperation(state.intelligence);
  const productLabel = herd.milk?.label ?? "Production";
  const carcassLabel = herd.id === "moutons" ? "Peaux" : "Carcasses";
  const getsMilk = herd.milk !== null;
  const feedsCorn = herd.feed === "corn";
  const conflicts = result.slaughterConflicts;
  const maxRisk = result.perAnimal.reduce((max, animal) => Math.max(max, animal.cumulativeRisk), 0);
  const animalName =
    herd.id === "cochons" ? "Cochon" : herd.id === "moutons" ? "Mouton" : "Chèvre";

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-5">
          <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
            <legend className="label-caps px-2">Le troupeau</legend>

            <div className="mt-1 space-y-4">
              <div>
                <p
                  id="herd-nombre"
                  className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim"
                >
                  Nombre de bêtes
                </p>
                <div
                  role="group"
                  aria-labelledby="herd-nombre"
                  className="mt-1.5 grid grid-cols-4 gap-1.5"
                >
                  {Array.from({ length: herd.maxAnimals }, (_, i) => i + 1).map((count) => (
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
                id="herd-synchronise"
                checked={state.synchronized}
                onChange={(checked) => patch("synchronized", checked)}
                label="Troupeau synchronisé"
                hint={`Même jour d’achat et corpulence ; abattages sur des jours consécutifs (1 par jour).`}
              />

              {state.synchronized ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <FieldSelect
                    id="herd-sync-achat"
                    label="Jour d’achat"
                    value={lead.purchaseDay}
                    options={dayOptions}
                    onChange={(value) => patchAllAnimals({ purchaseDay: value })}
                  />
                  <FieldSelect
                    id="herd-sync-age"
                    label="Âge du 1er abattage"
                    value={lead.slaughterAge}
                    options={ageOptions}
                    onChange={(value) => patchAllAnimals({ slaughterAge: value })}
                    hint={`Taille attendue de la 1re bête si nourrie chaque jour : ${formatPoints(
                      round1(herdExpectedSize(herd, lead.slaughterAge)),
                    )}`}
                  />
                  <FieldSelect
                    id="herd-sync-taille"
                    label="Corpulence"
                    value={lead.size}
                    options={sizeOptions}
                    onChange={(value) => patchAllAnimals({ size: value })}
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="border-l-2 border-gold/50 bg-gold/[0.06] px-3 py-2 text-[0.6875rem] leading-snug text-parchment-dim">
                    {getsMilk
                      ? "La traite s’applique à toutes les bêtes : décalez les achats et vous perdrez de la production. Le calcul reste une estimation."
                      : "Chaque bête est abattue séparément : décalez les achats pour lisser les abattages. Le calcul reste une estimation."}
                  </p>

                  {conflicts.length > 0 ? (
                    <p
                      role="alert"
                      className="border-l-2 border-blood bg-blood/10 px-3 py-2 text-[0.6875rem] leading-snug text-blood-light"
                    >
                      Un seul abattage par jour :{" "}
                      {conflicts
                        .map(
                          (conflict) =>
                            `J${conflict.day} (${animalName.toLowerCase()}s ${conflict.indices
                              .map((index) => index + 1)
                              .join(", ")})`,
                        )
                        .join(" · ")}
                      . Décalez un âge ou un jour d’achat.
                    </p>
                  ) : null}

                  {state.animals.map((animal, i) => (
                    <div key={i} className="border border-gold/15 bg-ink/40 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          id={`herd-${i}`}
                          type="checkbox"
                          checked={animal.enabled}
                          onChange={(event) => patchAnimal(i, { enabled: event.target.checked })}
                          className="h-3.5 w-3.5 flex-none accent-gold"
                        />
                        <label
                          htmlFor={`herd-${i}`}
                          className="font-display text-xs tracking-[0.08em] text-parchment"
                        >
                          {animalName} {i + 1}
                        </label>
                        <span className="ml-auto text-[0.5625rem] uppercase tracking-[0.1em] text-parchment-dim/60">
                          attendu {formatPoints(round1(herdExpectedSize(herd, animal.slaughterAge)))}
                        </span>
                      </div>

                      {animal.enabled ? (
                        <div className="mt-2.5 grid grid-cols-3 gap-2">
                          <FieldSelect
                            id={`herd-${i}-achat`}
                            label="Jour"
                            value={animal.purchaseDay}
                            options={dayOptions}
                            onChange={(value) => patchAnimal(i, { purchaseDay: value })}
                          />
                          <FieldSelect
                            id={`herd-${i}-age`}
                            label="Âge"
                            value={animal.slaughterAge}
                            options={ageOptions}
                            onChange={(value) => patchAnimal(i, { slaughterAge: value })}
                          />
                          <FieldSelect
                            id={`herd-${i}-taille`}
                            label="Taille"
                            value={animal.size}
                            options={sizeOptions}
                            onChange={(value) => patchAnimal(i, { size: value })}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-gold/10 pt-4">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.14em] text-parchment-dim">
                  Salaires
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {getsMilk ? (
                    <MoneyField
                      id="herd-salaire-production"
                      label={herd.id === "moutons" ? "Tonte (par passage)" : "Traite (par passage)"}
                      value={state.milkSalary}
                      onChange={(value) => patch("milkSalary", value)}
                    />
                  ) : null}
                  <MoneyField
                    id="herd-salaire-abattage"
                    label="Abattage (par bête)"
                    value={state.slaughterSalary}
                    onChange={(value) => patch("slaughterSalary", value)}
                  />
                </div>
                <p className="mt-2 text-[0.625rem] leading-snug text-parchment-dim/70">
                  Laissez à 0 si vous travaillez vous-même.
                </p>
              </div>
            </div>
          </fieldset>

          <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
            <legend className="label-caps px-2">La production</legend>

            <div className="mt-1 space-y-4">
              {getsMilk ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldSelect
                    id="herd-frequence"
                    label={herd.id === "moutons" ? "Fréquence de tonte" : "Fréquence de traite"}
                    value={state.milkEvery}
                    options={frequencyOptions(herd.milk?.every ?? 0)}
                    onChange={(value) => patch("milkEvery", value)}
                  />
                  <FieldSelect
                    id="herd-intelligence"
                    label="Intelligence"
                    value={state.intelligence}
                    options={intelligenceOptions}
                    onChange={(value) => patch("intelligence", value)}
                  />
                </div>
              ) : (
                <p className="text-[0.6875rem] leading-relaxed text-parchment-dim">
                  Les cochons ne produisent ni lait ni laine : seule la carcasse compte.
                </p>
              )}

              {getsMilk ? (
                <p className="text-[0.6875rem] leading-relaxed text-parchment-dim">
                  Rendement :{" "}
                  <span className="font-display text-sm text-gold-light">
                    {formatPoints(perOperation)}
                  </span>{" "}
                  {productLabel.toLowerCase()} par bête et par passage.
                  {state.milkEvery === 0 ? " La production est désactivée." : null}
                </p>
              ) : null}

              <Toggle
                id="herd-second-champ"
                checked={state.secondField}
                onChange={(checked) => patch("secondField", checked)}
                label="Second champ (−15 %)"
                hint={
                  getsMilk
                    ? "Production et carcasses réduites de 15 %."
                    : "Carcasses réduites de 15 %."
                }
              />
            </div>
          </fieldset>

          <fieldset className="card-dark texture-noise min-w-0 p-5 sm:p-6">
            <legend className="label-caps px-2">Le marché</legend>

            <div className="mt-1 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MoneyField
                  id="herd-prix-bete"
                  label={`${animalName} (à l’achat)`}
                  value={state.animalPrice}
                  onChange={(value) => patch("animalPrice", value)}
                />
                <MoneyField
                  id="herd-prix-carcasse"
                  label={
                    herd.id === "moutons" ? "Peau (à l’unité)" : "Demi-quintal (à l’unité)"
                  }
                  value={state.carcassPrice}
                  onChange={(value) => patch("carcassPrice", value)}
                />
                {getsMilk ? (
                  <MoneyField
                    id="herd-prix-produit"
                    label={`${productLabel} (à l’unité)`}
                    value={state.milkPrice}
                    onChange={(value) => patch("milkPrice", value)}
                  />
                ) : null}
                {feedsCorn ? (
                  <MoneyField
                    id="herd-prix-mais"
                    label="Sac de maïs (par jour et par bête)"
                    value={state.cornPrice}
                    onChange={(value) => patch("cornPrice", value)}
                  />
                ) : null}
                <MoneyField
                  id="herd-prix-couteau"
                  label="Couteau"
                  value={state.knifePrice}
                  onChange={(value) => patch("knifePrice", value)}
                />
                {herd.milk?.tool === "seau" ? (
                  <MoneyField
                    id="herd-prix-seau"
                    label="Seau cerclé"
                    value={state.bucketPrice}
                    onChange={(value) => patch("bucketPrice", value)}
                  />
                ) : null}
              </div>

              {feedsCorn ? (
                <Toggle
                  id="herd-nourrir-mais"
                  checked={state.feedCorn}
                  onChange={(checked) => patch("feedCorn", checked)}
                  label="Nourrir au maïs"
                  hint="Coût du maïs ajouté au cycle (1 sac par jour et par bête) ; la croissance reste saisie manuellement."
                />
              ) : null}
            </div>
          </fieldset>
        </div>

        <aside
          className="card-dark texture-noise min-w-0 p-5 sm:p-6"
          aria-labelledby="herd-resultats-titre"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="herd-resultats-titre" className="label-caps">
              Résultats
            </h2>
            <button
              type="button"
              onClick={() => setState(createDefault(herd))}
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
                  Par bête
                </dt>
                <dd className="mt-0.5 font-display text-sm tabular-nums text-parchment">
                  {formatPoints(result.profitPerAnimal)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-5 border-t border-gold/15 pt-4">
            <p className="label-caps">Recettes</p>
            <dl className="mt-2 space-y-1.5">
              {getsMilk ? (
                <Line
                  label={`${formatPoints(result.milkQty)} × ${formatPoints(
                    money(state.milkPrice),
                  )}  -  ${productLabel.toLowerCase()}`}
                  value={result.milkRevenue}
                />
              ) : null}
              <Line
                label={`${formatPoints(result.carcasses)} × ${formatPoints(
                  money(state.carcassPrice),
                )}  -  ${carcassLabel.toLowerCase()}`}
                value={result.carcassRevenue}
              />
            </dl>
            <Total label="Total" value={result.revenue} />
          </div>

          <div className="mt-5 border-t border-gold/15 pt-4">
            <p className="label-caps">Coûts</p>
            <dl className="mt-2 space-y-1.5">
              <Line
                label={`${result.activeAnimals} bête${result.activeAnimals > 1 ? "s" : ""} × ${formatPoints(
                  money(state.animalPrice),
                )}`}
                value={result.animalCost}
              />
              <Line
                label={`Couteaux${herd.milk?.tool === "seau" ? " & seaux" : ""}`}
                value={result.toolCost}
              />
              {feedsCorn ? (
                <Line
                  label={`Maïs${state.feedCorn ? ` × ${formatPoints(money(state.cornPrice))}` : " (herbe)"}`}
                  value={result.feedCost}
                />
              ) : null}
              <Line label="Salaires" value={result.salaries} />
            </dl>
            <Total label="Total" value={result.costs} />
          </div>

          <div className="mt-5 border-t border-gold/15 pt-4">
            <p className="label-caps">Cycle</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              {[
                { label: "Jours", value: result.cycleDays },
                ...(getsMilk
                  ? [
                      {
                        label: herd.id === "moutons" ? "Tontes" : "Traites",
                        value: result.operations,
                      },
                    ]
                  : []),
                { label: carcassLabel, value: result.carcasses },
                { label: "Bêtes", value: result.activeAnimals },
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

          {herd.mortality ? (
            <div className="mt-5 border-t border-gold/15 pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="label-caps">Risque</p>
                <p className="font-display text-sm tabular-nums text-parchment">
                  {formatPoints(round1(maxRisk))} %
                </p>
              </div>
              <p className="mt-1 text-[0.625rem] leading-snug text-parchment-dim/70">
                Risque cumulé de mortalité avant l’abattage, sur la bête la plus exposée.
              </p>
              {maxRisk >= 20 ? (
                <p className="mt-2 border-l-2 border-blood bg-blood/10 px-2.5 py-1.5 text-[0.6875rem] leading-snug text-blood-light">
                  Risque élevé : abattez plus tôt pour limiter les pertes.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 border-l-2 border-gold/50 bg-gold/[0.06] px-2.5 py-1.5 text-[0.6875rem] leading-snug text-parchment-dim">
              Table de mortalité non documentée sur le wiki pour les chèvres.
            </p>
          )}
        </aside>
      </div>

      <section
        className="card-dark texture-noise mt-5 overflow-hidden"
        aria-labelledby="herd-detail-titre"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-gold/15 px-5 py-4">
          <h2 id="herd-detail-titre" className="label-caps">
            Détail par bête
          </h2>
          <p className="text-[0.5625rem] uppercase tracking-[0.12em] text-parchment-dim/70">
            {result.activeAnimals} sur {state.animals.length} bêtes
          </p>
        </div>

        {result.perAnimal.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-parchment-dim">
            Aucune bête dans le troupeau.
          </p>
        ) : (
          <div className="overflow-x-auto px-5 pb-2">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-gold/15">
                  {[
                    "Bête",
                    "Achat",
                    "Abattage",
                    ...(getsMilk
                      ? [herd.id === "moutons" ? "Tontes" : "Traites", productLabel]
                      : []),
                    carcassLabel,
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
                {result.perAnimal.map((animal) => (
                  <tr key={animal.index}>
                    <th
                      scope="row"
                      className="whitespace-nowrap px-3 py-2.5 text-left font-display text-xs tracking-[0.08em] text-parchment first:pl-0 last:pr-0"
                    >
                      {animalName} {animal.index + 1}
                    </th>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                      J{state.animals[animal.index]?.purchaseDay ?? " - "}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                      J{animal.slaughterDay}
                    </td>
                    {getsMilk ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                          {formatPoints(animal.operations)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                          {formatPoints(animal.milkQty)}
                        </td>
                      </>
                    ) : null}
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-parchment-dim first:pl-0 last:pr-0">
                      {formatPoints(animal.carcasses)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2.5 text-sm tabular-nums first:pl-0 last:pr-0 ${
                        animal.cumulativeRisk >= 20 ? "text-blood-light" : "text-parchment-dim"
                      }`}
                    >
                      {herd.mortality ? `${formatPoints(round1(animal.cumulativeRisk))} %` : " - "}
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
