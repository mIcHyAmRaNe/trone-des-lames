import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Select from "react-select";
import { dotStyles, selectClassNames } from "./selectTheme";
import {
  type Avatar,
  type Catalog,
  type EquipEntry,
  type Loadout,
  type Sexe,
  MULTI_SLOTS,
  SECTIONS,
  SEXE_LABEL,
  countEquipped,
  entryFrom,
  indexBySlot,
  itemHaystack,
  itemLabel,
  loadCatalog,
  multiSlotsOf,
  orphanSlots,
  removeEntry,
  shadeColor,
  slotLabel,
  toLoadout,
  upsert,
} from "../../lib/wardrobe";
import ItemPicker from "./ItemPicker";
import CatalogInfo from "./CatalogInfo";

declare global {
  interface Window {
    RAR?: { Midas: any };
  }
}

// Les calques passent par le proxy du site, pas par le CDN du jeu : un asset
// manquant renverrait un 404 sans en-tête CORS (donc une « erreur CORS » dans
// Chrome), alors que /api/calque renvoie un pixel transparent à la place.
const CALQUE_ROOT = "/api/calque/";
const OUTFITS_KEY = "tdl.garde-robe.tenues";
const SEEN_KEY = "tdl.garde-robe.personnages";

type Status = "idle" | "logging-in" | "ready" | "error";
/** Aperçu au survol : jamais engagé avant le clic. */
type Hover = { slot: string; id: string; declinaison: number } | null;

interface SectionDef {
  title: string;
  slots: string[];
  hidden?: boolean;
}

/**
 * Familles d'onglets : les 16 sections de SECTIONS atterrissent chacune dans
 * exactement un onglet, y compris les trois marquées `hidden` (Mains,
 * Familiers, Outils) — désormais toujours visibles dans leur onglet. L'onglet
 * par défaut est « Habits », celui qui sert le plus.
 */
const TAB_DEFS: { id: string; label: string; sectionTitles: string[] }[] = [
  {
    id: "corps",
    label: "Corps",
    sectionTitles: ["IX · Visage", "II · Corps"],
  },
  {
    id: "accessoires",
    label: "Armes et Accessoires",
    sectionTitles: [
      "I · Chapeaux & Casques",
      "IV · Chaussures & Sous-Vêtements",
      "V · Bijoux",
      "XIII · Gants, Ceinture & Cou",
      "VIII · Armes",
      "XV · Boucliers",
      "VI · Mains",
    ],
  },
  {
    id: "habits",
    label: "Habits",
    sectionTitles: [
      "III · Tabliers & Gilets",
      "IV · Braies & Jupes",
      "XI · Bustiers & Chemises",
      "X · Capes & Mantels",
      "XII · Panoplies",
    ],
  },
  { id: "familiers",
    label: "Familiers & outils",
    sectionTitles: ["VII · Familiers", "XVI · Outils"],
  },
  { id: "decors", label: "Décors", sectionTitles: ["XIV · Cadres & Fonds"] },
];
const OTHERS_TITLE = "Autres emplacements";
// Filet de sécurité : si un titre de SECTIONS dérive, la section ne doit pas
// disparaître — elle rejoint l'onglet « Autres ».
const UNCLAIMED_TITLES = SECTIONS.filter(
  (s) => !TAB_DEFS.some((t) => t.sectionTitles.includes(s.title)),
).map((s) => s.title);

interface ShadeOpt {
  value: number;
  label: string;
  color: string;
}

const shadeStyles = dotStyles<ShadeOpt>((d) => d.color);

const fieldCls =
  "w-full border border-gold/20 bg-ink/60 px-3 py-2 text-sm text-parchment transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold";

const ghostSm =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 border border-gold/45 px-2.5 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gold-light transition-colors hover:border-gold hover:bg-gold/10";

const tabBaseCls =
  "flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap border px-3 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] transition-colors";

