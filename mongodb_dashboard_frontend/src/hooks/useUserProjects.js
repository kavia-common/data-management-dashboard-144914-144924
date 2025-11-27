
import { useCallback, useMemo, useState, useEffect } from "react";
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

  const load = useCallback(async () => {
    if (!canFetch) return;
    setLoading(true);
    setError("");
    try {
      const data = await getUserProjects(userId, { tenantId, from, to });
      const list = Array.isArray(data?.projects) ? data.projects : [];
      setProjects(list);
    } catch (e) {
      setProjects([]);
      setError(e?.response?.data?.message || e?.message || "Failed to load user projects.");
    } finally {
      setLoading(false);
    }
  }, [canFetch, userId, tenantId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return { projects, loading, error, refetch: load };
}
