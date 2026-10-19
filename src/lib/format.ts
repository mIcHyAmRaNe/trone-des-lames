/** Formats points with French decimal comma, dropping trailing .0 */
export function formatPoints(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}
