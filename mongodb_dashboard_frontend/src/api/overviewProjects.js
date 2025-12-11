import { apiGet } from '../utils/api';

/**
// PUBLIC_INTERFACE
 * getOverviewProjects
 * Fetches aggregated "Total Projects" over time with filters and returns
 * a normalized array sorted by a stable bucket key.
 *
 * Input params:
 *  - timeframe|range: 'daily' | 'weekly' | 'monthly' | 'custom'
 *  - start_date?: YYYY-MM-DD (required when custom)
 *  - end_date?:   YYYY-MM-DD (required when custom)
 *
 * Return:
 *  {
 *    items: Array<{
 *      bucket_start: string, // ISO or YYYY-MM-DD
 *      count: number,
 *      ...other
 *    }>
 *  }
 */
export async function getOverviewProjects(params = {}) {
  const timeframe = String(params.timeframe || params.range || 'daily').toLowerCase();
  const q = new URLSearchParams();
  q.set('timeframe', timeframe);
  if (timeframe === 'custom') {
    if (params.start_date) q.set('start_date', params.start_date);
    if (params.end_date) q.set('end_date', params.end_date);
  }
  if (params.organization_id) q.set('organization_id', params.organization_id);
  if (params.tenant_id) q.set('tenant_id', params.tenant_id);

  const path = `/overview/projects?${q.toString()}`;
  // apiGet ensures '/api' base prefix and headers as configured.
  const result = await apiGet(path);

  // Accept both shapes: { items: [...] } or a raw array.
  const rawItems = Array.isArray(result?.items)
    ? result.items
    : (Array.isArray(result) ? result : []);

  const items = rawItems.map((it) => {
    const bucket =
      it.bucket_start ??
      it.bucket ??
      it.date ??
      it.key ??
      it.created_at ??
      it.timestamp ??
      it.time;

    return {
      ...it,
      bucket_start: bucket,
      count: typeof it.count === 'number' ? it.count : (typeof it.total === 'number' ? it.total : 0),
    };
  });

  items.sort((a, b) => {
    const ta = new Date(a.bucket_start).getTime();
    const tb = new Date(b.bucket_start).getTime();
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
    return String(a.bucket_start).localeCompare(String(b.bucket_start));
  });

  return { items };
}
