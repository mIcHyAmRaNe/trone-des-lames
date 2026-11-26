# ⚔️ Le Trône des Lames

Site officiel du tournoi RP **Le Trône des Lames** (Renaissance Kingdoms) — édition Classique — et de l'agenda des animations des royaumes.

16 combattants · 4 groupes · 24 duels de poules · 8 qualifiés · 31 duels au total.

## Stack

- **Astro 7** (SSR, adapter Vercel)
- **React 19** pour le tableau de bord admin et l'îlot React de la chronique de l'agenda
- **Tailwind CSS v4** (`@theme` dans `src/styles/global.css`)
- **libSQL / Turso** pour la base — fichier local en dev, hébergé en prod

## Démarrage

```bash
npm install
cp .env.example .env      # renseigner ADMIN_PASSWORD et ADMIN_SECRET
npm run dev               # http://localhost:4321
```

En dev, sans `.env`, le mot de passe admin par défaut est `trone`.
**En production, toute action d’administration échoue sans `ADMIN_PASSWORD` et `ADMIN_SECRET` : renseignez-les avant de déployer.**

## Variables d'environnement

| Variable | Requis (prod) | Rôle |
|---|---|---|
| `ADMIN_PASSWORD` | oui | Mot de passe de l'espace admin |
| `ADMIN_SECRET` | oui | Clé de signature du cookie de session — sert aussi à chiffrer la session de la garde-robe |
| `TURSO_DATABASE_URL` | oui | `libsql://…` en prod, `file:local.db` en dev |
| `TURSO_AUTH_TOKEN` | oui | Jeton Turso |
| `RK_USERNAME` / `RK_PASS` | oui | Compte de service du site : connexion du jeu pour la garde-robe et pour `npm run catalog:refresh` |

## Déploiement Vercel

