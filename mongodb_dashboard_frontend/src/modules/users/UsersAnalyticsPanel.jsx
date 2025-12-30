import { useState, useEffect, useMemo } from "react";
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
import { useUsers } from "../../hooks/useUsers";
import { getUserProjects } from "../../api/users";
import { getActiveTenant } from "../../utils/tenantClient";
import Skeleton from "../../components/ui/Skeleton";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page, with independent filters.
 *
 * Data source:
 * - Reuses /api/users to get users, then uses /api/users/:userId/projects
 *   to fetch per-user projects when available.
 *
 * Filters:
 * - Quick range + Custom date range.
 *
 * Date normalization requirement:
 * - Always send full-day UTC bounds:
 *   - from = YYYY-MM-DDT00:00:00.000Z
 *   - to   = YYYY-MM-DDT23:59:59.999Z
 */
export default function UsersAnalyticsPanel({ style, className, defaultDays = 30 }) {
  // Filter state (independent from Overview)
  const [days, setDays] = useState(defaultDays);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateLiveLabel, setDateLiveLabel] = useState("");

  // Active tenant (scoped by client too, but visible here for explicit query params when needed)
  const activeTenantId = getActiveTenant?.() || null;

  /**
   * Compute date range ISO strings for API query params.
   * IMPORTANT: Avoid local timezone when deriving these bounds. We construct
   * dates using UTC components via Date.UTC(...).
   */
  // const { startISO, endISO } = useMemo(() => {
  //   const utcStartOfDay = (year, monthIndex0, day) =>
  //     new Date(Date.UTC(year, monthIndex0, day, 0, 0, 0, 0));

  //   const utcEndOfDay = (year, monthIndex0, day) =>
  //     new Date(Date.UTC(year, monthIndex0, day, 23, 59, 59, 999));

  //   const parseYMD = (ymd) => {
  //     if (!ymd || typeof ymd !== "string") return null;
  //     const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  //     if (!m) return null;
  //     return { y: Number(m[1]), m0: Number(m[2]) - 1, d: Number(m[3]) };
  //   };

  //   let start;
  //   let end;

  //   if (customStart && customEnd) {
  //     // Custom inputs are YYYY-MM-DD; interpret them as UTC calendar dates.
  //     const s = parseYMD(customStart);
  //     const e = parseYMD(customEnd);

  //     if (s && e) {
  //       start = utcStartOfDay(s.y, s.m0, s.d);
  //       end = utcEndOfDay(e.y, e.m0, e.d);
  //     } else {
  //       // Defensive fallback (shouldn't happen with <input type="date">).
  //       const now = new Date();
  //       start = utcStartOfDay(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  //       end = utcEndOfDay(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  //     }
  //   } else {
  //     // For presets, define days based on UTC "today" to avoid local timezone drift.
  //     const now = new Date();
  //     const todayUtcStart = utcStartOfDay(
  //       now.getUTCFullYear(),
  //       now.getUTCMonth(),
  //       now.getUTCDate()
  //     );

  //     if (days === 0) {
  //       // Today (UTC): full UTC day bounds (not "through now").
  //       start = todayUtcStart;
  //       end = utcEndOfDay(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  //     } else if (days === -1) {
  //       // Yesterday (UTC): full previous UTC calendar day.
  //       const y = new Date(todayUtcStart);
  //       y.setUTCDate(y.getUTCDate() - 1);
  //       start = utcStartOfDay(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate());
  //       end = utcEndOfDay(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate());
  //     } else {
  //       // Last N days (UTC, inclusive):
  //       // end = end-of-today UTC
  //       // start = start-of-(today - (N-1)) UTC
  //       end = utcEndOfDay(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  //       const s = new Date(todayUtcStart);
  //       s.setUTCDate(s.getUTCDate() - (Number(days) - 1));
  //       start = utcStartOfDay(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  //     }
  //   }

  //   return { startISO: start.toISOString(), endISO: end.toISOString() };
  // }, [customStart, customEnd, days]);

  const { startISO, endISO } = useMemo(() => {
  const utcStartOfDay = (y, m, d) =>
    new Date(Date.UTC(y, m, d, 0, 0, 0, 0));

  const utcEndOfDay = (y, m, d) =>
    new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

  const parseYMD = (ymd) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return { y, m0: m - 1, d };
  };

  let targetDate;

  if (customStart && customEnd) {
    // 🔹 SAME DATE QUERY (custom)
    const s = parseYMD(customStart);
    targetDate = { y: s.y, m0: s.m0, d: s.d };
  } else {
    // 🔹 SAME DATE QUERY (presets)
    const now = new Date();
    targetDate = {
      y: now.getUTCFullYear(),
      m0: now.getUTCMonth(),
      d: now.getUTCDate(),
    };
  }

  const start = utcStartOfDay(
    targetDate.y,
    targetDate.m0,
    targetDate.d
  );

  const end = utcEndOfDay(
    targetDate.y,
    targetDate.m0,
    targetDate.d
  );

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}, [customStart, customEnd]);

  // Live label for date range for accessibility
  useEffect(() => {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const fmt = (d) =>
      d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    setDateLiveLabel(`${fmt(start)} \u2013 ${fmt(end)}`);
  }, [startISO, endISO]);

  // Fetch users; table is unchanged elsewhere
  const { users, loading: usersLoading, error: usersError } = useUsers({ limit: 200 });

  // Fetch projects per user when needed
  const [projectsByUser, setProjectsByUser] = useState({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!Array.isArray(users) || users.length === 0 || !activeTenantId) {
        setProjectsByUser({});
        return;
      }

      setProjectsLoading(true);
      setProjectsError("");
      const acc = {};

      try {
        // Fetch in small batches to avoid overloading backend
        const batchSize = 8;

        for (let i = 0; i < users.length; i += batchSize) {
          const slice = users.slice(i, i + batchSize);

          await Promise.all(
            slice.map(async (u) => {
              if (!u?._id) return;

              try {
                // IMPORTANT: startISO/endISO are full-day UTC bounds by construction.
                // Use shared API helper so ISODate wrapping stays consistent.
                const res = await getUserProjects(String(u._id), {
                  organization_id: activeTenantId,
                  from: startISO,
                  to: endISO,
                });

                const list = Array.isArray(res?.projects) ? res.projects : [];
                acc[String(u._id)] = list;
              } catch {
                acc[String(u._id)] = acc[String(u._id)] || [];
              }
            })
          );

          if (cancelled) return;
        }

        if (!cancelled) setProjectsByUser(acc);
      } catch (e) {
        if (!cancelled) {
          setProjectsError(e?.message || "Failed to load user projects.");
          setProjectsByUser({});
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [users, activeTenantId, startISO, endISO]);

  const aggregates = useMemo(() => {
    const projectsCountByUser = [];

    for (const u of users || []) {
      const uid = String(u?._id || u?.id || "");
      const projs = projectsByUser[uid];

      projectsCountByUser.push({
        user: u?.name || u?.full_name || u?.email || uid,
        user_id: uid,
        count: Array.isArray(projs) ? projs.length : 0,
      });
    }

    projectsCountByUser.sort((a, b) => b.count - a.count);
    return { projectsCountByUser };
  }, [users, projectsByUser]);

  // Theme colors
  const primary = "#2563EB";
  const grid = "#E5E7EB";
  const subtle = "#6B7280";

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
              <input
                type="date"
                aria-label="Start date"
                className="ui-input"
                onChange={onCustomStartChange}
              />
              <span aria-hidden="true" style={{ color: subtle }}>
                to
              </span>
              <input
                type="date"
                aria-label="End date"
                className="ui-input"
                onChange={onCustomEndChange}
              />
            </div>
          </div>
        </div>

        <div className="card-content" style={{ paddingTop: 8 }}>
          <div
            id={ariaDateId}
            aria-live="polite"
            style={{ fontSize: 12, color: subtle, marginBottom: 8 }}
          >
            {dateLiveLabel}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div className="card" aria-label="Activity by User">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Activity by User</h4>
                <div className="card-subtitle">Counts derived from associated activity</div>
              </div>

              <div className="card-content" style={{ height: 340 }}>
                {usersLoading || projectsLoading ? (
                  <div aria-busy="true">
                    <Skeleton width="60%" height={14} className="mb-2" />
                    <Skeleton width="50%" height={12} className="mb-2" />
                    <Skeleton width="100%" height={300} />
                  </div>
                ) : usersError ? (
                  <div className="error" role="alert">
                    {usersError.message || "Failed to load users"}
                  </div>
                ) : projectsError ? (
                  <div className="error" role="alert">
                    {projectsError}
                  </div>
                ) : aggregates.projectsCountByUser.length === 0 ? (
                  <div className="screen-center">No project data</div>
                ) : (
                  <ResponsiveContainer>
                    <BarChart
                      data={aggregates.projectsCountByUser.slice(0, 20)}
                      margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                      <XAxis
                        dataKey="user"
                        tick={{ fill: subtle, fontSize: 12 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="count"
                        name="Count"
                        fill={primary}
                        stroke={primary}
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
