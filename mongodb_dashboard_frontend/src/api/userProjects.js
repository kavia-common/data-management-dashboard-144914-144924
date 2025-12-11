import { getApiClient } from "./index";

/**
 * PUBLIC_INTERFACE
 * getUserProjects
 * Fetches distinct projects for a user from aggregated backend endpoint.
 * GET /api/users/{userId}/projects?organization_id=<tenantId>&from&to
 *
 * Returns:
 * {
 *   user_id: string,
 *   tenant_id: string,
 *   projects: Array<{ project_id: string, project_name?: string|null, last_activity?: string|null }>
 * }
 *
 * @param {object} params
 * @param {string} params.userId - Required user id
 * @param {string} params.tenantId - Required tenant/organization id for scoping
 * @param {string|Date} [params.from] - Optional ISO date-time lower bound
 * @param {string|Date} [params.to] - Optional ISO date-time upper bound
 */
export async function getUserProjects({ userId, tenantId, from, to }) {
  if (!userId) throw new Error("getUserProjects: userId is required");
  if (!tenantId) throw new Error("getUserProjects: tenantId is required");

  const api = getApiClient();

  // Build params, letting the baseClient attach/override organization_id where appropriate.
  const query = {};
  if (tenantId) query.organization_id = tenantId;
  if (from) query.from = typeof from === "string" ? from : new Date(from).toISOString();
  if (to) query.to = typeof to === "string" ? to : new Date(to).toISOString();

  const path = `/api/users/${encodeURIComponent(String(userId))}/projects`;
  const res = await api.get(path, { params: query });
  const data = res?.data || {};

  // Normalize shape
  const projects = Array.isArray(data.projects) ? data.projects : [];
  return {
    user_id: data.user_id ?? String(userId),
    tenant_id: data.tenant_id ?? String(tenantId),
    projects: projects.map((p) => ({
      project_id: p?.project_id != null ? String(p.project_id) : "",
      project_name: p?.project_name ?? null,
      last_activity: p?.last_activity ?? null,
    })),
  };
}
