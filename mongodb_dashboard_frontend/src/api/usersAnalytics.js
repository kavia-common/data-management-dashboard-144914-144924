import { getApiBaseUrl } from './config';

/**
 * Users Analytics API client
 * Wraps calls to /api/users/analytics endpoints with optional filters.
 * UI filters: { from, to, organization, department, status }
 * Backend expects: organization_id, department, status, from, to (ISO)
 * Engagement metrics default to active users when status not provided.
 */

const API_BASE = getApiBaseUrl();

/**
 * Normalize UI filters to backend query params and apply defaults.
 * - organization -> organization_id
 * - status -> defaults to 'active' for engagement-type endpoints when not provided
 */
function toBackendParams(filters = {}, { defaultActive = false } = {}) {
  const {
    organization,
    department,
    status,
    from,
    to,
    organization_id, // allow already-normalized
  } = filters || {};

  const params = {
    organization_id: organization_id ?? organization ?? '',
    department: department ?? '',
    from: from ?? '',
    to: to ?? '',
    status: (status ?? '').trim(),
  };

  // Default to active when requested for engagement widgets
  if (defaultActive && !params.status) {
    params.status = 'active';
  }

  // Remove empty entries
  Object.keys(params).forEach((k) => {
    if (params[k] === '' || params[k] === undefined || params[k] === null) delete params[k];
  });
  return params;
}

function buildUrl(path, params) {
  const url = new URL(path, API_BASE);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v);
    }
  });
  return url.toString();
}

// PUBLIC_INTERFACE
export async function fetchUsersKpis(filters = {}) {
  /** Fetch KPI summary: totalActiveUsers, newUsers, inactiveUsers, compliancePercent */
  const url = buildUrl('/api/users/analytics/kpis', toBackendParams(filters, { defaultActive: true }));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch KPIs: ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchDauTrend(filters = {}) {
  /** Fetch DAU last 30 days time-series */
  const url = buildUrl('/api/users/analytics/dau-trend', toBackendParams(filters, { defaultActive: true }));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch DAU trend: ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchActiveByDepartment(filters = {}) {
  /** Fetch active users grouped by department (bar) */
  const url = buildUrl('/api/users/analytics/active-by-department', toBackendParams(filters, { defaultActive: true }));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch active by department: ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchActiveVsInactive(filters = {}) {
  /** Fetch active vs inactive breakdown (pie) */
  const url = buildUrl('/api/users/analytics/active-vs-inactive', toBackendParams(filters, { defaultActive: true }));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch active vs inactive: ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchTopActiveUsers(filters = {}) {
  /** Fetch top 10 most active users table */
  const params = { ...toBackendParams(filters, { defaultActive: true }), limit: 10 };
  const url = buildUrl('/api/users/analytics/top-active-users', params);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch top active users: ${res.status}`);
  return res.json();
}

/**
 * PUBLIC_INTERFACE
 * getTenantUsersSummary
 * Fetch tenant-wise users summary (distinct active users per tenant).
 * Accepts filters: { from, to, status, includeInactive }
 */
export async function getTenantUsersSummary(filters = {}) {
  const normalized = toBackendParams(filters, { defaultActive: false });
  // passthrough includeInactive if present
  if (filters.includeInactive !== undefined) {
    normalized.includeInactive = filters.includeInactive;
  }
  const url = buildUrl('/api/users/tenant-summary', normalized);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch tenant users summary: ${res.status}`);
  return res.json();
}

export default {
  fetchUsersKpis,
  fetchDauTrend,
  fetchActiveByDepartment,
  fetchActiveVsInactive,
  fetchTopActiveUsers,
  getTenantUsersSummary,
};
