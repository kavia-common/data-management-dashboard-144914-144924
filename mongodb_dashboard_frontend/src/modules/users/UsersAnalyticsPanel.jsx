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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useUsers } from "../../hooks/useUsers";
import { getApiClient } from "../../api";
import { getActiveTenant } from "../../utils/tenantClient";
import Skeleton from "../../components/ui/Skeleton";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page, with independent filters.
 * - Projects by User (bar)
 * - Projects by Department (pie/donut)
 * - Projects timeline (daily/weekly activity counts)
 *
 * Optimization notes:
 * - Eliminates per-user fan-out requests on initial render. All charts use aggregated endpoints.
 * - Adds optional on-demand toggle to fetch per-user projects; default is off (no fan-out).
 */
export default function UsersAnalyticsPanel({
  style,
  className,
  defaultDays = 30,
}) {
  // Filter state (independent from Overview)
  const [granularity, setGranularity] = useState("day"); // 'day' | 'week'
  const [days, setDays] = useState(defaultDays);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateLiveLabel, setDateLiveLabel] = useState("");

  // Optional: allow on-demand per-user projects fetch (disabled by default)
  const [enablePerUserDetails, setEnablePerUserDetails] = useState(false);

  // Active tenant
  const activeTenantId = getActiveTenant?.() || null;

  // Date range ISO
  const { startISO, endISO } = useMemo(() => {
    let start;
    let end;
    if (customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
    } else {
      end = new Date();
      end.setHours(23, 59, 59, 999);
      start = new Date();
      start.setDate(end.getDate() - days + 1);
      start.setHours(0, 0, 0, 0);
    }
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, [customStart, customEnd, days]);

  // Accessible live date label
  useEffect(() => {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const fmt = (d) => d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    const label = `${fmt(start)} \u2013 ${fmt(end)} (${granularity === "week" ? "Weekly" : "Daily"})`;
    setDateLiveLabel(label);
  }, [startISO, endISO, granularity]);

  // Fetch users (no change)
  const { users, loading: usersLoading, error: usersError } = useUsers({ limit: 200 });

  // Aggregated: Users usage summary (per user)
  const [usageByUser, setUsageByUser] = useState([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState("");

  // Aggregated: Active users trend timeline
  const [activeTrend, setActiveTrend] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState("");

  // On-demand per-user projects (disabled by default to avoid fan-out)
  const [projectsByUser, setProjectsByUser] = useState({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  // Fetch aggregated per-user usage
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!activeTenantId) {
        setUsageByUser([]);
        return;
      }
      setUsageLoading(true);
      setUsageError("");
      try {
        const api = getApiClient();
        // Use absolute API path to ensure baseClient path normalization and auth header injection
        const res = await api.get(`/api/tenants/${encodeURIComponent(String(activeTenantId))}/users/usage`, {
          params: {},
        });
        const payload = res?.data?.data ?? res?.data ?? [];
        if (!cancelled) {
          // Normalize to { user_id, user, count }
          const normalized = (Array.isArray(payload) ? payload : (payload.items || [])).map((row) => {
            const uid = String(row.user_id || row.userId || row._id || row.id || "");
            const name = row.user_name || row.name || row.email || uid;
            // Use total_projects if provided; otherwise use 0 as default
            const count = Number(row.total_projects ?? row.projects ?? row.project_count ?? 0);
            return { user_id: uid, user: name, count: isNaN(count) ? 0 : count };
          });
          // Sort desc by count
          normalized.sort((a, b) => b.count - a.count);
          setUsageByUser(normalized);
        }
      } catch (e) {
        if (!cancelled) {
          setUsageByUser([]);
          setUsageError(e?.message || "Failed to load users usage summary");
        }
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  // Fetch aggregated active users trend
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setTrendLoading(true);
      setTrendError("");
      try {
        const api = getApiClient();
        const res = await api.get(`/api/analytics/users/active-trend`, {
          params: {
            granularity: granularity === "week" ? "week" : "day",
            from: startISO,
            to: endISO,
          },
        });
        const data = res?.data?.items || res?.data?.datasets?.[0]?.data?.map((v, i) => ({
          date: res?.data?.labels?.[i],
          total: v,
        })) || [];
        const items = Array.isArray(data) ? data : [];
        if (!cancelled) {
          // Map to { bucket, total }
          const mapped = items.map((it) => ({
            bucket: it.date || it.bucket || "",
            total: Number(it.total || 0),
          }));
          setActiveTrend(mapped);
        }
      } catch (e) {
        if (!cancelled) {
          setActiveTrend([]);
          setTrendError(e?.message || "Failed to load active users trend");
        }
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [granularity, startISO, endISO]);

  // Optional on-demand per-user projects, guarded by enablePerUserDetails
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!enablePerUserDetails) {
        setProjectsByUser({});
        setProjectsLoading(false);
        setProjectsError("");
        return;
      }
      if (!Array.isArray(users) || users.length === 0 || !activeTenantId) {
        setProjectsByUser({});
        return;
      }
      setProjectsLoading(true);
      setProjectsError("");
      const api = getApiClient();
      const acc = {};
      try {
        const batchSize = 8;
        for (let i = 0; i < users.length; i += batchSize) {
          const slice = users.slice(i, i + batchSize);
          await Promise.all(
            slice.map(async (u) => {
              if (!u?._id) return;
              try {
                const res = await api.get(`/users/${encodeURIComponent(String(u._id))}/projects`, {
                  params: {
                    organization_id: activeTenantId,
                    from: startISO,
                    to: endISO,
                  },
                });
                const payload = res.data?.data ?? res.data;
                const list = Array.isArray(payload?.projects) ? payload.projects : [];
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
    return () => { cancelled = true; };
  }, [enablePerUserDetails, users, activeTenantId, startISO, endISO]);

  // Aggregations
  const aggregates = useMemo(() => {
    // Projects by User (from aggregated usage as primary)
    const projectsCountByUser = usageByUser.slice(0, 200);

    // Projects by department (from users only, no per-user projects needed by default)
    const projectsByDepartment = new Map();
    const departmentOf = (u) =>
      u?.department || u?.profile?.department || u?.metadata?.department || u?.details?.department || "Unknown";
    for (const u of users || []) {
      const dept = String(departmentOf(u) || "Unknown");
      // approximate department count from presence; if on-demand detail is enabled, sum projects lengths
      const uid = String(u?._id || u?.id || "");
      const projs = projectsByUser[uid];
      const inc = enablePerUserDetails && Array.isArray(projs) ? projs.length : 1;
      projectsByDepartment.set(dept, (projectsByDepartment.get(dept) || 0) + inc);
    }
    const departmentData = Array.from(projectsByDepartment.entries())
      .map(([department, count]) => ({ department, count }))
      .filter((d) => d.department && String(d.department).trim().toLowerCase() !== "unknown");

    // Timeline from aggregated active trend
    const timeline = activeTrend.slice().sort((a, b) => (a.bucket > b.bucket ? 1 : -1));

    return { projectsCountByUser, departmentData, timeline };
  }, [usageByUser, users, projectsByUser, enablePerUserDetails, activeTrend]);

  // Theme colors
  const primary = "#2563EB";
  const secondary = "#F59E0B";
  const grid = "#E5E7EB";
  const subtle = "#6B7280";
  const palette = ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#6366F1", "#14B8A6", "#F97316", "#84CC16", "#06B6D4", "#A855F7"];

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
            <div className="card-subtitle">Projects distribution and timeline</div>
          </div>
          <div className="card-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: subtle }}>Aggregation</span>
              <select
                aria-label="Aggregation granularity"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                className="ui-input"
                style={{ minWidth: 140 }}
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
              </select>
            </label>

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

            <div role="group" aria-label="Custom date range" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="date" aria-label="Start date" className="ui-input" onChange={onCustomStartChange} />
              <span aria-hidden="true" style={{ color: subtle }}>to</span>
              <input type="date" aria-label="End date" className="ui-input" onChange={onCustomEndChange} />
            </div>

            {/* On-demand toggle for per-user detail requests; off by default */}
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
              <input
                type="checkbox"
                checked={enablePerUserDetails}
                onChange={(e) => setEnablePerUserDetails(Boolean(e.target.checked))}
                aria-label="Enable per-user project details (on-demand)"
              />
              <span style={{ fontSize: 12, color: subtle }}>Per-user details (on demand)</span>
            </label>
          </div>
        </div>
        <div className="card-content" style={{ paddingTop: 8 }}>
          <div id={ariaDateId} aria-live="polite" style={{ fontSize: 12, color: subtle, marginBottom: 8 }}>
            {dateLiveLabel}
          </div>

          {/* Charts grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: 12,
            }}
          >
            {/* Projects by User */}
            <div className="card" aria-label="Projects by User">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Projects by User</h4>
                <div className="card-subtitle">Number of projects per user</div>
              </div>
              <div className="card-content" style={{ height: 340 }}>
                {usersLoading || usageLoading ? (
                  <div aria-busy="true">
                    <Skeleton width="60%" height={14} className="mb-2" />
                    <Skeleton width="50%" height={12} className="mb-2" />
                    <Skeleton width="100%" height={300} />
                  </div>
                ) : usersError ? (
                  <div className="error" role="alert">{usersError.message || "Failed to load users"}</div>
                ) : usageError ? (
                  <div className="error" role="alert">{usageError}</div>
                ) : aggregates.projectsCountByUser.length === 0 ? (
                  <div className="screen-center">No project data</div>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={aggregates.projectsCountByUser.slice(0, 20)} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                      <XAxis dataKey="user" tick={{ fill: subtle, fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={50} />
                      <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="Projects" fill={primary} stroke={primary} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Projects by Department */}
            <div className="card" aria-label="Projects by Department">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Projects by Department</h4>
                <div className="card-subtitle">Distribution of projects by department</div>
              </div>
              <div className="card-content" style={{ height: 340 }}>
                {usersLoading ? (
                  <div aria-busy="true">
                    <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 12, width: "50%", marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 260, width: "100%" }} />
                  </div>
                ) : usersError ? (
                  <div className="error" role="alert">{usersError.message || "Failed to load users"}</div>
                ) : aggregates.departmentData.length === 0 ? (
                  <div className="screen-center">No department project data</div>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie
                        data={aggregates.departmentData}
                        dataKey="count"
                        nameKey="department"
                        cx="50%"
                        cy="50%"
                        outerRadius="80%"
                        paddingAngle={2}
                      >
                        {aggregates.departmentData.map((entry, idx) => (
                          <Cell key={entry.department} fill={palette[idx % palette.length]} stroke={palette[idx % palette.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="card" style={{ gridColumn: "1 / span 2" }} aria-label="Projects timeline">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Projects timeline</h4>
                <div className="card-subtitle">User activity over time</div>
              </div>
              <div className="card-content" style={{ height: 320 }}>
                {trendLoading ? (
                  <div aria-busy="true">
                    <Skeleton width="60%" height={14} className="mb-2" />
                    <Skeleton width="50%" height={12} className="mb-2" />
                    <Skeleton width="100%" height={260} />
                  </div>
                ) : trendError ? (
                  <div className="error" role="alert">{trendError}</div>
                ) : aggregates.timeline.length === 0 ? (
                  <div className="screen-center">No timeline data</div>
                ) : (
                  <ResponsiveContainer>
                    <LineChart data={aggregates.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                      <XAxis dataKey="bucket" tick={{ fill: subtle, fontSize: 12 }} />
                      <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Users" stroke={secondary} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* If user explicitly enables per-user detail, show minor info note */}
          {enablePerUserDetails && projectsLoading && (
            <div className="muted" style={{ fontSize: 12, marginTop: 8, color: subtle }}>
              Loading per-user projects on demand…
            </div>
          )}
          {enablePerUserDetails && projectsError && (
            <div className="error" role="alert" style={{ marginTop: 8 }}>{projectsError}</div>
          )}
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
