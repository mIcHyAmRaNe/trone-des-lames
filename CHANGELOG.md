# Changelog

## 2026-11-26 — Catalogue : filtres à facettes, import CDN wiki robuste, liens wiki exacts

### Ajouté
- **Comptes à facettes** dans les dropdowns de filtre (catégorie, sexe, données) : le badge affiche `x / N` où `x` = nombre d'objets correspondant à *tous les autres filtres actifs* et `N` = total sans filtre. Implémenté via `filteredExcept(dimension)` dans `CatalogTable.tsx` + `totalCount` optionnel dans `Select.tsx`.
- Champ `wikiTitle` dans `CatalogItem` : titre exact de la page wiki (sensible à la casse, sans qualificatif « appelé aussi… »). Prioritaire dans `wikiItemUrl()` pour générer des liens directs valides.

### Corrigé
- **Import CDN wiki** (`wiki-fill-cdn.mjs`) :
  - Regex élargie : capture toutes les racines CDN (`personnages_midas/`, `interieurTaverne/`, etc.) et les URLs tronquées finissant par `_@1X.` ou `.`.
  - `fixTruncatedCdnUrl()` répare les URLs incomplètes (ex. `fondGrotteMarine_0_@1X.` → `.png`).
  - `assetInfo()` conserve le préfixe de racine CDN pour reconstruire l'URL complète correcte.
  - `CDN_FULL_ROOT` (`.../images/`) utilisé pour les vérifications d'existence (pas seulement `personnages_midas/`).
- **Blacklist** : `Guenilles en forme de` ajoutée (page mère listant des éléments déjà dans le catalogue), avec `Guenilles` et `Renard de la nuit`.
- **Enrichissement** (`catalog-enrich.mjs`) : `BASE_PATH=public/rk/catalog.json` par défaut dans `package.json` → l'enrichissement préserve les CDN/nom ajoutés par `wiki-fill-cdn` au lieu de les écraser depuis `data/catalog-wiki-union.json`.
- **Titres wiki** : 351 fiches corrigées (casse, qualificatifs) via correspondance slug→titre depuis `wiki-catalog-raw.json`, `catalog-wiki-clean.json` et `catalog-wiki-en.json` (ex. « Festive mask » → « Panoplie Fête »).

### Résultat
- `public/rk/catalog.json` : 2 137 fiches (1 077 M / 1 060 F), 2 123 avec CDN (99 %), 2 019 avec `zIndexCalques` (94 %).
- 1 099 titres wiki uniques vérifiés via l'API MediaWiki : 0 manquant.
- 5 URLs signalées (Hache de Robert Guiscard, Brutus, Gants Académiques, Gants parfumés des Quatre Maisons, Toque des Quatre Maisons) répondent HTTP 200.
- `npm run build` et `node --test tests/wardrobe.test.ts` verts.

## 2026-11-25 — Catalogue : pipeline wiki → enrichissement JSON, clé `zIndexCalques` unique

### Modifié

