import client from './client';

/**
 * PUBLIC_INTERFACE
 * getUserSessionCount
 * Fetches the total number of sessions for a given user_id by querying the session-tracking endpoint.
 * Strategy:
 * - Prefer backend count if supported (?limit=1 to minimize payload and rely on meta.total envelope).
 * - We send filter={ "user_id": "<id>" } and page=1&limit=1 to request an envelope with meta.total.
 * - If the server returns an array (no envelope), we return the array length (should be 0 or 1 due to limit).
 * - Handles errors gracefully by returning 0 on failure.
 *
 * Params:
 * - userId: string - The user's identifier (normalized to string in backend)
 * - extraParams: optional object for future use (e.g., tenant scoping could be added upstream in client)
 *
 * Returns: Promise<number> total sessions count for the user
 */
export async function getUserSessionCount(userId, extraParams = {}) {
  if (!userId) return 0;

  try {
    const params = {
      page: 1,
      limit: 1,
      // server expects JSON string for filter param based on other apis
      filter: JSON.stringify({ user_id: String(userId) }),
      ...extraParams,
    };

    const resp = await client.get('/session-tracking', { params });

    // Normalize possible response shapes from our client abstraction:
    // 1) axios-like: { data: { data?:[], items?:[], meta?:{total} } }
    // 2) already-unwrapped JSON: { data?:[], items?:[], meta?:{total} }
    // 3) raw array: [] with optional .total
    const body = resp && typeof resp === 'object' && 'data' in resp ? resp.data : resp;

    if (body && typeof body === 'object') {
      // Prefer meta.total from either top-level or nested data
      if (typeof body.meta?.total === 'number') return body.meta.total;
      if (body.data && typeof body.data.meta?.total === 'number') return body.data.meta.total;

      // If array-like items exist, use their length (should be <=1 given limit=1)
      if (Array.isArray(body.items)) return body.items.length;
      if (Array.isArray(body.data)) return body.data.length;
      if (Array.isArray(body.results)) return body.results.length;
    }

    if (Array.isArray(body)) {
      return (body.total ?? body.length) ?? 0;
    }

    return 0;
  } catch (_err) {
    // Swallow errors and return 0 so the table stays resilient
    return 0;
  }
}

export default {
  getUserSessionCount,
};
