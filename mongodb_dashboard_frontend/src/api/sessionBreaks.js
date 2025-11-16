import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * getSessionBreakDetails
 * Fetch session-break details for a given sessionId.
 * Respects existing auth and tenant scoping via baseClient headers and query handling.
 *
 * @param {string} sessionId - The session identifier.
 * @returns {Promise<object>} The raw session document including session_breakdown if present.
 */
export async function getSessionBreakDetails(sessionId) {
  if (!sessionId) throw new Error('sessionId is required');
  const client = getApiClient();
  const { data } = await client.get(`/api/sessions/${encodeURIComponent(String(sessionId))}/breaks`);
  return data;
}

export default {
  getSessionBreakDetails,
};
