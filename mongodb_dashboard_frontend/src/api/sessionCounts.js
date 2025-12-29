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

    const res = await client.get('/session-tracking', { params });

    // If response is envelope: { data:[], meta:{ total } }
    if (res && typeof res === 'object') {
      const data = res.data ?? res.items ?? res.results ?? res;
      const meta = res.meta || (res.data && res.data.meta) || null;

      // Some of our api clients return the raw JSON response directly; others wrap it.
      // Standardized session-tracking GET supports envelope when page/limit provided.
      if (res.meta && typeof res.meta.total === 'number') {
        return res.meta.total;
      }
      if (res && res.data && res.data.meta && typeof res.data.meta.total === 'number') {
        return res.data.meta.total;
      }
      // If not envelope, try to infer length of returned items (should be <= 1 given limit=1)
      if (Array.isArray(res)) {
        return (res.total ?? res.length) ?? 0;
      }
      if (Array.isArray(data)) {
        return data.length ?? 0;
      }
    }

    return 0;
  } catch (err) {
    // Swallow errors and return 0 so the table stays resilient
    // Optionally, we could log to a diagnostics channel
    return 0;
  }
}

export default {
  getUserSessionCount,
};
