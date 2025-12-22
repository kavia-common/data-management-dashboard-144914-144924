import { listUsers } from "../api";

/**
 * PUBLIC_INTERFACE
 * getUsers
 * Retrieves users from the backend with support for filter, page, limit, sort, and search.
 * Thin pass-through to shared listUsers to avoid duplicate call logic.
 */
export async function getUsers(options = {}) {
  const { filter, page, limit, sort, search, tenantId } = options || {};
  const params = {};
  if (page != null) params.page = page;
  if (limit != null) params.limit = limit;
  if (sort) params.sort = sort;
  if (search) params.q = search;
  if (tenantId) params.organization_id = tenantId;
  if (filter) {
    params.filter = typeof filter === "string" ? filter : JSON.stringify(filter);
  }
  return listUsers(params);
}
