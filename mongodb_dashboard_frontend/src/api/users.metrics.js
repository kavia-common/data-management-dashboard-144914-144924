import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * fetchUsersMetrics
 * Fetches { totalUsers, activeUsers } for the current tenant (or all-tenants if T0000).
 * Returns a safe object with zeros on failure.
 */
export async function fetchUsersMetrics({ signal } = {}) {
  try {
    const client = await getApiClient();
    const resp = await client.get('/metrics/users', { signal });
    // Support either envelope {success,totalUsers,activeUsers} or plain object
    const data = resp?.data || resp;
    return {
      totalUsers: Number(data?.totalUsers ?? 0),
      activeUsers: Number(data?.activeUsers ?? 0),
      success: data?.success !== false,
    };
  } catch (e) {
    return { totalUsers: 0, activeUsers: 0, success: false, error: e?.message || 'Failed to fetch users metrics' };
  }
}
