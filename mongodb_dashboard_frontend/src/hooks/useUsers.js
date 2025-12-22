import { useEffect, useMemo, useState } from 'react';
import { listUsers } from '../api'; // unified api index with clients

/**
 * PUBLIC_INTERFACE
 * useUsers
 * A hook to fetch users from the backend and expose loading, error, and data states.
 * Pagination-driven: page and limit are forwarded to the API to ensure a single call per change.
 */
export function useUsers({ page = 1, limit = 10, sort, filter, search, tenantId } = {}) {
  /**
   * This is a public function.
   * Returns:
   *  - users: array of user documents
   *  - loading: boolean
   *  - error: Error | null
   *  - meta: { page, limit, total }
   *  - refetch: function to re-trigger fetch
   */
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page, limit, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(() => {
    const out = {};
    // drive pagination explicitly
    if (page != null) out.page = page;
    if (limit != null) out.limit = limit;
    if (sort) out.sort = sort;
    if (filter) out.filter = typeof filter === 'string' ? filter : JSON.stringify(filter);
    if (search) out.q = search;
    // allow explicit tenant override if needed
    if (tenantId) out.organization_id = tenantId; // alias accepted by backend
    return out;
  }, [page, limit, sort, filter, search, tenantId]);

  const fetchUsers = async (signal) => {
    setLoading(true);
    setError(null);
    try {
      // listUsers returns normalized { items, total, meta }
      const resp = await listUsers(params, { signal });

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[useUsers] listUsers => items:', Array.isArray(resp?.items) ? resp.items.length : 0, 'meta:', resp?.meta);
      }

      const items = Array.isArray(resp?.items) ? resp.items : [];
      const nextMeta = resp?.meta || { page: params.page || 1, limit: params.limit || 10, total: Array.isArray(resp) ? resp.length : 0 };
      setUsers(items);
      setMeta({
        page: Number(nextMeta.page) || params.page || 1,
        limit: Number(nextMeta.limit) || params.limit || 10,
        total: Number(nextMeta.total) || 0,
      });
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err);
        setUsers([]);
        setMeta({ page: params.page || 1, limit: params.limit || 10, total: 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  return {
    users,
    loading,
    error,
    meta,
    refetch: () => fetchUsers(),
  };
}

/**
 * PUBLIC_INTERFACE
 * aggregateUsersByDepartment
 * Aggregates an array of users into counts per department.
 */
export function aggregateUsersByDepartment(users) {
  /** This is a public function.
   * Params:
   *  - users: array of user objects with an optional 'department' field
   * Returns:
   *  - array of { department: string, count: number }
   * Notes:
   *  - Users missing a valid department are excluded (skip undefined, null, empty, or 'Unknown')
   */
  const counts = new Map();

  const isInvalidDept = (val) => {
    if (val == null) return true;
    const s = String(val).trim();
    if (!s) return true;
    return s.toLowerCase() === 'unknown';
  };

  for (const u of users || []) {
    // Try direct and common nested locations
    let dept =
      u?.department ??
      u?.profile?.department ??
      u?.metadata?.department ??
      u?.details?.department;

    // Skip invalid department values
    if (isInvalidDept(dept)) continue;

    const key = String(dept).trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  // Convert to array sorted descending by count
  return Array.from(counts.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);
}
