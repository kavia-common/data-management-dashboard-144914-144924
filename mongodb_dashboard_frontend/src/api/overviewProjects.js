import { apiGet } from '../utils/api';

/**
// PUBLIC_INTERFACE
 * getOverviewProjects
 * Fetches aggregated "Total Projects" over time with filters.
 * params: { timeframe: 'daily'|'weekly'|'monthly'|'custom', start_date?, end_date? }
 */
export async function getOverviewProjects(params = {}) {
  const timeframe = String(params.timeframe || params.range || 'daily').toLowerCase();
  const q = new URLSearchParams();
  q.set('timeframe', timeframe);
  if (timeframe === 'custom') {
    if (params.start_date) q.set('start_date', params.start_date);
    if (params.end_date) q.set('end_date', params.end_date);
  }
  const path = `/overview/projects?${q.toString()}`;
  // apiGet will ensure '/api' prefix and append organization_id if available.
  const result = await apiGet(path);
  // Normalize response shape to ensure stable rendering
  return {
    buckets: Array.isArray(result?.buckets) ? result.buckets : [],
    total: Number(result?.total || 0),
    byUser: Array.isArray(result?.byUser) ? result.byUser : [],
  };
}
