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
import { getApiClient } from "../../api";
import { getActiveTenant } from "../../utils/tenantClient";
import Skeleton from "../../components/ui/Skeleton";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page, with independent filters.
 * - Activity by User (bar)
 *
 * Data source:
 * - Reuses /api/users to get users, then uses /api/users/:userId/projects
 *   to fetch per-user projects when available. Falls back to client-side
 *   aggregation from data already loaded if needed.
 *
 * Filters:
 * - Date range (start, end with explicit ISO)
 * - Tenant scoped via base client and active tenant helper.
 *
 * Accessibility:
 * - Proper aria-labels and live region updates for date label.
 */
export default function UsersAnalyticsPanel({
  style,
  className,
  defaultDays = 30,
}) {
  // Filter state (independent from Overview)
  const [days, setDays] = useState(defaultDays);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateLiveLabel, setDateLiveLabel] = useState("");

  // Active tenant (scoped by client too, but visible here for explicit query params when needed)
  const activeTenantId = getActiveTenant?.() || null;

  // Compute date range ISO strings.
  // - Custom: uses date inputs (YYYY-MM-DD) as local dates (start/end).
  // - Today: start at local 00:00 through now.
  // - Yesterday: local 00:00 to 23:59:59.999 of the previous calendar day.
  // - Other "Last N days": preserves existing behavior (end-of-today through N-day window).
  const { startISO, endISO } = useMemo(() => {
    let start;
    let end;

    if (customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
    } else if (days === 0) {
      // Today: from local start-of-day through now
      end = new Date();
      start = new Date();
      start.setHours(0, 0, 0, 0);
    } else if (days === -1) {
      // Yesterday: full previous local calendar day
      start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else {
      // Existing behavior for "Last N days": end is end-of-today, start is (end - (N-1) days) at start-of-day.
      end = new Date();
      end.setHours(23, 59, 59, 999);

      start = new Date();
      start.setDate(end.getDate() - days + 1);
      start.setHours(0, 0, 0, 0);
    }

    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, [customStart, customEnd, days]);

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
    const label = `${fmt(start)} \u2013 ${fmt(end)}`;
    setDateLiveLabel(label);
  }, [startISO, endISO]);

  // Fetch users; table is unchanged elsewhere
  const { users, loading: usersLoading, error: usersError } = useUsers({
    limit: 200,
  });

  // Fetch projects per user when needed
  const [projectsByUser, setProjectsByUser] = useState({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      // Lazily fetch projects for each user for better accuracy of counts over time.
      // If endpoint not available or fails, gracefully continue with partial data.
      if (!Array.isArray(users) || users.length === 0 || !activeTenantId) {
        setProjectsByUser({});
        return;
      }
      setProjectsLoading(true);
      setProjectsError("");
      const api = getApiClient();
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
                const res = await api.get(
                  `/users/${encodeURIComponent(String(u._id))}/projects`,
                  {
                    params: {
                      organization_id: activeTenantId,
                      from: startISO,
                      to: endISO,
                    },
                  }
                );
                const payload = res.data?.data ?? res.data;
                const list = Array.isArray(payload?.projects)
                  ? payload.projects
                  : [];
                acc[String(u._id)] = list;
              } catch {
                // Ignore individual user fetch errors; rely on others or fallback
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

  // Aggregations (department distribution removed)
  const aggregates = useMemo(() => {
    // Projects by user count only
    const projectsCountByUser = [];

    for (const u of users || []) {
      const uid = String(u?._id || u?.id || "");
      const projs = projectsByUser[uid];

      if (Array.isArray(projs)) {
        projectsCountByUser.push({
          user: u?.name || u?.full_name || u?.email || uid,
          user_id: uid,
          count: projs.length,
        });
      } else {
        projectsCountByUser.push({
          user: u?.name || u?.full_name || u?.email || uid,
          user_id: uid,
          count: 0,
        });
      }
    }

    // Sort projectsCountByUser desc
    projectsCountByUser.sort((a, b) => b.count - a.count);

    return { projectsCountByUser };
  }, [users, projectsByUser, startISO, endISO]);

  // Theme colors
  const primary = "#2563EB";
  const grid = "#E5E7EB";
  const subtle = "#6B7280";

  const ariaDateId = "users-analytics-date-label";

  // Handlers
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
          <div
            className="card-actions"
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          >
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

          {/* Charts grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 12,
            }}
          >
            {/* Activity by User */}
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
                      <YAxis
                        tick={{ fill: subtle, fontSize: 12 }}
                        allowDecimals={false}
                      />
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
