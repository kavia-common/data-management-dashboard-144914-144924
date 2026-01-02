import React, { useEffect, useMemo, useRef, useState } from "react";
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
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
} from "recharts";

import { getUserProjects } from "../../api/users";
import { getChartTheme } from "../charts/chartTheme";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanelModal
 * Provides analytics for a single user inside the Users modal.
 *
 * IMPORTANT (bugfix/requirements):
 * - Must NOT call /api/session-tracking from this panel.
 * - Must use GET /api/users/:userId/projects with:
 *   - organization_id (tenant scope)
 *   - from/to (range)
 * - All counts/charts must derive from the FILTERED projects response (selected range only).
 */
export default function UsersAnalyticsPanelModal({ userId, tenantId, from, to }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [projectsResponse, setProjectsResponse] = useState(null);

  const theme = getChartTheme();

  // Guard against out-of-order responses when quickly changing range
  const requestSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId || !tenantId) {
        setProjectsResponse(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErr("");

      const seq = ++requestSeq.current;

      try {
        const res = await getUserProjects(String(userId), {
          organization_id: String(tenantId),
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
        });

        if (cancelled || seq !== requestSeq.current) return;
        setProjectsResponse(res || null);
      } catch (e) {
        if (cancelled || seq !== requestSeq.current) return;
        setErr(e?.message || "Failed to load analytics.");
        setProjectsResponse(null);
      } finally {
        if (!cancelled && seq === requestSeq.current) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, tenantId, String(from || ""), String(to || "")]);

  const dateKey = (d) => {
    try {
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const da = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${da}`;
    } catch {
      return String(d || "");
    }
  };

  const charts = useMemo(() => {
    const projects = Array.isArray(projectsResponse?.projects) ? projectsResponse.projects : [];

    // 1) Projects over time (count of distinct projects by last_activity day)
    const projectsByDayMap = new Map();
    projects.forEach((p) => {
      const when = p?.last_activity || p?.updated_at || p?.created_at || null;
      if (!when) return;
      const k = dateKey(when);
      projectsByDayMap.set(k, (projectsByDayMap.get(k) || 0) + 1);
    });

    const projectsOverTime = Array.from(projectsByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    // 2) Total distinct projects (single point shown as an area series)
    const totalProjects = projects.length;
    const totalSeries = projectsOverTime.length
      ? projectsOverTime.map((row) => ({ date: row.date, total: totalProjects }))
      : [{ date: "range", total: totalProjects }];

    // 3) Project activity scatter (x=last_activity, y=index)
    const projectActivity = projects
      .map((p) => ({
        project_id: String(p?.project_id ?? p?.projectId ?? ""),
        last_activity: p?.last_activity ?? null,
      }))
      .filter((p) => p.project_id);

    return {
      projects,
      projectsOverTime,
      totalSeries,
      projectActivity,
    };
  }, [projectsResponse]);

  const allEmpty =
    (!charts.projects || charts.projects.length === 0) &&
    (!charts.projectsOverTime || charts.projectsOverTime.length === 0) &&
    (!charts.projectActivity || charts.projectActivity.length === 0);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ minHeight: 220, display: "grid", placeItems: "center", color: "white" }}
      >
        Loading analytics…
      </div>
    );
  }
  if (err) {
    return (
      <div>
        <div role="alert" className="error">
          {err}
        </div>
        <button
          type="button"
          onClick={() => {
            // trigger effect reload by resetting error/loading briefly
            setLoading(true);
            setErr("");
            setTimeout(() => setLoading(false), 0);
          }}
          className="btn btn-ghost"
        >
          Retry
        </button>
      </div>
    );
  }
  if (allEmpty) {
    return (
      <div className="screen-center" style={{ minHeight: 120 }}>
        No analytics available for this user in the selected range.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Row 1: Projects over time + Total projects */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
        <section
          aria-label="Projects over time"
          style={{
            background: "var(--bg-surface, #fff)",
            border: "1px solid var(--border-subtle, #e5e7eb)",
            borderRadius: 12,
            boxShadow: "var(--shadow, 0 1px 2px rgba(16,24,40,0.04))",
            padding: 12,
          }}
        >
          <header style={{ marginBottom: 6 }}>
            <h4 style={{ margin: 0 }}>Projects over time</h4>
            <div style={{ color: "var(--text-secondary,#475569)", fontSize: 12 }}>
              Distinct projects with activity per day (filtered)
            </div>
          </header>
          {charts.projectsOverTime.length === 0 ? (
            <div className="screen-center" style={{ minHeight: 220 }}>
              No project activity
            </div>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={charts.projectsOverTime} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: theme.label }}
                    tickLine={false}
                    axisLine={{ stroke: theme.axisTick }}
                    minTickGap={24}
                  />
                  <YAxis tick={{ fill: theme.label }} tickLine={false} axisLine={{ stroke: theme.axisTick }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      background: theme.tooltip.bg,
                      border: `1px solid ${theme.tooltip.border}`,
                      borderRadius: 8,
                      color: theme.tooltip.text,
                    }}
                    formatter={(value) => [value, "Projects"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="count" fill={theme.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section
          aria-label="Total projects in range"
          style={{
            background: "var(--bg-surface, #fff)",
            border: "1px solid var(--border-subtle, #e5e7eb)",
            borderRadius: 12,
            boxShadow: "var(--shadow, 0 1px 2px rgba(16,24,40,0.04))",
            padding: 12,
          }}
        >
          <header style={{ marginBottom: 6 }}>
            <h4 style={{ margin: 0 }}>Total projects (range)</h4>
            <div style={{ color: "var(--text-secondary,#475569)", fontSize: 12 }}>
              Count of distinct projects returned by filtered API
            </div>
          </header>

          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={charts.totalSeries} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis dataKey="date" tick={{ fill: theme.label }} />
                <YAxis tick={{ fill: theme.label }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: theme.tooltip.bg,
                    border: `1px solid ${theme.tooltip.border}`,
                    borderRadius: 8,
                    color: theme.tooltip.text,
                  }}
                  formatter={(v) => [v, "Projects in range"]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Projects in range"
                  stroke={theme.primaryActive}
                  fill={theme.primaryActive}
                  fillOpacity={0.18}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Row 2: Project activity scatter */}
      <section
        aria-label="Project activity summary"
        style={{
          background: "var(--bg-surface, #fff)",
          border: "1px solid var(--border-subtle, #e5e7eb)",
          borderRadius: 12,
          boxShadow: "var(--shadow, 0 1px 2px rgba(16,24,40,0.04))",
          padding: 12,
        }}
      >
        <header style={{ marginBottom: 6 }}>
          <h4 style={{ margin: 0 }}>Project activity</h4>
          <div style={{ color: "var(--text-secondary,#475569)", fontSize: 12 }}>
            Distinct projects with last activity (filtered)
          </div>
        </header>

        {charts.projectActivity.length === 0 ? (
          <div className="screen-center" style={{ minHeight: 120 }}>
            No project activity
          </div>
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis
                  dataKey="last_activity"
                  name="Last activity"
                  tick={{ fill: theme.label }}
                  tickFormatter={(v) => {
                    try {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    } catch {
                      return String(v);
                    }
                  }}
                />
                <YAxis
                  dataKey="idx"
                  name="Project"
                  tick={{ fill: theme.label }}
                  tickFormatter={() => ""}
                  width={24}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(v, name, item) => {
                    if (name === "idx") return null;
                    return [v, name];
                  }}
                  labelFormatter={() => ""}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload || {};
                    return (
                      <div
                        style={{
                          background: theme.tooltip.bg,
                          border: `1px solid ${theme.tooltip.border}`,
                          borderRadius: 8,
                          padding: 10,
                          color: theme.tooltip.text,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Project</div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ opacity: 0.85 }}>ID:</span>
                          <span style={{ fontWeight: 600 }}>{p.project_id}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <span style={{ opacity: 0.85 }}>Last activity:</span>
                          <span style={{ fontWeight: 600 }}>
                            {p.last_activity ? new Date(p.last_activity).toLocaleString() : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={charts.projectActivity.map((p, idx) => ({
                    idx: idx + 1,
                    last_activity: p.last_activity ? new Date(p.last_activity).getTime() : 0,
                    project_id: p.project_id,
                  }))}
                  name="Projects"
                  fill={theme.primaryActive}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

UsersAnalyticsPanelModal.propTypes = {
  userId: PropTypes.string,
  tenantId: PropTypes.string,
  from: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  to: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
};
