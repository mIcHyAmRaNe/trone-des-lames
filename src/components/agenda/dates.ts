/** Date helpers for the agenda. All dates are plain YYYY-MM-DD strings (UTC). */

export const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const MONTHS_SHORT = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dayNumber(iso: string): number {
  return Number(iso.slice(8, 10));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export function monthShortLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS_SHORT[month - 1]} ${year}`;
}

export function durationDays(startISO: string, endISO: string): number {
  return Math.round((Date.parse(`${endISO}T00:00:00Z`) - Date.parse(`${startISO}T00:00:00Z`)) / 86_400_000) + 1;
}

/** "12 – 14 mars 2027", "28 févr. – 3 mars 2027", "1 jour". */
export function formatRange(startISO: string, endISO: string): string {
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const [ey, em, ed] = endISO.split('-').map(Number);
  if (!sy || !ey) return startISO;

  if (startISO === endISO) return `${sd} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey && sm === em) return `${sd} – ${ed} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${sy}`;
  return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

/** Compact range for tight spots: "12 déc.", "18–25 oct.", "30 déc. 26 – 4 janv. 27". */
export function formatRangeShort(startISO: string, endISO: string): string {
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const [ey, em, ed] = endISO.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (startISO === endISO) return `${sd} ${MONTHS_SHORT[sm - 1]}`;
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS_SHORT[sm - 1]}`;
  if (sy === ey) return `${sd} ${MONTHS_SHORT[sm - 1]} – ${ed} ${MONTHS_SHORT[em - 1]}`;
  return `${sd} ${MONTHS_SHORT[sm - 1]} ${pad(sy).slice(2)} – ${ed} ${MONTHS_SHORT[em - 1]} ${pad(ey).slice(2)}`;
}

export function formatDuration(startISO: string, endISO: string): string {
  const n = durationDays(startISO, endISO);
  return n === 1 ? '1 jour' : `${n} jours`;
}
