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
  // Ensure organization scoping is passed either via headers (preferred in baseClient) or query fallback.
  const url = `/api/sessions/${encodeURIComponent(String(sessionId))}/breaks`;
  const { data } = await client.get(url);
  return data;
}

export default {
  getSessionBreakDetails,
};
