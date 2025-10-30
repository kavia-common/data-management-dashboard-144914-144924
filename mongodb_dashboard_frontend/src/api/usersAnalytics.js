import baseClient from './baseClient';
import { withUrlOverrides } from './urlOverrides';

/**
 * Utility to build query string from params (ignore undefined/null)
 */
function toQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    q.set(k, String(v));
  });
  return q.toString();
}

// PUBLIC_INTERFACE
export async function fetchActiveTrend(params = {}) {
  /** Fetch active users trend time series. Supports granularity, from/to, status, tenant_id */
  const qs = toQuery({
    granularity: params.granularity === 'daily' ? 'day' : params.granularity === 'weekly' ? 'week' : params.granularity,
    from: params.startDate,
    to: params.endDate,
    status: params.status,
    tenant_id: params.organization_id || params.tenant_id,
  });
  const url = `/api/users/active-trend${qs ? `?${qs}` : ''}`;
  try {
    const res = await baseClient.get(withUrlOverrides(url));
    if (Array.isArray(res.data)) {
      return { items: res.data, meta: {} };
    }
    return res.data || { items: [], meta: {} };
  } catch (err) {
    // Graceful fallback: return empty structure
    console.warn('fetchActiveTrend failed:', err?.message || err);
    return { items: [], meta: { error: true, message: err?.message || 'Failed to load active trend' } };
  }
}

// PUBLIC_INTERFACE
export async function fetchKpiSummary(params = {}) {
  /** Fetch KPI summary for users analytics. Try multiple known routes. */
  const qs = toQuery({
    from: params.startDate,
    to: params.endDate,
    granularity: params.granularity,
    tenant_id: params.organization_id || params.tenant_id,
    status: params.status,
  });

  const candidates = [
    `/api/users/kpi-summary`,
    `/api/analytics/users/kpi-summary`,
    `/api/users/summary`,
  ];

  for (const path of candidates) {
    try {
      const res = await baseClient.get(withUrlOverrides(`${path}${qs ? `?${qs}` : ''}`));
      if (res?.data) {
        return {
          totalUsers: res.data.totalUsers ?? null,
          activeUsers: res.data.activeUsers ?? null,
          newUsers: res.data.newUsers ?? null,
          returningUsers: res.data.returningUsers ?? null,
          raw: res.data,
        };
      }
    } catch (e) {
      // continue trying next route
    }
  }
  return { totalUsers: null, activeUsers: null, newUsers: null, returningUsers: null, raw: null, empty: true };
}

// PUBLIC_INTERFACE
export async function fetchUsersByDepartment(params = {}) {
  /** Fetch users grouped by department for bar/pie chart. */
  const qs = toQuery({
    from: params.startDate,
    to: params.endDate,
    tenant_id: params.organization_id || params.tenant_id,
    status: params.status,
    granularity: params.granularity,
  });

  const candidates = [
    `/api/users/by-department`,
    `/api/analytics/users/by-department`,
  ];
  for (const path of candidates) {
    try {
      const res = await baseClient.get(withUrlOverrides(`${path}${qs ? `?${qs}` : ''}`));
      if (res?.data) {
        const items = Array.isArray(res.data.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        return items.map((d) => ({
          department: d.department || d._id || d.name || 'Unknown',
          count: d.count ?? d.total ?? d.user_count ?? 0,
        }));
      }
    } catch (e) {
      // try next
    }
  }
  return [];
}

// PUBLIC_INTERFACE
export async function fetchUsersByOrganization(params = {}) {
  /** Fetch users grouped by organization/tenant. Falls back to existing tenant-summary endpoint. */
  const qs = toQuery({
    from: params.startDate || params.from,
    to: params.endDate || params.to,
    includeInactive: params.includeInactive,
    status: params.status,
    granularity: params.granularity,
  });

  const candidates = [
    `/api/users/by-organization`,
    `/api/analytics/users/by-organization`,
  ];
  for (const path of candidates) {
    try {
      const res = await baseClient.get(withUrlOverrides(`${path}${qs ? `?${qs}` : ''}`));
      if (res?.data) {
        const items = Array.isArray(res.data.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        return items.map((d) => ({
          organization: d.tenant_name || d.organization_name || d.organization || d.tenant_id || 'Unknown',
          count: d.count ?? d.total ?? d.user_count ?? 0,
        }));
      }
    } catch (e) {
      // try next
    }
  }

  // Fallback to known endpoint in backend openapi: /api/users/tenant-summary
  try {
    const res = await baseClient.get(withUrlOverrides(`/api/users/tenant-summary${qs ? `?${qs}` : ''}`));
    const items = res?.data?.items || [];
    return items.map((d) => ({
      organization: d.tenant_name || d.tenant_id || 'Unknown',
      count: d.user_count ?? 0,
    }));
  } catch (e) {
    return [];
  }
}

// PUBLIC_INTERFACE
export async function fetchLastActive(params = {}) {
  /** Fetch last active list. Safe fallback to [] if endpoint missing. */
  const qs = toQuery({
    from: params.startDate,
    to: params.endDate,
    tenant_id: params.organization_id || params.tenant_id,
    status: params.status,
  });
  const candidates = [
    `/api/users/last-active`,
    `/api/analytics/users/last-active`,
  ];
  for (const path of candidates) {
    try {
      const res = await baseClient.get(withUrlOverrides(`${path}${qs ? `?${qs}` : ''}`));
      const items = res?.data?.items || res?.data || [];
      return Array.isArray(items) ? items : [];
    } catch (e) {
      // next
    }
  }
  return [];
}

// PUBLIC_INTERFACE
export async function fetchJoinedTrend(params = {}) {
  /** Fetch new users over time; fallback to backend /api/analytics/users/new-over-time defined in openapi. */
  const qs = toQuery({
    granularity: params.granularity === 'daily' ? 'day' : params.granularity === 'weekly' ? 'week' : (params.granularity === 'monthly' ? 'month' : params.granularity),
    start: params.startDate,
    end: params.endDate,
    from: params.startDate,
    to: params.endDate,
    tenant_id: params.organization_id || params.tenant_id,
  });

  const candidates = [
    `/api/users/joined-trend`,
    `/api/analytics/users/joined-trend`,
  ];
  for (const path of candidates) {
    try {
      const res = await baseClient.get(withUrlOverrides(`${path}${qs ? `?${qs}` : ''}`));
      if (res?.data) {
        const items = Array.isArray(res.data.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        return items.map((d) => ({
          date: d.date || d.bucket || d._id || '',
          total: d.total ?? d.count ?? 0,
        }));
      }
    } catch (e) {
      // try next
    }
  }

  // Fallback to defined endpoint in backend spec
  try {
    const res = await baseClient.get(withUrlOverrides(`/api/analytics/users/new-over-time${qs ? `?${qs}` : ''}`));
    const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
    return items.map((d) => ({
      date: d.date || d.bucket || d._id || '',
      total: d.total ?? d.count ?? 0,
    }));
  } catch (e) {
    return [];
  }
}

export default {
  fetchActiveTrend,
  fetchKpiSummary,
  fetchUsersByDepartment,
  fetchUsersByOrganization,
  fetchLastActive,
  fetchJoinedTrend,
};
