import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * wrapIsoAsMongoISODate
 * Wraps an ISO string into a Mongo-shell style ISODate("...") expression.
 * This is used for endpoints that expect ISODate-wrapped timestamps in query params.
 *
 * If the value is falsy, returns it unchanged.
 * If the value already starts with ISODate(, returns it unchanged.
 *
 * @param {string | undefined | null} iso
 * @returns {string | undefined | null}
 */
export function wrapIsoAsMongoISODate(iso) {
  if (!iso) return iso;
  const asString = String(iso);
  if (asString.startsWith('ISODate(')) return asString;
  return `ISODate("${asString}")`;
}

/**
 * PUBLIC_INTERFACE
 * getUserBasic
 * Fetch a single user document by id from /api/users/{id}.
 * Returns the raw user document payload as { ... }.
 */
export async function getUserBasic(userId, params = {}) {
  if (!userId) throw new Error('userId is required');
  const api = getApiClient();
  const { data } = await api.get(`/api/users/${encodeURIComponent(userId)}`, { params });
  return data;
}

/**
 * PUBLIC_INTERFACE
 * getUserProjects
 * Fetch distinct projects for a given user from session tracking aggregation.
 * Accepts a params object that can carry tenant scoping and optional time range:
 * { organization_id?: string, tenant_id?: string, from?: string, to?: string }
 */
export async function getUserProjects(userId, params = {}) {
  if (!userId) throw new Error('userId is required');
  const api = getApiClient();

  // Ensure from/to are sent using Mongo-style ISODate("...") wrapper as required by this endpoint.
  const formattedParams = {
    ...params,
    from: wrapIsoAsMongoISODate(params?.from),
    to: wrapIsoAsMongoISODate(params?.to),
  };

  const { data } = await api.get(`/api/users/${encodeURIComponent(userId)}/projects`, {
    params: formattedParams,
  });
  return data;
}

/**
 * PUBLIC_INTERFACE
 * getUserSessionDetails
 * Fetch aggregated session details for a given user.
 *
 * Backend endpoint:
 *   GET /api/users/:userId/session-details
 *
 * Expected response fields (used by UI):
 *   - total_count: number
 *   - total_duration: string|number
 *
 * @param {string} userId
 * @param {Object} [params] optional query params
 * @returns {Promise<any>}
 */
export async function getUserSessionDetails(userId, params = {}) {
  if (!userId) throw new Error('userId is required');
  const api = getApiClient();
  const { data } = await api.get(
    `/api/users/${encodeURIComponent(userId)}/session-details`,
    { params }
  );
  return data;
}

/**
 * PUBLIC_INTERFACE
 * getLlmCostsByOrganization
 * Fetch LLM costs rows for an organization from the underscore endpoint:
 *   GET /api/llm_costs?organization_id=...&page=...&limit=...
 *
 * Notes:
 * - We pass organization_id when provided. If omitted, baseClient may still append
 *   organization_id based on the active auth/org context.
 * - Returns the raw response payload, expected to include a `llm_costs` collection/array.
 *
 * @param {Object} params
 * @param {string} [params.organization_id] tenant/org id
 * @param {number} [params.page] page number (default 1)
 * @param {number} [params.limit] page size (default 10)
 * @returns {Promise<any>}
 */
export async function getLlmCostsByOrganization({ organization_id, page = 1, limit = 10 } = {}) {
  const api = getApiClient();
  const { data } = await api.get('/api/llm_costs', {
    params: {
      ...(organization_id ? { organization_id } : {}),
      page,
      limit,
    },
  });
  return data;
}

/**
 * PUBLIC_INTERFACE
 * getLlmCostsByUser
 * Fetch LLM costs rows for a specific user from the underscore endpoint:
 *   GET /api/llm_costs?organization_id=...&user_id=...&page=...&limit=...
 *
 * Notes:
 * - We pass organization_id when provided to preserve tenant scoping for demo/non-JWT contexts.
 * - The backend is expected to return rows that include a `user_cost` field.
 *
 * @param {Object} params
 * @param {string} params.user_id selected user id (required)
 * @param {string} [params.organization_id] tenant/org id (optional but recommended)
 * @param {number} [params.page] page number (default 1)
 * @param {number} [params.limit] page size (default 10)
 * @returns {Promise<any>}
 */
export async function getLlmCostsByUser({ user_id, organization_id, page = 1, limit = 10 } = {}) {
  if (!user_id) throw new Error('user_id is required');
  const api = getApiClient();
  const { data } = await api.get('/api/llm_costs', {
    params: {
      ...(organization_id ? { organization_id } : {}),
      user_id,
      page,
      limit,
    },
  });
  return data;
}
