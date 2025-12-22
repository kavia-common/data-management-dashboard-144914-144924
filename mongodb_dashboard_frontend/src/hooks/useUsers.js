import { useEffect, useMemo, useRef, useState } from 'react';
import { listUsers } from '../api'; // unified api index with clients

/**
 * PUBLIC_INTERFACE
 * useUsers
 * A hook to fetch users from the backend and expose loading, error, and data states.
 *
 * Behavior:
 * - Makes a single API call on initial mount.
 * - Further calls happen only when pagination (page) changes.
 * - Uses AbortController to cancel any in-flight request when params change or unmount happens.
 */
// PUBLIC_INTERFACE
export function useUsers({ initialPage = 1, limit, sort, filter } = {}) {
  /**
   * This is a public function.
   * Returns:
   *  - users: array of user documents
   *  - loading: boolean
   *  - error: Error | null
   *  - page: number (current page)
   *  - total: number (from meta or items length)
   *  - meta: object | null (server pagination meta if provided)
   *  - setPage: function to change page (triggers fetch)
   *  - refetch: function to re-trigger fetch for the current page
   */
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(initialPage || 1);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState(null);

  // Stable request state
  const abortRef = useRef(null);
  const inFlightRef = useRef(0);

  // Only include page in the effective params sent to listUsers.
  // Note: baseClient sanitizes users endpoint so only organization_id is kept;
  // but we still keep page here to remain future-proof if backend enables it.
  const params = useMemo(() => {
    const out = {};
    if (page) out.page = page;
    if (sort) out.sort = sort;
    if (filter) out.filter = typeof filter === 'string' ? filter : JSON.stringify(filter);
    // limit intentionally excluded as Users endpoint sanitizes to organization_id only
    return out;
  }, [page, sort, filter]);

  const fetchUsers = async (signalOverride) => {
    // cancel any in-flight request
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = signalOverride || controller.signal;

    setLoading(true);
    setError(null);
    inFlightRef.current += 1;

    try {
      const resp = await listUsers(params, { signal });

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[useUsers] GET /api/users => items:', Array.isArray(resp?.items) ? resp.items.length : 0, 'page:', page);
      }

      const nextItems = Array.isArray(resp?.items) ? resp.items : [];
      setUsers(nextItems);
      setTotal(typeof resp?.total === 'number' ? resp.total : nextItems.length);
      setMeta(resp?.meta || null);
    } catch (err) {
      // Ignore cancellation errors
      if (err?.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setLoading(false);
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    }
  };

  // Effect: single initial fetch + fetch on page change only.
  useEffect(() => {
    fetchUsers();
    return () => {
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
    };
    // We only depend on "page"; sort/filter changes are intentionally ignored to
    // keep pagination as the sole driver as per requirements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return {
    users,
    loading,
    error,
    page,
    total,
    meta,
    setPage,
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
