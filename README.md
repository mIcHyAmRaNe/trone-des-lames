# ⚔️ Le Trône des Lames

Site officiel du tournoi RP **Le Trône des Lames** (Renaissance Kingdoms) — édition Classique.

16 combattants · 4 groupes · 24 duels de poules · 8 qualifiés · 31 duels au total.

## Stack

- **Astro 7** (SSR, adapter Vercel)
- **React 19** pour le tableau de bord admin uniquement
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
| `ADMIN_SECRET` | oui | Clé de signature du cookie de session |
| `TURSO_DATABASE_URL` | oui | `libsql://…` en prod, `file:local.db` en dev |
| `TURSO_AUTH_TOKEN` | oui | Jeton Turso |

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
  components/
    Bracket.astro        # tableau final, connecteurs CSS purs
    MatchNode.astro      # un duel du tableau
    GroupTables.astro    # classements A-D
    GroupMatches.astro   # 24 duels de poules
    StatusBadge.astro
    admin/Admin.tsx      # dashboard React
  pages/
    index.astro · tournoi.astro · reglement.astro · admin.astro
    api/tournament.ts
    api/admin/{session,fighters,draw,match,bracket,reset}.ts
```

## Règles implémentées

- Classement : victoires → points cumulés → confrontation directe (si exactement deux combattants à égalité) → ordre alphabétique.
- Forfaits : 18 pts au 1er duel, répétition des points du 1er au 2e, moyenne des deux premiers au 3e (décimales conservées).
- Qualification affichée seulement quand les 24 duels de poules sont joués.
- Bracket : 1A–2B, 1B–2A, 1C–2D, 1D–2C ; SF1 = V(QF1)+V(QF3), SF2 = V(QF2)+V(QF4).

## Tests

```bash
node --experimental-strip-types tests/tournament.test.ts   # logique pure
node tests/e2e.mjs                                          # API (serveur dev requis)
```

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de dev |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualiser le build |