- Le catalogue est désormais reconstruit depuis le wiki FR + EN (`catalog:wiki:scan`, `catalog:wiki:en`, puis `catalog:public`) puis enrichi depuis un JSON unique `data/character-sheet-assets.json`. Les txt de fiches de personnage ne sont plus lus à chaque passe.
- `scripts/sheet-assets.mjs` génère ce JSON une fois (`--female`, `--male`) : 724 noms d'assets, une fiche par sexe, dédupliquée par nom et déclinaison de référence.
- `scripts/catalog-enrich.mjs` recopie les 15 clés de jeu (`idItem`, `declinaisons`, `slot`, `slotGardeRobe`, `miniature`, `zIndexCalques`…) et n'utilise plus `data/item-assets.json` ni `blabla.txt`. `KNOWN_SLOTS` est supprimé.
- `zIndex` est renommé `zIndexCalques` dans le catalogue, les formulaires, l'admin et les soumissions ; l'alias n'existe plus dans les fiches. `scripts/migrate-zindex-key.mjs` migre les JSON déjà stockés (dry-run par défaut, `--write`, sauvegarde, idempotent).
- Enrichissement : 1 334 / 2 064 fiches (1 309 exactes, 25 dérivées, 25 noms conservés), 453 sans correspondance, 62 liaisons refusées par la garde de catégorie, 215 fiches sans asset.
- `Bracelet` ajouté aux slots connus (libellés FR/EN, repli catégorie Bijoux).
- Filtrage des objets non portables : les pages dont l'infobox est `Amenagement`, `Outil`, `MatierePremiere2`, `Aliment` ou `ObjetNonCode` sont exclues, même si elles figurent dans une catégorie autorisée (ex. les bons d'achat dans « Vêtement événementiel », les meubles dans « Panoplie »). 21 entrées retirées (meubles de packs IRL, bons d'achat, matières premières, aliment, objets décoratifs).
- Les éléments de panoplie qui n'ont pas de page wiki propre (simplement listés comme variantes de couleur dans le tableau de la panoplie parente) ne créent plus de fiche séparée. Retire « Bure blanche » (variante de « Bure de Rituel ») et « Ultime Missive » (redirection vers « L'Ultime Missive »).
- La catégorie `Tatouage` est maintenant scannée.
- **Mapping FR/EN fiable** : nouveau script `scripts/build-name-map.mjs` qui télécharge `FragmentsRAR.php` (FR et EN) du jeu et construit un mapping bidirectionnel des 2 393 noms d'objets par ID numérique. `catalog-merge-en.mjs` l'utilise maintenant (méthode `game-map-fr-en`) pour retrouver la page EN correspondante à un objet FR, même quand les noms diffèrent totalement (ex. « Porte-bébé par Alii » ↔ « Baby carrier by Alii »). Résultat : 165 CDN récupérés via ce mapping (contre 0 avant), seulement 46 fiches sans CDN au final.
- **Catégorisation par modèle** : le type d'infobox (`Familier`, `Arme`, `CadreDecor`, etc.) lu dans le wikitexte détermine maintenant la catégorie d'armoire (`slotGardeRobe`), prioritaire sur la catégorie wiki ou la section. Corrige les éléments de panoplie qui sont en réalité des familiers, armes, décors, etc. (ex. « Hibou de Baba Yaga » → `Familiers` au lieu de `Panoplies`).

### Résultat

- `public/rk/catalog.json` : 2 064 fiches, aucune clé `zIndex` résiduelle, 1 334 avec `zIndexCalques`, 1 849 avec `nom`, 2 018 avec CDN.
- Tests `wardrobe` et `npm run build` verts. `tests/tournament.test.ts` échoue toujours hors catalogue (attendu `—`, obtenu ` - `).

## 2026-11-22 — Catalogue : rescan wiki complet sans cache

### Modifié

- Pipeline relancé avec `WIKI_REFRESH=1` sur les deux langues (aucune réponse HTTP réutilisée) : FR → `data/catalog-wiki-clean.json`, EN → `data/catalog-wiki-en.json`, puis export FR, merge EN et enrichissement.
- `public/rk/wiki-fr.json` : 1 076 objets, 906 avec CDN (890 avant). `public/rk/wiki-en.json` : 1 278 objets, 1 094 avec CDN (1 093 avant).

### Résultat

- Catalogue public : 2 010 / 2 104 fiches avec CDN (2 008 avant), 94 restantes sans CDN. 1 224 fiches enrichies depuis la fiche de jeu.
- Tests `wardrobe` et `npx astro build` verts. `tests/tournament.test.ts` échoue déjà hors catalogue (attendu `—`, obtenu ` - `).

## 2026-11-21 — Catalogues wiki séparés + catalogue public FR complété par l'EN

### Ajouté

- Deux extractions wiki indépendantes, sans donnée de l'autre langue ni donnée de jeu : `public/rk/wiki-fr.json` (1 076 objets, 890 avec CDN) et `public/rk/wiki-en.json` (1 278 objets, 1 093 avec CDN). `Special_object` est exclu du catalogue EN (objets de jeu, pas de garde-robe).
- Nouvel onglet admin « Wiki » (`/admin/wiki`) avec sous-onglets FR / EN, filtres react-select avec compteurs, badges, pagination et export Excel à deux feuilles (Catalogue / Sans CDN).
- `scripts/catalog-from-wiki-en.mjs` (extraction EN, cache `.cache/wiki-en`) et `scripts/wiki-catalog-export.mjs` (aplatissement FR). Scripts npm `catalog:wiki:fr`, `catalog:wiki:en`, `catalog:wiki:en:refresh`.
- `scripts/catalog-merge-en.mjs` + script npm `catalog:public` : le catalogue public reste la version FR, complétée uniquement par les CDN relevés sur les pages `File:` du wiki EN (288 fiches récupérées). Aucun nom ni section ne change de langue.
- Lien direct vers la fiche wiki dans le catalogue public : cliquer sur le nom ouvre la page dans un nouvel onglet, dans la langue de l'interface.

