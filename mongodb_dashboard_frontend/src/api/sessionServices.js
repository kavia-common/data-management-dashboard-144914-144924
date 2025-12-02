//
// PUBLIC_INTERFACE
// API client for session-tracking service usage aggregation
//
export async function fetchServiceUsage({
  baseUrl = "",
  tenantId,
  interval = "daily",
  startDate,
  endDate,
  top,
  status,
  includeUnknown = false,
  withTimeBuckets = false,
  debug = false,
}) {
  /** Fetches aggregated service usage.
   * Returns JSON envelope from backend.
   */
  if (!tenantId) {
    throw new Error("tenantId is required");
  }
  const params = new URLSearchParams();
  params.set("tenant_id", tenantId);
  if (interval) params.set("interval", interval);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (top != null) params.set("top", String(top));
  if (status) params.set("status", status);
  if (includeUnknown) params.set("include_unknown", "true");
  if (withTimeBuckets) params.set("withTimeBuckets", "true");
  if (debug) params.set("debug", "true");

  const url = `${baseUrl}/api/session-tracking/services?${params.toString()}`;
  const resp = await fetch(url, {
    headers: debug ? { "x-debug": "true" } : undefined,
  });
  if (!resp.ok) {
    let msg = "Failed to fetch service usage";
    try {
      const err = await resp.json();
      msg = err?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }
  return resp.json();
}
