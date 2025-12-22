import { getApiClient } from './baseClient';
import { withTenantHeaders } from './util';
import { buildOverviewFilterParams } from './buildOverviewFilterParams';

/**
 * PUBLIC_INTERFACE
 * getOverviewProjectsSummary
 * Fetch projects created summary with correct param handling.
 * Expects explicit organizationId from caller to avoid UI state imports.
 */
export async function getOverviewProjectsSummary({ organizationId, params = {} } = {}) {
  const client = getApiClient();

  const query = buildOverviewFilterParams({
    organizationId,
    range: params.range,
    start_date: params.start_date,
    end_date: params.end_date,
    search: params.search,
  });

  const headers = withTenantHeaders(organizationId);

  const { data } = await client.get('/projects/summary', {
    params: query,
    headers,
  });
  return data;
}
