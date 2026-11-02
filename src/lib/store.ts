import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog, CatalogItem } from './wardrobe';

export interface SubmissionItem {
  nom: string;
  nameEn?: string;
  nameFr?: string;
  slot: string;
  sexes: ('M' | 'F')[];
  declinaisons: number[];
  zIndex: number[];
  slotsMasques?: string[];
  dependCouleurPeau?: boolean;
  dependPostureMainG?: boolean;
  dependPostureMainD?: boolean;
  sourceUrl?: string;
  note?: string;
}

export interface Submission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string;
  submittedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  adminNote?: string;
  item: SubmissionItem;
}

type Sexes = { sexes: { M: CatalogItem[]; F: CatalogItem[] } };

const dataDir = join(process.cwd(), 'data');
const communityPath = join(dataDir, 'community.json');
const submissionsPath = join(dataDir, 'submissions.json');

function ensureDataDir(): void {
  mkdirSync(dataDir, { recursive: true });
}

let storeLocked = false;
function withStoreLock<T>(fn: () => T): T {
  if (storeLocked) throw new Error('[store] concurrent write in progress');
  storeLocked = true;
  try {
    return fn();
  } finally {
    storeLocked = false;
  }
}

function writeJsonAtomic(path: string, value: unknown): void {
  ensureDataDir();
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch (e) {
    if ((e as { code?: string })?.code === 'ENOENT') return null;
    if (e instanceof SyntaxError) {
      console.error(`[store] corrupt JSON at ${path}, using empty default`);
      return null;
    }
    throw e;
  }
}

const emptySexes = (): Sexes => ({ sexes: { M: [], F: [] } });

export function loadBaseCatalog(): Catalog {
  return JSON.parse(readFileSync(join(process.cwd(), 'public/rk/catalog.json'), 'utf8')) as Catalog;
}

export function loadCommunity(): Sexes {
  const raw = readJson<Sexes>(communityPath);
  if (!raw?.sexes) return emptySexes();
  return { sexes: { M: raw.sexes.M ?? [], F: raw.sexes.F ?? [] } };
}

export function loadMergedCatalog(): Catalog {
  const base = loadBaseCatalog();
  const community = loadCommunity();
  const sexes = { M: base.sexes.M, F: base.sexes.F } as Record<'M' | 'F', CatalogItem[]>;
  for (const sex of ['M', 'F'] as const) {
    const byId = new Map(base.sexes[sex].map((i) => [i.id, i]));
    for (const item of community.sexes[sex]) {
      if (byId.has(item.id)) {
        byId.set(item.id, item);
        continue;
      }
      const match = resolveCatalogItem([...byId.values()], item);
      byId.set(match?.id ?? item.id, match ? { ...match, ...item, id: match.id } : item);
    }
    sexes[sex] = [...byId.values()];
  }
  return { ...base, sexes };
}

export function resolveCatalogItem(
  items: CatalogItem[],
  ref: { id?: string; nom?: string; nameEn?: string | null; nameFr?: string | null },
): CatalogItem | undefined {
  if (ref.id) {
    const byId = items.find((i) => i.id === ref.id);
    if (byId) return byId;
  }
  const needles = [ref.nom, ref.nameEn, ref.nameFr]
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .map((s) => s.trim().toLowerCase());
  if (!needles.length) return undefined;
  return items.find((i) =>
    [i.nom, i.nameEn, i.nameFr].some(
      (n) => typeof n === 'string' && n !== '' && needles.includes(n.toLowerCase()),
    ),
  );
}

export function readSubmissions(): Submission[] {
  return readJson<Submission[]>(submissionsPath) ?? [];
}

export function writeSubmissions(all: Submission[]): void {
  writeJsonAtomic(submissionsPath, all);
}

export function addSubmission(s: Submission): Submission {
  return withStoreLock(() => {
    const all = readSubmissions();
    all.push(s);
    writeSubmissions(all);
    return s;
  });
}

export function setSubmissionStatus(
  id: string,
  status: Submission['status'],
  adminNote?: string,
): Submission | null {
  return withStoreLock(() => {
    const all = readSubmissions();
    const s = all.find((x) => x.id === id);
    if (!s) return null;
    s.status = status;
    s.decidedAt = new Date().toISOString();
    if (adminNote !== undefined) s.adminNote = adminNote;
    writeSubmissions(all);
    return s;
  });
}

export function approveSubmission(id: string, decidedBy: string): Submission | null {
  return withStoreLock(() => {
    const all = readSubmissions();
    const s = all.find((x) => x.id === id);
    if (!s) return null;
    const merged = loadMergedCatalog();
    const taken = new Set([...merged.sexes.M, ...merged.sexes.F].map((i) => i.id));
    const match = resolveCatalogItem([...merged.sexes.M, ...merged.sexes.F], {
      nom: s.item.nom,
      nameEn: s.item.nameEn,
      nameFr: s.item.nameFr,
    });
    let itemId = match?.id ?? `c-${s.id.replace(/-/g, '').slice(0, 8) || s.id}`;
    if (!match) for (let n = 2; taken.has(itemId); n++) itemId = `c-${s.id.replace(/-/g, '').slice(0, 8) || s.id}-${n}`;
    const declinaisons = s.item.declinaisons.length ? s.item.declinaisons : [0];
    const community = loadCommunity();
    for (const sex of s.item.sexes) {
      const entry: CatalogItem = {
        id: itemId,
        nom: s.item.nom,
        slot: s.item.slot,
        slotGardeRobe: null,
        miniature: 'o',
        declinaisons,
        zIndex: s.item.zIndex,
        dependCouleurPeau: s.item.dependCouleurPeau ?? false,
        dependPostureMainG: s.item.dependPostureMainG ?? false,
        dependPostureMainD: s.item.dependPostureMainD ?? false,
        slotsMasques: s.item.slotsMasques ?? [],
        nameEn: s.item.nameEn ?? match?.nameEn ?? null,
        nameFr: s.item.nameFr ?? match?.nameFr ?? null,
      };
      const at = community.sexes[sex].findIndex((i) => i.id === itemId);
      if (at < 0) community.sexes[sex].push(entry);
      else community.sexes[sex][at] = entry;
    }
    writeJsonAtomic(communityPath, community);
    s.status = 'approved';
    s.decidedBy = decidedBy;
    s.decidedAt = new Date().toISOString();
    writeSubmissions(all);
    return s;
  });
}
