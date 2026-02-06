import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import Skeleton from "../../components/ui/Skeleton";
import { listDashboardUsersAnalytics } from "../../api/baseClient";
import { fetchTenantsForDropdown } from "../../api/tenants";
import { deriveTenantsForDropdownFromUsers } from "../../api/usersTenants";
import { useQuickRange } from "./quickRangeContext";
import { useTenantFilter } from "./tenantFilterContext";

/**
 * Build a stable, readable, and unique label for the Y-axis.
 * Recharts/DOM rendering can behave oddly when category labels collide (duplicates/empty),
 * so we enforce uniqueness deterministically to avoid implicit de-dupe effects.
 */
function buildUniqueUserLabel(baseLabel, userId, index, seen) {
  const raw = String(baseLabel || "").trim();
  const fallback = userId ? `User ${String(userId).slice(0, 8)}` : `User ${index + 1}`;
  const candidate = raw || fallback;

  const key = candidate.toLowerCase();
  const count = (seen.get(key) || 0) + 1;
  seen.set(key, count);

  // Only suffix when we truly have a collision.
  return count === 1 ? candidate : `${candidate} (${count})`;
}

/**
 * Truncate a label for compact axis tick rendering.
 * Keeps the original available for native browser tooltips (title attr) and accessibility.
 */
