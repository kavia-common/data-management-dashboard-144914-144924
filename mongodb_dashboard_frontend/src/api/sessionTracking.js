import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * fetchSessionTracking
 * Fetch session tracking records with optional filters, pagination, and sorting.
 * Returns normalized { items, total, meta } envelope regardless of backend envelope/array shape.
 *
 * @param {Object} params
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @param {string} [params.sort]
 * @param {Object|string} [params.filter] JSON string or object for server-side filtering
 * @param {string} [params.q] Text search query
 * @returns {Promise<{ items: Array<any>, total: number, meta: any }>}
 */
export async function fetchSessionTracking(params = {}) {
  const safeParams = { ...(params || {}) };

  // Server enforces scoping from token; do not include tenant_id/user_id in params
  try {
    const { getAuthToken } = await import('../utils/auth');

    // Remove any accidental tenant_id/user_id passed by callers
    delete safeParams.tenant_id;
    if (safeParams.filter && typeof safeParams.filter === 'object') {
      // strip tenant_id/user_id within nested filter too
      const { tenant_id, user_id, ...rest } = safeParams.filter;
      safeParams.filter = rest;
    }

    // stringify filter object if necessary
    if (safeParams.filter && typeof safeParams.filter === 'object') {
      safeParams.filter = JSON.stringify(safeParams.filter);
    }

    const qs = buildQueryString(safeParams);
    const url = `/api/session-tracking${qs}`;

    // Authorization header only
    const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await getApiClient().get(url, { headers });
    const payload = res?.data ?? res;

    const items = Array.isArray(payload) ? payload : payload?.data ?? [];
    const total =
      (payload && payload.meta && typeof payload.meta.total === 'number' && payload.meta.total) ||
      (Array.isArray(items) ? items.length : 0);
    const meta = payload?.meta ?? null;

    return { items, total, meta };
  } catch {
    // Fallback path
    if (safeParams.filter && typeof safeParams.filter === 'object') {
      safeParams.filter = JSON.stringify(safeParams.filter);
    }
    const qs = buildQueryString(safeParams);
    const url = `/api/session-tracking${qs}`;
    const res = await getApiClient().get(url);
    const payload = res?.data ?? res;

    const items = Array.isArray(payload) ? payload : payload?.data ?? [];
    const total =
      (payload && payload.meta && typeof payload.meta.total === 'number' && payload.meta.total) ||
      (Array.isArray(items) ? items.length : 0);
    const meta = payload?.meta ?? null;

    return { items, total, meta };
  }
}

export default { fetchSessionTracking };
