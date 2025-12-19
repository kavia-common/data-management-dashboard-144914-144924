import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listSessions } from "../api";
import useDebouncedValue from "./useDebouncedValue";

/**
 * PUBLIC_INTERFACE
 * useSessionTracking
 * Consolidated, paginated data provider for /api/session-tracking.
 *
 * Params:
 * - page: number (1-based)
 * - limit: number
 * - tenantId: optional tenant scope override; when omitted, baseClient ensures scoping from auth/session.
 * - q: optional text query (debounced internally; this is the single source of truth for global search)
 * - sort: optional sort string accepted by backend. Example: "user_name" or "-timestamp"
 * - immediate: boolean (default true) - whether to fetch on mount/param change automatically.
 *
 * Behavior:
 * - Debounces q to avoid multiple requests while typing.
 * - Uses an in-flight request id guard to prevent late responses from overwriting newer state.
 * - Changing page/limit/sort triggers exactly one request via fetchOnce; DataTable should call fetchPage once.
 *
 * Returns:
 * { items, total, loading, error, meta, refetch, setPage, setLimit, setQuery, setSort }
 */
export default function useSessionTracking({
  page: initialPage = 1,
  limit: initialLimit = 10,
  tenantId = undefined,
  q: initialQuery = "",
  sort: initialSort,
  immediate = true,
} = {}) {
  const [page, setPage] = useState(initialPage || 1);
  const [limit, setLimit] = useState(initialLimit || 10);
  const [query, setQuery] = useState(initialQuery || "");
  const [sort, setSort] = useState(initialSort);
  const debouncedQuery = useDebouncedValue(query, 250);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState({ page: initialPage || 1, limit: initialLimit || 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Track in-flight request to avoid late responses overwriting state
  const activeReqRef = useRef(0);

  const params = useMemo(() => {
    const p = { page, limit };
    if (tenantId) p.tenant_id = tenantId;
    if (debouncedQuery && debouncedQuery.trim()) p.q = debouncedQuery.trim();
    if (sort) p.sort = sort;
    return p;
  }, [page, limit, tenantId, debouncedQuery, sort]);

  const fetchOnce = useCallback(async () => {
    const reqId = ++activeReqRef.current;
    setLoading(true);
    setError("");
    try {
      const res = await listSessions(params);
      // Ignore if another request started since this one
      if (reqId !== activeReqRef.current) return;
      const nextItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      const totalVal =
        (res?.meta && typeof res.meta.total === "number" && res.meta.total) ||
        (Array.isArray(nextItems) ? nextItems.length : 0);

      setItems(nextItems);
      setTotal(totalVal);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: totalVal,
        ...(res?.meta || {}),
      });
    } catch (e) {
      if (reqId !== activeReqRef.current) return;
      setItems([]);
      setTotal(0);
      setMeta({ page, limit, total: 0 });
      setError(e?.response?.data?.message || e?.message || "Failed to load session tracking.");
    } finally {
      if (reqId === activeReqRef.current) {
        setLoading(false);
      }
    }
  }, [params, page, limit]);

  // PUBLIC_INTERFACE
  const refetch = useCallback(() => {
    return fetchOnce();
  }, [fetchOnce]);

  useEffect(() => {
    if (!immediate) return;
    fetchOnce();
  }, [fetchOnce, immediate]);

  return {
    items,
    total,
    loading,
    error,
    meta,
    // state setters for pagination and query/sort control
    setPage,
    setLimit,
    setQuery,
    setSort,
    // refetch
    refetch,
  };
}
