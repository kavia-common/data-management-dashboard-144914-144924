import { getApiClient } from './baseClient';

const apiClient = getApiClient();

/**
 * Users Analytics API wrapper for /api/users endpoints and related aggregates.
 * All functions accept a params object for filters and pass through to the backend.
 * Ensures we can safely evolve endpoints without touching component code.
 */

// PUBLIC_INTERFACE
export function fetchActiveTrend(params = {}) {
  /** Fetches active users trend (DAU/WAU) from /api/users/active-trend */
  return apiClient.get('/api/users/active-trend', { params }).then(res => res.data);
}

// PUBLIC_INTERFACE
export function fetchNewUsersOverTime(params = {}) {
  /** Fetches new users over time from /api/analytics/users/new-over-time */
  return apiClient.get('/api/analytics/users/new-over-time', { params }).then(res => res.data);
}

// PUBLIC_INTERFACE
export function fetchUsersList(params = {}) {
  /** Fetches users list for search/filters support as a fallback */
  return apiClient.get('/api/users', { params }).then(res => res.data);
}

// PUBLIC_INTERFACE
export function fetchTenantSummary(params = {}) {
  /** Fetches tenant (organization) summary for activity by organization */
  return apiClient.get('/api/users/tenant-summary', { params }).then(res => res.data);
}

// PUBLIC_INTERFACE
export function getTenantUsersSummary(params = {}) {
  /** Backwards-compatible alias for fetchTenantSummary used by charts */
  return fetchTenantSummary(params);
}

// PUBLIC_INTERFACE
export function fetchReferralSources(params = {}) {
  /** Top referral sources as optional supporting metric */
  return apiClient.get('/api/users/referral-sources', { params }).then(res => res.data);
}

/**
 * The following endpoints are mentioned in the request but may not exist in backend spec:
 * - /api/users/kpi-summary, /api/users/by-department, /api/users/by-organization
 * We provide soft-fallbacks: if these calls 404, the caller should compute approximations from other endpoints.
 */

// PUBLIC_INTERFACE
export async function fetchKpiSummarySafe(params = {}) {
  /** Attempts to request /api/users/kpi-summary; if unavailable, derive KPIs using active trend and new users endpoints. */
  try {
    const res = await apiClient.get('/api/users/kpi-summary', { params });
    return res.data;
  } catch (err) {
    // Soft fallback: compute minimal KPI values using available endpoints
    // DAU/WAU/MAU approximations from active-trend with different windows
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatIso = d => d.toISOString();

    const [dauRes, wauRes, mauRes, newUsersRes] = await Promise.all([
      fetchActiveTrend({ ...params, from: formatIso(dayAgo), to: formatIso(now), granularity: 'day' }),
      fetchActiveTrend({ ...params, from: formatIso(weekAgo), to: formatIso(now), granularity: 'day' }),
      fetchActiveTrend({ ...params, from: formatIso(monthAgo), to: formatIso(now), granularity: 'day' }),
      fetchNewUsersOverTime({ ...params, start: formatIso(monthAgo), end: formatIso(now), granularity: 'day' })
    ]);

    const safeLast = arr => (Array.isArray(arr?.items) && arr.items.length ? arr.items[arr.items.length - 1] : null);

    const dau = safeLast(dauRes)?.total ?? 0;
    const wau = (Array.isArray(wauRes?.items) ? wauRes.items.slice(-7) : []).reduce((sum, d) => sum + (d.total || 0), 0);
    const mau = (Array.isArray(mauRes?.items) ? mauRes.items.slice(-30) : []).reduce((sum, d) => sum + (d.total || 0), 0);
    const newUsers = Array.isArray(newUsersRes) ? newUsersRes.reduce((s, d) => s + (d.count || d.total || 0), 0) : 0;

    return {
      dau,
      wau,
      mau,
      newUsers,
      termsAcceptedPct: null, // unable to compute without explicit endpoint; component should handle null gracefully
      activeCount: null,
      inactiveCount: null
    };
  }
}

// PUBLIC_INTERFACE
export async function fetchByOrganizationSafe(params = {}) {
  /** Attempts /api/users/by-organization; if missing, uses tenant-summary as a proxy. */
  try {
    const res = await apiClient.get('/api/users/by-organization', { params });
    return res.data;
  } catch (err) {
    const summary = await fetchTenantSummary(params);
    const items = Array.isArray(summary?.items) ? summary.items : [];
    return items.map(it => ({
      organization_id: it.tenant_id,
      organization_name: it.tenant_name || it.tenant_id,
      activity: it.user_count || 0
    }));
  }
}

// PUBLIC_INTERFACE
export async function fetchByDepartmentSafe(params = {}) {
  /** If backend does not provide department aggregation, fallback to users listing and group client-side by department field. */
  try {
    const res = await apiClient.get('/api/users/by-department', { params });
    return res.data;
  } catch (err) {
    // Fallback: fetch up to a reasonable number of users and aggregate
    const filter = {};
    if (params?.organization_id) filter.organization_id = params.organization_id;
    if (params?.status) filter.status = params.status;
    if (params?.is_admin != null) filter.is_admin = params.is_admin;

    const list = await fetchUsersList({
      limit: 200, // soft limit for client aggregation
      filter: JSON.stringify(filter),
      sort: '-last_active'
    });

    const users = Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : [];
    const map = new Map();
    users.forEach(u => {
      const dept = u.department || 'Unknown';
      map.set(dept, (map.get(dept) || 0) + 1);
    });
    return Array.from(map.entries()).map(([department, count]) => ({ department, count }));
  }
}

// PUBLIC_INTERFACE
export async function fetchTermsAcceptanceSafe(params = {}) {
  /** Terms acceptance distribution; if no backend, approximate via users list. */
  try {
    const res = await apiClient.get('/api/users/terms-acceptance', { params });
    return res.data;
  } catch (err) {
    const list = await fetchUsersList({
      limit: 200,
      filter: JSON.stringify({
        ...(params?.organization_id ? { organization_id: params.organization_id } : {})
      })
    });
    const users = Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : [];
    const accepted = users.filter(u => !!u.has_accepted_terms).length;
    const total = users.length || 1;
    return {
      accepted,
      notAccepted: total - accepted,
      acceptedPct: Math.round((accepted / total) * 100)
    };
  }
}
