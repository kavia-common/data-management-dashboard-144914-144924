import client from './client';

/**
 * Session Tracking API client.
 * Provides functions to fetch session tracking records for a tenant
 * and find a record by session id defensively handling envelope/array responses.
 */

const DEFAULT_PAGE = 4;
const DEFAULT_LIMIT = 200;

// PUBLIC_INTERFACE
export async function fetchSessionTracking({ tenantId, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) {
  /** Fetch session-tracking list (envelope or array) from the external API directly. */
  const params = new URLSearchParams();
  if (page != null) params.set('page', String(page));
  if (limit != null) params.set('limit', String(limit));
  if (tenantId) params.set('tenant_id', tenantId);

  const externalUrl = `https://vscode-internal-41189-beta.beta01.cloud.kavia.ai:3001/api/session-tracking?${params.toString()}`;
  // Use shared client; it adds Authorization/x-tenant-id when available. CORS must be allowed by the external API.
  const res = await client.get(externalUrl);
  return res.data;
}

// PUBLIC_INTERFACE
export function normalizeSessionBreakdown(record) {
  /** Extracts session breakdown fields defensively (snake_case or camelCase)
   * Returns { sessionStart, sessionEnd, duration, agent }
   */
  if (!record || typeof record !== 'object') {
    return { sessionStart: null, sessionEnd: null, duration: null, agent: null };
  }
  const sb = record.session_breakdown || record.sessionBreakdown || {};
  const sessionStart = sb.session_start ?? sb.sessionStart ?? sb.start ?? sb.start_time ?? sb.startTime ?? null;
  const sessionEnd = sb.session_end ?? sb.sessionEnd ?? sb.end ?? sb.end_time ?? sb.endTime ?? null;

  // Prefer a human-friendly breakdown string if provided, otherwise may be a numeric ms or seconds
  const duration =
    sb.breakdown ||
    sb.duration_breakdown ||
    sb.durationReadable ||
    sb.duration_readable ||
    sb.duration ||
    sb.total_duration ||
    sb.totalDuration ||
    null;

  const agent = sb.agent ?? sb.agent_name ?? sb.agentName ?? sb.model ?? sb.model_name ?? null;

  return { sessionStart, sessionEnd, duration, agent };
}

// PUBLIC_INTERFACE
export function recordMatchesSessionId(record, sessionId) {
  /** Determine if an API record corresponds to the provided sessionId.
   * Matches by any of: _id, id, session_id, sessionId, session_identifier, sessionIdentifier
   */
  if (!record || !sessionId) return false;
  const candidates = [
    record._id, record.id,
    record.session_id, record.sessionId,
    record.session_identifier, record.sessionIdentifier,
    record?.session_data?.session_id, // sometimes nested
    record?.session_data?.sessionId,
  ].filter(Boolean);
  return candidates.some((v) => String(v) === String(sessionId));
}

// PUBLIC_INTERFACE
export function findRecordBySessionId(list, sessionId) {
  /** Finds the first record in the returned payload (array or envelope.data) that matches sessionId. */
  if (!list) return null;
  const items = Array.isArray(list) ? list : (Array.isArray(list.data) ? list.data : []);
  return items.find((r) => recordMatchesSessionId(r, sessionId)) || null;
}
