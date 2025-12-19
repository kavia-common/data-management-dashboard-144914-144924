import { formatShortDateLabel } from './date';

/**
 * PUBLIC_INTERFACE
 * adaptProjectCreateSummary
 * Converts /api/projects/summary payload to a normalized structure used by charts.
 */
export function adaptProjectCreateSummary(raw) {
  const out = {
    buckets: [],
    range: raw?.range || 'daily',
    start_date: raw?.start_date || null,
    end_date: raw?.end_date || null,
    total: 0,
  };

  const buckets = Array.isArray(raw?.buckets) ? raw.buckets : [];
  out.buckets = buckets.map((b) => {
    const key = b?.key || '';
    const label = b?.label || (key ? formatShortDateLabel(key) : '');
    const count = Number.isFinite(b?.count) ? b.count : 0;
    return { key, label, count };
  });

  out.total = out.buckets.reduce((acc, b) => acc + (Number.isFinite(b.count) ? b.count : 0), 0);
  return out;
}
