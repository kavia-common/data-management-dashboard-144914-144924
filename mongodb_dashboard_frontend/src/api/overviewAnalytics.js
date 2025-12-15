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

  // Allow caller to pass through extra params like group_by without disrupting existing behavior
  const query = { ...params };

  // We still provide header for x-organization-id; baseClient will handle organization_id in query
  const headers = withTenantHeaders(organizationId);

  const { data } = await client.get('/projects/summary', {
    params: query,
    headers,
  });
  return data;
}
