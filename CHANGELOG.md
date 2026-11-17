# Changelog

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
