import { getApiClient } from "./baseClient";

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
  if (asString.startsWith("ISODate(")) return asString;
  return `ISODate(\"${asString}\")`;
}

/**
 * PUBLIC_INTERFACE
 * unwrapMongoISODate
 * Accepts a value that may be wrapped as ISODate("...") and returns the inner ISO string.
 * If the value is not wrapped, returns the string form as-is.
 *
 * This is useful for endpoints that expect plain ISO strings (e.g., POST bodies)
 * rather than Mongo-shell wrapper expressions.
 *
 * @param {string | undefined | null} value
 * @returns {string | undefined | null}
 */
export function unwrapMongoISODate(value) {
  if (value == null || value === "") return value;
  let s = String(value).trim();
  const m = /^ISODate\((.*)\)$/i.exec(s);
  if (m && m[1]) {
    s = m[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return s;
}

/**
 * PUBLIC_INTERFACE
 * getUserBasic
 * Fetch a single user document by id from /api/users/{id}.
 * Returns the raw user document payload as { ... }.
 */
export async function getUserBasic(userId, params = {}) {
  if (!userId) throw new Error("userId is required");
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
  if (!userId) throw new Error("userId is required");
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
 * getUsersProjectsBatch
 * Fetch distinct projects for multiple users in one consolidated request.
 *
 * Endpoint:
 *  POST /api/users/projects
 *
 * Body:
 *  {
 *    userIds: string[],
 *    organization_id?: string,
 *    tenant_id?: string,
 *    from?: string (ISO),
 *    to?: string (ISO)
 *  }
 *
 * Response (backend):
 *  { success: true, data: Record<userId, Array<{project_id, project_name?, last_activity?}>> }
 *
 * Notes:
 * - This endpoint expects plain ISO strings (not ISODate(...) wrappers).
 *
 * @param {string[]} userIds
 * @param {{organization_id?: string, tenant_id?: string, from?: string, to?: string}} params
 * @returns {Promise<{success?: boolean, data?: Record<string, any[]>, tenant_id?: string, meta?: any}>}
 */
export async function getUsersProjectsBatch(userIds, params = {}) {
  if (!Array.isArray(userIds)) throw new Error("userIds must be an array");
  const normalizedIds = userIds.map((v) => String(v)).filter(Boolean);
  const api = getApiClient();

  const payload = {
    userIds: normalizedIds,
    organization_id: params?.organization_id,
    tenant_id: params?.tenant_id,
    // Ensure we do NOT send ISODate(...) wrappers in the POST body.
    from: params?.from ? unwrapMongoISODate(params.from) : undefined,
    to: params?.to ? unwrapMongoISODate(params.to) : undefined,
  };

  const { data } = await api.post("/api/users/projects", payload);
  return data;
}