### Résultat

- Catalogue public : 2 008 / 2 104 fiches avec CDN (contre 1 720 avant complétion), 96 restantes sans CDN. Aucun `nameFr` modifié.
- `npx astro build` : exit 0.

## 2026-11-20 — Catalogue : jointure fiche de jeu fiable + registre `item-assets`

### Corrigé

- Le nom d'asset tiré du CDN ne colle plus un `0` en fin de nom (`pantalonEnSoie_d0_0` → `pantalonEnSoie` au lieu de `pantalonEnSoie0`) : la jointure avec la fiche de jeu devient exacte pour 53 fiches de plus.
- La jointure par nom approché (`nom` sans suffixe `_m0`/`_n0`/`_p0` ou sans chiffre final) exige désormais une catégorie d'armoire compatible : 43 coiffures ne prennent plus le zIndex du chapeau `coiffure` (calque 10300).
- Le `slot` technique fourni par la fiche de jeu est enfin recopié (1146 fiches) : la liste d'autorisation était construite depuis un catalogue où tous les slots étaient vides.
- Enrichissement : 1150 / 2106 fiches (contre 1140), 1124 par nom exact, 26 par nom dérivé, 43 liaisons douteuses refusées.

### Ajouté

- `data/item-assets.json` : registre durable du lien, clé `idItem`, valeur les champs d'affichage relevés sur une fiche (nom, slot, zIndex, masques, postures). Fusionné entre fiches, il survit aux passes wiki et sert de source à `catalog-enrich.mjs`.

## 2026-11-20 — Catalogue : outils non visuels retirés

### Corrigé

- Les objets `Outils_barque`, `Outils_filet` et `Outils_echelle` (Barque, Filet de pêche, Grande/Petite échelle) sont retirés du catalogue : ce sont des outils de jeu, pas des éléments visuels portables par la cabine d'essayage. Ils sont listés dans le rapport d'extraction avec leur motif d'exclusion.
- Catalogue à 2106 fiches (1060 M / 1046 F), 1649 avec CDN, 0 doublon. Tests et build verts.

## 2026-11-20 — Catalogue : aperçus CDN dédupliqués

### Corrigé

- La colonne « URLs CDN » affichait deux fois la même URL pour un objet mixte : `buildRows` concaténait les aperçus de la fiche homme et de la fiche femme (ex. « Fond Jour de marché »). Les URL sont désormais dédupliquées avant affichage.
- Le catalogue lui-même n'était pas en cause : chaque fiche ne porte qu'un seul chemin CDN (`fonds/fondJourMarche_0_@1X.png`).

## 2026-11-20 — Catalogue : libellés issus des titres wiki

### Corrigé

- Le libellé français d'une fiche est désormais le **titre de la page wiki**, pas le champ `nom` du modèle. Exemple : « Fond Jour de marché » (titre de la page) remplace « décor jour de marché » (champ `nom=Le décor jour de marché`). 1715 libellés alignés sur le wiki.
- Le CDN du fond est retrouvé via `Fichier:Item1584grand.png` (`fonds/fondJourMarche_0_@1X.png`) et l'objet reste classé `Fonds`.
- Catalogue à 2114 fiches (1649 avec CDN), 943 éléments tagués sur 104 articles, 0 doublon de nom ni de CDN. Tests et build verts.

## 2026-11-20 — Catalogue : décors exclus des éléments de panoplie

### Corrigé

