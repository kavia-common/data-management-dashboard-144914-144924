import { getApiBaseUrl } from './config';

/**
 * Users Analytics API client
 * Wraps calls to /api/users/analytics endpoints with optional filters.
 * Filters supported: { from, to, organization, department, status }
 */

const API_BASE = getApiBaseUrl();

// PUBLIC_INTERFACE
export async function fetchUsersKpis(filters = {}) {
  /** Fetch KPI summary: totalActiveUsers, newUsers, inactiveUsers, compliancePercent */
  const url = buildUrl('/api/users/analytics/kpis', filters);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch KPIs: ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchDauTrend(filters = {}) {
  /** Fetch DAU last 30 days time-series */
  const url = buildUrl('/api/users/analytics/dau-trend', filters);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch DAU trend: ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchActiveByDepartment(filters = {}) {
  /** Fetch active users grouped by department (bar) */
  const url = buildUrl('/api/users/analytics/active-by-department', filters);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch active by department: ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchActiveVsInactive(filters = {}) {
  /** Fetch active vs inactive breakdown (pie) */
  const url = buildUrl('/api/users/analytics/active-vs-inactive', filters);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch active vs inactive: ${res.status}`);
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchTopActiveUsers(filters = {}) {
  /** Fetch top 10 most active users table */
  const params = { ...filters, limit: 10 };
  const url = buildUrl('/api/users/analytics/top-active-users', params);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch top active users: ${res.status}`);
  return res.json();
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

/**
 * PUBLIC_INTERFACE
 * getTenantUsersSummary
 * Fetch tenant-wise users summary (distinct active users per tenant).
 * Accepts filters: { from, to, status, includeInactive }
 */
export async function getTenantUsersSummary(filters = {}) {
  const url = buildUrl('/api/users/tenant-summary', filters);
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
