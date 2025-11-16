/** PUBLIC_INTERFACE
 * getUserSessions
 * Fetch a user's session_breakdown entries flattened across sessions within a tenant.
 * Always calls GET /api/session-tracking with tenant_id and user_id; includes project_id when provided.
 * Returns { items, total } where items are [{ session_id, session_start, session_end, duration, agents, user_id }].
 */
import { getApiClient } from "./baseClient";

// PUBLIC_INTERFACE
export async function getUserSessions(
  userId,
  tenantId,
  { page = 1, limit = 100, projectId = null } = {}
) {
  if (!userId) throw new Error("userId is required");
  if (!tenantId) throw new Error("tenantId is required");

  const params = { tenant_id: tenantId, user_id: userId, page, limit };
  if (projectId) params.project_id = projectId;

  const { data } = await getApiClient().get("/api/session-tracking", { params });
  // Expect { success, items, total }
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = typeof data?.total === "number" ? data.total : items.length;
  return { items, total };
}

export default { getUserSessions };