- Les décors et fonds listés dans les panoplies ou packs (ex. « fond Jour de marché » du pack du marchand avisé, « décors à travers la roseraie ») ne sont plus traités comme des éléments : ni tag d'article parent, ni fiche d'élément. Ce ne sont ni des vêtements, ni des armes.
- Ils restent présents dans le catalogue comme objets autonomes et sont classés `Fonds` ou `Cadres` d'après leur dossier CDN (`fonds/` ou `cadres/`), au lieu d'hériter de `Panoplies`.
- 659 éléments tagués sur 79 articles, 0 décor tagué. Tests et build verts.

## 2026-11-20 — Catalogue : export Excel en menu « ⋮ »

### Corrigé

- Le bouton texte « Export Excel » de la barre de filtres est remplacé par une icône « ⋮ » compacte. Le clic ouvre un menu contextuel avec « Exporter en Excel » et le nombre de résultats actuellement filtrés.
- Le menu reprend le comportement de `RowMenu` : portail en position fixe, fermeture au clic extérieur, au scroll et avec Échap, navigation au clavier. L'export lui-même est inchangé (une colonne par catégorie, lignes filtrées uniquement).
- L'icône reste le dernier élément de la barre, après « Réinitialiser », poussée à droite (`ml-auto`) et calée sur la hauteur des autres contrôles (`h-10`).

## 2026-11-20 — Catalogue : relecture des pages `Fichier:` vides

### Corrigé

- Certaines pages `Fichier:` restaient enregistrées vides dans le cache HTTP alors que le wiki publie désormais leurs URL CDN — par exemple `Item1776h.gif` de « Barbe fleurie » et ses 8 calques `barbe_13_c0…c7`.
- Le scan relit maintenant en force les pages de sprites revenues vides (435 pages), sans invalider le reste du cache. Correction applicable à chaque passage, pas seulement via `WIKI_REFRESH=1`.
- « Barbe fleurie » récupère le nom d'asset `barbe13` et ses 8 CDN. Catalogue à 1545 fiches avec CDN (451 sans), 0 doublon, tests et build verts.

## 2026-11-19 — Catalogue : champs complets de la fiche de jeu

### Ajouté

- `catalog-enrich.mjs` recopie désormais les 15 clés de `blabla.txt` sur chaque fiche appariée : `idItem`, `declinaison`, `parametre`, `nom`, `slot`, `slotGardeRobe`, `miniature`, `declinaisons`, `slotsMasques`, `dependCouleurPeau`, `dependPostureMainG`, `dependPostureMainD`, `postureMainG`, `postureMainD`, `zIndexCalques`. Le champ `zIndex` reste synchronisé pour la cabine d'essayage.
- Les champs déjà fournis par le wiki (`nom`, `slot`, `slotGardeRobe`, `miniature`, `declinaisons`) ne sont comblés que s'ils sont vides : la fiche est féminine, ses emplacements ne valent pas pour les fiches masculines. Les slots inconnus de l'application (ex. « Bracelet ») sont ignorés.
- 1082 fiches sur 1996 portent désormais les 15 clés, avec un zIndex renseigné. `CatalogItem` declare les nouveaux champs optionnels. Tests et build verts.

## 2026-11-19 — Catalogue : libellés des tableaux de panoplies

### Corrigé

- `parseImageRows` lisait le libellé de la cellule après avoir conservé les cellules d'images : le libellé était vide ou pollué par `align="center"`, donc les éléments n'étaient jamais reliés à leurs pages `Fichier:`. Le libellé est maintenant lu sur la première ligne, images retirées avant de couper au séparateur `|`.
- Les trois éléments de « Panoplie 'Garde' » récupèrent leurs CDN : `Cotte de maille` (`maille_0`), `Gantelets` (`gantMetal_m0/m1/m2`) et `Cuissards` (`cuissardeMetal_0`), en homme et femme. Le tag d'article parent est conservé.
- 1528 fiches avec CDN (avant : 1498), 677 éléments tagués sur 79 articles, 0 doublon CDN. Tests et build verts.

## 2026-11-19 — Catalogue : rescan wiki rafraîchi

### Corrigé

- Le cache HTTP du scan wiki n'avait pas d'expiration : certaines pages `Fichier:` restaient enregistrées avec un contenu vide alors que le wiki publie depuis leurs URL CDN. `Épée brisée` était ainsi affichée « sans CDN » malgré ses quatre calques (`armeEpeeBrisee_0/1`, homme et femme).
- Le scan reprend les CDN de ces pages ; `Épée brisée` a désormais ses 2 calques par sexe et le nom d'asset `armeEpeeBrisee`. 1498 fiches avec CDN, 0 doublon.

