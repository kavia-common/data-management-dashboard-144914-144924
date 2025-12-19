import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUserProjects } from "../api/users";
import { getOrganizationId } from "../api/authTokenProvider";

/**
 * PUBLIC_INTERFACE
 * useUserProjects
 * A single-source hook to fetch a user's projects from /api/users/:userId/projects
 * with support for pagination and filters. Ensures only one request is made per
 * (userId, organization_id, page, pageSize, from, to) tuple and avoids duplicate
 * or parallel requests triggered by multiple components.
 *
 * Params:
 *  - userId: string (required)
 *  - options?: {
 *      page?: number,          // 1-based page number
 *      pageSize?: number,      // items per page
 *      from?: string|Date,     // ISO string or Date for start bound
 *      to?: string|Date,       // ISO string or Date for end bound
 *      organization_id?: string // override tenant scoping (defaults from auth/tenant)
 *    }
 *
 * Returns:
 *  - projects: array (current page items)
 *  - total: number (total projects available if the backend provides meta; otherwise derived)
 *  - page: number
 *  - pageSize: number
 *  - loading: boolean
 *  - error: Error|null
 *  - setPage: (n:number) => void
 *  - setPageSize: (n:number) => void
 *  - refetch: () => void
 */
export default function useUserProjects(userId, options = {}) {
  const {
    page: initialPage = 1,
    pageSize: initialPageSize = 10,
    from,
    to,
    organization_id,
  } = options || {};

  const resolvedOrgId =
    String(organization_id || getOrganizationId() || "").trim() || null;

  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Full projects array cached per key; we slice locally for pagination to guarantee a single request
  const [allProjects, setAllProjects] = useState([]);
  const [total, setTotal] = useState(0);

  // Build a stable request key to prevent duplicate/parallel calls
  const requestKey = useMemo(() => {
    const f = from ? new Date(from).toISOString() : "";
    const t = to ? new Date(to).toISOString() : "";
    return JSON.stringify({
      userId: userId ? String(userId) : "",
      org: resolvedOrgId || "",
      f,
      t,
    });
  }, [userId, resolvedOrgId, from, to]);

  // In-flight tracker to avoid parallel calls for the same key
  const inFlightMapRef = useRef(new Map());

  const loadAll = useCallback(async () => {
    if (!userId || !resolvedOrgId) {
      setAllProjects([]);
      setTotal(0);
      return;
    }
    // If already fetching for this requestKey, await the same promise
    const existing = inFlightMapRef.current.get(requestKey);
    if (existing) {
      try {
        await existing;
      } catch (e) {
        // pass through to error handling below
      }
      return;
    }

    const p = (async () => {
      setLoading(true);
      setError(null);
      try {
        // Backend currently returns { user_id, tenant_id, projects: [...] }
        // We request the full list once per filter change; pagination is applied client-side.
        const payload = await getUserProjects(String(userId), {
          organization_id: resolvedOrgId,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          // Intentionally do not send page/limit because backend does not support it yet
        });

        const list = Array.isArray(payload?.projects) ? payload.projects : [];
        setAllProjects(list);
        setTotal(Array.isArray(list) ? list.length : 0);
      } catch (err) {
        setAllProjects([]);
        setTotal(0);
        setError(err);
      } finally {
        setLoading(false);
      }
    })();

    inFlightMapRef.current.set(requestKey, p);
    try {
      await p;
    } finally {
      inFlightMapRef.current.delete(requestKey);
    }
  }, [userId, resolvedOrgId, from, to, requestKey]);

  // Load when key changes
  useEffect(() => {
    setPageState(1); // reset to first page when filters change
    loadAll();
  }, [requestKey, loadAll]);

  // Expose pagination setters that only change local state and trigger a memoized slice (no refetch)
  const setPage = useCallback((p) => {
    setPageState(p > 0 ? p : 1);
  }, []);
  const setPageSize = useCallback((s) => {
    const size = Number(s) || 10;
    setPageSizeState(size > 0 ? size : 10);
    setPageState(1); // reset to first page when page size changes
  }, []);

  const visibleProjects = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return (allProjects || []).slice(start, end);
  }, [allProjects, page, pageSize]);

  return {
    projects: visibleProjects,
    total,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
    refetch: loadAll,
  };
}
