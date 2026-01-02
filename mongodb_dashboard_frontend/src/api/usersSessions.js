import { getApiClient } from "./baseClient";

/**
 * PUBLIC_INTERFACE
 * getUserSessions
 * Fetch session summary for a specific user from:
 *   GET /api/users/:userId/sessions
 *
 * This endpoint is expected to be scoped by tenant and time range:
 *   - organization_id (tenant scope; alias tenant_id may also work server-side)
 *   - from/to (ISO date-time)
 *
 * The backend may return either:
 *   - { success: true, data: {...} }
 *   - { sessions_count, projects_count, ... }
 *   - or another object shape (we pass through and normalize lightly)
 *
 * @param {string} userId - User identifier
 * @param {Object} params
 * @param {string} params.organization_id - Tenant scope
 * @param {string} [params.from] - ISO date-time
 * @param {string} [params.to] - ISO date-time
 * @param {string} [params.tenant_id] - Optional alias
 * @returns {Promise<Object>} normalized payload
 */
export async function getUserSessions(userId, params = {}) {
  if (!userId) throw new Error("userId is required");

  const client = getApiClient();
  const { data } = await client.get(`/api/users/${encodeURIComponent(userId)}/sessions`, {
    params,
  });

  // Normalize common envelope shapes.
  if (data && typeof data === "object") {
    if (data.success === true && data.data && typeof data.data === "object") return data.data;
    return data;
  }
  return {};
}
