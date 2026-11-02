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
| `RK_USERNAME` / `RK_PASS` | non | Uniquement pour `npm run catalog:refresh` (jamais l'application) |

## Déploiement Vercel

1. Créer une base sur [turso.tech](https://turso.tech) et récupérer l'URL + le jeton.
2. Importer le repo dans Vercel.
3. Ajouter les 4 variables d'environnement ci-dessus.
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
    wardrobe.ts     # catalogue d'objets, sections, helpers de loadout
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
  pages/
    index.astro · tournoi.astro · agenda.astro · garde-robe.astro · catalogue.astro · admin.astro
    seneschal/          # hub, catégories (champs/échoppes) et outils
    reglement.astro     # redirection 301 vers /tournoi?onglet=reglement
    api/tournament.ts
    api/events.ts
    api/calque/[...path].ts     # proxy same-origin des calques du jeu
    api/garde-robe/{login,logout,me,fiche}.ts
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

- **`/garde-robe`** — connexion au jeu, chargement d'une fiche, habillage par emplacement, aperçu des variantes au survol, tenues enregistrées localement, export PNG.
- **`/catalogue`** — les objets du jeu (nom, emplacement, sexes, z-index, déclinaisons), filtrables et paginés.

### Rendu du personnage

`public/vendor/midas.js` est le moteur de portrait officiel du jeu, vendu tel quel. La fiche est un JSON `{ login, sexe, codeVisage, equipement }` ; le site ne réécrit que `equipement` — le corps, le visage et les cheveux viennent de `codeVisage` et ne sont jamais touchés.

Les calques passent par `GET /api/calque/<chemin>` et non directement par le CDN. Trois raisons : le CDN du jeu redirige sans `Access-Control-Allow-Origin` (Chrome échoue à la redirection), un calque absent répond 404 sans CORS (le proxy renvoie un GIF transparent en 200), et le same-origin permet de maîtriser le cache. Le canvas reste non « tainted », donc l'export PNG fonctionne.

### Session et confidentialité

Les identifiants ne vont qu'au serveur du site, qui ouvre une session auprès du jeu ; le mot de passe n'est jamais conservé. Le cookie de session du jeu est chiffré (AES-256-GCM, clé dérivée d'`ADMIN_SECRET`) dans un cookie `tdl_rk` `httpOnly`, `sameSite=lax`, d'une heure glissante. Aucune écriture en base : la session survit aux invocations Vercel. Les fiches publiques sont mises en cache cinq minutes en mémoire par instance ; la connexion est limitée à huit tentatives par IP et par dix minutes.

**En production, `ADMIN_SECRET` est indispensable** : sans lui, la connexion à la garde-robe échoue (comme l'admin).

### Catalogue

`public/rk/catalog.json` est un fichier statique (1792 objets, 39 emplacements) qui contient, pour chaque objet, son slot, son nom d'image CDN, ses déclinaisons de couleur et surtout son `zIndexCalques` — sans z-index réel, les vêtements se superposent mal au corps.

```bash
npm run catalog           # reconstruction complète depuis ryence.de (~1777 objets)
npm run catalog:refresh   # connexion au jeu, ajout des objets manquants
```

`catalog:refresh` lit `RK_USERNAME` / `RK_PASS` dans `.env` et n'est utilisé que par le script. Le jeu n'expose pas de catalogue : le script moissonne les pages qui rendent des objets et fusionne les `idItem` inconnus. Traiter le fichier comme un cache du jeu, pas comme une source de vérité.

### API

| Route | Rôle |
|---|---|
| `POST /api/garde-robe/login` | `{login, password}` → cookie de session chiffré |
| `GET /api/garde-robe/me` | joueur connecté ou `null` |
| `POST /api/garde-robe/logout` | ferme la session |
| `GET /api/garde-robe/fiche?login=` | fiche Midas (`401` sans session, `404` inconnu, `440` session de jeu expirée) |
| `GET /api/calque/<chemin>` | un calque, caché et same-origin, jamais 404 pour un vêtement |

Le cookie du jeu n'est jamais exposé au navigateur : seules les routes ci-dessus le manipulent, côté serveur.

## Le Sénéchal

Le Sénéchal regroupe les outils d'aide des champs et des échoppes, inspirés de l'Office des Boutonneux mais recalculés d'après les règles actuelles de Renaissance Kingdoms.

- `/seneschal` — hub des registres (champs, échoppes) et des outils disponibles.
- `/seneschal/champs` · `/seneschal/echoppes` — catégories et outils à venir.
- `/seneschal/champs/elevage-de-vaches` — calculateur de cycle : troupeau, traite, croissance, abattage, outils et rentabilité.

Les formules et constantes vivent dans `src/lib/seneschal.ts` (vache à 45 écus, 4 bêtes max, lait `1 × (1 + INT/20)` plafonné à 20, 2e champ −15 %, seau 20 utilisations, couteau 5 abattages, table de mortalité officielle). Les pages sont prérendues ; seul le calculateur est un îlot React.

## Règles implémentées

- Classement : victoires → points cumulés → confrontation directe (si exactement deux combattants à égalité) → ordre alphabétique.
- Forfaits : 18 pts au 1er duel, répétition des points du 1er au 2e, moyenne des deux premiers au 3e (décimales conservées).
- Qualification affichée seulement quand les 24 duels de poules sont joués.
- Bracket : 1A–2B, 1B–2A, 1C–2D, 1D–2C ; SF1 = V(QF1)+V(QF3), SF2 = V(QF2)+V(QF4).

## Tests

```bash
node --experimental-strip-types tests/tournament.test.ts   # logique pure
node --experimental-strip-types tests/wardrobe.test.ts     # catalogue, loadout, session
node --experimental-strip-types tests/seneschal.test.ts    # rendements du champ de vaches
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
