# Changelog

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
