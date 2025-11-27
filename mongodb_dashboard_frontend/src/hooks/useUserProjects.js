import { useCallback, useMemo, useState, useEffect } from "react";
import { fetchUserProjects } from "../api/userProjects";

/**
 * PUBLIC_INTERFACE
 * useUserProjects
 * React hook to fetch projects for a given user when enabled.
 *
 * @param {{ userId?: string, tenantId?: string, organization_id?: string, from?: string|Date|null, to?: string|Date|null, enabled?: boolean }} options
 * @returns {{
 *   projects: Array<{ project_id: string, project_name?: string|null, last_activity?: string|null }>,
 *   loading: boolean,
 *   error: string,
 *   refetch: () => Promise<void>
 * }}
 */
export function useUserProjects(options = {}) {
  const {
    userId,
    tenantId,
    organization_id: organizationIdProp,
    from = undefined,
    to = undefined,
    enabled = true,
  } = options || {};

  const organization_id = organizationIdProp || tenantId;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && userId && organization_id));
  const [error, setError] = useState("");

  const canFetch = useMemo(
    () => Boolean(enabled && userId && organization_id),
    [enabled, userId, organization_id]
  );

  const load = useCallback(async () => {
    if (!canFetch) return;
    setLoading(true);
    setError("");
    try {
      // Use the API helper that leverages requestClient cache/dedup with composite key
      const res = await fetchUserProjects(String(userId), String(organization_id), {
        from: from ? (typeof from === "string" ? from : new Date(from).toISOString()) : undefined,
        to: to ? (typeof to === "string" ? to : new Date(to).toISOString()) : undefined,
        enabled: true,
      });
      const payload = res?.data ?? res;
      const list = Array.isArray(payload?.projects) ? payload.projects : Array.isArray(payload) ? payload : [];
      setProjects(list);
    } catch (e) {
      setProjects([]);
      setError(e?.response?.data?.message || e?.message || "Failed to load user projects.");
    } finally {
      setLoading(false);
    }
  }, [canFetch, userId, organization_id, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return { projects, loading, error, refetch: load };
}

export default useUserProjects;
