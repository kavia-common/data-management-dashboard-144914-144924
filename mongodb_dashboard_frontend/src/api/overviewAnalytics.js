import { getApiClient } from './baseClient';
import { withTenantHeaders } from './util';

/**
 * PUBLIC_INTERFACE
 * getOverviewProjectsSummary
 * Fetch projects created summary with correct param handling.
 * - Expects an object containing { params, organizationId } or merged via buildOverviewFilterParams.
 * - Ensures organization_id is appended via shared baseClient rules so URL visibly contains it.
 */
export async function getOverviewProjectsSummary({ organizationId, params = {} } = {}) {
  const client = getApiClient();

  // Build params: range always; start/end only for custom
  const query = {};
  if (params.range) query.range = params.range;
  if (String(params.range || '').toLowerCase() === 'custom') {
    if (params.start_date) query.start_date = params.start_date;
    if (params.end_date) query.end_date = params.end_date;
  }

  // We still provide header for x-organization-id; baseClient will handle organization_id in query
  const headers = withTenantHeaders(organizationId);

  const { data } = await client.get('/api/projects/summary', {
    params: query,
    headers,
  });
  return data;
}
