/**
 * PUBLIC_INTERFACE
 * useOverallFeatures
 * React hook to fetch Overall Features (service_type distribution) from /api/session-tracking/services
 * using same filters/params as Sessions Trend: { tenant_id, interval, start_date, end_date }.
 * Adds loading/error/empty handling and a debug flag.
 */
import { useEffect, useState } from "react";
import { fetchServiceUsage } from "../api/sessionServices";

export function useOverallFeatures({
  tenant_id,
  interval = "daily",
  start_date,
  end_date,
  top = 12,
  include_unknown = false,
  withTimeBuckets = false,
  debug = false,
}) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    data: [],
    meta: {},
  });

  useEffect(() => {
    let aborted = false;
    async function load() {
      if (!tenant_id) {
        setState((s) => ({ ...s, loading: false, error: new Error("Missing tenant_id"), data: [] }));
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const resp = await fetchServiceUsage({
          tenantId: tenant_id,
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
  }, [tenant_id, interval, start_date, end_date, top, include_unknown, withTimeBuckets, debug]);

  return state;
}
