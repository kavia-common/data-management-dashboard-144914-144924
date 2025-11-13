import { getApiBase } from './config';
import { withTenantHeaders } from './util';
import { getToken } from './authTokenProvider';
import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * Fetch session details for a user.
 * Wraps GET /api/sessions/details?user_id=<id>&tenant_id=<tenantId>[&from=&to=]
 * Applies Authorization bearer if available and tenant headers via existing utilities.
 */
export async function fetchSessionDetails({ userId, tenantId, from, to, signal } = {}) {
  /** Fetches session details and aggregates for a user.
   * Params:
   *  - userId: string (required)
   *  - tenantId: string (optional; some deployments scope via tenant)
   *  - from: ISO string (optional)
   *  - to: ISO string (optional)
   *  - signal: AbortSignal (optional)
   * Returns: { sessions: Array<{session_start?: string|null, session_end?: string|null, duration: number }>, total_sessions: number, total_duration: number, duration_unit: 'seconds' }
   */
  if (!userId) {
    throw new Error('userId is required');
  }

  const baseUrl = getApiBase(); // e.g., https://host:3001/api
  // Ensure we point to the correct path: backend expects /api/sessions/details
  const root = String(baseUrl).replace(/\/+$/, '');
  const url = new URL('/api/sessions/details', root);

  url.searchParams.set('user_id', userId);
  if (tenantId) url.searchParams.set('tenant_id', tenantId);
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);

  const token = getToken?.();
  const headers = withTenantHeaders(
    {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    tenantId
  );

  const client = getApiClient();
  const res = await client.get(url.toString(), { headers, signal });
  return res.data;
}

export default {
  fetchSessionDetails,
};
