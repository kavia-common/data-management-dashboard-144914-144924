import { getApiClient } from './baseClient';
import { getOrganizationId } from './authTokenProvider';

/**
 * Projects API client
 * Provides functions to retrieve projects-related analytics/summaries.
 */

// PUBLIC_INTERFACE
export async function getProjectsSummary(params = {}) {
  /** Fetch projects created summary (time buckets).
   * Params:
   *  - range: 'daily' | 'weekly' | 'monthly' | 'custom'
   *  - start_date: 'YYYY-MM-DD' (only when range='custom')
   *  - end_date: 'YYYY-MM-DD' (only when range='custom')
   * Always attaches (centralized in baseClient):
   *  - Query: organization_id
   * Additionally attaches header:
   *  - x-organization-id
   *
   * Returns: { range, start_date, end_date, buckets: [{ key, label, count }] }
   */
  const { range, start_date, end_date } = params || {};

  const orgId = getOrganizationId();
  // Build query (organization_id is appended centrally for this endpoint)
  const query = {};
  if (range) query.range = range;
  if (String(range || '').toLowerCase() === 'custom') {
    if (start_date) query.start_date = start_date;
    if (end_date) query.end_date = end_date;
  }

  // Use shared base client which injects Authorization and merges scoped params
  const client = getApiClient();
  const res = await client.get('/projects/summary', {
    params: query,
    headers: orgId ? { 'x-organization-id': String(orgId) } : undefined,
  });
  return res.data;
}

export default {
  getProjectsSummary,
};
