import { apiGet } from '../utils/api';

/**
// PUBLIC_INTERFACE
 * getOverviewProjects
 * Fetches aggregated "Total Projects" per day with filters and returns normalized buckets
 * sorted by a stable bucket_start (YYYY-MM-DD).
 *
 * Input params:
 *  - timeframe|range: 'daily' | 'weekly' | 'monthly' | 'custom'
 *  - start_date?: YYYY-MM-DD (required when custom)
 *  - end_date?:   YYYY-MM-DD (required when custom)
 *
 * Return:
 *  {
 *    buckets: Array<{
 *      date: string,         // YYYY-MM-DD
 *      bucket_start: string, // YYYY-MM-DD
 *      count: number,
 *      by_user?: Array<{ user_name: string, count: number }>,
 *      by_project?: Array<{ project_name: string|null, count: number }>
 *    }>,
 *    total?: number,
 *    meta?: object
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
  const result = await apiGet(path);

  // Preferred shape: { buckets: [...] }
  let rawBuckets = Array.isArray(result?.buckets)
    ? result.buckets
    : (Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : []));

  const buckets = rawBuckets.map((it) => {
    const bucket =
      it.bucket_start ??
      it.date ??
      it.bucket ??
      it.key ??
      it.created_at ??
      it.timestamp ??
      it.time;

    const count = typeof it.count === 'number' ? it.count : (typeof it.total === 'number' ? it.total : 0);

    return {
      ...it,
      date: typeof it.date === 'string' ? it.date : (typeof bucket === 'string' ? bucket : it.date),
      bucket_start: bucket,
      count,
      // keep by_user/by_project if present
    };
  });

  buckets.sort((a, b) => {
    const ta = new Date(`${a.bucket_start}T00:00:00.000Z`).getTime();
    const tb = new Date(`${b.bucket_start}T00:00:00.000Z`).getTime();
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
    return String(a.bucket_start).localeCompare(String(b.bucket_start));
  });

  return {
    buckets,
    total: typeof result?.total === 'number' ? result.total : buckets.reduce((acc, b) => acc + (b.count || 0), 0),
    meta: result?.meta
  };
}
