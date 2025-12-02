//
// PUBLIC_INTERFACE
// API client for session-tracking service usage aggregation
//
/**
 * PUBLIC_INTERFACE
 * fetchServiceUsage
 * Calls GET /api/session-tracking/services using the same filters as Sessions Trend.
 * Parses backend envelope { success, data: [{ label?, service_type?, count }], meta }.
 * - It maps when label is absent but service_type is present.
 * - Handles empty arrays robustly.
 * - Adds a debug flag to log the request URL and response.
 *
 * @param {Object} params
 * @param {string} params.tenantId - Required tenant scope (organization/tenant id)
 * @param {"daily"|"weekly"|"monthly"|"custom"} [params.interval="daily"]
 * @param {string} [params.startDate] - ISO string
 * @param {string} [params.endDate] - ISO string
 * @param {number} [params.top] - Limit number of categories
 * @param {string} [params.status] - Optional regex for status
 * @param {boolean} [params.includeUnknown=false] - Include null/empty service_type
 * @param {boolean} [params.withTimeBuckets=false] - Optional time buckets
 * @param {boolean} [params.debug=false] - When true, logs URL and response
 * @returns {Promise<{ success: boolean, data: Array<{ label: string, count: number }>, meta: any }>}
 */
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

  const url = `${baseUrl}/api/session-tracking/services?${params.toString()}`;
  if (debug) {
    try {
      // eslint-disable-next-line no-console
      console.debug("[fetchServiceUsage] GET", url);
    } catch {}
  }

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
  const json = await resp.json();

  // Expected shape in openapi: { success, data, meta }
  const success = !!json?.success || Array.isArray(json);
  const rawData = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  const meta = json?.meta || {};

  // Normalize to [{ label, count }]
  const data = rawData
    .map((row) => {
      const label =
        row?.label ??
        row?.service_type ??
        row?.serviceType ??
        row?.name ??
        row?.key ??
        "Unknown";
      const count = Number(row?.count ?? row?.value ?? row?.total ?? 0);
      return { label: String(label), count: Number.isFinite(count) ? count : 0 };
    })
    .filter((d) => !!d.label); // keep Unknown too

  if (debug) {
    try {
      // eslint-disable-next-line no-console
      console.debug("[fetchServiceUsage] response", { success, data, meta });
    } catch {}
  }

  return { success, data, meta };
}
