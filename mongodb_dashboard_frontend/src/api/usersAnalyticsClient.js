import { getApiClient } from './index';
import { buildQueryString } from './util';


/**
 * PUBLIC_INTERFACE
 * fetchUsersByTenant
 * Standardized wrapper returning the backend response for /api/users/tenant-summary
 *
 * Note:
 * - Prefer using getTenantUsersSummary from ./usersAnalytics for components.
 *   That helper normalizes response shapes and is the single source used by:
 *     - components/users/UsersByTenantBarChart.jsx
 *     - components/charts/UsersByTenantChart.jsx
 * - Keep this low-level client for non-visual consumers or future hooks.
 */
export async function fetchUsersByTenant({ status, includeInactive } = {}) {
  const base = { status, includeInactive };
  const qs = buildQueryString(base);
  const res = await getApiClient().get(`/api/users/tenant-summary${qs}`, { cacheTTL: 120000 });
  return res.data ?? res;
}

/**
 * PUBLIC_INTERFACE
 * fetchReferralSources
 * Wrapper for /api/users/referral-sources
 */
export async function fetchReferralSources({ limit = 10 } = {}) {
  const base = { limit };
  const qs = buildQueryString(base);
  const res = await getApiClient().get(`/api/users/referral-sources${qs}`, { cacheTTL: 120000 });
  return res.data ?? res;
}

export default { fetchUsersByTenant, fetchReferralSources };
