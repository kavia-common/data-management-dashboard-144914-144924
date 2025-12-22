import { useEffect, useMemo, useRef, useState } from "react";
import { getUserProjects } from "../api/users";

/**
 * PUBLIC_INTERFACE
 * useUserProjects
 * A hook that retrieves projects for a single user with tenant scoping and optional time range.
 * Ensures:
 *  - Exactly one network call per unique parameter change (userId, orgId, page, limit, from, to)
 *  - In-flight request cancellation when inputs change rapidly
 *  - Deduplication: Avoids issuing a new network request when args are unchanged across re-renders
 *
 * Returns: { projects, loading, error, meta, refetch }
 */
export function useUserProjects({
  userId,
  organizationId,
  page = 1,
  limit = 50,
  from,
  to,
} = {}) {
  const argsKey = useMemo(() => {
    // Build a stable composite key to detect real changes
    return JSON.stringify({
      userId: userId ? String(userId) : null,
      organizationId: organizationId ? String(organizationId) : null,
      page,
      limit,
      from: from ? String(from) : null,
      to: to ? String(to) : null,
    });
  }, [userId, organizationId, page, limit, from, to]);

  const cacheRef = useRef(new Map()); // key => { data, meta, ts }
  const inflightRef = useRef(new Map()); // key => AbortController
  const [state, setState] = useState({
    projects: [],
    loading: false,
    error: null,
    meta: null,
  });

  const load = async (key, signal) => {
    if (!userId || !organizationId) {
      setState((s) => ({
        ...s,
        projects: [],
        error: userId ? "Missing organization/tenant id" : "Missing userId",
        loading: false,
        meta: null,
      }));
      return;
    }

    // Serve from cache when available to avoid refetching
    if (cacheRef.current.has(key)) {
      const cached = cacheRef.current.get(key);
      setState({
        projects: cached?.projects || [],
        loading: false,
        error: null,
        meta: cached?.meta || null,
      });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const params = {
        organization_id: organizationId,
        page,
        limit,
      };
      if (from) params.from = from;
      if (to) params.to = to;

      const res = await getUserProjects(userId, params, { signal });
      const payload = res?.data ?? res;
      const list = Array.isArray(payload?.projects)
        ? payload.projects
        : Array.isArray(payload)
        ? payload
        : [];

      const normalized = list.map((p) => ({
        project_id: p.project_id || p.projectId || p.id || null,
        project_name: p.project_name || p.projectName || p.name || null,
        last_activity: p.last_activity || p.lastActivity || null,
      }));

      const meta =
        payload?.meta && typeof payload.meta === "object" ? payload.meta : null;

      cacheRef.current.set(key, { projects: normalized, meta, ts: Date.now() });
      setState({ projects: normalized, loading: false, error: null, meta });
    } catch (e) {
      if (e?.name === "AbortError") return;
      setState({
        projects: [],
        loading: false,
        error: e?.message || "Failed to load user projects",
        meta: null,
      });
    } finally {
      inflightRef.current.delete(key);
    }
  };

  // Trigger loading with dedupe and cancellation
  useEffect(() => {
    const key = argsKey;

    // Abort previous inflight for different key
    inflightRef.current.forEach((controller, k) => {
      if (k !== key) {
        try {
          controller.abort();
        } catch {
          // ignore
        }
        inflightRef.current.delete(k);
      }
    });

    // If already in cache, show immediately without network
    if (cacheRef.current.has(key)) {
      const cached = cacheRef.current.get(key);
      setState({
        projects: cached?.projects || [],
        loading: false,
        error: null,
        meta: cached?.meta || null,
      });
      return;
    }

    // Skip when minimal inputs missing
    if (!userId || !organizationId) {
      setState((s) => ({
        ...s,
        projects: [],
        loading: false,
        error: null,
        meta: null,
      }));
      return;
    }

    // Start a single inflight if not already
    if (!inflightRef.current.has(key)) {
      const controller = new AbortController();
      inflightRef.current.set(key, controller);
      load(key, controller.signal);
    }

    // Cleanup on unmount or args change
    return () => {
      const controller = inflightRef.current.get(key);
      if (controller) {
        try {
          controller.abort();
        } catch {
          // ignore
        }
        inflightRef.current.delete(key);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [argsKey]);

  return {
    projects: state.projects,
    loading: state.loading,
    error: state.error,
    meta: state.meta,
    refetch: () => {
      // Force refetch: clear cache for current key and re-run effect path
      cacheRef.current.delete(argsKey);
      const controller = new AbortController();
      inflightRef.current.set(argsKey, controller);
      load(argsKey, controller.signal);
    },
  };
}
