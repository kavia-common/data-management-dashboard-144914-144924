import { useEffect, useMemo, useState } from 'react';
import { listUsers } from '../api'; // unified api index with clients

/**
 * PUBLIC_INTERFACE
 * useUsers
 * A hook to fetch users from the backend and expose loading, error, and data states.
 */
export function useUsers({ page, limit, sort, filter } = {}) {
  /**
   * This is a public function.
   * Returns:
   *  - users: array of user documents
   *  - loading: boolean
   *  - error: Error | null
   *  - refetch: function to re-trigger fetch
   */
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(() => {
    const out = {};
    // Note: limit is intentionally excluded for /api/users (stripped by client rule)
    if (page) out.page = page;
    if (sort) out.sort = sort;
    if (filter) out.filter = typeof filter === 'string' ? filter : JSON.stringify(filter);
    return out;
  }, [page, sort, filter]);

  const fetchUsers = async (signal) => {
    setLoading(true);
    setError(null);
    try {
      // listUsers returns normalized { items, total, meta }
      const resp = await listUsers(params, { signal });

      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[useUsers] listUsers => items:', Array.isArray(resp?.items) ? resp.items.length : 0);
      }

      setUsers(Array.isArray(resp?.items) ? resp.items : []);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err);
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
    refetch: () => fetchUsers(),
  };
}
