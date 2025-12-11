import client from './client';
import { getTenantHeaders } from './util';

/**
 * Projects API client
 * Provides functions to retrieve projects-related analytics/summaries.
 */

// PUBLIC_INTERFACE
export async function getProjectsSummary(params = {}) {
  /** Fetch projects created summary (time buckets).
   * params:
   *  - range: 'daily' | 'weekly' | 'monthly' | 'custom'
   *  - start_date: 'YYYY-MM-DD' (when range='custom')
   *  - end_date: 'YYYY-MM-DD' (when range='custom')
   *  - organization_id: optional; if the API client supports tenant headers in context, it will be sent via x-organization-id, otherwise pass explicitly
   *
   * Returns: { range, start_date, end_date, buckets: [{ key, label, count }] }
   */
  const { range, start_date, end_date, organization_id, tenant_id } = params || {};

  const query = new URLSearchParams();
  if (range) query.set('range', range);
  if (start_date) query.set('start_date', start_date);
  if (end_date) query.set('end_date', end_date);
  // Include org in query as a fallback; server prefers header but supports query aliases
  if (organization_id) query.set('organization_id', organization_id);
  if (tenant_id) query.set('tenant_id', tenant_id);

  const headers = getTenantHeaders(organization_id || tenant_id);

  const url = `/api/projects/summary${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await client.get(url, { headers });
  return res.data;
}

export default {
  getProjectsSummary,
};