### Ajouté

- `npm run catalog:wiki:refresh` force un scan neuf (`WIKI_REFRESH=1`) pour repartir du wiki plutôt que du cache ; `catalog:wiki:scan` et `catalog:enrich` rejouent les deux passes. Catalogue à 1992 fiches (1004 M / 988 F), tests et build verts.

## 2026-11-19 — Catalogue : tag d'article parent au lieu de la fiche panoplie

### Corrigé

- Les articles composés (panoplies, ensembles) ne sont plus insérés comme fiches dans le catalogue : leur `zIndex` est inconnu, donc ils ne peuvent pas être portés correctement dans la cabine d'essayage.
- Leurs éléments portent désormais un champ `group` avec le nom de l'article parent. Les 4 éléments de la « Panoplie à la Mandragore » sont ainsi tagués `panoplie à la Mandragore` tout en restant sélectionnables individuellement avec leur propre zIndex.
- Le tag est indexé dans la recherche (chercher « Mandragore » retrouve les 4 éléments) et affiché sous forme de badge dans `/catalogue`. Mécanisme générique : 674 éléments tagués sur 76 articles.
- Catalogue à 1988 fiches (1002 M / 986 F), 1462 avec CDN, 0 doublon CDN. Tests et build verts.

## 2026-11-19 — Catalogue : CDN dédupliqués et panoplies complètes

### Corrigé

- Les URL CDN sont dédupliquées par chemin lors de la génération : un élément comme `bas du clair de lune` n'a plus que ses 2 calques au lieu de 4 entrées répétées. 0 fiche avec doublon CDN sur 1663.
- L'article parent d'une panoplie composée porte maintenant les CDN de **tous ses éléments** : choisir « Panoplie à la Mandragore » dans la cabine d'essayage affiche les 8 sprites d'un coup. Les quatre éléments restent bien sélectionnables séparément.
- Le nom d'asset du parent est relevé sur le fichier `*entier` de la page wiki (`panomandragore`), ce qui évite que la panoplie soit signalée « sans CDN ».

## 2026-11-19 — Catalogue : panoplies `PackEnsemble` et CDN des éléments

### Corrigé

- L'extracteur reconnaît aussi les fiches `{{PackEnsemble}}`. « Panoplie à la Mandragore » est décomposée en ses 4 éléments (`bas du clair de lune` en Braies/Jupes, `ceinture à la mandragore`, `châle en laine bouillie`, `talisman en tissu`), chacun avec ses CDN femme et homme relevés sur les pages `Fichier:` correspondantes.
- Les URL CDN des tableaux sont retrouvées malgré l'absence du préfixe `Fichier:` dans le wikitexte : la recherche essaie maintenant les deux formes.
- La présence simultanée des fichiers `*f.png` et `*h.png` suffit à considérer un élément comme mixte, même sans mention `vetementGenre`.
- 203 panoplies composées sont décomposées (87 avant). Catalogue à 2345 fiches (1180 M / 1165 F), 1462 avec CDN, 1025 enrichies en zIndex. 0 doublon de nom, tests et build verts.

## 2026-11-19 — Catalogue : export Excel des résultats filtrés

### Ajouté

- Bouton « Export Excel » dans la barre de filtres de `/catalogue` : il exporte **exactement les lignes affichées** (recherche, catégorie, sexe, données). Le filtre « Sans CDN » produit `catalogue-sans-cdn.xlsx`, etc.
- Le classeur reprend le modèle de `ItemRK.xlsx` : une colonne par catégorie de garde-robe, objets triés alphabétiquement, suffixe `(M)` / `(F)` pour les objets non mixtes. Vérifié sur les 790 objets sans CDN : 29 colonnes, 307 lignes.
- `src/lib/xlsx.ts` écrit le `.xlsx` sans nouvelle dépendance (ZIP non compressé + cellules en chaînes inline), compatible Excel / LibreOffice / Google Sheets.

## 2026-11-18 — Catalogue : extraction wiki propre, sans ryence

### Corrigé

