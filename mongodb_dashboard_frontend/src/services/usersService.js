import { listUsers } from "../api";

/**
 * PUBLIC_INTERFACE
 * getUsers
 * Retrieves users from the backend with support for filter, page, limit, and sort.
 * Note: Prefer using server-side pagination (page/limit) in UI tables to avoid N-per-row downstream calls.
 */
export async function getUsers(options = {}) {
  const { filter, page, limit, sort, search } = options || {};
  const params = {};
  if (page != null) params.page = page;
  if (limit != null) params.limit = limit;
  if (sort) params.sort = sort;
  if (search) params.q = search;
  if (filter) {
    params.filter = typeof filter === "string" ? filter : JSON.stringify(filter);
  }
  const res = await listUsers(params);
  return res;
}
