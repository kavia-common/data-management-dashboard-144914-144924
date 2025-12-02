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
import { apiBase } from "./config";

/**
 * PUBLIC_INTERFACE
 * fetchServiceUsage
 * Calls GET /api/session-tracking/services using the same filters as Sessions Trend.
 * Parses backend envelope { success, data: [{ label?, service_type?, count }], meta }.
 * Adds debug logging and uses central apiBase to avoid missing base URL.
 */
export async function fetchServiceUsage({
  baseUrl,
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
  const resolvedBase = typeof baseUrl === "string" && baseUrl.length > 0 ? baseUrl : apiBase;
  if (!tenantId || String(tenantId).trim().length === 0) {
    const err = new Error("Missing tenant_id: A tenantId must be provided to fetch service usage.");
    err.code = "MISSING_TENANT_ID";
    throw err;
  }

  const params = new URLSearchParams();
  params.set("tenant_id", String(tenantId));
  if (interval) params.set("interval", interval);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (top != null) params.set("top", String(top));
  if (status) params.set("status", status);
  if (includeUnknown) params.set("include_unknown", "true");
  if (withTimeBuckets) params.set("withTimeBuckets", "true");

  const url = `${resolvedBase.replace(/\/+$/, "")}/session-tracking/services?${params.toString()}`;
  if (debug) {
    try {
      // eslint-disable-next-line no-console
      console.debug("[fetchServiceUsage] GET", url, { tenantId, interval, startDate, endDate, top, status, includeUnknown, withTimeBuckets });
    } catch {}
  }

  const headers = { Accept: "application/json" };
  // Provide tenant via header as an additional hint for middleware that accepts aliases
  headers["x-organization-id"] = String(tenantId);

  const resp = await fetch(url, {
    headers: debug ? { ...headers, "x-debug": "true" } : headers,
    credentials: "include",
  });
  if (!resp.ok) {
    let msg = `Failed to fetch service usage (${resp.status})`;
    try {
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const err = await resp.json();
        msg = err?.message || msg;
      } else {
        const text = await resp.text();
        if (text) msg = text;
      }
    } catch (_) {}
    const error = new Error(msg);
    error.status = resp.status;
    throw error;
  }
  const json = await resp.json();

  const success = !!json?.success || Array.isArray(json);
  const rawData = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  const meta = json?.meta || {};

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
    .filter((d) => typeof d.label === "string" && d.label.length >= 0);

  if (debug) {
    try {
      // eslint-disable-next-line no-console
      console.debug("[fetchServiceUsage] response", { success, meta, dataLen: data.length });
    } catch {}
  }

  return { success, data, meta };
}