function truncateLabel(label, maxChars) {
  const s = String(label ?? "");
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 1))}…`;
}

/**
 * Produce an x-axis label appropriate for the backend-provided interval.
 * Backend is authoritative: frontend must not infer/aggregate buckets.
 */
function formatBucketLabel(interval, bucket) {
  const key = bucket?.key;
  const label = bucket?.label;

  // Prefer server label if provided, but still ensure sensible fallback by interval.
  if (typeof label === "string" && label.trim()) return label;

  if (!key) return "";

  if (interval === "hour") {
    // Expected keys: 0..23 or "00".."23" or ISO-ish; keep as 00-23 when possible
    const n = Number(key);
    if (Number.isFinite(n)) return String(n).padStart(2, "0");
    return String(key).slice(-2);
  }

  if (interval === "day") {
    // Expected keys: YYYY-MM-DD or day index; fallback to last 2 chars if date-like.
    const s = String(key);
    const m = s.match(/^\d{4}-\d{2}-(\d{2})$/);
    if (m) return String(Number(m[1])); // 1..31
    const n = Number(s);
    if (Number.isFinite(n)) return String(n);
    return s;
  }

  if (interval === "month") {
    // Expected keys: YYYY-MM or 1..12; return short month when possible.
    const s = String(key);
    const m = s.match(/^\d{4}-(\d{2})$/);
    const monthNum = m ? Number(m[1]) : Number(s);
    if (Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return monthNames[monthNum - 1];
    }
    return s;
  }

  return String(key);
}

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page.
 *
 * Requirements (enforced by implementation):
 * - Exactly ONE request on initial load for analytics:
 *     GET /api/dashboard/users
 * - No per-user requests, no batching, and no frontend aggregation.
 * - The backend is responsible for date filtering, grouping, counting, joining user metadata,
 *   and sorting by activity.
 *
 * In addition, the "Activity by User" chart's time-series is backend-driven:
 * - Backend decides interval: hour|day|month based on from/to
 * - Backend returns interval-aware buckets, already aggregated
 * - Frontend only renders buckets and switches X-axis labels based on interval
 */
export default function UsersAnalyticsPanel({ style, className }) {
  const {
    selection,
    fromParam,
    toParam,
    label: dateLiveLabel,
    setQuickRange,
    setCustomRange,
  } = useQuickRange();

  const { selectedTenantId, setSelectedTenantId } = useTenantFilter();

  const [tenantOptions, setTenantOptions] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsNotice, setTenantsNotice] = useState("");

  const [rows, setRows] = useState([]);
  const [activitySeries, setActivitySeries] = useState({ interval: null, buckets: [] });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Load tenants for dropdown (best-effort).
  // Strategy:
  //  1) Prefer /api/session/tenants (auth-scoped) if it returns any tenants.
  //  2) If empty, derive tenants from users API by extracting tenant_id/organization_id.
  // On error/empty, we fall back to showing only "All tenants".
  useEffect(() => {
    const controller = new AbortController();

    async function loadTenants() {
      setTenantsLoading(true);
      setTenantsNotice("");

      try {
        let tenants = [];
        let shouldFallbackToUsers = false;

        try {
          tenants = await fetchTenantsForDropdown({ signal: controller.signal });
          if (!Array.isArray(tenants) || tenants.length === 0) {
            // Endpoint responded but doesn't provide tenants; derive from users as a robustness fallback.
            shouldFallbackToUsers = true;
          }
        } catch (e) {
          // 401 is expected when session is missing/expired or when endpoint strictly requires Authorization.
          if (e?.status === 401) {
            shouldFallbackToUsers = true;

            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.warn(
                "[UsersAnalyticsPanel] /api/session/tenants returned 401; falling back to users-derived tenants."
              );
            }

            setTenantsNotice(
              "Tenant list is limited due to authorization; showing tenants derived from users."
            );
          } else if (e?.name !== "AbortError") {
            // For other errors (network etc.), still try fallback for resiliency.
            shouldFallbackToUsers = true;
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.warn(
                "[UsersAnalyticsPanel] Failed to load tenants from /api/session/tenants; falling back.",
                e
              );
            }
          }
        }

        if (shouldFallbackToUsers) {
          const derived = await deriveTenantsForDropdownFromUsers({ signal: controller.signal });
          tenants = derived;
        }

        // Final safety: ensure array + de-dupe by id (works for both sources).
        const byId = new Map();
        (Array.isArray(tenants) ? tenants : []).forEach((t) => {
          if (!t?.id) return;
          byId.set(String(t.id), { id: String(t.id), name: String(t.name || t.id) });
        });

        setTenantOptions(Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        if (e?.name !== "AbortError") {
          setTenantOptions([]);
        }
      } finally {
        setTenantsLoading(false);
      }
    }

    loadTenants();
    return () => controller.abort();
    // Refresh when analytics refreshes to keep dropdown aligned with freshest data
  }, []);

  // Single aggregated fetch (no per-user calls)
  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setErr("");
      try {
        const data = await listDashboardUsersAnalytics(
          {
            from: fromParam || undefined,
            to: toParam || undefined,
            tenant_id: selectedTenantId || undefined,
          },
          { signal: controller.signal }
        );

        /**
         * Backend can return either:
         *  - legacy shape: Array<per-user rows>
         *  - new standardized shape: { users: Array<per-user rows>, activity: { interval, buckets } }
         *
         * IMPORTANT: frontend must not aggregate; it only normalizes the shape.
         */
        if (Array.isArray(data)) {
          setRows(data);
          setActivitySeries({ interval: null, buckets: [] });
        } else if (data && typeof data === "object") {
          const nextUsers = Array.isArray(data.users) ? data.users : Array.isArray(data.data) ? data.data : [];
          const nextActivity = data.activity && typeof data.activity === "object" ? data.activity : null;

          setRows(nextUsers);
          setActivitySeries({
            interval: nextActivity?.interval || null,
            buckets: Array.isArray(nextActivity?.buckets) ? nextActivity.buckets : [],
          });
        } else {
          setRows([]);
          setActivitySeries({ interval: null, buckets: [] });
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Failed to load users analytics.");
          setRows([]);
          setActivitySeries({ interval: null, buckets: [] });
        }
      } finally {
        setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [fromParam, toParam, selectedTenantId]);

  const chartRows = useMemo(() => {
    // Backend already sorts by activity; keep it stable but ensure numbers are numbers.
    // IMPORTANT: ensure the Y-axis category label is unique/stable to prevent rendering artifacts.
    const seen = new Map();

    const mapped = (rows || []).map((r, index) => {
      const baseLabel = r?.name || r?.email || r?.userId || "";
      const userId = r?.userId || "";
      const user = buildUniqueUserLabel(baseLabel, userId, index, seen);

      return {
        user,
        userId,
        // keep an unmodified string for tooltips/full display (avoid showing "(2)" suffix there)
        userRaw: String(baseLabel || "").trim() || user,
        totalSessions: Number(r?.totalSessions || 0),
        distinctProjects: Number(r?.distinctProjects || 0),
        lastActivityAt: r?.lastActivityAt || null,
        email: r?.email || "",
      };
    });

    // Temporary debug logs (remove after verifying fix)
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] range:", {
        mode: selection.mode,
        quickValue: selection.quickValue,
        fromParam,
        toParam,
      });
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] tenant:", selectedTenantId || "(all)");
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] rows length:", rows?.length ?? 0);
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] chartRows length:", mapped.length);
      // eslint-disable-next-line no-console
      console.debug(
        "[UsersAnalyticsPanel] first 10 labels:",
        mapped.slice(0, 10).map((x) => x.user)
      );
    }

    return mapped;
  }, [rows, selection.mode, selection.quickValue, fromParam, toParam, selectedTenantId]);

  const totalSessionsKpi = useMemo(() => {
    // Compute from the same server-returned per-user rows used by the panel.
    // This ensures alignment with the selected quick range + tenant filter.
    return (rows || []).reduce((sum, r) => sum + Number(r?.totalSessions || 0), 0);
  }, [rows]);

  const activityBuckets = useMemo(() => {
    // Backend-provided buckets, no aggregation. Normalize to chart-friendly points.
    const interval = activitySeries?.interval;
    const buckets = Array.isArray(activitySeries?.buckets) ? activitySeries.buckets : [];

    return buckets.map((b) => ({
      key: b?.key ?? "",
      label: formatBucketLabel(interval, b),
      value: Number(b?.count ?? b?.value ?? 0),
    }));
  }, [activitySeries]);

  // Theme colors
  const primary = "#2563EB";
  const secondary = "#f57c0bff";
  const grid = "#E5E7EB";
  const subtle = "#6B7280";

  const onCustomStartChange = (e) => {
    const start = e.target.value || null;
    setCustomRange(start, selection.customEnd);
  };
  const onCustomEndChange = (e) => {
    const end = e.target.value || null;
    setCustomRange(selection.customStart, end);
  };

  // Scrolling behavior:
  // Recharts does not support "scroll" natively; instead we create a scroll container (fixed viewport)
  // and increase INNER chart height based on row count so the wrapper scrolls.
  const SCROLL_THRESHOLD = 20;

  // Fixed viewport for the chart; the inner chart becomes taller as the dataset grows.
  const CHART_VIEWPORT_HEIGHT = 480; // ~420–520px target window
  const INNER_CHART_HEIGHT_CAP = 2400; // higher cap to improve readability for large sets

  // Adaptive bar sizing tiers (dense sets need smaller bars/gaps to avoid excessive scroll length).
  // Keep existing behavior but add an extra tighter tier for very large sets (>300).
  const rowCount = chartRows.length;
  const { barSize: BAR_SIZE, barGap: BAR_GAP } = (() => {
    if (rowCount > 300) return { barSize: 10, barGap: 4 };
    if (rowCount > 160) return { barSize: 12, barGap: 5 };
    if (rowCount > 90) return { barSize: 14, barGap: 6 };
    if (rowCount > 45) return { barSize: 16, barGap: 8 };
    return { barSize: 20, barGap: 10 };
  })();

  const CHART_PADDING = 140; // allowance for margins/axes/legend (slightly higher with custom ticks)
  const shouldScroll = rowCount > SCROLL_THRESHOLD;

  // Inner chart height uses rows*(bar+gap)+padding and caps at a higher value.
  // IMPORTANT: shouldScroll logic is based on chartRows.length (not raw rows).
  const innerChartHeight = shouldScroll
    ? Math.min(INNER_CHART_HEIGHT_CAP, rowCount * (BAR_SIZE + BAR_GAP) + CHART_PADDING)
    : 360;

  // Custom Y tick renderer: truncates label to avoid overlap and provides native tooltip with full label.
  const MAX_TICK_CHARS = 26;
  const yTickRenderer = (tickProps) => {
    const { x, y, payload } = tickProps || {};
    const full = String(payload?.value ?? "");
    const truncated = truncateLabel(full, MAX_TICK_CHARS);

    // Recharts passes coordinates for text baseline; use dy to align visually with bars.
    return (
      <g transform={`translate(${x},${y})`}>
        <title>{full}</title>
        <text
          x={0}
          y={0}
          dy={4}
          textAnchor="end"
          fill={subtle}
          fontSize={12}
          // Keep axis labels on one line; truncation handles overflows.
          style={{ pointerEvents: "auto" }}
        >
          {truncated}
        </text>
      </g>
    );
  };

  // For the time-series chart (backend buckets): keep readability by capping tick density.
  const seriesTickInterval = useMemo(() => {
    const n = activityBuckets.length;
    if (n <= 8) return 0;
    if (n <= 16) return 1;
    if (n <= 32) return 3;
    if (n <= 60) return 5;
    return Math.ceil(n / 12); // ~12 ticks max
  }, [activityBuckets.length]);

  return (
    <div className={className} style={{ ...style }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ paddingBottom: 0, gap: 12 }}>
          <div>
            <h3 className="card-title">Users Analytics</h3>
            <div className="card-subtitle">Per-user activity (server-aggregated)</div>
          </div>

          <div className="card-actions users-analytics-controls">
            <label className="users-analytics-control">
              <span className="users-analytics-control__label" style={{ color: subtle }}>
                Quick range
              </span>
              <select
                aria-label="Quick date range"
                value={selection.mode === "custom" ? "custom" : String(selection.quickValue)}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    // user will set dates using date inputs
                  } else {
                    setQuickRange(Number(e.target.value));
                  }
                }}
                className="ui-input"
                style={{ minWidth: 140 }}
              >
                <option value="0">Today</option>
                <option value="-1">Yesterday</option>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="custom">Custom...</option>
              </select>
            </label>

            <label className="users-analytics-control">
              <span className="users-analytics-control__label" style={{ color: subtle }}>
                Tenant
              </span>
              <select
                aria-label="Tenant filter"
                value={selectedTenantId || ""}
                onChange={(e) => setSelectedTenantId(e.target.value || null)}
                className="ui-input"
                style={{ minWidth: 180 }}
                disabled={tenantsLoading && tenantOptions.length === 0}
              >
                <option value="">
                  {tenantsLoading
                    ? "Loading tenants…"
                    : tenantOptions.length === 0
                      ? "All tenants"
                      : "All tenants"}
                </option>
                {tenantOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <div
              role="group"
              aria-label="Custom date range"
              className="users-analytics-control users-analytics-control--dates"
            >
              <input
                type="date"
                aria-label="Start date"
                className="ui-input"
                value={selection.customStart || ""}
                onChange={onCustomStartChange}
              />
              <span aria-hidden="true" style={{ color: subtle }}>
                to
              </span>
              <input
                type="date"
                aria-label="End date"
                className="ui-input"
                value={selection.customEnd || ""}
                onChange={onCustomEndChange}
              />
            </div>
          </div>
        </div>

        <div className="card-content" style={{ paddingTop: 8 }}>
          <div aria-live="polite" style={{ fontSize: 12, color: subtle, marginBottom: 8 }}>
            {dateLiveLabel}
            {tenantsNotice ? (
              <>
                {" "}
                <span style={{ color: subtle }}>•</span>{" "}
                <span style={{ color: subtle }}>{tenantsNotice}</span>
              </>
            ) : null}
          </div>

          {/* Compact KPI immediately below the date range div */}
          <div
            aria-label="Total Sessions Count"
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 10px",
              border: `1px solid ${grid}`,
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, color: subtle }}>Total Sessions Count</div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
              {loading ? "—" : err ? "—" : chartRows.length === 0 ? "0" : totalSessionsKpi}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {/* Interval-aware time-series chart driven by backend buckets */}
            <div className="card" aria-label="Activity by User">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Activity by User</h4>
                <div className="card-subtitle">
                  Activity over time (computed server-side; interval auto-selected)
                </div>
              </div>

              <div className="card-content" style={{ paddingTop: 8 }}>
                {loading ? (
                  <div aria-busy="true">
                    <Skeleton width="60%" height={14} className="mb-2" />
                    <Skeleton width="50%" height={12} className="mb-2" />
                    <Skeleton width="100%" height={260} />
                  </div>
                ) : err ? (
                  <div className="error" role="alert">
                    {err}
                  </div>
                ) : activityBuckets.length === 0 ? (
                  <div className="screen-center">No analytics data</div>
                ) : (
                  <div style={{ width: "100%", height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={activityBuckets}
                        margin={{ top: 8, right: 16, bottom: 8, left: 10 }}
                        barCategoryGap={10}
                        barSize={20}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: subtle, fontSize: 12 }}
                          interval={seriesTickInterval}
                          tickLine={false}
                          axisLine={{ stroke: grid }}
                        />
                        <YAxis
                          tick={{ fill: subtle, fontSize: 12 }}
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={{ stroke: grid }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !Array.isArray(payload) || payload.length === 0) return null;
                            const v = Number(payload?.[0]?.value ?? 0);
                            const interval = activitySeries?.interval || "interval";

                            return (
                              <div
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #E5E7EB",
                                  borderRadius: 8,
                                  padding: "10px 12px",
                                  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                                  color: "#111827",
                                  fontSize: 12,
                                  lineHeight: 1.35,
                                }}
                              >
                                <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                  }}
                                >
                                  <span style={{ color: "#6B7280" }}>Sessions ({interval}):</span>
                                  <span style={{ fontWeight: 600 }}>{v}</span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="value"
                          name="Sessions"
                          fill={primary}
                          stroke={primary}
                          radius={[6, 6, 0, 0]}
                        >
                          <LabelList
                            dataKey="label"
                            position="insideBottom"
                            content={(props) => {
                              // Keep native tooltip on label for accessibility; do not show extra text.
                              const { x, y, width, height, value } = props || {};
                              if (
                                typeof x !== "number" ||
                                typeof y !== "number" ||
                                typeof width !== "number" ||
                                typeof height !== "number"
                              ) {
                                return null;
                              }
                              const cx = x + width / 2;
                              const cy = y + height - 2;
                              return (
                                <g>
                                  <title>{String(value || "")}</title>
                                  <text
                                    x={cx}
                                    y={cy}
                                    dominantBaseline="alphabetic"
                                    textAnchor="middle"
                                    fill="transparent"
                                    fontSize={1}
                                  >
                                    {String(value || "")}
                                  </text>
                                </g>
                              );
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Keep existing per-user breakdown chart (styles/colors unchanged) */}
            <div className="card" aria-label="Per-user breakdown">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Per-user Breakdown</h4>
                <div className="card-subtitle">
                  Sessions and Projects (computed server-side; sorted by last activity)
                </div>
              </div>

              <div className="card-content" style={{ paddingTop: 8 }}>
                {loading ? (
                  <div aria-busy="true">
                    <Skeleton width="60%" height={14} className="mb-2" />
                    <Skeleton width="50%" height={12} className="mb-2" />
                    <Skeleton width="100%" height={320} />
                  </div>
                ) : err ? (
                  <div className="error" role="alert">
                    {err}
                  </div>
                ) : chartRows.length === 0 ? (
                  <div className="screen-center">No analytics data</div>
                ) : (
                  <div
                    style={{
                      height: CHART_VIEWPORT_HEIGHT,
                      overflowY: shouldScroll ? "auto" : "hidden",
                      overflowX: "hidden",
                    }}
                    aria-label={
                      shouldScroll
                        ? "Scrollable Per-user Breakdown chart (more than 20 users)"
                        : "Per-user Breakdown chart"
                    }
                  >
                    <div style={{ width: "100%", height: innerChartHeight }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={chartRows}
                          layout="vertical"
                          margin={{ top: 8, right: 16, bottom: 8, left: 18 }}
                          barCategoryGap={BAR_GAP}
                          barSize={BAR_SIZE}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                          <XAxis
                            type="number"
                            tick={{ fill: subtle, fontSize: 12 }}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="user"
                            width={190}
                            interval={0}
                            tick={yTickRenderer}
                            tickLine={false}
                            axisLine={{ stroke: grid }}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !Array.isArray(payload) || payload.length === 0) return null;
                              const row = payload?.[0]?.payload || {};
                              const sessions = Number.isFinite(Number(row?.totalSessions))
                                ? Number(row.totalSessions)
                                : 0;
                              const projects = Number.isFinite(Number(row?.distinctProjects))
                                ? Number(row.distinctProjects)
                                : 0;

                              return (
                                <div
                                  style={{
                                    background: "#ffffff",
                                    border: "1px solid #E5E7EB",
                                    borderRadius: 8,
                                    padding: "10px 12px",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                                    color: "#111827",
                                    fontSize: 12,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>

                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                    <span style={{ color: "#6B7280" }}>Sessions:</span>
                                    <span style={{ fontWeight: 600 }}>{sessions}</span>
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      marginTop: 4,
                                    }}
                                  >
                                    <span style={{ color: "#6B7280" }}>Projects:</span>
                                    <span style={{ fontWeight: 600 }}>{projects}</span>
                                  </div>

                                  {row?.lastActivityAt ? (
                                    <div style={{ marginTop: 6, color: "#6B7280" }}>
                                      Last activity:{" "}
                                      <span style={{ color: "#111827" }}>
                                        {new Date(row.lastActivityAt).toLocaleString()}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="totalSessions"
                            name="Sessions"
                            fill={primary}
                            stroke={primary}
                            radius={[0, 6, 6, 0]}
                          >
                            <LabelList
                              dataKey="userRaw"
                              position="insideLeft"
                              content={(props) => {
                                const { x, y, height, value } = props || {};
                                // Render nothing visually; we only want the native tooltip via <title>.
                                // This keeps chart clean but provides full-name hover for truncated labels.
                                if (typeof x !== "number" || typeof y !== "number") return null;
                                const cx = x + 4;
                                const cy = y + height / 2;

                                return (
                                  <g>
                                    <title>{String(value || "")}</title>
                                    <text
                                      x={cx}
                                      y={cy}
                                      dominantBaseline="middle"
                                      textAnchor="start"
                                      fill="transparent"
                                      fontSize={1}
                                    >
                                      {String(value || "")}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                          </Bar>
                          <Bar
                            dataKey="distinctProjects"
                            name="Projects"
                            fill={secondary}
                            stroke={secondary}
                            radius={[0, 6, 6, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Developer-facing hint if backend hasn't shipped activity buckets yet */}
          {!loading && !err && activitySeries?.interval === null ? (
            <div style={{ marginTop: 10, fontSize: 12, color: subtle }}>
              Note: Activity time-series buckets are not available in the current response.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

UsersAnalyticsPanel.propTypes = {
  style: PropTypes.object,
  className: PropTypes.string,
};
