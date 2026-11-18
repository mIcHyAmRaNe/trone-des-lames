// Catalogue de base + overrides approuvés. Ne lit PAS le disque en prod (Vercel fs read-only).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InArgs } from '@libsql/client';
import { getDb } from './db.js';
import type { Lang } from '../i18n/index.js';
import type { Catalog, CatalogItem, Sexe } from './wardrobe.js';
import { itemLabel } from './wardrobe.js';
import {
  type Submission,
  type SubmissionPayload,
  type SubmissionRequest,
  type SubmissionError,
  type PendingList,
  type Report,
  type ReportRequest,
  REPORT_REASONS,
  payloadFromItem,
  SUBMISSION_FIELDS,
} from './catalog-submit.js';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const BASE_CATALOG_PATH = join(__dirname, '..', '..', 'public', 'rk', 'catalog.json');

type RawSubmissionRow = {
  id: string;
  kind: 'create' | 'edit';
  status: 'pending' | 'approved' | 'rejected';
  target_key: string;
  item_id: string | null;
  payload: string;
  before: string | null;
  submitted_by: string;
  submitted_at: string;
  decided_by: string | null;
  decided_at: string | null;
  admin_note: string | null;
};

type OverrideRow = { sexe: Sexe; item_id: string; item: string; submission_id: string | null; updated_at: string };

let baseCatalog: Catalog | null = null;
let basePromise: Promise<Catalog> | null = null;

async function importBaseCatalog(): Promise<Catalog> {
  // En dev, le catalogue est réécrit par les scripts : le garder en mémoire
  // ferait servir un snapshot périmé à /api/catalog jusqu'au redémarrage.
  if (process.env.NODE_ENV !== 'production') {
    const txt = await readFile(BASE_CATALOG_PATH, 'utf8');
    return JSON.parse(txt) as Catalog;
  }
  if (baseCatalog) return baseCatalog;
  if (basePromise) return basePromise;
  basePromise = (async () => {
    const txt = await readFile(BASE_CATALOG_PATH, 'utf8');
    baseCatalog = JSON.parse(txt) as Catalog;
    return baseCatalog;
  })();
  return basePromise;
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^(?:le |la |les |l'|un |une |des |du |de |d')/, '')
    .replace(/[^a-z0-9]+/g, '');
}

function sortArray(arr: readonly unknown[]): readonly unknown[] {
  return [...arr].sort((a, b) => String(a).localeCompare(String(b)));
}

function payloadEqual(a: SubmissionPayload, b: SubmissionPayload): boolean {
  return SUBMISSION_FIELDS.every(([key]) => {
    const av = a[key];
    const bv = b[key];
    if (Array.isArray(av) && Array.isArray(bv)) {
      return JSON.stringify(sortArray(av)) === JSON.stringify(sortArray(bv));
    }
    return av === bv;
  });
}

/** Messages de validation renvoyés au client, dans la langue de sa requête. */
const MSG = {
  fr: {
    sexes: 'Sélectionnez au moins un sexe (M ou F).',
    nomLong: 'Nom d\'asset trop long (120 max).',
    nameFrLong: 'Nom FR trop long (160 max).',
    nameEnLong: 'Nom EN trop long (160 max).',
    slotLong: 'Emplacement trop long (40 max).',
    maxValues: (field: string) => `${field} : 64 valeurs max.`,
    numRange: (field: string) => `${field} : nombres entre 0 et 100000.`,
    slotsMasques: 'Slots masqués : 20 max, 40 caractères chacun.',
    nomOrZIndex: 'Un objet doit avoir un nom d\'asset OU au moins un zIndex.',
    itemIdRequired: 'ID objet requis pour une modification.',
    itemNotFound: 'Objet introuvable dans le catalogue.',
    reasonUnknown: 'Motif inconnu.',
    messageLong: 'Message trop long (500 max).',
  },
  en: {
    sexes: 'Select at least one sex (M or F).',
    nomLong: 'Asset name too long (120 max).',
    nameFrLong: 'French name too long (160 max).',
    nameEnLong: 'English name too long (160 max).',
    slotLong: 'Slot too long (40 max).',
    maxValues: (field: string) => `${field}: 64 values max.`,
    numRange: (field: string) => `${field}: numbers between 0 and 100000.`,
    slotsMasques: 'Hidden slots: 20 max, 40 characters each.',
    nomOrZIndex: 'An item needs an asset name OR at least one zIndex.',
    itemIdRequired: 'Item ID required for an edit.',
    itemNotFound: 'Item not found in the catalogue.',
    reasonUnknown: 'Unknown reason.',
    messageLong: 'Message too long (500 max).',
  },
} as const;

