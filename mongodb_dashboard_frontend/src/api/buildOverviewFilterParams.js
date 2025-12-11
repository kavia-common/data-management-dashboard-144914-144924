 /**
  * PUBLIC_INTERFACE
  * buildOverviewFilterParams
  * Returns a consistent shape for overview API calls consumed by overviewAnalytics clients.
  * { organizationId, params }
  */
export function buildOverviewFilterParams({ organizationId, params = {} } = {}) {
  return { organizationId, params };
}
