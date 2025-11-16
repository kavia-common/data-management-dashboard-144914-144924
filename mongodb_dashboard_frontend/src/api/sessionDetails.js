import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * getSessionDetails
 * Fetch a single session document including session_breakdown (optionally filtered by date range).
 *
 * @param {string} id - Session document id
 * @param {{ startDate?: string, endDate?: string }} [opts]
 * @returns {Promise<object>} Session document with session_breakdown and session_breakdown_total_duration_seconds
 */
export async function getSessionDetails(id, opts = {}) {
  if (!id) {
    throw new Error('Session id is required');
  }
  const params = {};
  if (opts.startDate) params.startDate = opts.startDate;
  if (opts.endDate) params.endDate = opts.endDate;

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') qs.append(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const url = `/api/session-tracking/${encodeURIComponent(id)}/details${query}`;
  const { data } = await getApiClient().get(url);
  return data;
}

export default { getSessionDetails };