function validatePayload(payload: SubmissionPayload, lang: Lang = 'fr'): Record<string, string> | null {
  const msg = MSG[lang];
  const errors: Record<string, string> = {};
  if (!Array.isArray(payload.sexes) || payload.sexes.length === 0 || payload.sexes.some(s => s !== 'M' && s !== 'F')) {
    errors.sexes = msg.sexes;
  }
  if (payload.nom !== null && payload.nom.trim().length > 120) {
    errors.nom = msg.nomLong;
  }
  if (payload.nameFr !== null && payload.nameFr.trim().length > 160) {
    errors.nameFr = msg.nameFrLong;
  }
  if (payload.nameEn !== null && payload.nameEn.trim().length > 160) {
    errors.nameEn = msg.nameEnLong;
  }
  if (payload.slot.trim().length > 40) {
    errors.slot = msg.slotLong;
  }
  const checkNums = (arr: number[], field: string) => {
    if (arr.length > 64) errors[field] = msg.maxValues(field);
    for (const n of arr) {
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        errors[field] = msg.numRange(field);
        break;
      }
    }
  };
  checkNums(payload.zIndex, 'zIndex');
  checkNums(payload.declinaisons, 'declinaisons');
  if (payload.slotsMasques.length > 20 || payload.slotsMasques.some(s => s.length > 40)) {
    errors.slotsMasques = msg.slotsMasques;
  }
  return Object.keys(errors).length ? errors : null;
}

async function loadOverrides(): Promise<{ M: Map<string, CatalogItem>; F: Map<string, CatalogItem> }> {
  const d = await getDb();
  const r = await d.execute({ sql: 'SELECT sexe, item_id, item FROM catalog_overrides', args: [] });
  const M = new Map<string, CatalogItem>();
  const F = new Map<string, CatalogItem>();
  for (const row of r.rows as unknown as OverrideRow[]) {
    const item = JSON.parse(row.item) as CatalogItem;
    if (row.sexe === 'M') M.set(row.item_id, item);
    else F.set(row.item_id, item);
  }
  return { M, F };
}

export async function loadMergedCatalog(): Promise<Catalog> {
  const base = await importBaseCatalog();
  const overrides = await loadOverrides();
  const sexes: Record<Sexe, CatalogItem[]> = { M: [...base.sexes.M], F: [...base.sexes.F] };
  for (const [id, item] of overrides.M) {
    const idx = sexes.M.findIndex(i => i.id === id);
    if (idx >= 0) sexes.M[idx] = item;
    else sexes.M.push(item);
  }
  for (const [id, item] of overrides.F) {
    const idx = sexes.F.findIndex(i => i.id === id);
    if (idx >= 0) sexes.F[idx] = item;
    else sexes.F.push(item);
  }
  return { ...base, sexes };
}

export async function listSubmissions(status?: Submission['status']): Promise<Submission[]> {
  const d = await getDb();
  let sql = 'SELECT * FROM catalog_submissions ORDER BY submitted_at DESC';
  const args: InArgs = [];
  if (status) {
    sql = 'SELECT * FROM catalog_submissions WHERE status = ? ORDER BY submitted_at DESC';
    args.push(status);
  }
  const r = await d.execute({ sql, args });
  return (r.rows as unknown as RawSubmissionRow[]).map(row => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    targetKey: row.target_key,
    itemId: row.item_id,
    payload: JSON.parse(row.payload),
    before: row.before ? JSON.parse(row.before) : null,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    adminNote: row.admin_note,
  }));
}

export async function pendingKeys(): Promise<PendingList> {
  const d = await getDb();
  const r = await d.execute({
    sql: 'SELECT target_key, kind, submitted_at FROM catalog_submissions WHERE status = ? ORDER BY submitted_at DESC',
    args: ['pending'],
  });
  return {
    pending: (r.rows as unknown as { target_key: string; kind: 'create' | 'edit'; submitted_at: string }[]).map(row => ({
      targetKey: row.target_key,
      kind: row.kind,
      submittedAt: row.submitted_at,
    })),
  };
}

