import client from './client';
import { withTenantHeaders } from './util';

/**
 * PUBLIC_INTERFACE
 * getOverviewProjectsSummary
 * Fetch projects created summary with correct param handling.
 * - Expects an object containing { params, organizationId } or merged via buildOverviewFilterParams.
 */
export async function getOverviewProjectsSummary({ organizationId, params = {} } = {}) {
  const url = '/projects/summary'; // base client already prefixes /api
  const searchParams = new URLSearchParams();

  // range always
  if (params.range) searchParams.set('range', params.range);

  // Only for custom send start/end
  if (params.range === 'custom') {
    if (params.start_date) searchParams.set('start_date', params.start_date);
    if (params.end_date) searchParams.set('end_date', params.end_date);
  }

  // Note: users summary behavior supports tenant via header or query. We add header.
  const headers = withTenantHeaders(organizationId);

  const { data } = await client.get(`${url}?${searchParams.toString()}`, { headers });
  return data;
}
