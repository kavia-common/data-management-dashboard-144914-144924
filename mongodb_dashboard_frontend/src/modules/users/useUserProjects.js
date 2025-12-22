import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUsersApiBase } from '../../api/config';
import { getAuthHeaders } from '../../api/auth';
import { getTenantHeaderOrQuery } from '../../api/util';

/**
 * PUBLIC_INTERFACE
 * useUserProjects
 * This hook fetches projects for a given user (GET /api/users/{userId}/projects) with:
 * - Single call on initial load/refresh
 * - Pagination-driven subsequent fetches
 * - Overlapping request cancellation via AbortController
 * - StrictMode guard to avoid duplicate fetches in development
 *
 * Params:
 *  - userId: string (required) user id to fetch projects for
 *  - tenantId: string (required) active tenant/organization id
 *  - options?: {
 *      page?: number (default 1)
 *      limit?: number (default 10)
 *      from?: string ISO date
 *      to?: string ISO date
 *      immediate?: boolean (default true) - whether to load on mount
 *    }
 * Returns:
 *  {
 *    data, loading, error,
 *    page, limit, total, setPage, setLimit,
 *    refresh, isCancelled
 *  }
 */
export function useUserProjects(userId, tenantId, options = {}) {
  const {
    page: initialPage = 1,
    limit: initialLimit = 10,
    from,
    to,
    immediate = true,
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  // Track last successful params to avoid duplicate initial fetches caused by StrictMode or re-renders.
  const lastFetchKeyRef = useRef(null);
  // Keep a single AbortController instance for in-flight request cancellation.
  const abortRef = useRef(null);
  // Track if the last request was cancelled
  const cancelledRef = useRef(false);
  // StrictMode mount guard: ensure we only trigger the initial fetch once in dev double-invoke
  const didInitRef = useRef(false);

  const canRequest = Boolean(userId) && Boolean(tenantId);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('organization_id', tenantId);
    params.set('tenant_id', tenantId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params;
  }, [tenantId, from, to, page, limit]);

  const requestKey = useMemo(() => {
    if (!canRequest) return null;
    return `${userId}|${tenantId}|${from || ''}|${to || ''}|${page}|${limit}`;
  }, [canRequest, userId, tenantId, from, to, page, limit]);

  const buildUrl = useCallback(() => {
    const base = getUsersApiBase?.() || '';
    const path = `/api/users/${encodeURIComponent(userId)}/projects`;
    return `${base}${path}?${queryParams.toString()}`;
  }, [userId, queryParams]);

  // PUBLIC_INTERFACE
  const refresh = useCallback(async () => {
    if (!canRequest) return;

    const nextKey = requestKey;
    if (lastFetchKeyRef.current === nextKey) {
      // Prevent duplicate network call for the same stable params
      return;
    }

    // Cancel any in-flight request before starting a new one
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch (_) {
        // ignore
      }
    }
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;

    const url = buildUrl();
    setLoading(true);
    setError(null);

    try {
      const headers = {
        ...(getAuthHeaders?.() || {}),
        ...(getTenantHeaderOrQuery?.(tenantId) || {}),
        Accept: 'application/json',
      };
      const timeoutMs = Number(process.env.REACT_APP_FETCH_TIMEOUT_MS || 0);
      let timeoutId = null;
      const timeoutPromise =
        timeoutMs > 0
          ? new Promise((_, reject) => {
              timeoutId = setTimeout(() => {
                try {
                  controller.abort();
                } catch (_) {}
                reject(new Error('Request timed out'));
              }, timeoutMs);
            })
          : null;

      const fetchPromise = fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      const res = await (timeoutPromise
        ? Promise.race([fetchPromise, timeoutPromise])
        : fetchPromise);

      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok) {
        if (controller.signal.aborted) {
          cancelledRef.current = true;
          return;
        }
        const text = await res.text().catch(() => '');
        throw new Error(text || `Failed to fetch user projects (${res.status})`);
      }

      const json = await res.json();
      if (!controller.signal.aborted) {
        setData(json);
        lastFetchKeyRef.current = nextKey;
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        cancelledRef.current = true;
      } else {
        setError(e);
      }
    } finally {
      if (!abortRef.current || abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [buildUrl, canRequest, requestKey, tenantId]);

  // PUBLIC_INTERFACE
  const isCancelled = useCallback(() => cancelledRef.current, []);

  // Single-call on initial mount/refresh with StrictMode guard
  useEffect(() => {
    if (!immediate) return;
    if (!canRequest) return;

    // In StrictMode (development), effects run twice on mount.
    // Ensure we only trigger the initial fetch once.
    if (!didInitRef.current) {
      didInitRef.current = true;
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRequest, immediate, refresh]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {
          // ignore
        }
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    page,
    limit,
    total: data?.projects?.length ?? 0,
    setPage,
    setLimit,
    refresh,
    isCancelled,
  };
}
