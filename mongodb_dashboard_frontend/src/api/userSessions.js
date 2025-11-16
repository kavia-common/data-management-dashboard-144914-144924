import { getApiClient } from "./baseClient";

// PUBLIC_INTERFACE
export async function getUserSessions(userId, tenantId, { page = 1, limit = 50 } = {}) {
  /** Fetch flattened session breakdown entries for a user across sessions.
   * Backend: GET /api/session-tracking?user_id=<id>&tenant_id=<tenant>&page=<page>&limit=<limit>
   * Returns { success, data: [{ session_id, session_start, session_end, duration, agents, user_id }], meta }
   */
  if (!userId) throw new Error("userId is required");
  if (!tenantId) throw new Error("tenantId is required");
  const api = getApiClient();
  const params = { user_id: String(userId), tenant_id: String(tenantId), page, limit };
  const res = await api.get("/session-tracking", { params });
  const payload = res?.data || {};
  const items = Array.isArray(payload) ? payload : payload?.data || [];
  const meta = payload?.meta || null;
  return { items, meta };
}

export default { getUserSessions };
