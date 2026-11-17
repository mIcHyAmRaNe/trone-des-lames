import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Select, { components } from "react-select";
import type { Lang } from "../../i18n";
import { dotStyles, menuPortalStyle, selectClassNames } from "./selectTheme";
import SelectField from "../ui/Select";
import {
  type Avatar,
  type Catalog,
  type CatalogItem,
  type EquipEntry,
  type Loadout,
  type Sexe,
  BODY_FIELDS,
  CATEGORIES,
  assetStyleNumber,
  DEFAULT_CODE_VISAGE,
  FAMILIES,
  categoryLabel,
  codeVisageValue,
  normalizeCodeVisage,
  setCodeVisageSex,
  setCodeVisageValue,
  categoryOf,
  countEquipped,
  entriesInCategory,
  entryFrom,
  familyLabel,
  indexByCategory,
  isMultiCategory,
  itemHaystack,
  itemLabel,
  loadCatalog,
  removeCategory,
  sexeLabel,
  shadeColor,
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
/** Position du style de cheveux dans le code visage (voir BODY_FIELDS). */
const HAIR_INDEX = BODY_FIELDS.find((f) => f.key === "cheveux")?.index ?? 11;
const SEEN_KEY = "tdl.garde-robe.personnages";

// Ces deux catégories ont leur sélecteur dans le panneau Corps : les rendre
// aussi dans la grille créerait deux endroits pour choisir la même coiffure.
const BODY_PICKER_CATEGORIES = new Set(["Coiffures", "Barbes"]);

function bodyStyleLabel(
  item: CatalogItem,
  kind: "hair" | "beard",
  lang: Lang,
): string {
  const localized = lang === "en" ? item.nameEn ?? item.nameFr : item.nameFr ?? item.nameEn;
  if (localized) return localized;
  const number = assetStyleNumber(item.nom, kind === "hair" ? "coiffure" : "barbe");
  if (number !== null) {
    if (kind === "hair") {
      return lang === "en" ? `Hairstyle ${number}` : `Coiffure ${number}`;
    }
    return lang === "en" ? `Beard ${number}` : `Barbe ${number}`;
  }
  return itemLabel(item, lang);
}

/**
 * Aperçu au survol : un objet du catalogue, ou une valeur du code visage
 * (index + valeur), que seul le survol affiche.
 */
type Hover =
  | { kind: "item"; slot: string; id: string; declinaison: number }
  | { kind: "code"; index: number; value: number }
  | null;

interface ShadeOpt {
  value: number;
  label: string;
  color: string;
}

const shadeStyles = dotStyles<ShadeOpt>((d) => d.color);

// Options des champs numériques du panneau « Corps ». Tableaux stables d'un
// rendu à l'autre : react-select perdrait la ligne survolée si les objets
// d'option changeaient d'identité (l'aperçu re-rend la page à chaque survol).
const FIELD_VALUES = new Map<string, number[]>(
  BODY_FIELDS.map((f) => [
    f.key,
    f.values ??
      Array.from({ length: f.max - f.min + 1 }, (_, i) => f.min + i),
  ]),
);
const fieldValues = (field: (typeof BODY_FIELDS)[number]) =>
  FIELD_VALUES.get(field.key) ?? [];

type CodeOpt = { value: string; label: string };

interface CodeMeta {
  onPreview?: (value: number | null) => void;
}

function CodeOptionRow(props: any) {
  const meta = props.selectProps.meta as CodeMeta;
  const number = Number(props.data.value);
  // Survol = aperçu, sans rien engager ; le pointeur parti, le personnage
  // retrouve ses valeurs réelles.
  return (
    <components.Option
      {...props}
      innerProps={{
        ...props.innerProps,
        onMouseEnter: () => meta.onPreview?.(number),
        onMouseLeave: () => meta.onPreview?.(null),
      }}
    />
  );
}

// Référence stable : react-select ne remonte pas le menu à chaque rendu.
const codeComponents = { Option: CodeOptionRow };

/** Champ numérique du visage : une valeur du code visage, prévisualisée au survol. */
function NumberSelect({
  inputId,
  values,
  value,
  onChange,
  onPreview,
}: {
  inputId: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
  onPreview: (value: number | null) => void;
}) {
  const options = useMemo<CodeOpt[]>(
    () => values.map((v) => ({ value: String(v), label: String(v) })),
    [values],
  );
  return (
    <Select<CodeOpt, false>
      unstyled
      inputId={inputId}
      className="mt-1"
      isSearchable={false}
      isClearable={false}
      options={options}
      value={options.find((o) => o.value === String(value)) ?? null}
      onChange={(o) => {
        if (o) onChange(Number(o.value));
      }}
      onMenuClose={() => onPreview(null)}
      components={codeComponents}
      classNames={selectClassNames}
      menuPosition="fixed"
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      styles={{ menuPortal: menuPortalStyle }}
      {...{ meta: { onPreview } as CodeMeta }}
    />
  );
}

const fieldCls =
  "w-full border border-gold/20 bg-ink/60 px-3 py-2 text-sm text-parchment transition-colors placeholder:text-parchment-dim/50 hover:border-gold/40 focus:border-gold";

const ghostSm =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 border border-gold/45 px-2.5 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-gold-light transition-colors hover:border-gold hover:bg-gold/10";

const tabBaseCls =
  "flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap border px-3 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] transition-colors";

const arrowCls =
  "grid h-7 w-7 flex-none cursor-pointer place-items-center border border-gold/25 text-gold-light transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:border-gold/10 disabled:text-parchment-dim/30";

const STR = {
  fr: {
    loading: "Chargement du catalogue…",
    loaded: "Modèle par défaut, aucun objet porté. Choisissez un objet ou chargez une fiche.",
    defaultModel: "Modèle par défaut",
    engineLoading: "Le moteur de rendu se charge…",
    familiesLabel: "les familles d'objets",
    categoriesLabel: "les catégories",
    itemsCount: (n: number) => `${n} objet${n > 1 ? "s" : ""}`,
    wornCount: (n: number) => `${n} porté${n > 1 ? "s" : ""}`,
    previewSuffix: "aperçu",
    joinError: "La garde-robe n'a pas pu joindre le jeu. Réessayez dans un moment.",
    notFound: (name: string) => `Aucun personnage nommé « ${name} » n'a été trouvé.`,
    sheetError: (name: string, status: number) =>
      `La fiche de « ${name} » n'a pas pu être chargée (erreur ${status}).`,
    sheetIncomplete: (name: string) => `La fiche de « ${name} » est incomplète.`,
    sheetLoaded: (name: string, n: number) =>
      `Fiche de ${name} chargée · ${n} objet${n > 1 ? "s" : ""} porté${n > 1 ? "s" : ""}.`,
    nothingToExport: "Rien à exporter pour l'instant.",
    exported: "Portrait exporté en PNG.",
    exportBlocked: "L'export a été bloqué par le navigateur.",
    filenameFallback: "personnage",
    nameOutfitFirst: "Donnez un nom à la tenue avant de l'enregistrer.",
    outfitSaved: (name: string) => `Tenue « ${name} » enregistrée.`,
    shadeOf: (name: string) => `Teinte de ${name}`,
    shadeFallback: "l'objet",
    bodyHelp:
      "Le sexe, le visage, les cheveux et la barbe se règlent ici. Changer de sexe remet la tenue à zéro et recharge le catalogue correspondant.",
    sex: "Sexe",
    hair: "Cheveux",
    beards: "Barbes",
    baseStyles: "Styles de base",
    catalogueHair: "Coiffures du catalogue",
    selectItem: "Sélectionner…",
    filterPlaceholder: "Filtrer les objets…",
    filterAria: "Filtrer les objets",
    familiesAria: "Familles d'objets",
    goTo: "Aller à",
    previewHint: "Aperçu  -  cliquez pour garder l'objet.",
    searchResultsAria: "Résultats de la recherche",
    searchSummary: (n: number, c: number) =>
      `Recherche menée sur toutes les familles  -  ${n} objet${n > 1 ? "s" : ""} dans ${c} catégorie${c > 1 ? "s" : ""}.`,
    clearSearch: "Effacer la recherche",
    noMatch: (q: string) => `Aucun objet ne correspond à « ${q} »`,
    noMatchHelp:
      "Essayez un autre mot, ou effacez le filtre pour retrouver l'ensemble du catalogue.",
    clearFilter: "Effacer le filtre",
    emptyFamily: "Rien à essayer dans cette famille",
    emptyFamilyHelp: "Aucun objet du catalogue dans cette famille pour ce personnage.",
    loadingFamilyHelp: "Les objets de la garde-robe arrivent dans un instant.",
    export: "Exporter",
    reset: "Réinitialiser",
    loadCharacter: "Charger un personnage",
    characterName: "Nom du personnage",
    loadSheet: "Charger la fiche",
    sheetNote:
      "Fiche publique, consultée en lecture seule. Aucun identifiant de connexion n'est demandé.",
    myOutfits: "Mes tenues",
    outfitName: "Nom de la tenue",
    outfitNameAria: "Nom de la tenue à enregistrer",
    save: "Enregistrer",
    noOutfits:
      "Aucune tenue enregistrée pour l'instant. Composez-la, nommez-la, conservez-la : elle restera sur cet appareil.",
    deleteOutfit: (name: string) => `Supprimer la tenue ${name}`,
    delete: "Supprimer",
  },
  en: {
    loading: "Loading the catalogue…",
    loaded: "Default model, no items worn. Choose an item or load a sheet.",
    defaultModel: "Default model",
    engineLoading: "The rendering engine is loading…",
    familiesLabel: "the families",
    categoriesLabel: "the categories",
    itemsCount: (n: number) => `${n} item${n === 1 ? "" : "s"}`,
    wornCount: (n: number) => `${n} worn`,
    previewSuffix: "preview",
    joinError: "The wardrobe could not reach the game. Try again in a moment.",
    notFound: (name: string) => `No character named “${name}” was found.`,
    sheetError: (name: string, status: number) =>
      `The sheet for “${name}” could not be loaded (error ${status}).`,
    sheetIncomplete: (name: string) => `The sheet for “${name}” is incomplete.`,
    sheetLoaded: (name: string, n: number) =>
      `Sheet for ${name} loaded · ${n} item${n === 1 ? "" : "s"} worn.`,
    nothingToExport: "Nothing to export yet.",
    exported: "Portrait exported as PNG.",
    exportBlocked: "The browser blocked the export.",
    filenameFallback: "character",
    nameOutfitFirst: "Give the outfit a name before saving it.",
    outfitSaved: (name: string) => `Outfit “${name}” saved.`,
    shadeOf: (name: string) => `Shade of ${name}`,
    shadeFallback: "the item",
    bodyHelp:
      "Sex, face, hair and beard are set here. Changing sex resets the outfit and reloads the matching catalogue.",
    sex: "Sex",
    hair: "Hair",
    beards: "Beards",
    baseStyles: "Base styles",
    catalogueHair: "Catalogue hairstyles",
    selectItem: "Select…",
    filterPlaceholder: "Filter items…",
    filterAria: "Filter items",
    familiesAria: "Item families",
    goTo: "Go to",
    previewHint: "Preview  -  click to keep the item.",
    searchResultsAria: "Search results",
    searchSummary: (n: number, c: number) =>
      `Searching all families  -  ${n} item${n === 1 ? "" : "s"} in ${c} categor${c === 1 ? "y" : "ies"}.`,
    clearSearch: "Clear search",
    noMatch: (q: string) => `No items match “${q}”`,
    noMatchHelp: "Try another word, or clear the filter to see the whole catalogue.",
    clearFilter: "Clear filter",
    emptyFamily: "Nothing to try in this family",
    emptyFamilyHelp: "No catalogue items in this family for this character.",
    loadingFamilyHelp: "The wardrobe items will be here in a moment.",
    export: "Export",
    reset: "Reset",
    loadCharacter: "Load a character",
    characterName: "Character name",
    loadSheet: "Load sheet",
    sheetNote: "Public sheet, read-only. No login is required.",
    myOutfits: "My outfits",
    outfitName: "Outfit name",
    outfitNameAria: "Outfit name to save",
    save: "Save",
    noOutfits:
      "No outfits saved yet. Put one together, name it, save it: it stays on this device.",
    deleteOutfit: (name: string) => `Delete outfit ${name}`,
    delete: "Delete",
  },
};

/**
 * Rangée de navigation qui peut déborder : défilement horizontal avec deux
 * flèches et un fondu de bord. Les flèches n'apparaissent que si la rangée
 * déborde (sinon elles ne servent à rien) et se désactivent aux extrémités,
 * pour qu'aucun onglet ni aucune puce ne reste caché sans indice.
 */
function ArrowScroller({
  label,
  lang,
  className,
  children,
}: {
  /** Nom lu par les flèches : « Faire défiler <label> vers la droite ». */
  label: string;
  lang: Lang;
  className?: string;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true, full: true });

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft <= 1;
    const end = el.scrollLeft >= max - 1;
    const full = max <= 1;
    setEdges((prev) =>
      prev.start === start && prev.end === end && prev.full === full
        ? prev
        : { start, end, full },
    );
    // Un bouton qui se désactive alors qu'il a le focus le renvoie au <body> :
    // on garde le focus dans la paire de flèches.
    if (end && document.activeElement === nextRef.current) prevRef.current?.focus();
    if (start && document.activeElement === prevRef.current) nextRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", sync);
    };
  }, [sync]);

  // Le contenu change (famille, sexe, recherche) : on remesure après le rendu.
  useEffect(sync);

  function nudge(dir: -1 | 1) {
    const el = trackRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: dir * Math.max(120, Math.round(el.clientWidth * 0.8)),
      behavior: reduce ? "auto" : "smooth",
    });
  }

  return (
    <div className={"flex min-w-0 items-center gap-1 " + (className ?? "")}>
      {!edges.full && (
        <button
          type="button"
          ref={prevRef}
          onClick={() => nudge(-1)}
          disabled={edges.start}
          aria-label={
            lang === "en"
              ? `Scroll ${label} left`
              : `Faire défiler ${label} vers la gauche`
          }
          className={arrowCls}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      )}
      <div className="relative min-w-0 flex-1">
        <div
          ref={trackRef}
          className="flex items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </div>
        {!edges.full && !edges.start && (
          <span
            className="pointer-events-none absolute inset-y-1 left-0 w-6 bg-gradient-to-r from-ink to-transparent"
            aria-hidden="true"
          />
        )}
        {!edges.full && !edges.end && (
          <span
            className="pointer-events-none absolute inset-y-1 right-0 w-6 bg-gradient-to-l from-ink to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
      {!edges.full && (
        <button
          type="button"
          ref={nextRef}
          onClick={() => nudge(1)}
          disabled={edges.end}
          aria-label={
            lang === "en"
              ? `Scroll ${label} right`
              : `Faire défiler ${label} vers la droite`
          }
          className={arrowCls}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function Wardrobe({ lang = "fr" }: { lang?: Lang }) {
  const s = STR[lang];
  const [message, setMessage] = useState(s.loading);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  // Accès direct : un personnage par défaut (homme, aucun vêtement) est
  // affiché dès l'arrivée, sans requête de fiche.
  const [avatar, setAvatar] = useState<Avatar>({
    login: "",
    sexe: "M",
    codeVisage: DEFAULT_CODE_VISAGE.M,
    equipement: [],
  });
  const [loadout, setLoadout] = useState<Loadout>({});
  const [hover, setHover] = useState<Hover>(null);
  const [query, setQuery] = useState("");
  const [activeFamily, setActiveFamily] = useState(FAMILIES[0].key);
  const [outfits, setOutfits] = useState<Record<string, Loadout>>({});
  const [outfitName, setOutfitName] = useState("");
  const [who, setWho] = useState("");
  const [seen, setSeen] = useState<string[]>([]);
  const [engineReady, setEngineReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCatalog()
      .then((c) => {
        setCatalog(c);
        setMessage(s.loaded);
      })
      .catch((e) => {
        const m = String((e as Error).message ?? e);
        setCatalogError(m);
        setMessage(m);
      });
  }, []);

  // midas.js est un script classique chargé par la page ; à l'hydratation de
  // l'îlot il n'a pas forcément déjà été exécuté  -  sondage court.
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
      /* données corrompues  -  on repart à vide */
    }
  }, []);

  const sexe: Sexe = avatar.sexe === "F" ? "F" : "M";
  const avatarName = avatar.login || s.defaultModel;
  // Les fiches sans asset CDN existent au catalogue pour être complétées,
  // mais la garde-robe ne peut pas les dessiner : elles ne sont pas proposées.
  const items = (catalog?.sexes[sexe] ?? []).filter((i) => i.nom);
  const index = useMemo(() => indexByCategory(items), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // L'aperçu est lissé : le survol rapide ne repeint pas à chaque pixel.
  const deferredHover = useDeferredValue(hover);

  // L'aperçu s'applique par-dessus la tenue engagée et est jeté au départ du
  // pointeur : explorer la liste ne modifie jamais rien.
  const shown = useMemo<Loadout>(() => {
    if (!deferredHover) return loadout;
    // Une coiffure de base remplace celle du catalogue, comme au clic.
    if (deferredHover.kind === "code") {
      return deferredHover.index === HAIR_INDEX
        ? removeCategory(loadout, "Coiffures")
        : loadout;
    }
    const item = byId.get(deferredHover.id);
    if (!item) return loadout;
    return upsert(loadout, item.slot, entryFrom(item, deferredHover.declinaison));
  }, [loadout, deferredHover, byId]);

  // Une coiffure du catalogue se superpose aux cheveux de base : l'aperçu met
  // le style de base à 0, exactement comme le fait le choix définitif.
  const shownAvatar = useMemo<Avatar>(() => {
    if (!deferredHover) return avatar;
    if (deferredHover.kind === "code") {
      return {
        ...avatar,
        codeVisage: setCodeVisageValue(
          avatar.codeVisage,
          deferredHover.index,
          deferredHover.value,
        ),
      };
    }
    if (byId.get(deferredHover.id)?.slot !== "Coiffures") return avatar;
    return {
      ...avatar,
      codeVisage: setCodeVisageValue(avatar.codeVisage, HAIR_INDEX, 0),
    };
  }, [avatar, deferredHover, byId]);

  // Rendu DÉCLARATIF. Une version impérative (peindre depuis le gestionnaire
  // de connexion) s'exécutait avant que la branche montrant la scène n'existe :
  // stageRef.current valait null, le dessin était sauté, et l'avatar
  // n'apparaissait qu'après le premier changement d'objet.
  useEffect(() => {
    if (!engineReady) return;
    const Midas = window.RAR?.Midas;
    const stage = stageRef.current;
    if (!Midas || !stage) return;
    Midas.racine = CALQUE_ROOT;
    stage.replaceChildren();
    const equipement = Object.values(shown).flat();
    // Seul `equipement` est réécrit  -  codeVisage (corps, visage, cheveux) est
    // celui du personnage et reste intact. C'est tout le truc.
    stage.appendChild(
      Midas.genereApercuDepuisJSON(JSON.stringify({ ...shownAvatar, equipement }), false),
    );
  }, [shownAvatar, shown, engineReady]);

  const needle = query.trim().toLowerCase();
  // Résultats mémoïsés par catégorie : l'aperçu au survol re-rend la page à
  // chaque option traversée. Des tableaux stables gardent les mêmes objets
  // d'option, sinon react-select perd l'option survolée (surbrillance et
  // position de défilement) à chaque mouvement du pointeur.
  const matchedByCategory = useMemo(() => {
    const out = new Map<string, CatalogItem[]>();
    for (const [category, all] of index) {
      out.set(
        category,
        needle ? all.filter((it) => itemHaystack(it).includes(needle)) : all,
      );
    }
    return out;
  }, [index, needle]);
  const matches = useCallback(
    (category: string) => matchedByCategory.get(category) ?? [],
    [matchedByCategory],
  );

  const hairField = BODY_FIELDS.find((f) => f.key === "cheveux");

  // Options des deux sélecteurs du panneau « Corps », mémoïsées pour la même
  // raison : l'aperçu au survol re-rend la page, et react-select perdrait la
  // ligne survolée si les objets d'option changeaient d'identité.
  const hairOptions = useMemo(() => {
    const values =
      hairField?.values ??
      Array.from(
        { length: (hairField?.max ?? 6) - (hairField?.min ?? 0) + 1 },
        (_, i) => (hairField?.min ?? 0) + i,
      );
    return [
      ...values.map((number) => ({
        value: `base:${number}`,
        label: String(number),
        group: s.baseStyles,
      })),
      ...matches("Coiffures")
        .filter((item) => {
          // coiffure0..6 sont les styles de base déjà proposés par le code visage.
          const number = assetStyleNumber(item.nom, "coiffure");
          return number === null || number > (hairField?.max ?? 6);
        })
        .map((item) => ({
          value: item.id,
          label: bodyStyleLabel(item, "hair", lang),
          group: s.catalogueHair,
          item,
        })),
    ];
  }, [hairField, matches, lang, s]);

  const beardOptions = useMemo(
    () =>
      matches("Barbes").map((item) => ({
        value: item.id,
        label: bodyStyleLabel(item, "beard", lang),
        group: s.beards,
        item,
      })),
    [matches, lang, s],
  );

  // Onglets = familles d'objets, dans un ordre fixe. Une catégorie vide pour ce
  // sexe ne produit pas de carte ; une famille sans aucune catégorie pleine ne
  // produit pas d'onglet.
  const tabs = useMemo(
    () =>
      FAMILIES.map((f) => ({
        id: f.key,
        label: familyLabel(f.key, lang),
        categories: f.categories.filter((key) => (index.get(key) ?? []).length > 0),
      })).filter((t) => t.categories.length > 0),
    [index, lang],
  );
  const currentTab = tabs.some((t) => t.id === activeFamily)
    ? activeFamily
    : (tabs[0]?.id ?? FAMILIES[0].key);
  const tabCategories = tabs.find((t) => t.id === currentTab)?.categories ?? [];
  const visibleTabCategories = tabCategories.filter(
    (category) => !BODY_PICKER_CATEGORIES.has(category),
  );

  const categoriesIn = (tabId: string) =>
    tabs.find((t) => t.id === tabId)?.categories ?? [];
  const wornInTab = (tabId: string) =>
    categoriesIn(tabId).reduce((n, key) => n + entriesInCategory(loadout, key).length, 0);
  const resultsInTab = (tabId: string) =>
    categoriesIn(tabId).reduce((n, key) => n + matches(key).length, 0);

  // Recherche globale : quand un filtre est actif, on balaie toutes les
  // catégories  -  l'utilisateur cherche un objet par son nom, pas par le tiroir
  // où le jeu le range ; rien n'est jamais caché par l'onglet affiché.
  const searchCategories = needle
    ? CATEGORIES.map((c) => c.key).filter((key) => matches(key).length > 0)
    : [];
  const totalResults = searchCategories.reduce((n, key) => n + matches(key).length, 0);
  const bodySearchMatches = [...BODY_PICKER_CATEGORIES].reduce(
    (n, category) => n + matches(category).length,
    0,
  );

  function entryFor(id: string, declinaison?: number): EquipEntry | null {
    const item = byId.get(id);
    if (!item) return null;
    // Re-choisir le même objet garde sa teinte ; sinon première variante.
    const worn = entriesInCategory(loadout, categoryOf(item)).find((e) => e.idItem === id);
    const d = declinaison ?? worn?.declinaison ?? item.declinaisons[0] ?? 0;
    return entryFrom(item, d);
  }

  function commit(category: string, id: string | null, declinaison?: number) {
    setHover(null);
    if (!id) {
      setLoadout((l) => removeCategory(l, category));
      return;
    }
    const entry = entryFor(id, declinaison);
    if (!entry) return;
    setLoadout((l) =>
      // Catégorie à capacité un : poser autre chose remplace ce qui s'y trouvait.
      upsert(isMultiCategory(category) ? l : removeCategory(l, category), entry.slot, entry),
    );
  }

  function syncMulti(category: string, ids: string[]) {
    setHover(null);
    setLoadout((l) => {
      const keep = entriesInCategory(l, category).filter((e) => ids.includes(e.idItem));
      const have = new Set(keep.map((e) => e.idItem));
      const additions: EquipEntry[] = [];
      for (const id of ids) {
        if (have.has(id)) continue;
        const entry = entryFor(id);
        if (entry) {
          additions.push(entry);
          have.add(id);
        }
      }
      let next = removeCategory(l, category);
      for (const entry of [...keep, ...additions]) next = upsert(next, entry.slot, entry);
      return next;
    });
  }

  async function fetchFiche(name: string): Promise<boolean> {
    const res = await fetch(`/api/garde-robe/fiche?login=${encodeURIComponent(name)}`);
    if (res.status === 401 || res.status === 440) {
      setMessage(s.joinError);
      return false;
    }
    if (res.status === 404) {
      setMessage(s.notFound(name));
      return false;
    }
    if (!res.ok) {
      setMessage(s.sheetError(name, res.status));
      return false;
    }
    const parsed = (await res.json()) as Avatar;
    if (!parsed?.codeVisage) {
      setMessage(s.sheetIncomplete(name));
      return false;
    }
    // Le code visage d'une fiche ancienne peut être incomplet : on le complète,
    // et on cale le sexe sur celui de la fiche. En cas d'échec plus haut, le
    // personnage par défaut reste affiché, avec le message d'erreur.
    const sexeFiche: Sexe = parsed.sexe === "F" ? "F" : "M";
    setAvatar({
      ...parsed,
      sexe: sexeFiche,
      codeVisage: normalizeCodeVisage(parsed.codeVisage, sexeFiche),
    });
    setLoadout(toLoadout(parsed.equipement));
    setHover(null);
    const next = [parsed.login, ...seen.filter((s) => s !== parsed.login)].slice(0, 12);
    setSeen(next);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    setMessage(s.sheetLoaded(parsed.login, parsed.equipement?.length ?? 0));
    return true;
  }

  function exportPng() {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) {
      setMessage(s.nothingToExport);
      return;
    }
    try {
      const a = document.createElement("a");
      a.download = `${avatar.login || s.filenameFallback}.png`;
      a.href = (canvas as HTMLCanvasElement).toDataURL("image/png");
      a.click();
      setMessage(s.exported);
    } catch {
      setMessage(s.exportBlocked);
    }
  }

  function saveOutfit() {
    const name = outfitName.trim();
    if (!name) {
      setMessage(s.nameOutfitFirst);
      return;
    }
    // Plafond de 50 tenues : localStorage ne peut pas croître sans borne.
    const capped = Object.fromEntries(
      [...Object.entries(outfits).filter(([n]) => n !== name), [name, loadout]].slice(-50),
    );
    setOutfits(capped);
    localStorage.setItem(OUTFITS_KEY, JSON.stringify(capped));
    setOutfitName("");
    setMessage(s.outfitSaved(name));
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
  // tablist (rôle group, boutons simples)  -  pas de flèches fantômes.
  function onTablistKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (needle) return;
    const ids = tabs.map((t) => t.id);
    if (!ids.length) return;
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
    setActiveFamily(id);
    document.getElementById(`tab-${id}`)?.focus();
  }

  /** Puce d'ancrage : amène la carte de catégorie sous la barre collante. */
  function jumpTo(category: string) {
    const el = document.getElementById(`cat-${category}`);
    if (!el) return;
    const covered = barRef.current?.getBoundingClientRect().bottom ?? 0;
    const top = el.getBoundingClientRect().top + window.scrollY - covered - 12;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }

  /** Aperçu d'une valeur du code visage (champ numérique, style de cheveux). */
  function previewCode(index: number, value: number | null) {
    setHover(value == null ? null : { kind: "code", index, value });
  }

  /** Aperçu au survol : l'objet survolé, jamais celui actuellement porté. */
  function preview(id: string | null, declinaison?: number) {
    if (!id) return setHover(null);
    // Styles de base du code visage : aucune entrée de catalogue à prévisualiser.
    if (id.startsWith("base:")) {
      return previewCode(HAIR_INDEX, Number(id.slice(5)));
    }
    const item = byId.get(id);
    if (!item) return setHover(null);
    // Même teinte que celle que poserait un clic : la teinte portée si l'objet
    // est déjà en place, sinon la première variante.
    const worn =
      declinaison == null
        ? entriesInCategory(loadout, categoryOf(item)).find((e) => e.idItem === id)
        : undefined;
    setHover({
      kind: "item",
      slot: item.slot,
      id,
      declinaison: declinaison ?? worn?.declinaison ?? item.declinaisons[0] ?? 0,
    });
  }

  /** Ligne d'une catégorie à capacité un : l'entrée portée, ou une ligne vide. */
  function row(category: string, entry: EquipEntry | null, key: string) {
    const choices = matches(category);
    const current = choices.find((it) => it.id === entry?.idItem) ?? null;
    const variants = current && current.declinaisons.length > 1 ? current.declinaisons : [];
    return (
      <div key={key} className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <ItemPicker
            items={choices}
            value={entry?.idItem ?? ""}
            id={`essai-${category}-${key}`}
            showSlot
            lang={lang}
            onChange={(id, d) => commit(category, id, d)}
            onPreview={(id) => preview(id)}
            onPreviewColour={(id, d) => preview(id, d)}
          />
        </div>
        {entry && variants.length > 0 && (
          <Select<ShadeOpt, false>
            unstyled
            inputId={`teinte-${category}-${key}`}
            aria-label={s.shadeOf(current ? itemLabel(current, lang) : s.shadeFallback)}
            value={{
              value: entry.declinaison,
              label: `#${entry.declinaison}`,
              color: shadeColor(entry.declinaison),
            }}
            options={variants.map((d) => ({ value: d, label: `#${d}`, color: shadeColor(d) }))}
            onChange={(o) => {
              if (o) commit(category, entry.idItem, o.value);
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

  /** Contenu d'une catégorie : un picker unique (multi si le jeu le permet). */
  function categoryBlock(category: string) {
    const worn = entriesInCategory(loadout, category);
    return (
      <div className="px-4 py-3">
        {isMultiCategory(category) ? (
          <ItemPicker
            multi
            items={matches(category)}
            value={worn.map((e) => e.idItem)}
            id={`essai-${category}-multi`}
            showSlot
            lang={lang}
            onChange={(id, d) => {
              if (id) commit(category, id, d);
            }}
            onMultiChange={(ids) => syncMulti(category, ids)}
            onPreview={(id) => preview(id)}
            onPreviewColour={(id, d) => preview(id, d)}
          />
        ) : worn.length > 0 ? (
          row(category, worn[0], worn[0].idItem)
        ) : (
          row(category, null, "vide")
        )}
      </div>
    );
  }

  /**
   * Famille « Corps » : sexe, traits du visage, cheveux et barbe.
   * Les Hair et Beards du catalogue ont ici leur unique sélecteur : les
   * catégories correspondantes ne sont plus rendues une seconde fois dans la
   * grille de la famille.
   */
  function bodyPanel() {
    const fields = BODY_FIELDS.filter(
      (f) => (!f.maleOnly || sexe === "M") && f.key !== "cheveux",
    );
    const beforeHair = fields.filter((f) => f.index < 11);
    const hairColour = fields.filter((f) => f.index > 11 && f.index < 14);
    const afterBeard = fields.filter((f) => f.index >= 14);

    const wornHair = entriesInCategory(loadout, "Coiffures")[0];
    const wornHairItem = wornHair ? byId.get(wornHair.idItem) : undefined;
    const wornBaseHair = assetStyleNumber(wornHairItem?.nom ?? null, "coiffure");
    const currentHair = wornHairItem
      ? wornBaseHair !== null && wornBaseHair <= (hairField?.max ?? 6)
        ? `base:${wornBaseHair}`
        : wornHairItem.id
      : `base:${codeVisageValue(avatar.codeVisage, hairField?.index ?? 11)}`;

    const wornBeard = entriesInCategory(loadout, "Barbes")[0];

    const labelCls =
      "block text-[0.5625rem] font-semibold uppercase leading-tight tracking-[0.12em] text-parchment-dim";

    function numberField(field: (typeof BODY_FIELDS)[number]) {
      const id = `corps-${field.key}`;
      return (
        <div key={field.key} className="min-w-0">
          <label htmlFor={id} className={labelCls}>
            {lang === "en" ? field.labelEn : field.label}
          </label>
          <NumberSelect
            inputId={id}
            values={fieldValues(field)}
            value={codeVisageValue(avatar.codeVisage, field.index)}
            onChange={(next) => {
              setAvatar((a) => ({
                ...a,
                codeVisage: setCodeVisageValue(a.codeVisage, field.index, next),
              }));
              setHover(null);
            }}
            onPreview={(next) => previewCode(field.index, next)}
          />
        </div>
      );
    }

    function selectHair(value: string | null, declinaison?: number) {
      if (!value) return;
      if (value.startsWith("base:")) {
        const number = Number(value.slice(5));
        setAvatar((a) => ({
          ...a,
          codeVisage: setCodeVisageValue(a.codeVisage, hairField?.index ?? 11, number),
        }));
        setLoadout((loadout) => removeCategory(loadout, "Coiffures"));
        setHover(null);
        return;
      }
      // Une coiffure catalogue remplace les cheveux de base : le code visage
      // passe à 0 pour éviter de superposer les deux calques.
      setAvatar((a) => ({
        ...a,
        codeVisage: setCodeVisageValue(a.codeVisage, hairField?.index ?? 11, 0),
      }));
      commit("Coiffures", value, declinaison);
    }

    return (
      <section
        className="card-dark texture-noise mb-4 p-4"
        aria-labelledby="corps-titre"
      >
        <h3 id="corps-titre" className="label-caps">
          {familyLabel("corps", lang)}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-parchment-dim">
          {s.bodyHelp}
        </p>
        <div className="mt-3 max-w-[13rem]">
          <label htmlFor="corps-sexe" className={labelCls}>
            {s.sex}
          </label>
          <SelectField
            inputId="corps-sexe"
            options={(["M", "F"] as Sexe[]).map((value) => ({
              value,
              label: sexeLabel(value, lang),
            }))}
            value={sexe}
            onChange={(value) => {
              const next: Sexe = value === "F" ? "F" : "M";
              setAvatar((a) => ({
                ...a,
                sexe: next,
                codeVisage: setCodeVisageSex(a.codeVisage, next),
                equipement: [],
              }));
              setLoadout({});
              setHover(null);
            }}
            ariaLabel={s.sex}
            size="sm"
            className="mt-1"
            styles={{ control: (base) => ({ ...base, cursor: "pointer" }) }}
            lang={lang}
          />
        </div>

        {/* Une seule grille : cheveux et barbe occupent une cellule comme les
            autres champs, même largeur, même alignement. */}
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {beforeHair.map(numberField)}

          <div key="cheveux" className="min-w-0">
            <label htmlFor="corps-cheveux" className={labelCls}>
              {s.hair}
            </label>
            <ItemPicker
              options={hairOptions}
              value={currentHair}
              id="corps-cheveux"
              lang={lang}
              onChange={selectHair}
              onPreview={(id) => preview(id)}
              showShades={false}
              placeholder={s.selectItem}
            />
          </div>

          {hairColour.map(numberField)}

          {beardOptions.length > 0 && (
            <div key="barbes" className="min-w-0">
              <label htmlFor="corps-barbes" className={labelCls}>
                {s.beards}
              </label>
              <ItemPicker
                options={beardOptions}
                value={wornBeard?.idItem ?? ""}
                id="corps-barbes"
                lang={lang}
                onChange={(id, declinaison) => commit("Barbes", id, declinaison)}
                onPreview={(id) => preview(id)}
                showShades={false}
                placeholder={s.selectItem}
              />
            </div>
          )}

          {afterBeard.map(numberField)}
        </div>
      </section>
    );
  }

  /** Grille de cartes de catégorie, rendu identique d'un onglet à l'autre. */
  function sectionGrid(categories: string[]) {
    const visibleCategories = categories.filter(
      (category) => !BODY_PICKER_CATEGORIES.has(category),
    );
    return (
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {visibleCategories.map((category) => {
          const wornHere = entriesInCategory(loadout, category).length;
          return (
            <section
              key={category}
              id={`cat-${category}`}
              tabIndex={-1}
              className="card-dark texture-noise self-start"
            >
              <h3 className="flex items-center justify-between gap-2 border-b border-gold/15 px-4 py-2.5">
                <span className="font-display text-sm font-semibold tracking-[0.08em] text-parchment">
                  {categoryLabel(category, lang)}
                </span>
                {wornHere > 0 && (
                  <span className="flex-none border border-gold/30 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-gold-light">
                    {wornHere}
                  </span>
                )}
              </h3>
              {categoryBlock(category)}
            </section>
          );
        })}
      </div>
    );
  }

  const statusLine = `mt-3 border px-3 py-2 text-xs leading-relaxed ${
    catalogError
      ? "border-blood/50 bg-blood/10 text-parchment"
      : "border-gold/15 bg-ink/40 text-parchment-dim"
  }`;

  const tabHasItems = tabCategories.length > 0;

  return (
    <div className="w-full">
      {/* Sans items-start : les deux colonnes s'étirent à la hauteur de la
          rangée, sinon l'élément collant n'a aucune course de défilement. */}
      <div className="min-h-[calc(100vh-5rem)] grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Colonne côté portrait : formulaire de chargement en haut (sticky),
            puis la carte portrait en dessous. */}
        <div className="min-w-0 lg:min-h-[calc(100vh-5rem)]">
          <div className="lg:sticky lg:top-20 lg:z-10">
            {/* Formulaire de chargement fiche — en haut, toujours visible */}
            <form
              className="card-dark texture-noise p-4 mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (who.trim()) fetchFiche(who.trim());
              }}
            >
              <h2 className="label-caps">{s.loadCharacter}</h2>
              <label
                htmlFor="fiche-nom"
                className="mt-2.5 block text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-gold/80"
              >
                {s.characterName}
              </label>
              <input
                id="fiche-nom"
                value={who}
                onInput={(e) => setWho((e.target as HTMLInputElement).value)}
                list="personnages-recents"
                placeholder={s.characterName}
                autoComplete="off"
                className={fieldCls + " mt-1"}
              />
              <datalist id="personnages-recents">
                {seen.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button type="submit" className={ghostSm + " mt-2 w-full"}>
                {s.loadSheet}
              </button>
              <p className="mt-2 text-[0.6875rem] leading-relaxed text-parchment-dim/70">
                {s.sheetNote}
              </p>
            </form>

            {/* Portrait — en dessous du formulaire */}
            <div className="card-dark texture-noise relative p-4">
              <div className="flex items-center justify-between gap-2">
                <h2
                  className="truncate font-display text-lg font-bold tracking-[0.05em] text-parchment"
                  title={avatarName}
                >
                  {avatarName}
                </h2>
                <CatalogInfo catalog={catalog} lang={lang} />
              </div>
              <p className="mt-1 text-xs text-parchment-dim">
                {sexeLabel(sexe, lang)} · {s.itemsCount(items.length)} ·{" "}
                <span className="tabular-nums text-gold-light">
                  {s.wornCount(countEquipped(loadout))}
                </span>
                {/* Espace réservé : la mention apparaît et disparaît au survol,
                    elle ne doit pas faire passer la ligne à deux lignes. */}
                <span className={`text-gold-light ${hover ? "" : "invisible"}`}>
                  {" "}· {s.previewSuffix}
                </span>
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
                  {s.engineLoading}
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
                  {s.export}
                </button>
                <button
                  onClick={() => {
                    setLoadout(toLoadout(avatar.equipement));
                    setHover(null);
                  }}
                  className={ghostSm + " flex-1"}
                >
                  {s.reset}
                </button>
              </div>
            </div>
            <p className={statusLine} role="status">
              {catalogError || message}
            </p>
          </div>

          </div>

        {/* ---------------------------------------------------- colonne */}
        <div className="min-w-0">
          {/* Barre collante unique : familles + recherche (+ puces de
              catégorie pour les familles larges), sous l'en-tête. Les menus
              react-select sont portés dans document.body en z-70 : ils
              passent au-dessus de cette barre (z-20). */}
          <div
            ref={barRef}
            className="sticky top-16 z-20 mb-4 min-h-fit border border-gold/15 bg-ink/90 p-3 backdrop-blur-md"
          >
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:gap-4">
              <input
                value={query}
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                placeholder={s.filterPlaceholder}
                aria-label={s.filterAria}
                className={fieldCls + " lg:order-2 lg:w-64 lg:flex-none"}
              />
              <ArrowScroller
                label={s.familiesLabel}
                lang={lang}
                className="w-full lg:order-1 lg:w-auto lg:flex-1"
              >
                <div
                  role={needle ? "group" : "tablist"}
                  aria-label={needle ? undefined : s.familiesAria}
                  aria-orientation={needle ? undefined : "horizontal"}
                  onKeyDown={needle ? undefined : onTablistKeyDown}
                  className="flex w-max flex-none gap-1"
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
                        tabIndex={needle ? 0 : (active ? 0 : -1)}
                        onClick={() => {
                          setQuery("");
                          setActiveFamily(tab.id);
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
              </ArrowScroller>
            </div>
            {/* Sommaire de la famille affichée : une puce par catégorie, qui
                amène sa carte sous la barre. Les familles d'une seule carte
                n'en ont pas besoin. */}
            {!needle && visibleTabCategories.length > 1 && (
              <ArrowScroller label={s.categoriesLabel} lang={lang} className="mt-2 w-full">
                <span className="label-caps mr-0.5 flex-none text-[0.5625rem]">
                  {s.goTo}
                </span>
                {visibleTabCategories.map((key) => {
                  const worn = entriesInCategory(loadout, key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => jumpTo(key)}
                      className="flex flex-none cursor-pointer items-center gap-1 whitespace-nowrap border border-gold/15 px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-parchment-dim transition-colors hover:border-gold/40 hover:bg-gold/[0.06] hover:text-parchment"
                    >
                      {categoryLabel(key, lang)}
                      {worn > 0 && (
                        <span className="tabular-nums text-gold-light">{worn}</span>
                      )}
                    </button>
                  );
                })}
              </ArrowScroller>
            )}
            {/* La ligne est toujours présente (invisible au repos) : sinon la
                barre collante grandit à chaque survol et repousse toute la
                grille  -  la page « vibre ». */}
            <p
              className={`mt-2 text-xs text-gold-light ${hover ? "" : "invisible"}`}
              aria-hidden={!hover}
            >
              {s.previewHint}
            </p>
          </div>

          {needle ? (
            <div role="region" aria-label={s.searchResultsAria}>
              <p className="mb-3 text-xs text-parchment-dim">
                {s.searchSummary(totalResults, searchCategories.length)}{" "}
                <button
                  onClick={() => setQuery("")}
                  className="cursor-pointer underline decoration-gold/40 underline-offset-4 transition-colors hover:text-parchment"
                >
                  {s.clearSearch}
                </button>
              </p>
              {searchCategories.length === 0 ? (
                <div className="card-dark texture-noise px-6 py-12 text-center">
                  <p className="font-display text-lg tracking-[0.05em] text-parchment">
                    {s.noMatch(query.trim())}
                  </p>
                  <p className="mt-2 text-sm text-parchment-dim">
                    {s.noMatchHelp}
                  </p>
                  <button onClick={() => setQuery("")} className={ghostSm + " mt-5"}>
                    {s.clearFilter}
                  </button>
                </div>
              ) : (
                <>
                  {bodySearchMatches > 0 && bodyPanel()}
                  {sectionGrid(searchCategories)}
                </>
              )}
            </div>
          ) : (
            <div
              role="tabpanel"
              id={`panel-${currentTab}`}
              aria-labelledby={`tab-${currentTab}`}
            >
              {currentTab === "corps" && bodyPanel()}
              {!tabHasItems ? (
                <div className="card-dark texture-noise px-6 py-12 text-center">
                  <p className="font-display text-lg tracking-[0.05em] text-parchment">
                    {catalog
                      ? s.emptyFamily
                      : s.loading}
                  </p>
                  <p className="mt-2 text-sm text-parchment-dim">
                    {catalog
                      ? s.emptyFamilyHelp
                      : s.loadingFamilyHelp}
                  </p>
                </div>
              ) : (
                sectionGrid(tabCategories)
              )}
            </div>
          )}
          {/* Bandeau de contrôle : les tenues, en bas de colonne  -  jamais sous
              le portrait collant (autre colonne), et la vue à mi-page ne
              montre que le portrait, les onglets et les objets. */}
          <div className="mt-6">
            <div className="card-dark texture-noise p-4">
              <h2 className="label-caps">{s.myOutfits}</h2>
              <div className="mt-2.5 flex gap-1.5">
                <input
                  value={outfitName}
                  placeholder={s.outfitName}
                  aria-label={s.outfitNameAria}
                  onInput={(e) => setOutfitName((e.target as HTMLInputElement).value)}
                  className={fieldCls + " min-w-0 flex-1"}
                />
                <button onClick={saveOutfit} className={ghostSm + " flex-none"}>
                  {s.save}
                </button>
              </div>
              {Object.keys(outfits).length === 0 ? (
                <p className="mt-2.5 text-xs leading-relaxed text-parchment-dim/70">
                  {s.noOutfits}
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
                        aria-label={s.deleteOutfit(name)}
                        title={s.delete}
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
    </div>
  );
}
