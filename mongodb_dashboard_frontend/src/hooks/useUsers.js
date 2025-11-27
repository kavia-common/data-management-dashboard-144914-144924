import { useEffect, useMemo, useRef, useState } from 'react';
import { listUsers } from '../api'; // unified api index with clients
import useDebouncedValue from './useDebouncedValue';

/**
 * PUBLIC_INTERFACE
 * useUsers
 * A hook to fetch users from the backend and expose loading, error, and data states.
 */
export function useUsers({ page, limit, sort, filter } = {}) {
  /**
   * This is a public function.
   * Returns:
   *  - users: array of user documents (unwrapped if envelope)
   *  - loading: boolean
   *  - error: Error | null
   *  - refetch: function to re-trigger fetch
   */
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Build stable params; limit intentionally ignored for /api/users by design
  const params = useMemo(() => {
    const out = {};
    if (page) out.page = page;
    if (sort) out.sort = sort;
    if (filter) out.filter = typeof filter === 'string' ? filter : JSON.stringify(filter);
    return out;
  }, [page, sort, filter]);

  // Debounce params to avoid rapid successive requests when inputs change quickly
  const debouncedParams = useDebouncedValue(params, 300);

  // Track current in-flight controller for explicit cancellation on changes/unmount
  const inflightRef = useRef(null);

  const fetchUsers = async (optSignal) => {
    setLoading(true);
    setError(null);

    // If a previous request is still in-flight, cancel it
    if (inflightRef.current) {
      try {
        inflightRef.current.abort();
      } catch {
        // ignore
      }
    }

    // Create a new controller for this invocation
    const controller = new AbortController();
    inflightRef.current = controller;

    // Compose signal: if caller provided one, race via consumer cancellation
    const signal = optSignal instanceof AbortSignal ? optSignal : controller.signal;

    try {
      // listUsers already uses requestClient with dedupe/cache; pass signal for consumer-level abort
      const resp = await listUsers(debouncedParams, { signal });

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[useUsers] fetched users', { debouncedParams });
      }

      // Normalize payload to array
      const data = Array.isArray(resp) ? resp : (resp?.data || resp?.items || []);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setLoading(false);
      // clear only if this is our current controller
      if (inflightRef.current === controller) {
        inflightRef.current = null;
      }
    }
  };

  useEffect(() => {
    const outer = new AbortController();
    fetchUsers(outer.signal);
    return () => {
      outer.abort();
      if (inflightRef.current) {
        try { inflightRef.current.abort(); } catch { /* noop */ }
        inflightRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedParams)]);

  return {
    users,
    loading,
    error,
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