export default function Wardrobe() {
  const [status, setStatus] = useState<Status>("idle");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Chargement du catalogue…");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loadout, setLoadout] = useState<Loadout>({});
  const [hover, setHover] = useState<Hover>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("habits");
  const [outfits, setOutfits] = useState<Record<string, Loadout>>({});
  const [outfitName, setOutfitName] = useState("");
  const [who, setWho] = useState("");
  const [seen, setSeen] = useState<string[]>([]);
  const [engineReady, setEngineReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCatalog()
      .then((c) => {
        setCatalog(c);
        setMessage("Connectez-vous pour charger la fiche de votre personnage.");
      })
      .catch((e) => {
        const m = String((e as Error).message ?? e);
        setCatalogError(m);
        setMessage(m);
      });
  }, []);

  // midas.js est un script classique chargé par la page ; à l'hydratation de
  // l'îlot il n'a pas forcément déjà été exécuté — sondage court.
  useEffect(() => {
    if (window.RAR?.Midas) {
      setEngineReady(true);
      return;
    }
    const t = setInterval(() => {
      if (window.RAR?.Midas) {
        setEngineReady(true);
        clearInterval(t);
      }
    }, 50);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      setOutfits(JSON.parse(localStorage.getItem(OUTFITS_KEY) ?? "{}"));
      setSeen(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
    } catch {
      /* données corrompues — on repart à vide */
    }
  }, []);

  const sexe: Sexe = avatar?.sexe === "F" ? "F" : "M";
  const items = catalog?.sexes[sexe] ?? [];
  const index = useMemo(() => indexBySlot(items), [items]);

  // Slots qui se cumulent : tout ce que ce personnage porte déjà en plusieurs
  // exemplaires, plus l'ensemble explicite connu. Sans cela, un personnage à
  // cinq familiers en perdrait quatre silencieusement au chargement.
  const multi = useMemo(
    () => new Set([...multiSlotsOf(avatar?.equipement), ...MULTI_SLOTS]),
    [avatar],
  );

  // L'aperçu est lissé : le survol rapide ne repeint pas à chaque pixel.
  const deferredHover = useDeferredValue(hover);

  // L'aperçu s'applique par-dessus la tenue engagée et est jeté au départ du
  // pointeur : explorer la liste ne modifie jamais rien.
  const shown = useMemo<Loadout>(() => {
    if (!deferredHover) return loadout;
    const item = (index.get(deferredHover.slot) ?? []).find((i) => i.id === deferredHover.id);
    if (!item) return loadout;
    return upsert(loadout, deferredHover.slot, entryFrom(item, deferredHover.declinaison));
  }, [loadout, deferredHover, index]);

  // Rendu DÉCLARATIF. Une version impérative (peindre depuis le gestionnaire
  // de connexion) s'exécutait avant que la branche montrant la scène n'existe :
  // stageRef.current valait null, le dessin était sauté, et l'avatar
  // n'apparaissait qu'après le premier changement d'objet.
  useEffect(() => {
    if (!avatar || !engineReady) return;
    const Midas = window.RAR?.Midas;
    const stage = stageRef.current;
    if (!Midas || !stage) return;
    Midas.racine = CALQUE_ROOT;
    stage.replaceChildren();
    const equipement = Object.values(shown).flat();
    // Seul `equipement` est réécrit — codeVisage (corps, visage, cheveux) est
    // celui du personnage et reste intact. C'est tout le truc.
    stage.appendChild(
      Midas.genereApercuDepuisJSON(JSON.stringify({ ...avatar, equipement }), false),
    );
  }, [avatar, shown, engineReady]);

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matches = useCallback(
    (slot: string) => {
      const all = index.get(slot) ?? [];
      if (!needle) return all;
      return all.filter((it) => itemHaystack(it).includes(needle));
    },
    [index, needle],
  );

  // Toutes les sections à montrer, sections orphelines comprises.
  const allSections = useMemo<SectionDef[]>(() => {
    const orphans = orphanSlots(index.keys());
    return orphans.length ? [...SECTIONS, { title: OTHERS_TITLE, slots: orphans }] : SECTIONS;
  }, [index]);

  // Onglets : les familles fixes, plus un onglet « Autres » si des sections
  // orphelines ou non réclamées existent.
  const tabs = useMemo(() => {
    const orphans = orphanSlots(index.keys());
    const extra = [...UNCLAIMED_TITLES];
    if (orphans.length) extra.push(OTHERS_TITLE);
    return extra.length
      ? [...TAB_DEFS, { id: "autres", label: "Autres", sectionTitles: extra }]
      : TAB_DEFS;
  }, [index]);
  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : "habits";

  const sectionsOfTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return [];
      const titles = new Set(tab.sectionTitles);
      return allSections.filter(
        (s) => titles.has(s.title) && s.slots.some((slot) => matches(slot).length > 0),
      );
    },
    [tabs, allSections, matches],
  );

  const wornInTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return 0;
    const titles = new Set(tab.sectionTitles);
    return allSections
      .filter((s) => titles.has(s.title))
      .reduce((n, s) => n + s.slots.reduce((m, slot) => m + (loadout[slot]?.length ?? 0), 0), 0);
  };

  const resultsInTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return 0;
    const titles = new Set(tab.sectionTitles);
    return allSections
      .filter((s) => titles.has(s.title))
      .reduce((n, s) => n + s.slots.reduce((m, slot) => m + matches(slot).length, 0), 0);
  };

  // Recherche globale : quand un filtre est actif, on balaie toutes les
  // familles — l'utilisateur cherche un objet par son nom, pas par le tiroir
  // où le jeu le range ; rien n'est jamais caché par l'onglet affiché.
  const searchSections = needle
    ? allSections.filter((s) => s.slots.some((slot) => matches(slot).length > 0))
    : [];
  const totalResults = searchSections.reduce(
    (n, s) => n + s.slots.reduce((m, slot) => m + matches(slot).length, 0),
    0,
  );

  function entryFor(slot: string, id: string, declinaison?: number): EquipEntry | null {
    const item = (index.get(slot) ?? []).find((it) => it.id === id);
    if (!item) return null;
    // Re-choisir le même objet garde sa teinte ; sinon première variante.
    const worn = loadout[slot]?.find((e) => e.idItem === id);
    const d = declinaison ?? (item.id === worn?.idItem ? worn.declinaison : item.declinaisons[0]) ?? 0;
    return entryFrom(item, d);
  }

  function commit(slot: string, id: string | null, declinaison?: number) {
    setHover(null);
    if (!id) {
      // Retirer la dernière ligne d'un sélecteur vide ne touche à rien d'autre
      // dans un slot cumulable ; le retrait par idItem suffit.
      const only = loadout[slot]?.length === 1 ? loadout[slot][0].idItem : undefined;
      if (only) setLoadout((l) => removeEntry(l, slot, only));
      return;
    }
    const entry = entryFor(slot, id, declinaison);
    if (!entry) return;
    // Slot à capacité un : poser autre chose remplace ce qui s'y trouvait.
    if (!multi.has(slot)) {
      const list = (loadout[slot] ?? []).filter((e) => e.idItem !== id);
      setLoadout((l) => upsert({ ...l, [slot]: list }, slot, entry));
      return;
    }
    setLoadout((l) => upsert(l, slot, entry));
  }

  function commitMulti(slot: string, id: string, declinaison?: number) {
    setHover(null);
    const entry = entryFor(slot, id, declinaison);
    if (!entry) return;
    // Slot cumulable : re-choisir (changement de teinte) ou ajouter — jamais
    // de contrôle supplémentaire, les puces du multi portent tout.
    setLoadout((l) => upsert(l, slot, entry));
  }

  function syncMulti(slot: string, ids: string[]) {
    setHover(null);
    setLoadout((l) => {
      const prev = l[slot] ?? [];
      const keep = prev.filter((e) => ids.includes(e.idItem));
      const have = new Set(keep.map((e) => e.idItem));
      const additions: EquipEntry[] = [];
      for (const id of ids) {
        if (have.has(id)) continue;
        const entry = entryFor(slot, id);
        if (entry) {
          additions.push(entry);
          have.add(id);
        }
      }
      const list = [...keep, ...additions];
      if (!list.length) {
        const next = { ...l };
        delete next[slot];
        return next;
      }
      return { ...l, [slot]: list };
    });
  }

  async function fetchFiche(name: string): Promise<boolean> {
    const res = await fetch(`/api/garde-robe/fiche?login=${encodeURIComponent(name)}`);
    if (res.status === 401) {
      setStatus("idle");
      setMessage("Session perdue. Rouvrez-la avec vos identifiants de jeu.");
      return false;
    }
    if (res.status === 440) {
      setStatus("idle");
      setMessage("La session de jeu a expiré. Rouvrez-la pour continuer.");
      return false;
    }
    if (res.status === 404) {
      setMessage(`Aucun personnage nommé « ${name} » n'a été trouvé.`);
      return false;
    }
    if (!res.ok) {
      setMessage(`La fiche de « ${name} » n'a pas pu être chargée (erreur ${res.status}).`);
      return false;
    }
    const parsed = (await res.json()) as Avatar;
    if (!parsed?.codeVisage) {
      setMessage(`La fiche de « ${name} » est incomplète.`);
      return false;
    }
    setAvatar(parsed);
    setLoadout(toLoadout(parsed.equipement));
    setHover(null);
    setStatus("ready");
    const next = [parsed.login, ...seen.filter((s) => s !== parsed.login)].slice(0, 12);
    setSeen(next);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    setMessage(`Fiche de ${parsed.login} chargée · ${parsed.equipement?.length ?? 0} objets portés.`);
    return true;
  }

  async function doLogin(e: FormEvent) {
    e.preventDefault();
    const name = login.trim();
    if (!name || !password) {
      setStatus("error");
      return setMessage("Renseignez votre identifiant et votre mot de passe.");
    }
    setStatus("logging-in");
    setMessage(`Ouverture de la session de ${name}…`);
    try {
      const res = await fetch("/api/garde-robe/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: name, password }),
      });
      if (res.status === 401) {
        setStatus("error");
        return setMessage("Identifiant ou mot de passe incorrect.");
      }
      if (res.status === 429) {
        setStatus("error");
        return setMessage("Trop de tentatives. Réessayez dans quelques minutes.");
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus("error");
        return setMessage(body?.error || "La session n'a pas pu être ouverte.");
      }
      setPassword("");
      setStatus("ready");
      setMessage(`Bienvenue, ${name}. Fiche en cours de chargement…`);
      await fetchFiche(name);
    } catch {
      setStatus("error");
      setMessage("Serveur injoignable. Vérifiez votre connexion, puis réessayez.");
    }
  }

  async function doLogout() {
    try {
      await fetch("/api/garde-robe/logout", { method: "POST" });
    } catch {
      /* même hors ligne, on abandonne l'état local */
    }
    setAvatar(null);
    setLoadout({});
    setHover(null);
    setLogin("");
    setPassword("");
    setWho("");
    setStatus("idle");
    setMessage("Session fermée. Vos tenues restent enregistrées sur cet appareil.");
  }

  // La session du site (cookie chiffré) survit à la navigation alors que
  // l'état du composant non : on restaure la connexion sans redemander le
  // mot de passe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/garde-robe/me");
        const { player } = res.ok ? ((await res.json()) as { player?: string | null }) : {};
        if (cancelled || !player) return;
        setLogin(player);
        setStatus("logging-in");
        setMessage(`Bienvenue, ${player}. Fiche en cours de chargement…`);
        await fetchFiche(player);
        if (!cancelled) setStatus((s) => (s === "logging-in" ? "idle" : s));
      } catch {
        /* hors ligne — le formulaire de connexion reste affiché */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportPng() {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) {
      setMessage("Rien à exporter pour l'instant.");
      return;
    }
    try {
      const a = document.createElement("a");
      a.download = `${avatar?.login ?? "personnage"}.png`;
      a.href = (canvas as HTMLCanvasElement).toDataURL("image/png");
      a.click();
      setMessage("Portrait exporté en PNG.");
    } catch {
      setMessage("L'export a été bloqué par le navigateur.");
    }
  }

  function saveOutfit() {
    const name = outfitName.trim();
    if (!name) {
      setMessage("Donnez un nom à la tenue avant de l'enregistrer.");
      return;
    }
    // Plafond de 50 tenues : localStorage ne peut pas croître sans borne.
    const capped = Object.fromEntries(
      [...Object.entries(outfits).filter(([n]) => n !== name), [name, loadout]].slice(-50),
    );
    setOutfits(capped);
    localStorage.setItem(OUTFITS_KEY, JSON.stringify(capped));
    setOutfitName("");
    setMessage(`Tenue « ${name} » enregistrée.`);
  }

  function deleteOutfit(name: string) {
    const next = { ...outfits };
    delete next[name];
    setOutfits(next);
    localStorage.setItem(OUTFITS_KEY, JSON.stringify(next));
  }

  // Navigation clavier de la tablist : flèches et Début/Fin, activation
  // automatique, tabindex itinérant (l'onglet actif seul est tabulable).
  // Hors recherche uniquement : en recherche, la barre n'est plus une
  // tablist (rôle group, boutons simples) — pas de flèches fantômes.
  function onTablistKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (needle) return;
    const ids = tabs.map((t) => t.id);
    const at = ids.indexOf(currentTab);
    let next = -1;
    if (e.key === "ArrowRight") next = (at + 1) % ids.length;
    else if (e.key === "ArrowLeft") next = (at - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = ids[next];
    setQuery("");
    setActiveTab(id);
    document.getElementById(`tab-${id}`)?.focus();
  }

  /** Ligne d'un slot à capacité un : l'entrée portée, ou une ligne vide. */
  function row(slot: string, entry: EquipEntry | null, key: string) {
    const choices = matches(slot);
    const current = choices.find((it) => it.id === entry?.idItem) ?? null;
    const variants = current && current.declinaisons.length > 1 ? current.declinaisons : [];
    return (
      <div key={key} className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <ItemPicker
            items={choices}
            value={entry?.idItem ?? ""}
            id={`essai-${slot}-${key}`}
            showSlot={multi.has(slot)}
            onChange={(id, d) => commit(slot, id, d)}
            onPreview={(id) => {
              if (!id) return setHover(null);
              // Aperçu de l'objet SURVOLÉ, avec sa propre première teinte —
              // pas celle de l'objet actuellement porté.
              const it = index.get(slot)?.find((x) => x.id === id);
              setHover({ slot, id, declinaison: it?.declinaisons[0] ?? 0 });
            }}
            onPreviewColour={(id, d) => setHover({ slot, id, declinaison: d })}
          />
        </div>
        {entry && variants.length > 0 && (
          <Select<ShadeOpt, false>
            unstyled
            inputId={`teinte-${slot}-${key}`}
            aria-label={`Teinte de ${current ? itemLabel(current) : "l'objet"}`}
            value={{
              value: entry.declinaison,
              label: `#${entry.declinaison}`,
              color: shadeColor(entry.declinaison),
            }}
            options={variants.map((d) => ({ value: d, label: `#${d}`, color: shadeColor(d) }))}
            onChange={(o) => {
              if (o) commit(slot, entry.idItem, o.value);
            }}
            isSearchable={false}
            isClearable={false}
            menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            styles={shadeStyles}
            classNames={{ ...selectClassNames, container: () => "w-16 flex-none" }}
          />
        )}
      </div>
    );
  }

  function slotBlock(slot: string) {
    const worn = loadout[slot] ?? [];
    const canStack = multi.has(slot);
    return (
      <div key={slot} className="border-t border-gold/10 px-4 py-2.5 first-of-type:border-t-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-parchment-dim">
            {slotLabel(slot)}
          </span>
          {canStack && (
            <span className="text-[0.625rem] tabular-nums text-parchment-dim/60">
              {worn.length || "—"}
            </span>
          )}
        </div>
        <div className="mt-1.5 space-y-1.5">
          {canStack ? (
            <ItemPicker
              multi
              items={matches(slot)}
              value={worn.map((e) => e.idItem)}
              id={`essai-${slot}-multi`}
              showSlot
              onChange={(id, d) => {
                if (id) commitMulti(slot, id, d);
              }}
              onMultiChange={(ids) => syncMulti(slot, ids)}
              onPreview={(id) => {
                if (!id) return setHover(null);
                const it = index.get(slot)?.find((x) => x.id === id);
                setHover({ slot, id, declinaison: it?.declinaisons[0] ?? 0 });
              }}
              onPreviewColour={(id, d) => setHover({ slot, id, declinaison: d })}
            />
          ) : worn.length > 0 ? (
            row(slot, worn[0], worn[0].idItem)
          ) : (
            row(slot, null, "vide")
          )}
        </div>
      </div>
    );
  }

  /** Grille de cartes de section, rendu identique d'un onglet à l'autre. */
  function sectionGrid(sections: SectionDef[]) {
    return (
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const wornHere = section.slots.reduce((n, s) => n + (loadout[s]?.length ?? 0), 0);
          return (
            <section key={section.title} className="card-dark texture-noise self-start">
              <h3 className="flex items-center justify-between gap-2 border-b border-gold/15 px-4 py-2.5">
                <span className="font-display text-sm font-semibold tracking-[0.08em] text-parchment">
                  {section.title}
                </span>
                {wornHere > 0 && (
                  <span className="flex-none border border-gold/30 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-gold-light">
                    {wornHere}
                  </span>
                )}
              </h3>
              {section.slots.filter((s) => matches(s).length > 0).map((slot) => slotBlock(slot))}
            </section>
          );
        })}
      </div>
    );
  }

  const statusLine = `mt-4 border px-3 py-2 text-xs leading-relaxed ${
    status === "error" || catalogError
      ? "border-blood/50 bg-blood/10 text-parchment"
      : "border-gold/15 bg-ink/40 text-parchment-dim"
  }`;

  const tabSecs = sectionsOfTab(currentTab);

  return (
    <div className="w-full">
      {!avatar && (
        <div className="mx-auto w-full max-w-md">
          <div className="card-dark texture-noise relative p-6 sm:p-8">
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
              aria-hidden="true"
            />
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold tracking-[0.06em] text-parchment">
                Ouvrir la session
              </h2>
              <CatalogInfo catalog={catalog} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-parchment-dim">
              Vos identifiants ne sont envoyés qu'au serveur du site, qui ouvre
              la session auprès du jeu. Le mot de passe n'est jamais conservé ;
              la session de jeu reste dans un cookie chiffré d'une heure.
            </p>
            <form className="mt-5" onSubmit={doLogin}>
              <label className="block">
                <span className="mb-1.5 block text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-gold/80">
                  Identifiant de jeu
                </span>
                <input
                  value={login}
                  onInput={(e) => setLogin((e.target as HTMLInputElement).value)}
                  className={fieldCls}
                  autoComplete="username"
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-gold/80">
                  Mot de passe
                </span>
                <input
                  type="password"
                  value={password}
                  onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                  className={fieldCls}
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                disabled={status === "logging-in"}
                className="btn-gold mt-5 w-full justify-center disabled:pointer-events-none disabled:opacity-50"
              >
                {status === "logging-in" ? "Ouverture de la session…" : "Ouvrir la session"}
              </button>
            </form>
            <p className={statusLine} role="status">
              {catalogError || message}
            </p>
            {!catalog && !catalogError && (
              <div className="mt-3 animate-pulse space-y-2" aria-hidden="true">
                <div className="h-3 w-full bg-gold/10" />
                <div className="h-3 w-2/3 bg-gold/10" />
              </div>
            )}
          </div>
        </div>
      )}

      {avatar && (
        /* Sans items-start : les deux colonnes s'étirent à la hauteur de la
           rangée, sinon l'élément collant n'a aucune course de défilement.
           La marge basse négative donne au portrait collant la course qui
           lui manque en fin de page : elle mange le blanc entre le contenu
           et le pied de page (le pied garde son padding interne). */
        <div className="min-h-[calc(100vh-5rem)] grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Colonne côté portrait + bandeau de contrôle en bas : la
              carte collante garde sa course (page assez longue) et aucune
              carte de contrôle n'est cachée par le sticky (autre colonne). */}
          <div className="min-w-0 lg:min-h-[calc(100vh-5rem)]">
            <div className="lg:sticky lg:top-20">
              <div className="card-dark texture-noise relative p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-display text-lg font-bold tracking-[0.05em] text-parchment">
                    {avatar.login}
                  </h2>
                  <CatalogInfo catalog={catalog} />
                </div>
                <p className="mt-1 text-xs text-parchment-dim">
                  {SEXE_LABEL[sexe]} · {items.length} objets ·{" "}
                  <span className="tabular-nums text-gold-light">
                    {countEquipped(loadout)} portés
                  </span>
                  {hover && <span className="text-gold-light"> · aperçu</span>}
                </p>
                <div
                  className="mt-2 flex justify-center border border-gold/15 p-2"
                  style={{
                    background:
                      "radial-gradient(220px 340px at 50% 18%, color-mix(in oklab, var(--color-gold) 12%, transparent), transparent), linear-gradient(180deg, var(--color-ink), var(--color-ink-3))",
                  }}
                >
                  <div
                    ref={stageRef}
                    className="flex h-[480px] w-[240px] items-end justify-center overflow-hidden"
                  />
                </div>
                {!engineReady && (
                  <p className="mt-2 text-center text-xs text-parchment-dim">
                    Le moteur de rendu se charge…
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button onClick={exportPng} className={ghostSm + " flex-1"}>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 flex-none"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                    </svg>
                    Exporter
                  </button>
                  <button
                    onClick={() => {
                      setLoadout(toLoadout(avatar.equipement));
                      setHover(null);
                    }}
                    className={ghostSm + " flex-1"}
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- colonne */}
          <div className="min-w-0">
            {/* Barre collante unique : familles + recherche, sous l'en-tête.
                Les menus react-select sont portés dans document.body en
                z-70 : ils passent au-dessus de cette barre (z-20). */}
            <div className="sticky top-16 z-20 mb-4 min-h-fit border border-gold/15 bg-ink/90 p-3 backdrop-blur-md">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:gap-4">
                <input
                  value={query}
                  onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                  placeholder="Filtrer les objets…"
                  aria-label="Filtrer les objets"
                  className={fieldCls + " lg:order-2 lg:w-64 lg:flex-none"}
                />
                <div
                  role={needle ? "group" : "tablist"}
                  aria-label={needle ? undefined : "Familles d'objets"}
                  aria-orientation={needle ? undefined : "horizontal"}
                  onKeyDown={needle ? undefined : onTablistKeyDown}
                  className="flex flex-nowrap gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1.5 -my-1.5 px-1.5 py-1.5 lg:min-w-0 lg:flex-1 lg:order-1"
                >
                  {tabs.map((tab) => {
                    const active = !needle && tab.id === currentTab;
                    const worn = wornInTab(tab.id);
                    return (
                      <button
                        key={tab.id}
                        role={needle ? undefined : "tab"}
                        id={`tab-${tab.id}`}
                        aria-selected={needle ? undefined : active}
                        aria-controls={active ? `panel-${tab.id}` : undefined}
                        tabIndex={needle ? -1 : (active ? 0 : -1)}
                        onClick={() => {
                          setQuery("");
                          setActiveTab(tab.id);
                        }}
                        className={
                          tabBaseCls +
                          (active
                            ? " border-gold bg-gold/10 text-gold-light"
                            : " border-transparent text-parchment-dim hover:border-gold/30 hover:text-parchment")
                        }
                      >
                        <span>{tab.label}</span>
                        {worn > 0 && (
                          <span className="border border-gold/30 bg-gold/10 px-1 text-[0.625rem] tabular-nums text-gold-light">
                            {worn}
                          </span>
                        )}
                        {needle && (
                          <span className="border border-gold/15 px-1 text-[0.625rem] tabular-nums text-parchment-dim">
                            {resultsInTab(tab.id)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-xs text-parchment-dim" role="status">
                {message}
                {hover && (
                  <span className="text-gold-light"> · aperçu — cliquez pour garder</span>
                )}
              </p>
            </div>

            {needle ? (
              <div role="region" aria-label="Résultats de la recherche">
                <p className="mb-3 text-xs text-parchment-dim">
                  Recherche menée sur toutes les familles — {totalResults} objet
                  {totalResults > 1 ? "s" : ""} dans {searchSections.length} section
                  {searchSections.length > 1 ? "s" : ""}.{" "}
                  <button
                    onClick={() => setQuery("")}
                    className="cursor-pointer underline decoration-gold/40 underline-offset-4 transition-colors hover:text-parchment"
                  >
                    Effacer la recherche
                  </button>
                </p>
                {searchSections.length === 0 ? (
                  <div className="card-dark texture-noise px-6 py-12 text-center">
                    <p className="font-display text-lg tracking-[0.05em] text-parchment">
                      Aucun objet ne correspond à « {query.trim()} »
                    </p>
                    <p className="mt-2 text-sm text-parchment-dim">
                      Essayez un autre mot, ou effacez le filtre pour retrouver
                      l'ensemble du catalogue.
                    </p>
                    <button onClick={() => setQuery("")} className={ghostSm + " mt-5"}>
                      Effacer le filtre
                    </button>
                  </div>
                ) : (
                  sectionGrid(searchSections)
                )}
              </div>
            ) : (
              <div
                role="tabpanel"
                id={`panel-${currentTab}`}
                aria-labelledby={`tab-${currentTab}`}
              >
                {tabSecs.length === 0 ? (
                  <div className="card-dark texture-noise px-6 py-12 text-center">
                    <p className="font-display text-lg tracking-[0.05em] text-parchment">
                      Rien à essayer dans cette famille
                    </p>
                    <p className="mt-2 text-sm text-parchment-dim">
                      Aucun objet du catalogue n'occupe ces emplacements pour ce
                      personnage.
                    </p>
                  </div>
                ) : (
                  sectionGrid(tabSecs)
                )}
              </div>
            )}
            {/* Bandeau de contrôle : session, recherche de personnage, tenues — en bas
                de colonne : jamais sous le portrait collant (autre colonne), et la
                vue à mi-page ne montre que le portrait, les onglets et les objets. */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="card-dark texture-noise p-4">
                <h2 className="label-caps">Session de jeu</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-parchment-dim">
                  Connecté en tant que{" "}
                  <span className="text-parchment">{login || avatar.login}</span>. La
                  session expire après une heure d'inactivité.
                </p>
                <button onClick={doLogout} className={ghostSm + " mt-3 w-full"}>
                  Fermer la session
                </button>
              </div>

              <form
                className="card-dark texture-noise p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (who.trim()) fetchFiche(who.trim());
                }}
              >
                <h2 className="label-caps">Charger un personnage</h2>
                <input
                  value={who}
                  onInput={(e) => setWho((e.target as HTMLInputElement).value)}
                  list="personnages-recents"
                  placeholder="Nom du personnage"
                  aria-label="Nom du personnage à charger"
                  className={fieldCls + " mt-2.5"}
                />
                <datalist id="personnages-recents">
                  {seen.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <button type="submit" className={ghostSm + " mt-2 w-full"}>
                  Charger la fiche
                </button>
                <p className="mt-2 text-[0.6875rem] leading-relaxed text-parchment-dim/70">
                  Fiche publique, consultée en lecture seule.
                </p>
              </form>

              <div className="card-dark texture-noise p-4">
                <h2 className="label-caps">Mes tenues</h2>
                <div className="mt-2.5 flex gap-1.5">
                  <input
                    value={outfitName}
                    placeholder="Nom de la tenue"
                    aria-label="Nom de la tenue à enregistrer"
                    onInput={(e) => setOutfitName((e.target as HTMLInputElement).value)}
                    className={fieldCls + " min-w-0 flex-1"}
                  />
                  <button onClick={saveOutfit} className={ghostSm + " flex-none"}>
                    Enregistrer
                  </button>
                </div>
                {Object.keys(outfits).length === 0 ? (
                  <p className="mt-2.5 text-xs leading-relaxed text-parchment-dim/70">
                    Aucune tenue enregistrée pour l'instant. Composez-la, nommez-la,
                    conservez-la : elle restera sur cet appareil.
                  </p>
                ) : (
                  <ul className="mt-2.5 max-h-48 space-y-0.5 overflow-y-auto pr-1">
                    {Object.entries(outfits).map(([name, worn]) => (
                      <li
                        key={name}
                        className="group flex items-center gap-1 px-1 py-0.5 transition-colors hover:bg-gold/[0.06]"
                      >
                        <button
                          onClick={() => {
                            setLoadout(worn);
                            setHover(null);
                          }}
                          className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-parchment transition-colors hover:text-gold-light"
                        >
                          {name}{" "}
                          <span className="tabular-nums text-parchment-dim/60">
                            ({countEquipped(worn)})
                          </span>
                        </button>
                        <button
                          onClick={() => deleteOutfit(name)}
                          aria-label={`Supprimer la tenue ${name}`}
                          title="Supprimer"
                          className="grid h-6 w-6 flex-none cursor-pointer place-items-center text-parchment-dim/50 transition-colors hover:bg-blood/10 hover:text-blood"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
