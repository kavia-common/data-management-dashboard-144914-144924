import { useEffect, useMemo, useRef, useState } from 'react';
import { listUsers } from '../api/baseClient'; // restored original listUsers source
import useDebouncedValue from './useDebouncedValue';

/**
 * PUBLIC_INTERFACE
 * useUsers
 * A hook to fetch users from the backend and expose loading, error, and data states.
 */
export function useUsers({ page, limit, sort, filter, q } = {}) {
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

  // Build raw params
  const rawParams = useMemo(() => {
    const out = {};
    if (page) out.page = page;
    if (limit) out.limit = limit;
    if (sort) out.sort = sort;
    if (q) out.q = q;
    if (filter) out.filter = typeof filter === 'string' ? filter : JSON.stringify(filter);
    return out;
  }, [page, limit, sort, filter, q]);

  // Debounce to avoid chatty network calls during rapid typing/pagination changes
  const debouncedParams = useDebouncedValue(rawParams, 250);

  // Maintain a stable AbortController to cancel in-flight requests
  const abortRef = useRef(null);

  const fetchUsers = async (params, { useAbortController = true } = {}) => {
    // Abort any prior request
    if (useAbortController) {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }
      abortRef.current = typeof AbortController !== 'undefined' ? new AbortController() : null;
    }

    setLoading(true);
    setError(null);
    try {
      // Prefer existing users API client if present; fallback to generic api util
      let resp;
      if (typeof listUsers === 'function') {
        const result = await listUsers(params, { signal: abortRef.current?.signal });
        // listUsers returns envelope-normalized shape { items, total, meta }
        resp = result?.items ?? result;
      } else {
        // Generic fetch
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`/api/users${qs ? `?${qs}` : ''}`, { signal: abortRef.current?.signal });
        if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
        resp = await res.json();
      }

      // Handle both raw array and envelope formats
      const data = Array.isArray(resp) ? resp : (resp?.data || resp?.items || []);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      // Ignore aborted requests; surface other errors
      if (err?.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(debouncedParams, { useAbortController: true });
    return () => {
      // Abort on unmount
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(debouncedParams)]);

  return {
    users,
    loading,
    error,
    refetch: () => fetchUsers(debouncedParams, { useAbortController: true }),
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
