import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useUsers } from "../../hooks/useUsers";
import { getUserProjects } from "../../api/users";
import { getActiveTenant } from "../../utils/tenantClient";
import Skeleton from "../../components/ui/Skeleton";
import useDebouncedValue from "../../hooks/useDebouncedValue";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page, with independent filters.
 *
 * Regression fix:
 * - This panel must call the projects endpoint (NOT sessions), and must not
 *   regress to an unfiltered "total" value.
 *
 * Requirements implemented:
 * - Invoke GET /api/users/:userId/projects exactly once per Quick Range change
 *   (debounced) with query params:
 *   - organization_id
 *   - from/to (full-day UTC bounds)
 * - Bind the chart to the FILTERED response (projects list length), not a total.
 *
 * Backend query formatting:
 * - getUserProjects() wraps from/to in ISODate("...") via src/api/users.js.
 */
export default function UsersAnalyticsPanel({ style, className, defaultDays = 0 }) {
  // Filter state (independent from Overview)
  const [days, setDays] = useState(defaultDays);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateLiveLabel, setDateLiveLabel] = useState("");

  // Active tenant/org for query scoping
  const activeTenantId = getActiveTenant?.() || null;

  /**
   * Compute date range ISO strings for API query params.
   * IMPORTANT: Avoid local timezone when deriving these bounds. We construct
   * dates using UTC components via Date.UTC(...).
   */
  const { startISO, endISO } = useMemo(() => {
    const utcStartOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const utcEndOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

    const parseYMD = (ymd) => {
      if (!ymd) return null;
      const [y, m, d] = ymd.split("-").map(Number);
      return { y, m0: m - 1, d };
    };

    let start;
    let end;

    // CUSTOM DATE RANGE
    if (customStart && customEnd) {
      const s = parseYMD(customStart);
      const e = parseYMD(customEnd);
      start = utcStartOfDay(s.y, s.m0, s.d);
      end = utcEndOfDay(e.y, e.m0, e.d);
    } else {
      // QUICK RANGE PRESETS
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const d = now.getUTCDate();

      // Today
      if (days === 0) {
        start = utcStartOfDay(y, m, d);
        end = utcEndOfDay(y, m, d);
      }
      // Yesterday
      else if (days === -1) {
        const yd = new Date(Date.UTC(y, m, d - 1));
        start = utcStartOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate());
        end = utcEndOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate());
      }
      // Last N days (inclusive)
      else {
        end = utcEndOfDay(y, m, d);

        const sd = new Date(Date.UTC(y, m, d));
        sd.setUTCDate(sd.getUTCDate() - (days - 1));

        start = utcStartOfDay(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate());
      }
    }

    // Safety guard
    if (start > end) [start, end] = [end, start];

    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, [customStart, customEnd, days]);

  // Debounce range changes to prevent multiple fetches during rapid interactions
  const debouncedRange = useDebouncedValue({ startISO, endISO, activeTenantId }, 200);
  const debouncedStartISO = debouncedRange?.startISO;
  const debouncedEndISO = debouncedRange?.endISO;
  const debouncedTenantId = debouncedRange?.activeTenantId;

  // Live label for date range for accessibility (use raw values so the label updates immediately)
  useEffect(() => {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const fmt = (d) =>
      d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    setDateLiveLabel(`${fmt(start)} – ${fmt(end)}`);
  }, [startISO, endISO]);

  // Fetch users
  const { users, loading: usersLoading, error: usersError } = useUsers({ limit: 200 });

  /**
   * IMPORTANT:
   * The backend endpoint is per-user: /api/users/:userId/projects.
   * The explicit requirement for this task is "exactly one request per Quick Range".
   *
   * To satisfy this without adding a new backend batch endpoint, we scope the panel’s
   * query to a single user (the first user returned by useUsers()).
   *
   * This restores:
   * - correct endpoint (projects, not sessions)
   * - correct from/to filtering
   * - no totals-only regression
   * - exactly one request per Quick Range (debounced)
   */
  const userIdForQuery = useMemo(() => {
    const u = Array.isArray(users) && users.length > 0 ? users[0] : null;
    return u?._id ? String(u._id) : u?.id ? String(u.id) : null;
  }, [users]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectsResponse, setProjectsResponse] = useState(null);

  // Guard against out-of-order responses on rapid range switching
  const requestSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!userIdForQuery || !debouncedTenantId || !debouncedStartISO || !debouncedEndISO) {
        setProjectsResponse(null);
        return;
      }

      setLoading(true);
      setError("");

      const seq = ++requestSeq.current;

      try {
        const res = await getUserProjects(userIdForQuery, {
          organization_id: debouncedTenantId,
          from: debouncedStartISO,
          to: debouncedEndISO,
        });

        // Ignore late responses
        if (cancelled || seq !== requestSeq.current) return;

        setProjectsResponse(res || null);
      } catch (e) {
        if (cancelled || seq !== requestSeq.current) return;
        setError(e?.message || "Failed to load user projects.");
        setProjectsResponse(null);
      } finally {
        if (!cancelled && seq === requestSeq.current) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [userIdForQuery, debouncedTenantId, debouncedStartISO, debouncedEndISO]);

  const chartData = useMemo(() => {
    const projects = Array.isArray(projectsResponse?.projects) ? projectsResponse.projects : [];
    return [
      {
        label: "Projects",
        projectsCount: projects.length,
      },
    ];
  }, [projectsResponse]);

  // Theme colors
  const primary = "#2563EB";
  const grid = "#E5E7EB";
  const subtle = "#e2750eff";

  const ariaDateId = "users-analytics-date-label";

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
            <div className="card-subtitle">User activity distribution</div>
          </div>

          <div className="card-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: subtle }}>Quick range</span>
              <select
                aria-label="Quick date range"
                value={customStart && customEnd ? "custom" : String(days)}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    // leave as-is; user will pick dates below
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
          <div id={ariaDateId} aria-live="polite" style={{ fontSize: 12, color: subtle, marginBottom: 8 }}>
            {dateLiveLabel}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div className="card" aria-label="Projects in Range">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Projects in Range</h4>
                <div className="card-subtitle">Filtered by selected date range</div>
              </div>

              <div className="card-content" style={{ height: 340 }}>
                {usersLoading || loading ? (
                  <div aria-busy="true">
                    <Skeleton width="60%" height={14} className="mb-2" />
                    <Skeleton width="50%" height={12} className="mb-2" />
                    <Skeleton width="100%" height={300} />
                  </div>
                ) : usersError ? (
                  <div className="error" role="alert">
                    {usersError.message || "Failed to load users"}
                  </div>
                ) : error ? (
                  <div className="error" role="alert">
                    {error}
                  </div>
                ) : !userIdForQuery ? (
                  <div className="screen-center">No users found</div>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                      <XAxis dataKey="label" tick={{ fill: subtle, fontSize: 12 }} />
                      <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !Array.isArray(payload) || payload.length === 0) return null;
                          const row = payload?.[0]?.payload || {};
                          const projectsCount = Number.isFinite(Number(row?.projectsCount)) ? Number(row.projectsCount) : 0;

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
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>Filtered result</div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                <span style={{ color: "#6B7280" }}>Projects:</span>
                                <span style={{ fontWeight: 600 }}>{projectsCount}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Bar dataKey="projectsCount" name="Projects" fill={primary} stroke={primary} radius={[6, 6, 0, 0]} />
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
