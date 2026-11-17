// Contrat partagé entre le formulaire (navigateur) et les routes API (serveur).
// Aucun import Node ici : le module est chargé des deux côtés.

import type { Lang } from '../i18n';
import type { CatalogItem } from './wardrobe';

export type Sex = 'M' | 'F';

export interface SubmissionPayload {
  sexes: Sex[];
  /** Nom d'asset CDN. `null` = fiche relevée au wiki, asset encore inconnu. */
  nom: string | null;
  nameFr: string | null;
  nameEn: string | null;
  slot: string;
  zIndex: number[];
  declinaisons: number[];
  slotsMasques: string[];
  dependCouleurPeau: boolean;
  dependPostureMainG: boolean;
  dependPostureMainD: boolean;
  sourceUrl: string | null;
  note: string | null;
}

export interface Submission {
  id: string;
  kind: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  /** Edit : id de l'objet. Create : empreinte du nom + emplacement. */
  targetKey: string;
  itemId: string | null;
  payload: SubmissionPayload;
  /** État de l'objet avant la modification, `null` pour une création. */
  before: SubmissionPayload | null;
  submittedBy: string;
  submittedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  adminNote: string | null;
}

export interface SubmissionRequest {
  kind: 'create' | 'edit';
  itemId?: string | null;
  item: SubmissionPayload;
  /** Pseudo Renaissance Kingdoms du proposeur, vérifié côté serveur. */
  login: string;
  /** Champ piège, doit rester vide (anti-robot). */
  website?: string;
  /** Millisecondes écoulées depuis l'affichage du formulaire. */
  elapsedMs?: number;
}

export type SubmissionError =
  | { error: 'invalid item'; fields: Record<string, string> }
  | { error: 'unchanged' }
  | { error: 'duplicate-pending'; id: string; submittedBy: string; submittedAt: string }
  | { error: 'already-exists'; id: string; label: string }
  | { error: 'unknown-player'; login: string }
  | { error: 'rk-unavailable' }
  | { error: 'rate-limited' }
  | { error: 'bot' };

export interface PendingList {
  pending: { targetKey: string; kind: 'create' | 'edit'; submittedAt: string }[];
}

/** Motifs de signalement proposés depuis le catalogue. */
export const REPORT_REASONS = [
  ['duplicate', 'Objet en double'],
  ['delete', 'Objet à supprimer'],
  ['wrong-data', 'Données erronées'],
  ['other', 'Autre'],
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number][0];

/** Motifs de signalement en anglais (mêmes clés, même ordre). */
export const REPORT_REASONS_EN = [
  ['duplicate', 'Duplicate item'],
  ['delete', 'Item to delete'],
  ['wrong-data', 'Wrong data'],
  ['other', 'Other'],
] as const satisfies readonly (readonly [ReportReason, string])[];

export function reportReasonLabel(reason: ReportReason, lang: Lang = 'fr'): string {
  const table = lang === 'en' ? REPORT_REASONS_EN : REPORT_REASONS;
  return table.find(([key]) => key === reason)?.[1] ?? reason;
}

export interface ReportRequest {
  itemId: string;
  reason: ReportReason;
  message?: string;
  website?: string;
  elapsedMs?: number;
}

export interface Report {
  id: string;
  itemId: string;
  itemLabel: string;
  reason: ReportReason;
  message: string | null;
  status: 'open' | 'closed';
  createdAt: string;
  closedAt: string | null;
}

/** Champs modifiables d'un objet, dans l'ordre d'affichage du diff. */
export const SUBMISSION_FIELDS = [
  ['nameFr', 'Nom FR'],
  ['nameEn', 'Nom EN'],
  ['nom', 'Asset CDN'],
  ['slot', 'Emplacement'],
  ['sexes', 'Sexes'],
  ['zIndex', 'zIndex'],
  ['declinaisons', 'Déclinaisons'],
  ['slotsMasques', 'Slots masqués'],
  ['dependCouleurPeau', 'Dépend de la peau'],
  ['dependPostureMainG', 'Dépend main gauche'],
  ['dependPostureMainD', 'Dépend main droite'],
] as const satisfies readonly (readonly [keyof SubmissionPayload, string])[];

export type SubmissionField = (typeof SUBMISSION_FIELDS)[number][0];

/** Libellés anglais des champs modifiables (mêmes clés). */
const SUBMISSION_LABELS_EN: Record<SubmissionField, string> = {
  nameFr: 'Name FR',
  nameEn: 'Name EN',
  nom: 'CDN asset',
  slot: 'Slot',
  sexes: 'Sexes',
  zIndex: 'zIndex',
  declinaisons: 'Colour variants',
  slotsMasques: 'Masked slots',
  dependCouleurPeau: 'Depends on skin colour',
  dependPostureMainG: 'Depends on left hand',
  dependPostureMainD: 'Depends on right hand',
};

/** Valeur d'un champ telle qu'affichée (jamais `undefined`). */
export function fieldValue(
  payload: SubmissionPayload,
  key: SubmissionField,
  lang: Lang = 'fr',
): string {
  const v = payload[key];
  if (Array.isArray(v)) return v.length ? v.join(', ') : ' - ';
  if (typeof v === 'boolean') return v ? (lang === 'en' ? 'yes' : 'oui') : lang === 'en' ? 'no' : 'non';
  return v === null || v === '' ? ' - ' : String(v);
}

/** Diff lisible entre l'état publié et la proposition. */
export function submissionDiff(
  before: SubmissionPayload,
  after: SubmissionPayload,
  lang: Lang = 'fr',
) {
  return SUBMISSION_FIELDS.map(([key, label]) => ({
    key,
    label: lang === 'en' ? SUBMISSION_LABELS_EN[key] : label,
    from: fieldValue(before, key, lang),
    to: fieldValue(after, key, lang),
  })).filter((d) => d.from !== d.to);
}

/** Préremplit le formulaire depuis un objet du catalogue. */
export function payloadFromItem(item: CatalogItem, sexes: Sex[]): SubmissionPayload {
  return {
    sexes,
    nom: item.nom,
    nameFr: item.nameFr,
    nameEn: item.nameEn,
    slot: item.slot || item.slotGardeRobe || '',
    zIndex: [...item.zIndex],
    declinaisons: [...item.declinaisons],
    slotsMasques: [...item.slotsMasques],
    dependCouleurPeau: item.dependCouleurPeau,
    dependPostureMainG: item.dependPostureMainG,
    dependPostureMainD: item.dependPostureMainD,
    sourceUrl: null,
    note: null,
  };
}