1. Créer une base sur [turso.tech](https://turso.tech) et récupérer l'URL + le jeton.
2. Importer le repo dans Vercel.
3. Ajouter les variables d'environnement ci-dessus, dont `RK_USERNAME` et `RK_PASS` (compte de service du site, sans quoi la garde-robe répond `502`).
4. Déployer. Le schéma se crée automatiquement au premier appel API.

## Structure

```
src/
  lib/
    db.ts           # client libSQL + schéma + édition
    tournament.ts   # classement, forfaits, seeds du bracket
    auth.ts         # session HMAC, mot de passe
    state.ts        # état complet pour les pages
    format.ts       # formatage et lecture des points (virgule française)
    events.ts       # types, validation et CRUD des animations
    wardrobe.ts     # catalogue d'objets, catégories du jeu, helpers de loadout
    seneschal.ts    # outils des champs/échoppes : règles et calculs de rendement
    rk.ts           # connexion au jeu et lecture d'une fiche (serveur)
    rk-session.ts   # session de garde-robe chiffrée dans un cookie
  components/
    Bracket.astro        # tableau final, connecteurs CSS purs
    MatchNode.astro      # un duel du tableau
    GroupTables.astro    # classements A-D
    GroupMatches.astro   # 24 duels de poules
    StatusBadge.astro
    ReglementContent.astro  # règlement, affiché dans l'onglet de /tournoi
    admin/Admin.tsx      # dashboard React
    agenda/AgendaChronicle.tsx  # chronique React (période, filtres, détail)
    agenda/agenda-chronicle.css # styles de la chronique
    garde-robe/Wardrobe.tsx     # îlot garde-robe (rendu Midas, tenues, pickers)
    garde-robe/ItemPicker.tsx   # combobox react-select (aperçu au survol)
    catalogue/CatalogTable.tsx  # table filtrable et paginée du catalogue
    seneschal/CowCalculator.tsx # calculateur de rendement du champ de vaches
    seneschal/BotanistCalculator.tsx # calculateur de marge de l'échoppe du botaniste
    seneschal/CraftCalculator.tsx # calculateur de marge des métiers d'échoppe
    seneschal/controls.tsx      # champs et selects partagés des calculateurs
  pages/
    index.astro · tournoi.astro · agenda.astro · garde-robe.astro · catalogue.astro · admin.astro
    confidentialite.astro # politique de confidentialité (garde-robe incluse)
    seneschal/          # hub, catégories (champs/échoppes) et outils
    reglement.astro     # redirection 301 vers /tournoi?onglet=reglement
    api/tournament.ts
    api/events.ts
    api/calque/[...path].ts     # proxy same-origin des calques du jeu
    api/garde-robe/{fiche}.ts
    api/admin/{session,fighters,draw,match,bracket,reset,events}.ts
public/
  rk/catalog.json       # catalogue statique généré (948 objets, 1 792 entrées M/F)
  vendor/midas.js       # moteur de portrait officiel du jeu, vendu tel quel
scripts/catalog.mjs     # bootstrap (ryence.de) | refresh (jeu en direct)
```

## Agenda

Les animations RP sont stockées dans la table `events` (`src/lib/events.ts`). Les joueurs proposent un événement via `POST /api/events` (créé « en attente », honeypot anti-spam, 20 propositions/heure/IP) ; `GET /api/events` ne liste que les événements approuvés. L'admin gère tout via `/api/admin/events` (session requise) : GET liste complète, POST publication immédiate, PATCH édition/approbation, DELETE.

La chronique se consulte globalement (`/agenda`) ou mois par mois via `/agenda?periode=YYYY-MM` ; la vue mensuelle ne rend que les animations qui chevauchent ce mois. C'est un îlot React (`AgendaChronicle.tsx`, `client:load`) : le changement de période met à jour la vue et l'URL sans recharger la page, tandis que la vue initiale reste rendue côté serveur et que les URLs `?periode=` restent partageables.

## Garde-robe & catalogue

Deux sections publiques issues de l'outil personnel `rk_wardrobe`, réécrites pour le langage visuel du site.

- **`/garde-robe`** — accès direct avec un personnage par défaut, réglage du sexe et des traits du visage (famille « Corps », encodés dans `codeVisage`), chargement d'une fiche par son nom, habillage par catégorie de la garde-robe du jeu, aperçu des variantes au survol, tenues enregistrées localement, export PNG. La connexion au jeu utilise le compte de service du site.
- **`/catalogue`** — les objets du jeu (nom, catégorie, sexes, z-index, déclinaisons), filtrables et paginés.

### Rendu du personnage

`public/vendor/midas.js` est le moteur de portrait officiel du jeu, vendu tel quel. La fiche est un JSON `{ login, sexe, codeVisage, equipement }`. Le site réécrit `equipement` (les objets essayés) et les chiffres de `codeVisage` (sexe, visage, couleurs, cheveux, émotions) quand on règle la famille « Corps » ; les index non éditables du code (style de barbe, iris, addition) sont conservés tels quels. Les plages de valeurs sont celles de la garde-robe de référence (`body.js` de ryence.de), le catalogue du jeu ne fournissant aucune métadonnée de visage.

Les calques passent par `GET /api/calque/<chemin>` et non directement par le CDN. Trois raisons : le CDN du jeu redirige sans `Access-Control-Allow-Origin` (Chrome échoue à la redirection), un calque absent répond 404 sans CORS (le proxy renvoie un GIF transparent en 200), et le same-origin permet de maîtriser le cache. Le canvas reste non « tainted », donc l'export PNG fonctionne.

### Session et confidentialité

Le visiteur ne saisit jamais d'identifiants : le serveur ouvre la session du jeu avec le compte de service du site (`RK_USERNAME` / `RK_PASS`) et ne demande que le nom du personnage dont la fiche publique est affichée en lecture seule. Le mot de passe du compte de service n'est jamais renvoyé au navigateur ni conservé dans un cookie. Le cookie de session du jeu est chiffré (AES-256-GCM, clé dérivée d'`ADMIN_SECRET`) dans un cookie `tdl_rk` `httpOnly`, `sameSite=lax`, d'une heure glissante. Aucune écriture en base : la session survit aux invocations Vercel. Le cookie du compte de service est aussi gardé quinze minutes en mémoire par instance pour éviter de rappeler le jeu ; les fiches publiques sont mises en cache cinq minutes. Il n'y a plus de limite de tentatives par IP, puisqu'aucun identifiant visiteur n'est transmis. Voir aussi la page `/confidentialite`.

**En production, `ADMIN_SECRET`, `RK_USERNAME` et `RK_PASS` sont indispensables** : sans eux, la garde-robe échoue (comme l'admin).

### Catalogue

`public/rk/catalog.json` est un fichier statique (2 104 entrées, 30 catégories du jeu) qui contient, pour chaque objet, son slot technique, son `slotGardeRobe`, son nom d'image CDN, ses déclinaisons de couleur et surtout son `zIndexCalques` — sans ordre de superposition, les vêtements se dessinent mal sur le corps.

Le catalogue est construit en trois temps : extraction du wiki FR et EN, fusion, puis enrichissement depuis les fiches de personnage.

```bash
npm run catalog:wiki:scan  # extraction wiki FR -> data/catalog-wiki-clean.json
npm run catalog:wiki:en    # extraction wiki EN -> data/catalog-wiki-en.json
npm run catalog:public     # fusion EN + enrichissement -> public/rk/catalog.json
npm run catalog:wiki       # audit de couverture face au wiki officiel
```

L'enrichissement ne lit jamais les captures de fiches de personnage : `data/character-sheet-assets.json` (committé) les a résumées une fois, via `node scripts/sheet-assets.mjs --female <fiche> --male <fiche>`. Il fournit les 15 clés de jeu (`idItem`, `declinaisons`, `slot`, `slotGardeRobe`, `miniature`, `zIndexCalques`…) ; aucune donnée historique n'est conservée. `npm run catalog` et `npm run catalog:refresh` restent disponibles comme reconstruction de secours depuis ryence.de ou le jeu.

`catalog:wiki` balaie la page wiki « Vêtement » (16 tableaux, colonnes MIXTE / FEMME / HOMME), suit chaque objet jusqu'aux pages `Fichier:` de ses sprites et compare les noms d'assets CDN au catalogue. Résultat dans `data/wiki-gaps.json` : `gaps` (asset CDN absent → objet à ajouter), `namedOnly` (objet absent d'après son nom, mais le wiki ne documente pas d'asset) et `unknownAssets`. Le wiki ne donne ni `idItem` ni `zIndexCalques` : ces deux champs restent à récupérer côté jeu avant de fusionner une entrée.

### Soumissions et modifications

Le catalogue est en lecture seule côté contributeurs : toute proposition passe par `POST /api/submissions` (création ou modification d'un objet) puis par une validation admin (`/admin/catalog`). Aucun mot de passe n'est demandé : le contributeur saisit son pseudo en jeu, que le serveur vérifie auprès du jeu avec le compte de service (`RK_USERNAME` / `RK_PASS`) avant d'enregistrer la proposition. Les propositions approuvées sont écrites dans la table `catalog_overrides` (Turso) et fusionnées à la lecture par `GET /api/catalog` — `catalog:refresh` et `catalog:wiki` ne réécrivent que le catalogue de base, elles ne peuvent donc jamais écraser une modification approuvée.

Cas traités côté serveur : pseudo inexistant (`unknown-player`), objet déjà au catalogue (`already-exists`), proposition déjà en attente sur le même objet (`duplicate-pending`, vérifiée par un `SELECT` car l'index partiel n'est pas fiable sur libsql), modification sans changement (`unchanged`), plafond de 20 propositions en attente par pseudo, plus un champ piège et un délai minimum pour décourager les robots.

Chaque ligne du catalogue propose un menu « ⋮ » : **Modifier** (même formulaire, prérempli, en modale) et **Signaler** (objet en double, à supprimer, données erronées). Les signalements vont dans `catalog_reports` et s'affichent en bas de `/admin/catalog` ; un signalement ouvert par objet et par motif, plafond de 10 par heure et par IP.

### API

| Route | Rôle |
|---|---|
| `GET /api/garde-robe/fiche?login=` | fiche Midas (`400` nom invalide, `404` inconnu, `502` compte de service indisponible, `440` session de jeu expirée) |
| `GET /api/calque/<chemin>` | un calque, caché et same-origin, jamais 404 pour un vêtement |
| `GET /api/catalog` | catalogue fusionné (base + modifications approuvées) |
| `POST /api/submissions` | proposer une création ou une modification (pseudo RK vérifié) |
| `GET /api/submissions?status=` | file d'attente, admin seulement |
| `GET /api/submissions/pending` | objets qui ont déjà une proposition en attente (public) |
| `POST /api/submissions/<id>/approve` · `/reject` | validation admin |
| `POST /api/reports` | signaler un objet (public, sans compte) |
| `GET /api/reports?status=` · `POST /api/reports/<id>/close` | file des signalements, admin |

Le cookie du jeu n'est jamais exposé au navigateur : seule la route `fiche` le manipule, côté serveur.

## Le Sénéchal

Le Sénéchal regroupe les outils d'aide des champs et des échoppes, inspirés de l'Office des Boutonneux mais recalculés d'après les règles actuelles de Renaissance Kingdoms.

- `/seneschal` — hub des registres (champs, échoppes) et des outils disponibles.
- `/seneschal/champs` · `/seneschal/echoppes` — catégories et outils à venir.
- `/seneschal/champs/elevage-de-vaches` — calculateur de cycle : troupeau, traite, croissance, abattage, outils et rentabilité.
- `/seneschal/champs/elevage-de-moutons` · `elevage-de-cochons` · `elevage-de-chevres` — tonte, engraissement, lait, carcasses et mortalité.
- `/seneschal/champs/champ-de-ble` · `champ-d-orge` · `champ-de-mais` · `champ-de-legumes` · `champ-d-oliviers` · `champ-de-vignes` · `champ-de-houblon` — cycle, qualité, récolte et marge.
- `/seneschal/champs/rucher` — ruches, humeur des abeilles, miel, cire et gelée royale.
- `/seneschal/echoppes/boucher` · `boulanger` · `charpentier` · `cidriculteur` · `distillateur` · `forgeron` · `fromager` · `meunier` · `oleiculteur` · `sculpteur` · `tisserand` · `viniculteur` — calculateurs d'atelier : recettes, matières premières, dépenses, recettes et marge nette (par heure et par unité).

Les formules et constantes vivent dans `src/lib/seneschal.ts` (vache à 45 écus, 4 bêtes max, lait `1 × (1 + INT/20)` plafonné à 20, 2e champ −15 %, seau 20 utilisations, couteau 5 abattages, table de mortalité officielle). Les cultures suivent la règle du wiki : qualité 50 % par défaut, rendement doublé à 100 %, minimum de récolte du wiki pour chaque champ, second champ avec son propre minimum. Les pages sont prérendues ; seul le calculateur est un îlot React.

Le moteur est data-driven : `CROP_FIELDS`, `HERD_RULES` et `APIARY_RULES` décrivent chaque champ, `computeCropCycle`, `computeHerdCycle` et `computeApiary` font les calculs. Les tables de mortalité des chèvres et les rendements maximaux ne sont pas documentés sur le wiki : l’outil le signale au lieu d’inventer des valeurs.

## Règles implémentées

- Classement : victoires → points cumulés → confrontation directe (si exactement deux combattants à égalité) → ordre alphabétique.
- Forfaits : 18 pts au 1er duel, répétition des points du 1er au 2e, moyenne des deux premiers au 3e (décimales conservées).
- Qualification affichée seulement quand les 24 duels de poules sont joués.
- Bracket : 1A–2B, 1B–2A, 1C–2D, 1D–2C ; SF1 = V(QF1)+V(QF3), SF2 = V(QF2)+V(QF4).

## Tests

```bash
node --experimental-strip-types tests/tournament.test.ts   # logique pure
node --experimental-strip-types tests/wardrobe.test.ts     # catalogue, loadout, session
node --experimental-strip-types tests/seneschal.test.ts    # vaches, cultures, élevages, rucher, métiers
node tests/e2e.mjs                                          # API (serveur dev requis)
```

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de dev |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualiser le build |
| `npm run catalog` | Reconstruire `public/rk/catalog.json` (ryence.de) |
| `npm run catalog:refresh` | Compléter le catalogue depuis le jeu (`.env` requis) |
