import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * Fetch session tracking records with pagination, sorting, and optional text search and exact userId.
 * Recognized params: page, limit, pageSize, sort, filter (ignored by backend), q (string), userId (string), tenant_id.
 */
export async function getSessionTracking(params = {}) {
  const {
    page, limit, pageSize, sort, q, userId, tenant_id, filter, ...rest
  } = params || {};

  const safe = {};
  if (page !== undefined) safe.page = page;
  if (limit !== undefined) safe.limit = limit;
  if (pageSize !== undefined) safe.pageSize = pageSize;
  if (sort !== undefined) safe.sort = sort;
  if (tenant_id !== undefined) safe.tenant_id = tenant_id;
  if (q !== undefined && q !== '') safe.q = q;
  if (userId !== undefined && userId !== '') safe.userId = userId;
  // 'filter' intentionally omitted; backend ignores it for this route
  Object.assign(safe, rest);

  const qs = buildQueryString(safe);
  const url = `/api/session-tracking${qs}`;
  const res = await getApiClient().get(url);
  return res?.data ?? res;
}

/**
 * PUBLIC_INTERFACE
 * fetchSessionTracking: normalized result for table usage { items, total, meta }
 */
export async function fetchSessionTracking(params = {}) {
  const data = await getSessionTracking(params);
  const items = Array.isArray(data) ? data : data?.data ?? [];
  const total =
    (data && data.meta && typeof data.meta.total === 'number' && data.meta.total) ||
    (Array.isArray(items) ? items.length : 0);
  const meta = data?.meta ?? null;
  return { items, total, meta };
}

/* No default export to favor named exports */
