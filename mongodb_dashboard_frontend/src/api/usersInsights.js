import client from './client';

/**
 * Shared helper to build query objects by removing undefined/null keys.
 */
function cleanParams(params = {}) {
  const cleaned = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v;
  });
  return cleaned;
}

/**
 * Centralized error handling for API calls to ensure consistent error shapes.
 * Wraps axios errors into a standardized Error with message and optional details.
 */
function handleApiError(error, fallbackMessage) {
  const err = new Error(
    error?.response?.data?.message ||
      error?.message ||
      fallbackMessage ||
      'Request failed'
  );
  err.status = error?.response?.status;
  err.details = error?.response?.data || null;
  err.isAxiosError = Boolean(error?.isAxiosError);
  throw err;
}

// PUBLIC_INTERFACE
export async function getUsersActivity({ period, from, to, tenant_id } = {}) {
  /** Fetch user activity summary for a given period (daily|weekly|monthly).
   * Params:
   * - period: 'daily' | 'weekly' | 'monthly' (required by API)
   * - from?: ISO date string
   * - to?: ISO date string
   * - tenant_id?: string
   * Returns ActivityResponse:
   * {
   *   totals: { activeUsers: number },
   *   items: Array<{ label: string, count: number, [key: string]: any }>,
   *   meta: { from?: string, to?: string, granularity?: string }
   * }
   */
  try {
    const params = cleanParams({ period, from, to, tenant_id });
    const res = await client.get('/api/users/activity', { params });
    return res.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch users activity');
  }
}

// PUBLIC_INTERFACE
export async function getUsersTrends({ from, to, granularity } = {}) {
  /** Fetch 30-day active users trend (supports optional from/to and granularity where backend may default to day).
   * Params:
   * - from?: ISO date string
   * - to?: ISO date string
   * - granularity?: 'day' | 'week' | 'month'
   * Returns TrendResponse:
   * {
   *   totals: { points: number },
   *   items: Array<{ date: string, total: number, sessions?: number|null }>,
   *   meta: { from?: string, to?: string, granularity?: string }
   * }
   */
  try {
    const params = cleanParams({ from, to, granularity });
    const res = await client.get('/api/users/trends', { params });
    return res.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch users trends');
  }
}

// PUBLIC_INTERFACE
export async function getUsersEngagementTrend({ from, to, granularity, tenant_id } = {}) {
  /** Fetch engagement trend (active users and sessions) with optional tenant scope.
   * Params:
   * - from?: ISO date string
   * - to?: ISO date string
   * - granularity?: 'day' | 'week' | 'month'
   * - tenant_id?: string
   * Returns TrendResponse:
   * {
   *   totals: { points: number },
   *   items: Array<{ date: string, total: number, sessions?: number|null }>,
   *   meta: { from?: string, to?: string, granularity?: string }
   * }
   */
  try {
    const params = cleanParams({ from, to, granularity, tenant_id });
    const res = await client.get('/api/users/engagement-trend', { params });
    return res.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch users engagement trend');
  }
}

// PUBLIC_INTERFACE
export async function getUsersByOrganizations({ from, to, tenant_id } = {}) {
  /** Fetch counts of distinct active users grouped by organization.
   * Params:
   * - from?: ISO date string
   * - to?: ISO date string
   * - tenant_id?: string (optional scope)
   * Returns GroupResponse:
   * {
   *   totals: { groups: number },
   *   items: Array<{ label: string, count: number, [key: string]: any }>,
   *   meta: { from?: string, to?: string, granularity?: 'group' }
   * }
   */
  try {
    const params = cleanParams({ from, to, tenant_id });
    const res = await client.get('/api/users/organizations', { params });
    return res.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch users by organizations');
  }
}

// PUBLIC_INTERFACE
export async function getUsersByDepartments({ from, to, tenant_id } = {}) {
  /** Fetch counts of distinct active users grouped by department.
   * Params:
   * - from?: ISO date string
   * - to?: ISO date string
   * - tenant_id?: string (optional scope)
   * Returns GroupResponse:
   * {
   *   totals: { groups: number },
   *   items: Array<{ label: string, count: number, [key: string]: any }>,
   *   meta: { from?: string, to?: string, granularity?: 'group' }
   * }
   */
  try {
    const params = cleanParams({ from, to, tenant_id });
    const res = await client.get('/api/users/departments', { params });
    return res.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch users by departments');
  }
}

// PUBLIC_INTERFACE
export async function getUsersCompliance({ tenant_id, inactiveDays, requiredFields, includeDetails } = {}) {
  /** Fetch user compliance metrics (terms, MFA, inactivity) for optional tenant and filters.
   * Params:
   * - tenant_id?: string
   * - inactiveDays?: number
   * - requiredFields?: string | string[]
   * - includeDetails?: boolean
   * Returns ComplianceResponse:
   * {
   *   totals: {
   *     totalUsers: number,
   *     accepted: number,
   *     acceptedWithinWindow?: number,
   *     acceptanceRate?: number,
   *     mfaEnabled?: number|null,
   *     inactiveUsers30d?: number|null
   *   },
   *   items: Array<{ label: string, count: number, [key: string]: any }>,
   *   meta: { from?: string, to?: string, granularity?: 'summary' }
   * }
   */
  try {
    let required = requiredFields;
    if (Array.isArray(requiredFields)) {
      // Convert arrays to comma-separated string to pass via query params.
      required = requiredFields.join(',');
    }
    const params = cleanParams({
      tenant_id,
      inactiveDays,
      requiredFields: required,
      includeDetails,
    });
    const res = await client.get('/api/users/compliance', { params });
    return res.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch users compliance');
  }
}

// PUBLIC_INTERFACE
export async function getUsersKpis({ from, to, tenant_id } = {}) {
  /** Fetch KPI metrics for users in a time window.
   * Params:
   * - from: ISO date string (required by our client; API has defaults but we encourage explicit range)
   * - to: ISO date string (required by our client; API has defaults but we encourage explicit range)
   * - tenant_id?: string (optional scope)
   * Returns KpisResponse:
   * {
   *   totals: {
   *     newUsers: number,
   *     activeUsers: number,
   *     returningUsers: number,
   *     avgSessionsPerUser: number
   *   },
   *   items: Array<{ label: string, count: number }>,
   *   meta: { from?: string, to?: string, granularity?: 'summary' }
   * }
   */
  try {
    const params = cleanParams({ from, to, tenant_id });
    const res = await client.get('/api/users/kpis', { params });
    return res.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch users KPIs');
  }
}

export default {
  getUsersActivity,
  getUsersTrends,
  getUsersEngagementTrend,
  getUsersByOrganizations,
  getUsersByDepartments,
  getUsersCompliance,
  getUsersKpis,
};
