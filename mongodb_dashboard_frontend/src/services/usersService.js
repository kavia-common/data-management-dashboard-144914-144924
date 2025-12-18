import { listUsers, postUser, putUser } from "../api";

/**
 * PUBLIC_INTERFACE
 * getUsers
 * Retrieves users from the backend with support for filter, page, limit, and sort.
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

/**
 * PUBLIC_INTERFACE
 * createUser
 * Creates a user; payload must include { name }. Any other name-like fields are ignored client-side.
 */
export async function createUser({ name, ...rest }) {
  const payload = { ...rest };
  if (name && String(name).trim()) {
    payload.name = String(name).trim();
  }
  return await postUser(payload);
}

/**
 * PUBLIC_INTERFACE
 * updateUser
 * Updates a user by id; payload must include { name } when modifying the primary name.
 */
export async function updateUser(id, { name, ...rest }) {
  const payload = { ...rest };
  if (name && String(name).trim()) {
    payload.name = String(name).trim();
  }
  return await putUser(id, payload);
}
