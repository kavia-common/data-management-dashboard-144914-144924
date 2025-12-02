import React, { useEffect, useMemo, useState } from "react";
import OverallFeaturesChart from "../components/Overview/OverallFeaturesChart";
import { fetchServiceUsage } from "../api/sessionServices";

/**
 * PUBLIC_INTERFACE
 * Overview page section for "Overall Features" chart.
 * Assumes parent layout or app context provides current tenant and filter controls.
 * This file includes a minimal fetch of service usage and renders a horizontal bar chart.
 */
export default function Overview() {
  // In a real app, these would come from global state or existing filter components.
  // To integrate seamlessly with existing Sessions Trend, we mirror similar defaults:
  const [tenantId, setTenantId] = useState("T0015");
  const [interval, setInterval] = useState("daily"); // daily|weekly|monthly|custom
  const [dateRange, setDateRange] = useState({ start: null, end: null }); // ISO strings
  const [debug, setDebug] = useState(false);

  const [data, setData] = useState([]);
  const [most, setMost] = useState(null);
  const [least, setLeast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const colors = useMemo(
    () => ({
      primary: "#2563EB", // Ocean Professional
      secondary: "#F59E0B",
      error: "#EF4444",
    }),
    []
  );

  useEffect(() => {
    let abort = false;
    async function load() {
      if (!tenantId) return;
      setLoading(true);
      setErr("");
      try {
        const resp = await fetchServiceUsage({
          tenantId,
          interval,
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
          top: 12,
          includeUnknown: false,
          withTimeBuckets: false,
          debug,
        });
        if (abort) return;
        if (debug) {
          // Debug verification logs
          // eslint-disable-next-line no-console
          console.debug("[Overview] ServiceUsage response:", resp);
        }
        setData(resp?.data || []);
        setMost(resp?.meta?.most || null);
        setLeast(resp?.meta?.least || null);
      } catch (e) {
        if (abort) return;
        setErr(e?.message || "Failed to load service usage");
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    return () => {
      abort = true;
    };
  }, [tenantId, interval, dateRange.start, dateRange.end, debug]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Overall Features</h2>
          <p className="text-sm text-gray-500">Usage by service_type</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
            />
            Debug logs
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">Loading service usage…</div>
        ) : err ? (
          <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{err}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No service usage found for selected period
          </div>
        ) : (
          <OverallFeaturesChart data={data} most={most} least={least} colors={colors} />
        )}
        <div className="pt-3 text-xs text-gray-400">Data source: session_tracking.service_type</div>
      </div>
    </div>
  );
}
