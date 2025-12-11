import { apiGet } from '../utils/api';

/**
// PUBLIC_INTERFACE
 * getOverviewProjects
 * Fetches aggregated "Total Projects" per project with filters and returns normalized buckets:
 * [{ project_id, project_name, count, days?: [{date,count}]}], sorted by count desc.
 *
 * Input params:
 *  - timeframe|range: 'daily' | 'weekly' | 'monthly' | 'custom'
 *  - start_date?: YYYY-MM-DD (required when custom)
 *  - end_date?:   YYYY-MM-DD (required when custom)
 *  - organization_id|tenant_id?: optional scope
 *
 * Return:
 *  {
 *    buckets: Array<{
 *      project_id: string,
 *      project_name: string|null,
 *      count: number,
 *      days?: Array<{ date: string, count: number }>
 *    }>,
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

  const rawBuckets = Array.isArray(result?.buckets)
    ? result.buckets
    : (Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : []));

  // Normalize shape and sort by count desc
  const buckets = rawBuckets
    .map((it) => ({
      project_id: String(it.project_id ?? it.projectId ?? ''),
      project_name: it.project_name ?? it.projectName ?? null,
      count: typeof it.count === 'number' ? it.count : (typeof it.total === 'number' ? it.total : 0),
      days: Array.isArray(it.days) ? it.days : undefined,
    }))
    .filter((b) => b.project_id);

  buckets.sort((a, b) => b.count - a.count);

  return {
    buckets,
    meta: result?.meta,
  };
}
