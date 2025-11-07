import httpClient from './httpClient';

/**
 * PUBLIC_INTERFACE
 * listUsers
 * Lists users using the axios httpClient (with Authorization and x-tenant-id interceptors).
 * Normalizes the response to { items, total, meta }.
 *
 * @param {Object} params - Optional query parameters like page, limit, sort, filter.
 * @returns {Promise<{ items: Array, total: number, meta: Object|null }>}
 */
export async function listUsers(params = {}) {
  const res = await httpClient.get('/users', { params });
  const payload = res?.data;

  // Normalize various response shapes to a consistent structure
  const items = Array.isArray(payload) ? payload : payload?.data || [];
  const total =
    (payload && payload.meta && typeof payload.meta.total === 'number' && payload.meta.total) ||
    (Array.isArray(items) ? items.length : 0);

  return { items, total, meta: payload?.meta || null };
}

export default {
  listUsers,
};
