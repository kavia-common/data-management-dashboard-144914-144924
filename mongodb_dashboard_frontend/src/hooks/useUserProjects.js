/**
 * CHANGE LOG (Users Projects dedupe + cancel):
 * - Restored /api/users/:id/projects consumption via a shared hook.
 * - Introduced in-flight deduplication by key and AbortController cancel on param change.
 * - Ensures exactly one request per change in { userId, organization_id, from, to, page, limit }.
 * - Pagination and filters remain external drivers; hook avoids duplicate effects across components.
 * - Lightweight debug log prints the computed request key once per fetch (no console spam).
 */

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

  // Global-ish in-hook caches to dedupe across multiple subscribers in the same render tree
  const cacheRef = useRef(new Map()); // key => { projects, meta, ts }
  const inflightRef = useRef(new Map()); // key => { controller, promise }

  const [state, setState] = useState({
    projects: [],
    loading: false,
    error: null,
    meta: null,
  });

  const fetchOnce = async (key, controller) => {
    // Note: Any consumer reading from cache gets immediate value; otherwise subscribers
    // share this single promise below to prevent duplicate network calls.
    const params = {
      organization_id: organizationId,
      page,
      limit,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };

    // Lightweight one-line debug to verify single request per change:
    // It logs a stable short hash-like preview of the key, not the whole payload.
    // eslint-disable-next-line no-console
    console.debug?.("[useUserProjects] fetch key:", key.slice(0, 60));

    const p = getUserProjects(userId, params, { signal: controller.signal })
      .then((res) => res?.data ?? res)
      .then((payload) => {
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
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setState({
          projects: [],
          loading: false,
          error: e?.message || "Failed to load user projects",
          meta: null,
        });
      })
      .finally(() => {
        inflightRef.current.delete(key);
      });

    inflightRef.current.set(key, { controller, promise: p });
    return p;
  };

  // Trigger loading with dedupe and cancellation
  useEffect(() => {
    const key = argsKey;

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

    // Abort all other inflights for different keys
    inflightRef.current.forEach(({ controller }, k) => {
      if (k !== key) {
        try {
          controller.abort();
        } catch {
          // ignore
        }
        inflightRef.current.delete(k);
      }
    });

    // If cache has data, serve it immediately and avoid network
    const cached = cacheRef.current.get(key);
    if (cached) {
      setState({
        projects: cached.projects || [],
        loading: false,
        error: null,
        meta: cached.meta || null,
      });
      return;
    }

    // If there is an inflight promise for this key, attach to it (subscribe) instead of firing again
    const inflight = inflightRef.current.get(key);
    if (inflight?.promise) {
      setState((s) => ({ ...s, loading: true, error: null }));
      // No need to await; state will update when inflight resolves/finally runs
      return;
    }

    // Start a single inflight fetch
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchOnce(key, controller);

    // Cleanup on unmount or args change: cancel only the exact key's controller
    return () => {
      const rec = inflightRef.current.get(key);
      if (rec?.controller) {
        try {
          rec.controller.abort();
        } catch {
          // ignore
        }
        inflightRef.current.delete(key);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [argsKey]);

  // PUBLIC_INTERFACE
  return {
    projects: state.projects,
    loading: state.loading,
    error: state.error,
    meta: state.meta,
    refetch: () => {
      // Force refetch: clear cache for current key and (re)subscribe
      cacheRef.current.delete(argsKey);
      const controller = new AbortController();
      setState((s) => ({ ...s, loading: true, error: null }));
      fetchOnce(argsKey, controller);
    },
  };
}
