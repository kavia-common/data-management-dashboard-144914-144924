/**
 * PUBLIC_INTERFACE
 * buildOverviewFilterParams
 * Returns a consistent shape for overview API calls consumed by overviewAnalytics clients.
 * { organizationId, params }
 *
 * Note: organization_id is injected into the query string centrally by baseClient for
 * /api/projects/summary so the network URL visibly contains ?organization_id=<id> as filters change.
 */
export function buildOverviewFilterParams({ organizationId, params = {} } = {}) {
  return { organizationId, params };
}
