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
 * @param {string} params.tenantId - Required tenant/organization id for scoping (sent as organization_id per API spec; alias to tenant_id server-side)
 * @param {string|Date} [params.from] - Optional ISO date-time lower bound
 * @param {string|Date} [params.to] - Optional ISO date-time upper bound
 */
// PUBLIC_INTERFACE
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
  // Normalize and add defensive mapping for project name:
  // - Prefer project_name (backend contract)
  // - Fallbacks: name, title, projectName (in case backend or aggregator uses alternate field)
  // - Coerce to string when possible
  const normalizedProjects = projects.map((p) => {
    const projectId = p?.project_id != null ? String(p.project_id) : "";
    // Accept nested deployment object and flatten if present
    const deployment = p?.deployment || p?.app_deployment || null;
    const rawName =
      p?.project_name ??
      p?.name ??
      p?.title ??
      p?.projectName ??
      (deployment?.project_name ?? deployment?.name ?? deployment?.title ?? null);

    let projectName =
      rawName == null
        ? null
        : typeof rawName === "string"
        ? rawName
        : String(rawName);

    // Normalize: trim and filter out purely numeric strings which are likely IDs
    if (typeof projectName === 'string') {
      projectName = projectName.trim();
      if (!projectName) projectName = null;
      else if (/^\d+$/.test(projectName)) projectName = null;
    }

    return {
      project_id: projectId,
      project_name: projectName,
      last_activity: p?.last_activity ?? null,
    };
  });

  // Small unit verification by logging a sample row mapping (first item)
  if (normalizedProjects.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      "[api/userProjects] sample mapped row",
      JSON.stringify(normalizedProjects[0])
    );
  }

  return {
    user_id: data.user_id ?? String(userId),
    tenant_id: data.tenant_id ?? String(tenantId),
    projects: normalizedProjects,
  };
}
