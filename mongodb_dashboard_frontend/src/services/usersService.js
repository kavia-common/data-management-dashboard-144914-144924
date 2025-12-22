import { listUsers } from "../api";

/**
 * PUBLIC_INTERFACE
 * getUsers
 * Retrieves users from the backend with support for filter, page, limit, and sort.
 */
// PUBLIC_INTERFACE
export async function getUsers(options = {}) {
  const { filter, page, limit, sort, search, signal } = options || {};
  const params = {};
  if (page != null) params.page = page;
  if (limit != null) params.limit = limit;
  if (sort) params.sort = sort;
  if (search) params.q = search;
  if (filter) {
    params.filter = typeof filter === "string" ? filter : JSON.stringify(filter);
  }
  // Pass AbortController signal through to underlying fetch layer if provided.
  const res = await listUsers(params, { signal });
  return res;
}
