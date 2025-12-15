import http from '../utils/http';

/**
 * PUBLIC_INTERFACE
 * Fetch service types summary for Overview using same filter params builder.
 * @param {Object} params - built via buildOverviewFilterParams (range, start_date, end_date, organization_id)
 * @param {string=} orgIdHeader - optional to pass x-organization-id header (used in demo/no-auth)
 * @param {boolean=} includeOrgBuckets - when super admin, include org buckets
 */
export async function getServiceTypesSummary(params = {}, orgIdHeader, includeOrgBuckets = false) {
  const query = new URLSearchParams({ ...params });
  if (includeOrgBuckets) {
    query.set('include_org_buckets', '1');
  }
  const headers = {};
  if (orgIdHeader) {
    headers['x-organization-id'] = orgIdHeader;
  }
  const { data } = await http.get(`/api/services/summary?${query.toString()}`, { headers });
  return data;
}
