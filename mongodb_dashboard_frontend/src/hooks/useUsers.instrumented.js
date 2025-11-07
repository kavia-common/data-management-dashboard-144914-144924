import { useEffect, useMemo, useState } from 'react';
import { listUsers } from '../api/baseClient'; // original listUsers export lives here

/**
 * PUBLIC_INTERFACE
 * useUsers
 * A hook to fetch users from the backend and expose loading, error, and data states.
 * This file adds targeted console diagnostics for the users list flow (non-production only).
 */
export function useUsers({ page, limit, sort, filter } = {}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(() => {
    const out = {};
    if (page) out.page = page;
    if (limit) out.limit = limit;
    if (sort) out.sort = sort;
    if (filter) out.filter = typeof filter === 'string' ? filter : JSON.stringify(filter);
    return out;
  }, [page, limit, sort, filter]);

  const fetchUsers = async (signal) => {
    const isProd = process.env.NODE_ENV === 'production' || process.env.REACT_APP_NODE_ENV === 'production';
    if (!isProd) {
      try {
        console.debug('[useUsers] fetch:start', params);
      } catch {}
    }

    setLoading(true);
    setError(null);
    try {
      let resp;
      if (typeof listUsers === 'function') {
        resp = await listUsers(params, { signal });
      } else {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`/api/users${qs ? `?${qs}` : ''}`, { signal });
        if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
        resp = await res.json();
      }
      const data = Array.isArray(resp) ? resp : (resp?.data || resp?.items || []);
      setUsers(Array.isArray(data) ? data : []);

      if (!isProd) {
        try {
          console.debug('[useUsers] fetch:response', {
            ok: true,
            count: Array.isArray(data) ? data.length : undefined,
          });
        } catch {}
      }
    } catch (err) {
      if (!isProd) {
        try {
          console.error('[useUsers] fetch:error', err?.message, err);
        } catch {}
      }
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
