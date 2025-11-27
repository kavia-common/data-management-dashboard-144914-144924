import { useCallback, useMemo, useRef } from 'react';
import { fetchUserProjects } from '../api/userProjects';

/**
 * PUBLIC_INTERFACE
 * useUserProjectsOnDemand
 * A minimal wrapper to fetch per-user projects only when enabled is true.
 *
 * Params:
 * - { userId, organization_id, from, to, enabled }
 *
 * Returns:
 * - { load, latest, error, isLoading }
 *
 * Usage:
 * - Keep UI unchanged. Invoke load() when modal/tab opens and pass enabled=true to avoid pre-fetch fan-out.
 */
// PUBLIC_INTERFACE
export function useUserProjectsOnDemand({ userId, organization_id, from, to, enabled }) {
  const latestRef = useRef(undefined);
  const loadingRef = useRef(false);
  const errorRef = useRef(null);

  const load = useCallback(async () => {
    if (!enabled) return undefined;
    try {
      loadingRef.current = true;
      errorRef.current = null;
      const res = await fetchUserProjects(userId, organization_id, { from, to, enabled: true });
      latestRef.current = res?.data ?? res;
      return latestRef.current;
    } catch (e) {
      errorRef.current = e;
      throw e;
    } finally {
      loadingRef.current = false;
    }
  }, [enabled, userId, organization_id, from, to]);

  const state = useMemo(
    () => ({
      load,
      latest: latestRef.current,
      error: errorRef.current,
      isLoading: loadingRef.current,
    }),
    [load]
  );

  return state;
}

export default useUserProjectsOnDemand;
