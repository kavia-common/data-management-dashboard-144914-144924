import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUsersApiBase } from '../../api/config';
import { getAuthHeaders } from '../../api/auth';
import { getTenantHeaderOrQuery } from '../../api/util';

/**
 * PUBLIC_INTERFACE
 * useUserProjects
 * Hook to fetch projects for a given user (GET /api/users/{userId}/projects) with:
 * - Strict one-time mount guard with dev-only StrictMode protection
 * - Param stabilization via useMemo
 * - Pagination-driven subsequent calls only
 * - AbortController-based cancellation for in-flight requests
 *
 * Signature:
 *   useUserProjects(userId: string, tenantId: string, options?: {
 *     page?: number,       // default 1
 *     limit?: number,      // default 10 (alias of pageSize)
 *     pageSize?: number,   // alias of limit
 *     from?: string,       // ISO datetime
 *     to?: string,         // ISO datetime
 *     immediate?: boolean  // default true: first fetch on mount
 *   })
 *
 * Returns:
 *   {
 *     data, loading, error,
 *     page, limit, total,
 *     setPage, setLimit,
 *     refresh, isCancelled
 *   }
 */
export function useUserProjects(userId, tenantId, options = {}) {
  const {
    page: initialPage = 1,
    limit: limitOpt,
    pageSize,
    from,
    to,
    immediate = true,
  } = options;

  // Normalize page size/limit to a single "limit"
  const initialLimit = typeof limitOpt === 'number' ? limitOpt : (typeof pageSize === 'number' ? pageSize : 10);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

  // Stable, memoized base params to avoid effect churn due to new object identities
  const baseParams = useMemo(
    () => ({
      userId: userId || undefined,
      organization_id: tenantId || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: limit,
    }),
    [userId, tenantId, from, to, page, limit]
  );

  // Internal guards and refs
  const abortRef = useRef(null);
  const cancelledRef = useRef(false);
  // StrictMode guard: ensures initial fetch is triggered only once in dev double-invoke
  const didInitRef = useRef(false);
  // Last param signature to skip duplicate initial requests across remounts with identical params
  const lastFetchKeyRef = useRef(null);
  const seqRef = useRef(0);

  const canRequest = !!baseParams.userId && !!baseParams.organization_id;

  // Build a stable fetch key from params
  const requestKey = useMemo(() => {
    if (!canRequest) return null;
    return JSON.stringify({
      userId: baseParams.userId || null,
      organization_id: baseParams.organization_id || null,
      from: baseParams.from || null,
      to: baseParams.to || null,
      page: baseParams.page || 1,
      pageSize: baseParams.pageSize || 10,
    });
  }, [canRequest, baseParams]);

  // Build URL with stabilized query string
  const buildUrl = useCallback(() => {
    if (!canRequest) return null;
    const base = getUsersApiBase?.() || '';
    const path = `/api/users/${encodeURIComponent(baseParams.userId)}/projects`;
    const qs = new URLSearchParams();
    qs.set('organization_id', baseParams.organization_id);
    qs.set('tenant_id', baseParams.organization_id);
    if (baseParams.from) qs.set('from', baseParams.from);
    if (baseParams.to) qs.set('to', baseParams.to);
    qs.set('page', String(baseParams.page));
    qs.set('pageSize', String(baseParams.pageSize));
    // Also set limit alias for backends that use "limit"
    qs.set('limit', String(baseParams.pageSize));
    return `${base}${path}?${qs.toString()}`;
  }, [canRequest, baseParams]);

  // PUBLIC_INTERFACE
  const isCancelled = useCallback(() => cancelledRef.current, []);

  // Perform the fetch with AbortController cancellation
  const doFetch = useCallback(async () => {
    if (!canRequest) return;

    const nextKey = requestKey;
    if (lastFetchKeyRef.current === nextKey) {
      // Skip duplicate call for identical params signature
      if (isDev) {
        // eslint-disable-next-line no-console
        console.debug('[Users/useUserProjects] Skip duplicate fetch (same params)', { nextKey });
      }
      return;
    }

    // Abort any in-flight request
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

    seqRef.current += 1;
    const seq = seqRef.current;

    const url = buildUrl();
    if (!url) return;

    setLoading(true);
    setError(null);

    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug('[Users/useUserProjects] FETCH start', { seq, url, params: baseParams });
    }

    try {
      const headers = {
        ...(getAuthHeaders?.() || {}),
        ...(getTenantHeaderOrQuery?.(baseParams.organization_id) || {}),
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

      const fetchPromise = fetch(url, { method: 'GET', headers, signal: controller.signal });
      const res = await (timeoutPromise ? Promise.race([fetchPromise, timeoutPromise]) : fetchPromise);

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
        if (isDev) {
          // eslint-disable-next-line no-console
          console.debug('[Users/useUserProjects] FETCH success', {
            seq,
            count: Array.isArray(json?.projects) ? json.projects.length : undefined,
          });
        }
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        cancelledRef.current = true;
        if (isDev) {
          // eslint-disable-next-line no-console
          console.debug('[Users/useUserProjects] FETCH aborted', { seq });
        }
      } else {
        setError(e);
        if (isDev) {
          // eslint-disable-next-line no-console
          console.debug('[Users/useUserProjects] FETCH error', { seq, message: e?.message });
        }
      }
    } finally {
      // Avoid toggling loading if a new request replaced this controller
      if (!abortRef.current || abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [canRequest, requestKey, buildUrl, baseParams, isDev]);

  // PUBLIC_INTERFACE
  const refresh = useCallback(() => {
    // Explicit refresh bypasses StrictMode/mount guard; still dedupes by requestKey
    doFetch();
  }, [doFetch]);

  // Initial mount effect with dev-only StrictMode guard
  useEffect(() => {
    if (!immediate) return;
    if (!canRequest) return;

    // In development with React.StrictMode, effects can run twice on mount.
    // Ensure only one initial fetch.
    if (isDev && didInitRef.current) {
      return;
    }
    didInitRef.current = true;

    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, canRequest, isDev]);

  // Cleanup on unmount
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
