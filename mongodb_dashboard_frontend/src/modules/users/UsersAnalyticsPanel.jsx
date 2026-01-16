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
} from "recharts";
import Skeleton from "../../components/ui/Skeleton";
import { listDashboardUsersAnalytics } from "../../api/baseClient";

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
export default function UsersAnalyticsPanel({ style, className, defaultDays = 0 }) {
  // Filter state
  const [days, setDays] = useState(defaultDays);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateLiveLabel, setDateLiveLabel] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /**
   * Compute date params.
   * - If quick range is used, we send explicit from/to as ISO strings (UTC bounds).
   * - If custom range is used, we send YYYY-MM-DD strings to let backend expand to full-day UTC bounds.
   * - If nothing is set, we omit both and backend will default to TODAY UTC.
   */
  const { fromParam, toParam } = useMemo(() => {
    const utcStartOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const utcEndOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

    // Custom range => send YYYY-MM-DD values (backend expands)
    if (customStart && customEnd) {
      return { fromParam: customStart, toParam: customEnd };
    }

    // Quick range => send ISO bounds
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();

    // Today
    if (days === 0) {
      return {
        fromParam: utcStartOfDay(y, m, d).toISOString(),
        toParam: utcEndOfDay(y, m, d).toISOString(),
      };
    }

    // Yesterday
    if (days === -1) {
      const yd = new Date(Date.UTC(y, m, d - 1));
      return {
        fromParam: utcStartOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate()).toISOString(),
        toParam: utcEndOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate()).toISOString(),
      };
    }

    // Last N days (inclusive)
    if (Number.isFinite(Number(days)) && Number(days) > 0) {
      const end = utcEndOfDay(y, m, d);
      const sd = new Date(Date.UTC(y, m, d));
      sd.setUTCDate(sd.getUTCDate() - (Number(days) - 1));
      const start = utcStartOfDay(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate());

      return { fromParam: start.toISOString(), toParam: end.toISOString() };
    }

    // Fallback: omit params and let backend default
    return { fromParam: null, toParam: null };
  }, [customStart, customEnd, days]);

  // Live label for date range for accessibility
  useEffect(() => {
    try {
      // If both are absent, backend defaults to TODAY (server-defined). Keep label simple.
      if (!fromParam && !toParam) {
        setDateLiveLabel("Today");
        return;
      }

      const fmt = (d) =>
        d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

      // If YYYY-MM-DD, render as date-only label.
      const isYmd = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

      const start = isYmd(fromParam) ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(fromParam);
      const end = isYmd(toParam) ? new Date(`${toParam}T23:59:59.999Z`) : new Date(toParam);

      setDateLiveLabel(`${fmt(start)} – ${fmt(end)}`);
    } catch {
      setDateLiveLabel("");
    }
  }, [fromParam, toParam]);

  // Single aggregated fetch (no per-user calls)
  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setErr("");
      try {
        const data = await listDashboardUsersAnalytics(
          { from: fromParam || undefined, to: toParam || undefined },
          { signal: controller.signal }
        );
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Failed to load users analytics.");
          setRows([]);
        }
      } finally {
        setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [fromParam, toParam]);

  const chartRows = useMemo(() => {
    // Backend already sorts by activity; keep it stable but ensure numbers are numbers.
    return (rows || []).map((r) => ({
      user: r?.name || r?.email || r?.userId || "",
      userId: r?.userId || "",
      totalSessions: Number(r?.totalSessions || 0),
      distinctProjects: Number(r?.distinctProjects || 0),
      lastActivityAt: r?.lastActivityAt || null,
      email: r?.email || "",
    }));
  }, [rows]);

  // Theme colors
  const primary = "#2563EB";
  const secondary = "#f57c0bff";
  const grid = "#E5E7EB";
  const subtle = "#6B7280";

  const handlePreset = (d) => {
    setCustomStart(null);
    setCustomEnd(null);
    setDays(d);
  };

  const onCustomStartChange = (e) => setCustomStart(e.target.value || null);
  const onCustomEndChange = (e) => setCustomEnd(e.target.value || null);

  return (
    <div className={className} style={{ ...style }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ paddingBottom: 0, gap: 12 }}>
          <div>
            <h3 className="card-title">Users Analytics</h3>
            <div className="card-subtitle">Per-user activity (server-aggregated)</div>
          </div>

          <div className="card-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: subtle }}>Quick range</span>
              <select
                aria-label="Quick date range"
                value={customStart && customEnd ? "custom" : String(days)}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    // leave custom controls to user below
                  } else {
                    handlePreset(Number(e.target.value));
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

            <div
              role="group"
              aria-label="Custom date range"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <input type="date" aria-label="Start date" className="ui-input" onChange={onCustomStartChange} />
              <span aria-hidden="true" style={{ color: subtle }}>
                to
              </span>
              <input type="date" aria-label="End date" className="ui-input" onChange={onCustomEndChange} />
            </div>
          </div>
        </div>

        <div className="card-content" style={{ paddingTop: 8 }}>
          <div aria-live="polite" style={{ fontSize: 12, color: subtle, marginBottom: 8 }}>
            {dateLiveLabel}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div className="card" aria-label="Activity by User">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Activity by User</h4>
                <div className="card-subtitle">
                  Sessions and Projects (computed server-side; sorted by last activity)
                </div>
              </div>

              <div className="card-content" style={{ height: 360 }}>
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
                  <ResponsiveContainer>
                    <BarChart data={chartRows.slice(0, 20)} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                      <XAxis
                        dataKey="user"
                        tick={{ fill: subtle, fontSize: 12 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !Array.isArray(payload) || payload.length === 0) return null;
                          const row = payload?.[0]?.payload || {};
                          const sessions = Number.isFinite(Number(row?.totalSessions)) ? Number(row.totalSessions) : 0;
                          const projects = Number.isFinite(Number(row?.distinctProjects)) ? Number(row.distinctProjects) : 0;

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

                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
                                <span style={{ color: "#6B7280" }}> Projects:</span>
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
                      <Bar dataKey="totalSessions" name="Sessions" fill={primary} stroke={primary} radius={[6, 6, 0, 0]} />
                      <Bar
                        dataKey="distinctProjects"
                        name=" Projects"
                        fill={secondary}
                        stroke={secondary}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
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
  defaultDays: PropTypes.number,
};
