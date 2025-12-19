import React, { useEffect, useMemo, useState } from "react";
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

  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useUsers } from "../../hooks/useUsers";
import { getActiveTenant } from "../../utils/tenantClient";
import Skeleton from "../../components/ui/Skeleton";
import useUserProjects from "../../hooks/useUserProjects";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page, with independent filters.
 * - Projects by User (bar)
 * - Projects by Department (pie/donut)
 *
 * Data source:
 * - Reuses /api/users to get users, then uses a single call to /api/session-tracking
 *   scoped by tenant and date range to derive per-user projects map. This avoids
 *   N parallel requests to /api/users/:userId/projects and guarantees a single call.
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
  // Aggregation removed: charts render unbucketed timeline based on raw activity dates
  const [days, setDays] = useState(defaultDays);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateLiveLabel, setDateLiveLabel] = useState("");

  // Active tenant (scoped by client too, but visible here for explicit query params when needed)
  const activeTenantId = getActiveTenant?.() || null;

  // Compute date range ISO strings; end is set to 23:59:59.999
  const { startISO, endISO } = useMemo(() => {
    let start;
    let end;
    if (customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
    } else {
      end = new Date();
      // end to end-of-day
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

  // Centralized projects load: single request to session-tracking to derive user->projects map,
  // avoiding N requests to /api/users/:id/projects. This preserves functionality while
  // enforcing a single network call per (tenant, range).
  const [projectsByUser, setProjectsByUser] = useState({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadOnce() {
      if (!activeTenantId) {
        setProjectsByUser({});
        return;
      }
      setProjectsLoading(true);
      setProjectsError("");
      try {
        // Use sessions root list with a reasonable cap; server normalizes envelope.
        // We only need user_id, project_id, and timestamps to compute last activity.
        const url = "/api/session-tracking";
        const params = {
          page: 1,
          limit: 1000, // cap; analytics panel is a summary view
          sort: "-last_updated",
          tenant_id: activeTenantId,
          from: startISO,
          to: endISO,
        };
        const { getApiClient } = await import("../../api/baseClient");
        const api = getApiClient();
        const res = await api.get(url, { params });
        const payload = res?.data;
        const items = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
          ? payload
          : [];

        const acc = {};
        for (const s of items) {
          const uid =
            s?.user_id ??
            s?.userId ??
            s?.user?._id ??
            s?.user?.id ??
            s?.user?.user_id ??
            null;
          const pid =
            s?.project_id ||
            s?.projectId ||
            s?.session_data?.project_id ||
            s?.project?.id ||
            null;
          if (!uid || !pid) continue;
          const key = String(uid);
          const projKey = String(pid);
          if (!acc[key]) acc[key] = new Map();
          const when =
            s?.last_updated ||
            s?.session_end ||
            s?.updated_at ||
            s?.timestamp ||
            s?.session_start ||
            null;
          const prev = acc[key].get(projKey);
          if (!prev) {
            acc[key].set(projKey, { project_id: projKey, last_activity: when || null });
          } else {
            // keep most recent
            if (when && (!prev.last_activity || when > prev.last_activity)) {
              prev.last_activity = when;
            }
          }
        }
        const out = {};
        Object.keys(acc).forEach((k) => {
          out[k] = Array.from(acc[k].values());
        });
        if (!cancelled) setProjectsByUser(out);
      } catch (e) {
        if (!cancelled) {
          setProjectsError(e?.message || "Failed to load user projects.");
          setProjectsByUser({});
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }
    // Load only when users list is present to constrain scope for rendering
    if (Array.isArray(users)) {
      loadOnce();
    }
    return () => {
      cancelled = true;
    };
  }, [users, activeTenantId, startISO, endISO]);

  // Aggregations
  const aggregates = useMemo(() => {
    // Projects by user count
    const projectsCountByUser = [];
    // Projects by department (from users)
    const projectsByDepartment = new Map();

    const departmentOf = (u) =>
      u?.department ||
      u?.profile?.department ||
      u?.metadata?.department ||
      u?.details?.department ||
      "Unknown";

    // Iterate users
    for (const u of users || []) {
      const uid = String(u?._id || u?.id || "");
      const dept = String(departmentOf(u) || "Unknown");
      const projs = projectsByUser[uid];

      if (Array.isArray(projs)) {
        // Projects by User count
        projectsCountByUser.push({
          user: u?.name || u?.full_name || u?.email || uid,
          user_id: uid,
          count: projs.length,
        });

        // Department contribution: number of projects for user's department
        const prev = projectsByDepartment.get(dept) || 0;
        projectsByDepartment.set(dept, prev + projs.length);
      } else {
        // No project list; fall back to user presence (count 0 projects)
        projectsCountByUser.push({
          user: u?.name || u?.full_name || u?.email || uid,
          user_id: uid,
          count: 0,
        });
        const prev = projectsByDepartment.get(dept) || 0;
        projectsByDepartment.set(dept, prev);
      }
    }

    // Normalize department pie data
    const departmentData = Array.from(projectsByDepartment.entries())
      .map(([department, count]) => ({ department, count }))
      .filter(
        (d) =>
          d.department &&
          String(d.department).trim().toLowerCase() !== "unknown"
      );

    // Sort projectsCountByUser desc
    projectsCountByUser.sort((a, b) => b.count - a.count);

    return { projectsCountByUser, departmentData };
  }, [users, projectsByUser, startISO, endISO]);

  // Theme colors
  const primary = "#2563EB";
  const grid = "#E5E7EB";
  const subtle = "#6B7280";
  const palette = [
    "#2563EB",
    "#F59E0B",
    "#10B981",
    "#EF4444",
    "#6366F1",
    "#14B8A6",
    "#F97316",
    "#84CC16",
    "#06B6D4",
    "#A855F7",
  ];

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
            {/* Projects by User */}
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
