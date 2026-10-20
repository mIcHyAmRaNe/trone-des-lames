/** Formats points with French decimal comma, dropping trailing zeros */
export function formatPoints(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

/**
 * Accepts "17,5" as well as 17.5. Returns null when out of range or unparsable.
 * Shared by the server validator and the admin UI so both accept the same values.
 */
export function parsePoints(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 999) return null;
  return n;
}
