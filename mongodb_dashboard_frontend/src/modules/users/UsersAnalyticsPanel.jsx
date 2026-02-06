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

  const [rows, setRows] = useState([]);
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
  const [activity, setActivity] = useState(null);
  const [interval, setInterval] = useState(null);

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

        // New shape: { activity, users, interval }
        if (data && typeof data === "object" && ("users" in data || "activity" in data)) {
          setRows(Array.isArray(data.users) ? data.users : []);
          setActivity(Array.isArray(data.activity) ? data.activity : null);
          setInterval(typeof data.interval === "string" ? data.interval : null);
        } else {
          // Safety fallback (should not happen)
          setRows(Array.isArray(data) ? data : []);
          setActivity(null);
          setInterval(null);
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Failed to load users analytics.");
          setRows([]);
          setActivity(null);
          setInterval(null);
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
      console.debug("[UsersAnalyticsPanel] per-user rows length:", rows?.length ?? 0);
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] activity buckets length:", activity?.length ?? 0);
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] interval:", interval || "(none)");
    }

    return mapped;
  }, [rows, selection.mode, selection.quickValue, fromParam, toParam, selectedTenantId, activity, interval]);

  const totalSessionsKpi = useMemo(() => {
    // Compute from the same server-returned per-user rows used by the panel.
    // This ensures alignment with the selected quick range + tenant filter.
    return (rows || []).reduce((sum, r) => sum + Number(r?.totalSessions || 0), 0);
  }, [rows]);

  const activityChartData = useMemo(() => {
    // Backend-driven aggregation for the "Activity by User" chart:
    // interval=hour => labels "00".."23"
    // interval=day  => labels "1".."31"
    // interval=month => labels "Jan".."Dec"
    return (Array.isArray(activity) ? activity : []).map((b) => ({
      label: String(b?.label ?? ""),
      sessions: Number(b?.sessions ?? 0),
      users: Number(b?.users ?? 0),
      key: String(b?.key ?? ""),
    }));
  }, [activity]);

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
  // Recharts does not support "scroll" natively; instead we create a scroll container and
  // increase chart height based on row count so the wrapper scrolls.
  const SCROLL_THRESHOLD = 20;
  const BAR_SIZE = 20; // px per bar
  const BAR_GAP = 10; // px gap between bars
  const CHART_PADDING = 120; // allowance for margins/axes/legend
  const shouldScroll = chartRows.length > SCROLL_THRESHOLD;
  const chartHeight = shouldScroll
    ? Math.min(1200, chartRows.length * (BAR_SIZE + BAR_GAP) + CHART_PADDING)
    : 360;

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
                  {interval === "hour"
                    ? "Hourly activity (00–23)"
                    : interval === "day"
                      ? "Daily activity (by date)"
                      : interval === "month"
                        ? "Monthly activity (Jan–Dec)"
                        : "Activity (server-aggregated)"}
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
                ) : activityChartData.length === 0 ? (
                  <div className="screen-center">No analytics data</div>
                ) : (
                  <div style={{ width: "100%", height: 360 }} aria-label="Activity by User chart">
                    <ResponsiveContainer>
                      <BarChart
                        data={activityChartData}
                        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                        barCategoryGap={12}
                        barSize={18}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: subtle, fontSize: 12 }}
                          interval="preserveStartEnd"
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
                            const row = payload?.[0]?.payload || {};
                            const sessions = Number.isFinite(Number(row?.sessions)) ? Number(row.sessions) : 0;
                            const users = Number.isFinite(Number(row?.users)) ? Number(row.users) : 0;

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
                                  <span style={{ color: "#6B7280" }}>Users:</span>
                                  <span style={{ fontWeight: 600 }}>{users}</span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        {/* Keep existing colors and stacked behavior */}
                        <Bar
                          dataKey="sessions"
                          name="Sessions"
                          fill={primary}
                          stroke={primary}
                          stackId="a"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="users"
                          name="Users"
                          fill={secondary}
                          stroke={secondary}
                          stackId="a"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
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
