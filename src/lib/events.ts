import { getDb } from './db';

export type EventStatus = 'pending' | 'approved';

export type AgendaEvent = {
  id: number;
  title: string;
  rkName: string;
  city: string;
  county: string;
  forumUrl: string;
  startsOn: string;
  endsOn: string;
  status: EventStatus;
  createdAt: string;
};

export type EventInput = Omit<AgendaEvent, 'id' | 'status' | 'createdAt'>;

type Row = {
  id: number;
  title: string;
  rk_name: string;
  city: string;
  county: string;
  forum_url: string;
  starts_on: string;
  ends_on: string;
  status: EventStatus;
  created_at: string;
};

function toEvent(r: Row): AgendaEvent {
  return {
    id: r.id,
    title: r.title,
    rkName: r.rk_name,
    city: r.city,
    county: r.county,
    forumUrl: r.forum_url,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    status: r.status,
    createdAt: r.created_at,
  };
}

const LIMITS = {
  title: [3, 100],
  rkName: [2, 60],
  city: [2, 60],
  county: [2, 60],
} as const;

const LABELS: Record<keyof typeof LIMITS, string> = {
  title: 'Nom de l’animation',
  rkName: 'Nom du joueur',
  city: 'Ville',
  county: 'Comté',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(v: string) {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Inclusive duration in days; both dates already known valid. */
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) + 1;
}

function text(value: unknown, key: keyof typeof LIMITS): string {
  const [min, max] = LIMITS[key];
  if (typeof value !== 'string') throw new Error(`${LABELS[key]} requis`);
  const v = value.trim().replace(/\s+/g, ' ');
  if (v.length < min || v.length > max) {
    throw new Error(`${LABELS[key]} : ${min} à ${max} caractères`);
  }
  return v;
}

function url(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length > 500) {
    throw new Error('Lien forum requis (500 caractères max)');
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Lien forum invalide');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Lien forum invalide (http ou https attendu)');
  }
  return parsed.toString();
}

/** Validates a complete event; `status` is never taken from the client here. */
export function parseEvent(raw: unknown): EventInput;
/** PATCH mode: only provided keys are checked, and `status` is allowed. */
export function parseEvent(
  raw: unknown,
  opts: { partial: true },
): Partial<EventInput> & { status?: EventStatus };
export function parseEvent(
  raw: unknown,
  opts: { partial?: boolean } = {},
): Partial<EventInput> & { status?: EventStatus } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Requête invalide');
  const body = raw as Record<string, unknown>;
  const partial = opts.partial === true;
  const out: Partial<EventInput> & { status?: EventStatus } = {};

  const has = (k: string) => body[k] !== undefined;

  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (partial && !has(key)) continue;
    out[key] = text(body[key], key);
  }
  if (!partial || has('forumUrl')) out.forumUrl = url(body.forumUrl);

  const needDates = !partial || has('startsOn') || has('endsOn');
  if (needDates) {
    if (typeof body.startsOn !== 'string' || !isDate(body.startsOn)) {
      throw new Error('Date de début invalide');
    }
    if (typeof body.endsOn !== 'string' || !isDate(body.endsOn)) {
      throw new Error('Date de fin invalide');
    }
    if (body.endsOn < body.startsOn) throw new Error('La date de fin doit suivre la date de début');
    if (daysBetween(body.startsOn, body.endsOn) > 366) {
      throw new Error('Une animation ne peut pas durer plus d’un an');
    }
    out.startsOn = body.startsOn;
    out.endsOn = body.endsOn;
  }

  if (partial && has('status')) {
    if (body.status !== 'pending' && body.status !== 'approved') {
      throw new Error('Statut invalide');
    }
    out.status = body.status;
  }

  if (partial && Object.keys(out).length === 0) throw new Error('Aucune modification');
  return out;
}

export async function listEvents(opts: { status?: EventStatus | 'all' } = {}): Promise<AgendaEvent[]> {
  const d = await getDb();
  const status = opts.status ?? 'approved';
  const r =
    status === 'all'
      ? await d.execute({ sql: 'SELECT * FROM events ORDER BY starts_on, id', args: [] })
      : await d.execute({
          sql: 'SELECT * FROM events WHERE status = ? ORDER BY starts_on, id',
          args: [status],
        });
  return (r.rows as unknown as Row[]).map(toEvent);
}

export async function createEvent(input: EventInput, status: EventStatus): Promise<AgendaEvent> {
  const d = await getDb();
  const r = await d.execute({
    sql: `INSERT INTO events (title, rk_name, city, county, forum_url, starts_on, ends_on, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.title,
      input.rkName,
      input.city,
      input.county,
      input.forumUrl,
      input.startsOn,
      input.endsOn,
      status,
    ],
  });
  const created = await getEvent(Number(r.lastInsertRowid));
  if (!created) throw new Error('Événement introuvable après création');
  return created;
}

const COLUMNS: Record<string, string> = {
  title: 'title',
  rkName: 'rk_name',
  city: 'city',
  county: 'county',
  forumUrl: 'forum_url',
  startsOn: 'starts_on',
  endsOn: 'ends_on',
  status: 'status',
};

export async function updateEvent(
  id: number,
  patch: Partial<EventInput> & { status?: EventStatus },
): Promise<AgendaEvent | null> {
  const d = await getDb();
  const keys = Object.keys(patch).filter((k) => COLUMNS[k]);
  if (keys.length === 0) return getEvent(id);

  const sets = keys.map((k) => `${COLUMNS[k]} = ?`).join(', ');
  const args = keys.map((k) => (patch as Record<string, unknown>)[k] as string | number);
  const r = await d.execute({ sql: `UPDATE events SET ${sets} WHERE id = ?`, args: [...args, id] });
  if (r.rowsAffected === 0) return null;
  return getEvent(id);
}

export async function getEvent(id: number): Promise<AgendaEvent | null> {
  const d = await getDb();
  const r = await d.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] });
  const row = r.rows[0] as unknown as Row | undefined;
  return row ? toEvent(row) : null;
}

export async function deleteEvent(id: number): Promise<boolean> {
  const d = await getDb();
  const r = await d.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [id] });
  return r.rowsAffected > 0;
}