export async function createSubmission(login: string, req: SubmissionRequest, lang: Lang = 'fr'): Promise<{ ok: true; id: string } | SubmissionError> {
  const msg = MSG[lang];
  // Anti-bot
  if (req.website && req.website.trim() !== '') return { error: 'bot' };
  if (typeof req.elapsedMs === 'number' && req.elapsedMs < 1200) return { error: 'bot' };

  const payload: SubmissionPayload = {
    sexes: req.item.sexes,
    nom: req.item.nom?.trim() ?? null,
    nameFr: req.item.nameFr?.trim() ?? null,
    nameEn: req.item.nameEn?.trim() ?? null,
    slot: req.item.slot.trim(),
    zIndex: req.item.zIndex ?? [],
    declinaisons: req.item.declinaisons ?? [],
    slotsMasques: req.item.slotsMasques ?? [],
    dependCouleurPeau: !!req.item.dependCouleurPeau,
    dependPostureMainG: !!req.item.dependPostureMainG,
    dependPostureMainD: !!req.item.dependPostureMainD,
    sourceUrl: req.item.sourceUrl?.trim() ?? null,
    note: req.item.note?.trim() ?? null,
  };

  const fieldErrors = validatePayload(payload, lang);
  if (fieldErrors) return { error: 'invalid item', fields: fieldErrors };

  const catalog = await loadMergedCatalog();
  const allItems = [...catalog.sexes.M, ...catalog.sexes.F];

  if (req.kind === 'create') {
    // Doublon : même nom d'asset (insensible casse) OU même nameFr/nameEn normalisé
    const nomNorm = payload.nom?.toLowerCase().trim();
    const nameFrNorm = payload.nameFr ? normalizeName(payload.nameFr) : null;
    const nameEnNorm = payload.nameEn ? normalizeName(payload.nameEn) : null;

    const exists = allItems.find(it => {
      if (nomNorm && it.nom?.toLowerCase() === nomNorm) return true;
      if (nameFrNorm && it.nameFr && normalizeName(it.nameFr) === nameFrNorm) return true;
      if (nameEnNorm && it.nameEn && normalizeName(it.nameEn) === nameEnNorm) return true;
      return false;
    });
    if (exists) {
      return { error: 'already-exists', id: exists.id, label: exists.nameFr ?? exists.nameEn ?? exists.nom ?? exists.id };
    }

    // Un create doit avoir au moins nom OU zIndex
    if ((!payload.nom || payload.nom === '') && (!payload.zIndex || payload.zIndex.length === 0)) {
      return { error: 'invalid item', fields: { nom: msg.nomOrZIndex } };
    }
  } else {
    // Edit
    if (!req.itemId) return { error: 'invalid item', fields: { itemId: msg.itemIdRequired } };
    const existing = allItems.find(it => it.id === req.itemId);
    if (!existing) return { error: 'invalid item', fields: { itemId: msg.itemNotFound } };

    const existingSexes = new Set([...catalog.sexes.M.filter(i => i.id === req.itemId).map(() => 'M'), ...catalog.sexes.F.filter(i => i.id === req.itemId).map(() => 'F')]);
    const before = payloadFromItem(existing, [...existingSexes] as ('M' | 'F')[]);

    if (payloadEqual(before, payload)) {
      return { error: 'unchanged' };
    }
  }

  // Limite 20 pending par utilisateur
  const d = await getDb();
  const pendingCount = await d.execute({
    sql: 'SELECT COUNT(*) as c FROM catalog_submissions WHERE status = ? AND submitted_by = ?',
    args: ['pending', login],
  });
  if ((pendingCount.rows[0]?.c as number) >= 20) {
    return { error: 'rate-limited' };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  let targetKey: string;
  if (req.kind === 'edit') {
    targetKey = req.itemId!;
  } else {
    const nomForKey = payload.nom ?? payload.nameFr ?? payload.nameEn ?? 'objet';
    targetKey = `create:${normalizeName(nomForKey)}|${payload.slot.toLowerCase()}`;
  }

  const row = {
    id,
    kind: req.kind,
    status: 'pending' as const,
    target_key: targetKey,
    item_id: req.kind === 'edit' ? req.itemId : null,
    payload: JSON.stringify(payload),
    before: req.kind === 'edit' ? JSON.stringify(payloadFromItem(
      allItems.find(it => it.id === req.itemId)!,
      [...new Set([...catalog.sexes.M.filter(i => i.id === req.itemId).map(() => 'M'), ...catalog.sexes.F.filter(i => i.id === req.itemId).map(() => 'F')])] as ('M' | 'F')[]
    )) : null,
    submitted_by: login,
    submitted_at: now,
    decided_by: null,
    decided_at: null,
    admin_note: null,
  };

  // Vérification manuelle du doublon pending (l'index partiel n'est pas fiable sur libsql)
  const existingPending = await d.execute({
    sql: 'SELECT id, submitted_by, submitted_at FROM catalog_submissions WHERE target_key = ? AND status = ?',
    args: [targetKey, 'pending'],
  });
  if (existingPending.rows.length > 0) {
    const ex = existingPending.rows[0] as unknown as { id: string; submitted_by: string; submitted_at: string };
    return { error: 'duplicate-pending', id: ex.id, submittedBy: ex.submitted_by, submittedAt: ex.submitted_at };
  }

  try {
    await d.execute({
      sql: `INSERT INTO catalog_submissions (id, kind, status, target_key, item_id, payload, before, submitted_by, submitted_at, decided_by, decided_at, admin_note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [row.id, row.kind, row.status, row.target_key, row.item_id, row.payload, row.before, row.submitted_by, row.submitted_at, row.decided_by, row.decided_at, row.admin_note] as InArgs,
    });
  } catch (e: unknown) {
    const err = e as { cause?: { code?: string } };
    if (err.cause?.code === 'SQLITE_CONSTRAINT') {
      // Doublon pending sur le même target_key
      const existing = await d.execute({
        sql: 'SELECT id, submitted_by, submitted_at FROM catalog_submissions WHERE target_key = ? AND status = ?',
        args: [targetKey, 'pending'],
      });
      const ex = existing.rows[0] as unknown as { id: string; submitted_by: string; submitted_at: string } | undefined;
      if (ex) return { error: 'duplicate-pending', id: ex.id, submittedBy: ex.submitted_by, submittedAt: ex.submitted_at };
    }
    throw e;
  }

  return { ok: true, id };
}

export async function decideSubmission(id: string, status: 'approved' | 'rejected', by: string, note?: string | null): Promise<Submission | null> {
  const d = await getDb();
  const existing = await d.execute({ sql: 'SELECT * FROM catalog_submissions WHERE id = ?', args: [id] });
  const row = existing.rows[0] as unknown as RawSubmissionRow | undefined;
  if (!row) return null;
  if (row.status !== 'pending') return null;

  const now = new Date().toISOString();

  if (status === 'rejected') {
    await d.execute({
      sql: 'UPDATE catalog_submissions SET status = ?, decided_by = ?, decided_at = ?, admin_note = ? WHERE id = ?',
      args: [status, by, now, note ?? null, id],
    });
    return { ...row, status, decided_by: by, decided_at: now, admin_note: note, payload: JSON.parse(row.payload), before: row.before ? JSON.parse(row.before) : null } as unknown as Submission;
  }

  // Approved
  const payload = JSON.parse(row.payload) as SubmissionPayload;
  const catalog = await loadMergedCatalog();
  const allItems = [...catalog.sexes.M, ...catalog.sexes.F];

  if (row.kind === 'edit' && row.item_id) {
    const baseItem = allItems.find(it => it.id === row.item_id);
    if (!baseItem) return null;

    const sexesPresent = new Set([...catalog.sexes.M.filter(i => i.id === row.item_id).map(() => 'M'), ...catalog.sexes.F.filter(i => i.id === row.item_id).map(() => 'F')]);

    for (const sexe of sexesPresent) {
      const mergedItem = catalog.sexes[sexe as Sexe].find(i => i.id === row.item_id) ?? baseItem;
      const updated: CatalogItem = {
        ...mergedItem,
        nom: payload.nom,
        nameFr: payload.nameFr ?? mergedItem.nameFr,
        nameEn: payload.nameEn ?? mergedItem.nameEn,
        slot: payload.slot,
        zIndex: payload.zIndex,
        declinaisons: payload.declinaisons,
        dependCouleurPeau: payload.dependCouleurPeau,
        dependPostureMainG: payload.dependPostureMainG,
        dependPostureMainD: payload.dependPostureMainD,
        slotsMasques: payload.slotsMasques,
      };
      await d.execute({
        sql: `INSERT INTO catalog_overrides (sexe, item_id, item, submission_id, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(sexe, item_id) DO UPDATE SET item = excluded.item, submission_id = excluded.submission_id, updated_at = excluded.updated_at`,
        args: [sexe, updated.id, JSON.stringify(updated), id, now],
      });
    }
  } else {
    // Create
    let baseId = `c-${id.replace(/-/g, '').slice(0, 8)}`;
    const taken = new Set(allItems.map(i => i.id));
    let candidate = baseId;
    let suffix = 2;
    while (taken.has(candidate)) {
      candidate = `${baseId}-${suffix++}`;
    }
    const finalId = candidate;

    const declinaisons = payload.declinaisons.length > 0 ? payload.declinaisons : [0];

    for (const sexe of payload.sexes) {
      const newItem: CatalogItem = {
        id: finalId,
        nom: payload.nom,
        slot: payload.slot,
        slotGardeRobe: null,
        miniature: 'o',
        declinaisons,
        zIndex: payload.zIndex,
        dependCouleurPeau: payload.dependCouleurPeau,
        dependPostureMainG: payload.dependPostureMainG,
        dependPostureMainD: payload.dependPostureMainD,
        slotsMasques: payload.slotsMasques,
        nameEn: payload.nameEn,
        nameFr: payload.nameFr,
      };
      await d.execute({
        sql: `INSERT INTO catalog_overrides (sexe, item_id, item, submission_id, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(sexe, item_id) DO UPDATE SET item = excluded.item, submission_id = excluded.submission_id, updated_at = excluded.updated_at`,
        args: [sexe, finalId, JSON.stringify(newItem), id, now],
      });
    }
  }

  await d.execute({
    sql: 'UPDATE catalog_submissions SET status = ?, decided_by = ?, decided_at = ?, admin_note = ? WHERE id = ?',
    args: [status, by, now, note ?? null, id],
  });

  return { ...row, status, decided_by: by, decided_at: now, admin_note: note, payload, before: row.before ? JSON.parse(row.before) : null } as unknown as Submission;
}
type RawReportRow = {
  id: string;
  item_id: string;
  item_label: string;
  reason: string;
  message: string | null;
  status: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
};

const toReport = (row: RawReportRow): Report => ({
  id: row.id,
  itemId: row.item_id,
  itemLabel: row.item_label,
  reason: row.reason as Report['reason'],
  message: row.message,
  status: row.status,
  createdAt: row.created_at,
  closedAt: row.closed_at,
});

export type ReportResult =
  | { ok: true; id: string }
  | { error: 'bot' }
  | { error: 'already-reported' }
  | { error: 'invalid item'; fields: Record<string, string> };

export async function createReport(req: ReportRequest, lang: Lang = 'fr'): Promise<ReportResult> {
  const msg = MSG[lang];
  if (req.website && req.website.trim() !== '') return { error: 'bot' };
  if (typeof req.elapsedMs === 'number' && req.elapsedMs < 1200) return { error: 'bot' };

  if (!REPORT_REASONS.some(([key]) => key === req.reason)) {
    return { error: 'invalid item', fields: { reason: msg.reasonUnknown } };
  }
  const message = req.message?.trim() || null;
  if (message && message.length > 500) {
    return { error: 'invalid item', fields: { message: msg.messageLong } };
  }

  const catalog = await loadMergedCatalog();
  const item = [...catalog.sexes.M, ...catalog.sexes.F].find(i => i.id === req.itemId);
  if (!item) {
    return { error: 'invalid item', fields: { itemId: msg.itemNotFound } };
  }

  const d = await getDb();
  const open = await d.execute({
    sql: 'SELECT id FROM catalog_reports WHERE item_id = ? AND reason = ? AND status = ?',
    args: [item.id, req.reason, 'open'],
  });
  if (open.rows.length > 0) return { error: 'already-reported' };

  const id = crypto.randomUUID();
  await d.execute({
    sql: `INSERT INTO catalog_reports (id, item_id, item_label, reason, message, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, item.id, itemLabel(item), req.reason, message, 'open', new Date().toISOString()],
  });
  return { ok: true, id };
}

export async function listReports(status: 'open' | 'closed' = 'open'): Promise<Report[]> {
  const d = await getDb();
  const r = await d.execute({
    sql: 'SELECT * FROM catalog_reports WHERE status = ? ORDER BY created_at DESC',
    args: [status],
  });
  return (r.rows as unknown as RawReportRow[]).map(toReport);
}

export async function closeReport(id: string): Promise<Report | null> {
  const d = await getDb();
  const now = new Date().toISOString();
  const r = await d.execute({
    sql: 'SELECT * FROM catalog_reports WHERE id = ?',
    args: [id],
  });
  const row = r.rows[0] as unknown as RawReportRow | undefined;
  if (!row || row.status !== 'open') return null;
  await d.execute({
    sql: 'UPDATE catalog_reports SET status = ?, closed_at = ? WHERE id = ?',
    args: ['closed', now, id],
  });
  return toReport({ ...row, status: 'closed', closed_at: now });
}
