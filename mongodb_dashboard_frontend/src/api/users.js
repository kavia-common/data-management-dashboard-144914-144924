import { getApiClient } from "./index";

/**
 * PUBLIC_INTERFACE
 * getUserBasic
 * Fetch minimal user info by MongoDB ObjectId.
 * GET /api/users/:id -> { id, name }
 *
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {Promise<{ id: string, name: string|null }>}
 */
export async function getUserBasic(userId) {
  const api = getApiClient();
  if (!userId) throw new Error("userId is required");
  try {
    // Always include /api prefix and let the client handle base + auth + tenant propagation
    const res = await api.get(`/api/users/${encodeURIComponent(userId)}`);
    return res.data;
  } catch (err) {
    const status = err?.response?.status || err?.status;
    if (status === 404) {
      return { id: String(userId), name: null };
    }
    throw err;
  }
}

/**
 * PUBLIC_INTERFACE
 * getUserProjects
 * Fetch projects associated with a user via session tracking linkage.
 * GET /api/users/{userId}/projects requires tenant scope (organization_id/tenant_id).
 *
 * @param {string} userId
 * @param {object} [opts]
 * @param {string} [opts.organization_id] - optional explicit tenant; if omitted, base client injects it.
 * @param {string} [opts.tenant_id] - alias for tenant
 * @param {string|Date} [opts.from] - optional ISO date-time lower bound
 * @param {string|Date} [opts.to] - optional ISO date-time upper bound
 * @returns {Promise<{ user_id: string, tenant_id: string, projects: Array<{ project_id: string, project_name?: string|null, last_activity?: string|null }> }>}
 */
export async function getUserProjects(userId, opts = {}) {
  if (!userId) throw new Error("userId is required");
  const api = getApiClient();

  const params = {};
  if (opts && typeof opts === "object") {
    const { organization_id, tenant_id, from, to } = opts;
    if (organization_id) params.organization_id = organization_id;
    if (tenant_id) params.tenant_id = tenant_id;
    if (from) params.from = typeof from === "string" ? from : new Date(from).toISOString();
    if (to) params.to = typeof to === "string" ? to : new Date(to).toISOString();
  }

  // Path must start with /api to cooperate with base client URL join logic
  const { data } = await api.get(`/api/users/${encodeURIComponent(String(userId))}/projects`, {
    params,
  });
  return data;
}
