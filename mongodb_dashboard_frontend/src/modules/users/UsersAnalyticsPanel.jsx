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
 * Date filtering:
 * - When no from/to are supplied, the backend defaults to TODAY in UTC
 *   (00:00:00.000Z -> 23:59:59.999Z).
 * - When date-only values are selected, we pass YYYY-MM-DD; backend expands to full-day UTC bounds.
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

  // `usersPayload` supports both legacy and new shapes:
  // - Legacy: Array<{ userId, name, email, totalSessions, distinctProjects, lastActivityAt }>
  // - New (bucketed): { interval, buckets, totals?, users? }
  const [usersPayload, setUsersPayload] = useState(null);
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

        // Accept either:
        //  - legacy array
        //  - new object shape (interval + buckets + totals/users)
        if (Array.isArray(data)) {
          setUsersPayload({ legacyRows: data });
        } else if (data && typeof data === "object") {
          setUsersPayload(data);
        } else {
          setUsersPayload(null);
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Failed to load users analytics.");
          setUsersPayload(null);
        }
      } finally {
        setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [fromParam, toParam, selectedTenantId]);

  /**
   * Format a bucket label from a bucket key (ISO) and the backend-provided interval.
   * Backend is authoritative for interval selection, but labels should remain compact.
   */
  function formatBucketLabel(key, interval) {
    if (!key) return "";
    const d = new Date(key);
    if (Number.isNaN(d.getTime())) return String(key);

    if (interval === "hour") {
      // Example: Feb 6, 14:00
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (interval === "day") {
      // Example: Feb 6
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    if (interval === "month") {
      // Example: Feb 2026
      return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    }
    // Fallback
    return d.toLocaleString();
  }

  const normalized = useMemo(() => {
    // Normalize payload into:
    // - `intervalSeries`: bucketed activity over time
    // - `totalsRows`: legacy per-user totals (for KPI + any existing usages)
    const payload = usersPayload;

    // Legacy array wrapped as { legacyRows }
    const legacyRows = Array.isArray(payload?.legacyRows) ? payload.legacyRows : null;

    if (legacyRows) {
      return {
        interval: null,
        intervalSeries: [],
        totalsRows: legacyRows,
      };
    }

    // New bucketed shape: { interval, buckets, totals?, users? }
    const interval = typeof payload?.interval === "string" ? payload.interval : null;
    const buckets = Array.isArray(payload?.buckets) ? payload.buckets : [];
    const totalsRows = Array.isArray(payload?.users)
      ? payload.users
      : Array.isArray(payload?.totals)
        ? payload.totals
        : [];

    const intervalSeries = buckets
      .map((b) => {
        const key = b?.key ?? b?.start ?? b?.bucket ?? b?.date;
        const count = b?.count ?? b?.total ?? b?.value ?? 0;
        return {
          key: key ? String(key) : "",
          label: formatBucketLabel(key, interval),
          value: Number(count || 0),
        };
      })
      .filter((x) => x.key);

    return {
      interval,
      intervalSeries,
      totalsRows,
    };
  }, [usersPayload]);

  // Chart data for the existing "Activity by User" chart:
  // - If we have interval buckets, show a vertical BarChart with X=label (time) and Y=value (sessions)
  // - Otherwise fallback to the prior per-user horizontal chart (Sessions/Projects).
  const usingIntervalBuckets = normalized.intervalSeries.length > 0;

  const chartRows = useMemo(() => {
    if (usingIntervalBuckets) {
      return normalized.intervalSeries.map((b) => ({
        label: b.label,
        key: b.key,
        sessions: b.value,
      }));
    }

    // Legacy behavior: per-user totals (already sorted by backend)
    const seen = new Map();
    const rows = normalized.totalsRows || [];

    const mapped = rows.map((r, index) => {
      const baseLabel = r?.name || r?.email || r?.userId || "";
      const userId = r?.userId || "";
      const user = buildUniqueUserLabel(baseLabel, userId, index, seen);

      return {
        user,
        userId,
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
    }

    return mapped;
  }, [
    usingIntervalBuckets,
    normalized.intervalSeries,
    normalized.totalsRows,
    selection.mode,
    selection.quickValue,
    fromParam,
    toParam,
    selectedTenantId,
  ]);

  const totalSessionsKpi = useMemo(() => {
    // Keep KPI compatible:
    // - If totalsRows exists, compute from it.
    // - Else if only buckets exist, compute sum of bucket counts.
    if (Array.isArray(normalized.totalsRows) && normalized.totalsRows.length > 0) {
      return normalized.totalsRows.reduce(
        (sum, r) => sum + Number(r?.totalSessions || 0),
        0
      );
    }
    if (Array.isArray(normalized.intervalSeries) && normalized.intervalSeries.length > 0) {
      return normalized.intervalSeries.reduce((sum, b) => sum + Number(b?.value || 0), 0);
    }
    return 0;
  }, [normalized.totalsRows, normalized.intervalSeries]);

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

  // For time-series buckets we render a standard vertical chart; scrolling/inner-height logic
  // is only relevant for the (potentially huge) per-user horizontal chart.
  const { barSize: BAR_SIZE, barGap: BAR_GAP } = (() => {
    if (usingIntervalBuckets) return { barSize: 18, barGap: 10 };
    if (rowCount > 300) return { barSize: 10, barGap: 4 };
    if (rowCount > 160) return { barSize: 12, barGap: 5 };
    if (rowCount > 90) return { barSize: 14, barGap: 6 };
    if (rowCount > 45) return { barSize: 16, barGap: 8 };
    return { barSize: 20, barGap: 10 };
  })();

  const CHART_PADDING = 140;
  const shouldScroll = !usingIntervalBuckets && rowCount > SCROLL_THRESHOLD;

  const innerChartHeight = usingIntervalBuckets
    ? 320
    : shouldScroll
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
            <div className="card" aria-label="Activity by User">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Activity by User</h4>
                <div className="card-subtitle">
                  {usingIntervalBuckets
                    ? `Sessions over time (${normalized.interval || "interval"} buckets)`
                    : "Sessions and Projects (computed server-side; sorted by last activity)"}
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
                ) : usingIntervalBuckets ? (
                  <div style={{ width: "100%", height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={chartRows}
                        margin={{ top: 8, right: 16, bottom: 24, left: 12 }}
                        barCategoryGap={BAR_GAP}
                        barSize={BAR_SIZE}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: subtle, fontSize: 11 }}
                          interval="preserveStartEnd"
                          minTickGap={12}
                          angle={-25}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis
                          tick={{ fill: subtle, fontSize: 12 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !Array.isArray(payload) || payload.length === 0)
                              return null;
                            const row = payload?.[0]?.payload || {};
                            const sessions = Number.isFinite(Number(row?.sessions))
                              ? Number(row.sessions)
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
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                  }}
                                >
                                  <span style={{ color: "#6B7280" }}>Sessions:</span>
                                  <span style={{ fontWeight: 600 }}>{sessions}</span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="sessions"
                          name="Sessions"
                          fill={primary}
                          stroke={primary}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div
                    style={{
                      height: CHART_VIEWPORT_HEIGHT,
                      overflowY: shouldScroll ? "auto" : "hidden",
                      overflowX: "hidden",
                    }}
                    aria-label={
                      shouldScroll
                        ? "Scrollable Activity by User chart (more than 20 users)"
                        : "Activity by User chart"
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
                              if (!active || !Array.isArray(payload) || payload.length === 0)
                                return null;
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

                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 12,
                                    }}
                                  >
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
        </div>
      </div>
    </div>
  );
}

UsersAnalyticsPanel.propTypes = {
  style: PropTypes.object,
  className: PropTypes.string,
};