- Le catalogue ne dépend plus du tout de ryence ni de l'ancien catalogue : `catalog-from-wiki.mjs` génère des fiches neuves (ids `wiki:*`, aucun `zIndex` inventé) à partir des pages wiki et de leurs pages `Fichier:`. `catalog-wiki-join.mjs` est supprimé.
- Les objets sont regroupés par **nom canonique** du template `nom`, plus par titre de page : les pages FR, EN et variantes qui portent le même nom ne créent plus plusieurs fiches (`panoplie 'Fête'`, `panoplie 'Garde'`…). 0 nom dupliqué.
- Les panoplies composées sont décomposées correctement : `Panoplie Fête` donne une fiche `Panoplies` pour l'ensemble et une fiche par élément avec son propre emplacement — `Veste d'Harlequin` (Bustiers F / Chemises M), `Collants` (Braies), `Masque` (Yeux). 87 panoplies composées traitées de la même façon.
- La catégorie vient de l'emplacement de la page objet, puis du type wiki (`Panoplie`, `Familier`, `Arme`, `Cadre`, `Decor`…), puis de la section du tableau. Les objets sans catégorie exploitable (43) sont écartés et listés dans le rapport au lieu d'être classés n'importe comment.

### Ajouté

- `scripts/catalog-enrich.mjs` : passe séparée qui remplit `zIndex`, `slotsMasques` et les dépendances peau/postures depuis la fiche de personnage (`blabla.txt`), sans toucher aux noms ni aux ids. 1074 fiches enrichies sur 2311.
- Catalogue à 2311 fiches (1163 M / 1148 F), 1521 avec CDN, 0 doublon de nom, 0 catégorie orpheline. Tests `wardrobe` et `astro build` verts.
- Les intermédiaires `data/catalog-wiki-clean*.json` et `data/catalog-enrich-report.json` sont ignorés par git.

## 2026-11-18 — Catalogue : régénération depuis le wiki

### Corrigé

- Le catalogue n'est plus issu des métadonnées ryence.de : `scripts/catalog-from-wiki.mjs` reconstruit les objets à partir des 16 tableaux de la page wiki « Vêtement » et des 92 pages de `Catégorie:Panoplie`. Les panoplies sont classées dans `Panoplies` d'après `vetementType=Panoplie`, et non plus rangées comme des colliers ou des casques.
- La catégorie vient en priorité de l'emplacement de la page objet (avec les variantes `(homme)` / `(femme)`), puis de la section du tableau ; `cheveux` et `barbe` au singulier sont désormais reconnus. 24 fiches changent ainsi de catégorie, dont `panoplie Procession d'Aristote`, `miroir à main` et plusieurs panoplies de concours.
- Les noms, libellés FR/EN, sexes, CDN, déclinaisons et dépendances (peau/postures) sont relevés sur les pages wiki et les pages `Fichier:` (3622 pages en cache, aucun re-téléchargement).

### Ajouté

- `scripts/catalog-wiki-join.mjs` : jointure déterministe des champs absents du wiki (`id`, `zIndex`, `slotsMasques`, `slot` technique) depuis l'ancien catalogue, par nom d'asset puis libellé, avec priorité aux fiches de jeu canoniques. Écrit `data/catalog-wiki-staged.json` et un rapport de diff avant tout remplacement.
- Rapport de régénération : 1914 fiches jointes, 105 objets nouveaux (id `wiki:*`), 131 fiches ryence abandonnées, 0 collision d'id, 0 zIndex perdu, 0 catégorie orpheline. Catalogue à 2019 fiches (1019 M / 1000 F), 1850 avec zIndex. Tests `wardrobe` et `astro build` verts.
- Les données intermédiaires (`data/wiki-catalog-raw.json`, `data/catalog-wiki-staged.json`, `data/catalog-wiki-report.json`) sont générées et ignorées par git.

## 2026-11-18 — Catalogue : calques, postures et objets mixtes

### Corrigé

