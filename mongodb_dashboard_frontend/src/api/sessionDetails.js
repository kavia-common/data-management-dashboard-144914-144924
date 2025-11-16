import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * getSessionDetails
 * Fetch a single session document including session_breakdown (optionally filtered by date range)
 * via unified GET /api/session-tracking?id=<id>&startDate=&endDate=.
 *
 * Note: baseClient ensures tenant scoping using organization_id -> tenant_id where applicable.
 *
 * @param {string} id - Session document id
 * @param {{ startDate?: string, endDate?: string }} [opts]
 * @returns {Promise<object|null>} Session document with session_breakdown and session_breakdown_total_duration_seconds
 */
export async function getSessionDetails(id, opts = {}) {
  if (!id) throw new Error('Session id is required');
  const params = {
    id,
    startDate: opts.startDate || '',
    endDate: opts.endDate || '',
  };
  // Use baseClient.get with params to append scoping automatically
  const { data } = await getApiClient().get('/api/session-tracking', { params });
  // Backend returns { success, data }
  if (data && typeof data === 'object' && 'data' in data) {
    return data.data;
  }
  // Fallback (should not occur with unified API)
  return data || null;
}

export default { getSessionDetails };
