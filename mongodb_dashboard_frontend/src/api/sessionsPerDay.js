import { getApiClient } from './baseClient';
import { withTenantHeaders } from './util';

/**
 * PUBLIC_INTERFACE
 * Fetches sessions-per-day style series by reusing the supported overview endpoint.
 * NOTE: The old path /api/analytics/sessions-per-day is not present; this adapter calls
 * GET /api/projects/summary and shapes the buckets into { date, count } items.
 *
 * Supported params (mapped):
 * - organizationId | tenant_id | organization_id — provided via withTenantHeaders or base client rules
 * - range: 'daily' | 'weekly' | 'monthly' | 'custom'
 * - start_date, end_date (YYYY-MM-DD) when range='custom'
 *
 * Returns: { items: Array<{ date: 'YYYY-MM-DD', count: number }>, meta?: object }
 */
export async function getSessionsPerDay(params = {}) {
  const client = getApiClient();

  const {
    organizationId,
    range = 'daily',
    start_date,
    end_date,
    ...rest
  } = params || {};

  const query = { range, ...rest };
  if (range === 'custom' && start_date && end_date) {
    query.start_date = start_date;
    query.end_date = end_date;
  }

  const headers = withTenantHeaders(organizationId);
  const { data } = await client.get('/projects/summary', { params: query, headers });

  const buckets = Array.isArray(data?.buckets) ? data.buckets : [];
  const items = buckets.map(b => ({
    date: b.label || b.key || '',
    count: Number(b.count || 0),
  }));

  return { items, meta: { range: data?.range, start_date: data?.start_date, end_date: data?.end_date } };
}