- 28 objets par sexe (56 fiches) récupèrent leur `zIndex` depuis le `zIndexCalques` de la fiche du personnage fournie : `grevesPillard` → 2200, `capePillard` → 800/2201/6000, `ganteletsPillard` → 2350/17500/14500, familiers, ceintures des dunes… Seules les fiches au calque vide sont touchées ; `slotsMasques` et `declinaisons` restent inchangés.
- `ganteletsPillard` (M et F) dépend désormais des deux mains : `dependPostureMainG` et `dependPostureMainD` passent à `true`, comme sur la fiche. Les sprites `_m0_n0` répondent 200 sur le CDN pour les deux sexes.
- « Foulard du teinturier (Corail) » est référencé comme mixte : la fiche absente de M y est copiée avec les CDN `hommes/vetements/foulardTeinturier_d1_0` et `_d1_1`.
- « Médaille d'Aristote cardinalice » est référencée comme mixte : l'item de jeu `300` (complet) est ajouté en F et la fiche wiki fantôme `wiki:medaille-d-aristote-cardinalice` (sans nom, calque ni CDN) est supprimée. Une seule ligne « Mixte » reste dans `/catalogue`.

### Ajouté

- `catalog-dedupe` : détection des fiches `wiki:*` incomplètes qui doublonnent une fiche complète, copie des objets mixtes (cadres/fonds) vers le sexe manquant et report des traductions ou CDN manquants avant suppression.
- `wiki-audit --import` : n'importe plus de doublon quand une fiche du même objet existe déjà sous un autre id (fiche du jeu ou page wiki FR/EN).
- `wiki-fill-cdn` : correction du nom « Coiffure dans le vent », renard polaire marqué mixte, et distinction des teintes d'un même asset par déclinaison (`etole_d2` Divin / `etole_d3` Écarlate). Les trois scripts restent stables en dry-run. Catalogue à 2045 fiches (1030 M / 1015 F).

## 2026-11-18 — CDN : frames manquantes et emplacements genrés

### Corrigé

- L'`Accessoire de Rituel (Divin)` affiche désormais ses deux sprites par sexe (`etole_d2_0_@1X` et `etole_d2_1_@1X`), relevés sur les pages `Fichier:` anglaises. 17 autres fiches importées du wiki récupèrent de même leurs frames manquantes.
- `wiki-fill-cdn` ne prend plus le numéro de frame d'une URL `_dN_F` pour une déclinaison : les frames d'un même objet partagent un nom d'asset et toutes leurs URL sont conservées dans `cdn`.
- Catégories corrigées d'après l'emplacement du wiki : Bure de Rituel (Divin) → Mantels (M/F), Bas du clair de lune → Braies (M) / Jupes (F), Accessoire de Rituel (Divin) → Cou (M) / Chapeaux (F), Bas des dunes → Jupes (F).
- `wiki-fill-cdn` lit l'emplacement sur plusieurs lignes et distingue `(homme)` / `(femme)` au lieu de ne garder que la dernière ligne du champ.

### Ajouté

- Scripts relancés en écriture (`wiki-fill-cdn`, `catalog-dedupe`, `wiki-audit --import --merge-sexes`) : `Chemises` (M/F), `Chemise de l'Abeilleur` (M) et `Léine celtique` (M) complétées ; Cervelière du Pillard (F) remplacée par la fiche complète ; `data/wiki-gaps.json` actualisé. Catalogue à 2044 fiches.

## 2026-11-18 — Catégories : emplacements wiki et filtre « Autres »

### Corrigé

- 28 fiches wiki (14 par sexe) classées « Autres » parce que leur `slotGardeRobe` valait `Accessoires` ou `Evenementiels` sont désormais dans la bonne catégorie de garde-robe, d'après l'emplacement documenté sur le wiki : Braies, Ceintures, Chaussures, Gants, Panoplies, Capes, Chapeaux, Cou, Yeux, Tabliers, Main droite, Bustiers.
- `wiki-fill-cdn` dérive désormais la catégorie du champ `emplacement` du template wiki (« III.a : Braies », « XII. : Outfits ») avant de retomber sur la catégorie wiki générique. Les futures fiches importées ne devraient plus arriver en « Autres ».
- 3 fiches par sexe restent en « Autres » : leurs pages wiki n'ont pas d'emplacement renseigné.

### Ajouté

- Le filtre « Catégorie » de `/catalogue` propose « Autres » (badge avec le compteur) uniquement si des objets y sont classés — permet de repérer les fiches à corriger.

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
