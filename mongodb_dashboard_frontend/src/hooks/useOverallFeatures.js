/**
 * PUBLIC_INTERFACE
 * useOverallFeatures
 * React hook to fetch Overall Features (service_type distribution) from /api/session-tracking/services
 * using same filters/params as Sessions Trend: { tenant_id, interval, start_date, end_date }.
 * Adds loading/error/empty handling and a debug flag.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchServiceUsage } from "../api/sessionServices";
import { resolveTenantId } from "../utils/tenantSelection";

/**
 * PUBLIC_INTERFACE
 * useOverallFeatures
 * React hook to fetch Overall Features (service_type distribution).
 * - Resolves tenant id from multiple sources when not provided.
 * - Returns empty state instead of throwing when tenant is not discoverable.
 * - If debug=true, logs resolved tenant and URL via API client's debug.
 */
export function useOverallFeatures({
  tenant_id,
  interval = "daily",
  start_date,
  end_date,
  top = 12,
  include_unknown = false,
  withTimeBuckets = false,
  debug = false,
  // Optional: custom getter to fetch tenant from AuthContext lazily to avoid direct import cycles.
  getTenantFromAuth,
  // Optional: when true, the hook returns an explicit error if tenant cannot be resolved.
  requireTenant = false,
}) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    data: [],
    meta: {},
  });

  const resolvedTenant = useMemo(() => {
    return resolveTenantId(tenant_id, getTenantFromAuth);
  }, [tenant_id, getTenantFromAuth]);

  useEffect(() => {
    let aborted = false;
    async function load() {
      // Tenant handling with graceful empty state
      if (!resolvedTenant) {
        if (requireTenant) {
          setState({ loading: false, error: new Error("Missing tenant_id"), data: [], meta: {} });
        } else {
          if (debug) {
            try {
              // eslint-disable-next-line no-console
              console.debug("[useOverallFeatures] tenant not resolved, rendering empty state");
            } catch {}
          }
          setState({ loading: false, error: null, data: [], meta: {} });
        }
        return;
      }

      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const resp = await fetchServiceUsage({
          tenantId: resolvedTenant,
          interval,
          startDate: start_date,
          endDate: end_date,
          top,
          includeUnknown: include_unknown,
          withTimeBuckets,
          debug,
        });
        if (aborted) return;
        const data = Array.isArray(resp?.data) ? resp.data : [];
        setState({ loading: false, error: null, data, meta: resp?.meta || {} });
      } catch (e) {
        if (aborted) return;
        setState({ loading: false, error: e, data: [], meta: {} });
      }
    }
    load();
    return () => {
      aborted = true;
    };
  }, [resolvedTenant, interval, start_date, end_date, top, include_unknown, withTimeBuckets, debug]);

  return { ...state, tenant_id: resolvedTenant };
}
