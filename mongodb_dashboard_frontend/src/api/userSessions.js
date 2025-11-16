/** PUBLIC_INTERFACE
 * getUserSessions
 * Fetch a user's session breakdown entries (flattened across sessions) scoped to tenant.
 * Calls GET /api/session-tracking?tenant_id=<tenantId>&user_id=<userId>&page=&limit=
 * Returns { items, total, meta? } where items are [{ session_id, session_start, session_end, duration, agents, user_id }].
 */
import { getApiClient } from "./baseClient";

export async function getUserSessions(userId, tenantId, { page = 1, limit = 50, projectId = null } = {}) {
  if (!userId) throw new Error("userId is required");
  if (!tenantId) throw new Error("tenantId is required");
  const params = { tenant_id: tenantId, user_id: userId, page, limit };
  if (projectId) params.project_id = projectId;
  const { data } = await getApiClient().get("/api/session-tracking", { params });
  // Backend returns { success, items, total }
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = typeof data?.total === "number" ? data.total : items.length;
  return { items, total };
}

export default { getUserSessions };
