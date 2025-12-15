import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * Fetch service types summary for Overview using plain query params.
 * @param {Object} params - plain key/value params (range, start_date, end_date)
 * @param {string=} orgIdHeader - optional to pass x-organization-id header (used in demo/no-auth)
 * @param {boolean=} includeOrgBuckets - when super admin, include org buckets
 *
 * Ensures:
 * - x-organization-id header is sent when orgIdHeader provided
 * - organization_id query param is appended as a fallback (backend accepts header or query)
 * - no nested params object (axios "params: { params: {...} }" bug)
 */
export async function getServiceTypesSummary(params = {}, orgIdHeader, includeOrgBuckets = false) {
  const query = new URLSearchParams({ ...(params || {}) });

  if (orgIdHeader && !query.get('organization_id')) {
    query.set('organization_id', orgIdHeader);
  }
  if (includeOrgBuckets) {
    query.set('include_org_buckets', '1');
  }

  const headers = {};
  if (orgIdHeader) {
    headers['x-organization-id'] = orgIdHeader;
  }

  const client = getApiClient();
  const res = await client.get(`/api/services/summary?${query.toString()}`, { headers });
  return res.data;
}

export default {
  getServiceTypesSummary,
};
