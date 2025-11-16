import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * fetchSessionTracking
 * Fetch session tracking records with optional filters, pagination, and sorting.
 * Behavior:
 * - When called with user-centric params (tenant_id + user_id [+ project_id]) the backend returns { success, items, total }.
 * - Otherwise it may return array or { success, data, meta } for list-type responses.
 * This function normalizes to { items, total, meta } WITHOUT falling back to unfiltered data.
 *
 * @param {Object} params
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @param {string} [params.sort]
 * @param {Object|string} [params.filter] JSON string or object for server-side filtering
 * @param {string} [params.q] Text search query
 * @param {string} [params.tenant_id]
 * @param {string} [params.user_id]
 * @param {string} [params.project_id]
 * @returns {Promise<{ items: Array<any>, total: number, meta: any }>}
 */
export async function fetchSessionTracking(params = {}) {
  const safeParams = { ...params };
  if (safeParams.filter && typeof safeParams.filter === 'object') {
    safeParams.filter = JSON.stringify(safeParams.filter);
  }
  const qs = buildQueryString(safeParams);
  const url = `/api/session-tracking${qs}`;
  const res = await getApiClient().get(url);
  const payload = res?.data ?? res;

  // User-centric branch: expect { success, items, total }
  if (safeParams?.tenant_id && safeParams?.user_id) {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total =
      typeof payload?.total === 'number'
        ? payload.total
        : (Array.isArray(items) ? items.length : 0);
    return { items, total, meta: null };
  }

  // Generic list branches
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length, meta: null };
  }
  if (payload && Array.isArray(payload.data)) {
    const total =
      payload?.meta && typeof payload.meta.total === 'number'
        ? payload.meta.total
        : payload.data.length;
    return { items: payload.data, total, meta: payload?.meta ?? null };
  }

  // Fallback: unknown shape -> empty list (do not surface unfiltered data)
  return { items: [], total: 0, meta: null };
}

export default { fetchSessionTracking };
