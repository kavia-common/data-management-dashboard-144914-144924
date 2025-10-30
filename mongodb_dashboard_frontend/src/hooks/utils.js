import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Simple in-memory cache keyed by string. Lives for the page session.
 * This is intentionally minimal; consider a better cache (LRU) if needed.
 */
const _cache = new Map();

/**
 * Builds a stable cache key from a namespace and params object.
 */
export function buildCacheKey(ns, params) {
  try {
    const norm = JSON.stringify(params, Object.keys(params || {}).sort());
    return `${ns}:${norm}`;
  } catch (e) {
    // fallback in case of non-serializable values
    return `${ns}:${String(params)}`;
  }
}

/**
 * PUBLIC_INTERFACE
 * useApiQuery
 * A generic data-fetching hook for API clients.
 * - Accepts a fetcher function (must return a promise)
 * - Accepts a params object
 * - Exposes { data, loading, error, refresh }
 * - Memoizes results in a simple in-memory cache using a stable key
 */
export function useApiQuery(namespace, fetcher, params) {
  const key = useMemo(() => buildCacheKey(namespace, params || {}), [namespace, params]);
  const [data, setData] = useState(() => (_cache.has(key) ? _cache.get(key) : null));
  const [loading, setLoading] = useState(() => !(_cache.has(key)));
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const doFetch = useCallback(async (overrideParams) => {
    const p = overrideParams ?? params;
    const nextKey = buildCacheKey(namespace, p || {});
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.aborted = true;
    }
    const token = { aborted: false };
    abortRef.current = token;

    setLoading(true);
    setError(null);
    try {
      const res = await fetcher(p || {});
      if (token.aborted) return;
      _cache.set(nextKey, res);
      setData(res);
    } catch (err) {
      if (token.aborted) return;
      setError(err);
    } finally {
      if (!token.aborted) {
        setLoading(false);
      }
    }
  }, [fetcher, namespace, params]);

  // Refresh function to manually refetch (optionally with new params)
  const refresh = useCallback((overrideParams) => {
    return doFetch(overrideParams);
  }, [doFetch]);

  // Initial and reactive fetch based on key change
  useEffect(() => {
    // Serve from cache immediately if present
    if (_cache.has(key)) {
      setData(_cache.get(key));
      setLoading(false);
      setError(null);
      return;
    }
    doFetch(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error, refresh };
}
