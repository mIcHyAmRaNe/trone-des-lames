/** Styles et parseurs partagés par les formulaires du catalogue. */

import type { Lang } from '../../i18n';

/** Textes d'aide affichés sous les champs, par langue. */
export const FIELD_HELP = {
  fr: {
    nom: 'Identifiant du fichier image sur le CDN. Laisser vide si inconnu.',
    zIndexCalques: 'Ordre de superposition des calques. Rempli automatiquement quand il est connu.',
    declinaisons: 'Une valeur par variante de couleur.',
    slotsMasques: 'Emplacements recouverts par cet objet.',
    depends: 'À cocher si le calque change selon la peau ou la posture des mains.',
  },
  en: {
    nom: 'Image file identifier on the CDN. Leave blank if unknown.',
    zIndexCalques: 'Layer stacking order. Filled automatically when known.',
    declinaisons: 'One value per colour variant.',
    slotsMasques: 'Slots covered by this item.',
    depends: 'Tick if the layer changes with skin colour or hand posture.',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export const FIELD_INPUT =
  'w-full border border-gold/25 bg-ink/60 px-3 py-2.5 text-sm text-parchment placeholder:text-parchment-dim/50 transition-colors hover:border-gold/40 focus:border-gold/60 focus:outline-none';

/** « 42 » ou « 40, 41 » -> nombres ; `null` si une valeur n'est pas un nombre. */
export function parseNumberList(raw: string): number[] | null {
  if (!raw.trim()) return [];
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  const nums = parts.map(Number);
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}

/** « Chemise, Cape » -> ['Chemise', 'Cape']. */
export function parseTextList(raw: string): string[] {
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

/** Emplacements connus du catalogue, triés, pour les listes déroulantes. */
export function slotOptions(slots: readonly string[], current?: string): string[] {
  const all = new Set(slots.filter(Boolean));
  if (current) all.add(current);
  return [...all].sort((a, b) => a.localeCompare(b, 'fr'));
}
