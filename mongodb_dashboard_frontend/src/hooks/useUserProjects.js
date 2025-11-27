
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { getUserProjects } from "../api/users";

/**
 * PUBLIC_INTERFACE
 * useUserProjects
 * React hook to fetch projects for a given user when enabled.
 *
 * @param {{ userId?: string, tenantId?: string, from?: string|Date|null, to?: string|Date|null, enabled?: boolean }} options
 * @returns {{
 *   projects: Array<{ project_id: string, project_name?: string|null, last_activity?: string|null }>,
 *   loading: boolean,
 *   error: string,
 *   refetch: () => Promise<void>
 * }}
 */
export function useUserProjects(options = {}) {
  const { userId, tenantId, from = undefined, to = undefined, enabled = true } = options || {};

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && userId && tenantId));
  const [error, setError] = useState("");

  const canFetch = useMemo(() => Boolean(enabled && userId && tenantId), [enabled, userId, tenantId]);

  // Track last composite key to prevent unnecessary reloads due to identity churn
  const lastKeyRef = useRef("");
  const compositeKey = useMemo(() => {
    const f = from ? (typeof from === "string" ? from : new Date(from).toISOString()) : "";
    const t = to ? (typeof to === "string" ? to : new Date(to).toISOString()) : "";
    return [String(userId || ""), String(tenantId || ""), f, t, String(Boolean(canFetch))].join("::");
  }, [userId, tenantId, from, to, canFetch]);

  const load = useCallback(async () => {
    if (!canFetch) return;
    if (lastKeyRef.current === compositeKey) {
      // Params unchanged; no-op to avoid redundant refetch
      return;
    }
    lastKeyRef.current = compositeKey;

    setLoading(true);
    setError("");
    try {
      const data = await getUserProjects(userId, { tenantId, from, to, enabled: true, cacheTTL: 120000 });
      const list = Array.isArray(data?.projects) ? data.projects : [];
      setProjects(list);
    } catch (e) {
      setProjects([]);
      setError(e?.response?.data?.message || e?.message || "Failed to load user projects.");
    } finally {
      setLoading(false);
    }
  }, [canFetch, compositeKey, userId, tenantId, from, to]);

  useEffect(() => {
    // Only trigger load when allowed; guard inside load handles unchanged params
    if (canFetch) {
      void load();
    }
  }, [canFetch, load]);

  return { projects, loading, error, refetch: load };
}
