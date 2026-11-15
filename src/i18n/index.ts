/** Langues disponibles. Ajouter ici suffit : le sélecteur et le cookie suivent. */
export const LANGS = { fr: 'Français', en: 'English' } as const;
export type Lang = keyof typeof LANGS;
export const DEFAULT_LANG: Lang = 'fr';
export const LANG_COOKIE = 'tdl-lang';

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && Object.hasOwn(LANGS, value);
}

/** Locale d'affichage : le français du site est hexagonale, l'anglais britannique. */
export function locale(lang: Lang): string {
  return lang === 'en' ? 'en-GB' : 'fr-FR';
}

export function nf(lang: Lang): Intl.NumberFormat {
  return new Intl.NumberFormat(locale(lang));
}

/** Textes communs à toutes les pages (coque du site). */
const COMMON = {
  fr: {
    site: 'LE TRÔNE DES LAMES',
    home: 'Accueil',
    tournament: 'Tournoi',
    agenda: 'Agenda',
    seneschal: 'Sénéchal',
    wardrobe: 'Garde-robe',
    catalogue: 'Catalogue',
    mainNav: 'Navigation principale',
    homeAria: 'Le Trône des Lames, accueil',
    language: 'Langue',
    theme: 'Thème',
    footerTagline:
      'Tournoi & agenda des animations Renaissance Kingdoms. Résultats et animations validés par l’organisation.',
    footerUnofficial:
      'Site de joueurs lié à Renaissance Kingdoms, non officiel et non reconnu par Celsius Online.',
    footerPassword:
      'N’utilisez jamais votre mot de passe Renaissance Kingdoms sur un site externe : celui-ci ne vous le demande jamais.',
    footerGuides: 'Informations et guides établis par des joueurs, sans garantie d’exactitude.',
    privacy: 'Confidentialité & mentions',
    alphaTag: 'Alpha',
    alpha:
      'Site en cours de développement : certaines rubriques, données et outils peuvent changer ou être incomplets.',
  },
  en: {
    site: 'THE THRONE OF BLADES',
    home: 'Home',
    tournament: 'Tournament',
    agenda: 'Calendar',
    seneschal: 'Seneschal',
    wardrobe: 'Wardrobe',
    catalogue: 'Catalogue',
    mainNav: 'Main navigation',
    homeAria: 'The Throne of Blades, home',
    language: 'Language',
    theme: 'Theme',
    footerTagline:
      'Renaissance Kingdoms tournament & events calendar. Results and events approved by the organisers.',
    footerUnofficial:
      'A players’ site for Renaissance Kingdoms  -  unofficial and not endorsed by Celsius Online.',
    footerPassword:
      'Never enter your Renaissance Kingdoms password on an external site: this one never asks for it.',
    footerGuides: 'Information and guides written by players, with no guarantee of accuracy.',
    privacy: 'Privacy & legal notice',
    alphaTag: 'Alpha',
    alpha:
      'Site under development: some sections, data and tools may change or be incomplete.',
  },
} as const;

export type CommonKey = keyof (typeof COMMON)['fr'];

export function common(lang: Lang, key: CommonKey): string {
  return COMMON[lang][key];
}