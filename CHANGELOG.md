# Changelog

## 2026-11-18 — Catalogue : compteurs dans les filtres et date de mise à jour

### Ajouté

- Badge de nombre d'objets dans les trois filtres react-select de `/catalogue` : Catégorie, Sexe, Données. Chaque chiffre correspond exactement au résultat retourné par le filtre (ex. « M » ne compte pas les objets mixtes).
- `Select.tsx` : champ `count` optionnel sur `Option`, rendu via `formatOptionLabel` uniquement quand il est fourni — aucun autre sélecteur de l'application n'est modifié.

### Corrigé

- La ligne « Relevé du 5 octobre 2026 » affichait `generatedAt` (date du bootstrap ryence.de). Elle affiche désormais `refreshedAt` avec « Dernière mise à jour le » / « Last updated on ».

## 2026-11-18 — Catalogue : plus de snapshot périmé ni de doublon récurrent

### Corrigé

- `/api/catalog` servait un catalogue figé au premier appel depuis le démarrage du serveur (`catalog-store.ts`). En développement, le fichier est maintenant relu à chaque requête : plus besoin de redémarrer le serveur après une relance des scripts.
- « Masse épineuse », « Trompette du champion 1472 » et « Cape du pillard » n'apparaissent plus qu'une fois dans `/catalogue` (ligne « Mixte », catégorie unique) : les anciennes lignes venaient du snapshot périmé de l'API.
- `wiki:pillagerscervelliere` (page wiki EN) réapparaissait avec un libellé anglais et échappait à la dédup : fusion avec la fiche FR `wiki:cerveliere-du-pillard`.
- `wiki-fill-cdn` ne donne plus le titre anglais d'une page EN comme `nameFr` lors d'une création.
- `catalog-dedupe` rapproche aussi deux fiches `wiki:*` de même asset et de mêmes CDN, même si leurs libellés divergent.

## 2026-11-18 — Doublons : fiches FR/EN fusionnées et ids dupliqués

### Corrigé

- Les paires « page wiki FR + page wiki EN » importées sous deux ids sont fusionnées : `Masse épineuse`, `Trompette du champion 1472`, `Cape du pillard`, `Cervelets/Grèves/Gantelets du Pillard`, `Cygneau de l'orage`, `Fourchette en fer`, `Coiffure désordonnée/lâche/radieuse`.
- 8 fiches portant le même id que leur voisine (819, 1402, 1860, 1863, 1864, 1870, 1871) sont supprimées ; pour l'id 819 c'est la version **avec** CDN qui est conservée.
- 25 fiches supprimées au total (16 M / 9 F), catalogue à 2041 fiches.
- `catalog-dedupe.mjs` détecte aussi les doublons stricts (même asset et libellés non contradictoires). Les variantes numérotées (« Cadre Atout majeur I », « II »…) restent distinctes : leur numéro est dans `nameEn`.
- Les trois scripts sont stables en dry-run : 0 ajout, 0 correction, 0 suppression.

## 2026-11-18 — Colliers en pierre fine : variantes mixtes et CDN

### Corrigé

- Les trois variantes « Collier en pierre fine (ambre / apatite / péridot) » sont désormais présentes dans les deux sexes, avec leurs propres CDN (`collierPierreFineAmbre`, `...Apatite`, `...Peridot`, 2 sprites chacune).
- L'id 1902 (« Colliers en pierre fine », cornaline) pointait à tort sur les sprites ambre ; son CDN est corrigé en `collierPierreFineCornaline`.
- `wiki-audit` reconnaît maintenant les URL CDN de tous les hôtes du wiki (`www.renaissancekingdoms.com`, `beta.lesroyaumes.com`, CDN oxv) et les doubles slashs : les assets ne sont plus considérés comme absents, ce qui réduit les fiches à compléter de 152 à 144.

## 2026-11-18 — Catalogue : panoplies genrées, nettoyage wiki et affichage

### Corrigé

- **Pages de panoplie** : les pages avec `elementPano > 1` (Troubadour, Mariage…) n'alimentent plus les index d'assets. Chaque objet ne reçoit que ses propres CDN, relevés sur sa page `Fichier:` (ex. `Item244f.png` pour le Voile de mariée, `Item240h.png` pour le Pourpoint brodé).
- **Noms par sexe** : les composants genrés ont leur propre libellé et leurs propres sprites — Veste de cuir / Robe de dentelle, Gants de cuir / Gants de mariée, Pourpoint brodé / Voile de mariée.
- **Affichage `/catalogue`** : les fiches M et F d'un même id mais de noms différents ne sont plus fusionnées. Rechercher « Voile de mariée » renvoie désormais une ligne dédiée avec son seul CDN féminin, au lieu d'une ligne « Pourpoint brodé » mélangeant les deux sexes.
- **Sexe des objets wiki** : `wiki-audit` tient compte de `VetementGenre` (« pour homme » / « pour femme ») au lieu de la colonne du tableau ; suppression des fiches F fantômes de la Léine celtique et de la Chemise de l'Abeilleur.
- **Libellés FR** : `wiki-fill-cdn` ne remplace plus un nom français par le titre de la page anglaise, et n'ajoute pas d'article initial (`Le`/`La`) aux noms issus du wiki.
- **Fiches catégorie** : blacklist étendue dans les deux scripts (Arme, Lac, Pêcher, Verger, Foulard/Tenue du teinturier, Panoplie Troubadour, Panoplie Mariage et leurs sous-éléments) ; les fiches déjà importées ont été retirées.
- **CDN ponctuels** : renard polaire F, tenue de rupin Noël 1472 (bleu) M et pourpoint M complétés ; le CDN `_@2X` du wiki est ramené en `_@1X`.

### Technique

- `wiki-fill-cdn.mjs` : exclusion des pages de panoplie des index `byName`/`byAsset`, garde-fou `lang === 'fr'` sur les mises à jour de `nameFr`, `correctSexes` étendu aux objets sans asset et `SEX_OVERRIDES` pour le renard polaire.
- `wiki-audit.mjs` : blacklist partagée et import qui respecte le genre déclaré sur le wiki.
- `CatalogTable.tsx` : regroupement des lignes par id **et** par nom, clé React incluant le sexe.
- Catalogue régénéré : 2066 fiches ; `data/wiki-gaps.json` actualisé (0 manquant par asset CDN). `npm run build` OK.
