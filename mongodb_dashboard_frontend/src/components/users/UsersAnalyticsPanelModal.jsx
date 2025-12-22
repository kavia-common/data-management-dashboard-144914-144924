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
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
} from "recharts";

import { listSessions } from "../../api/baseClient";
import { getChartTheme } from "../charts/chartTheme";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanelModal
 * Provides charts for a single user's analytics inside the Users modal.
 * - Sessions over time (from session_breakdown/date fields if available)
 * - Total session duration vs count (aggregate from session_breakdown)
 * - Optional project distribution/activity summary (from session records if available)
 *
 * Props:
 *  - userId: string (required for fetching)
 *  - tenantId: string (optional; scoping is handled by base client too)
 *  - from?: string|Date
 *  - to?: string|Date
 *
 * Behavior:
 * - Lazy fetches when mounted/active.
 * - No pagination; caps to reasonable fetch sizes.
 * - Minimal dependencies (uses recharts already present).
 * - Loading/empty/error states included.
 */
export default function UsersAnalyticsPanelModal({ userId, tenantId, from, to }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sessions, setSessions] = useState([]); // filtered for this user

  const theme = getChartTheme();

  const inRange = (dt) => {
    if (!dt) return true;
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return true;
    const f = from ? new Date(from) : null;
    const t = to ? new Date(to) : null;
    if (f && d < f) return false;
    if (t && d > t) return false;
    return true;
  };

  // Fetch lazily on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setLoading(false);
        setSessions([]);
        return;
      }
      setLoading(true);
      setErr("");
      try {
        const sessResp = await listSessions({ page: 1, limit: 500, sort: "-last_updated" });

        const normalizedUserId = String(userId);

        // Normalize array items from envelopes
        const sessionItems = Array.isArray(sessResp?.items) ? sessResp.items : [];

        const byUserSessions = sessionItems.filter((row) => {
          const uid =
            row?.user_id ??
            row?.userId ??
            row?.user?._id ??
            row?.user?.id ??
            row?.user?.user_id ??
            null;
          // Filter by user and date range
          return uid && String(uid) === normalizedUserId && inRange(row?.last_updated || row?.session_end || row?.session_start || row?.created_at);
        });

        if (!cancelled) {
          setSessions(byUserSessions);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load analytics.");
          setSessions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Aggregate charts data (only those retained)
  const charts = useMemo(() => {
    // 1) Sessions over time (count per day)
    const sessionsByDayMap = new Map();
    (sessions || []).forEach((s) => {
      const when =
        s?.last_updated ||
        s?.session_end ||
        s?.session_start ||
        s?.created_at ||
        s?.updated_at;
      if (!when) return;
      const k = dateKey(when);
      sessionsByDayMap.set(k, (sessionsByDayMap.get(k) || 0) + 1);
    });
    const sessionsOverTime = Array.from(sessionsByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    // 2) Total session duration vs count (aggregate duration from session_breakdown)
    const secondsFromStep = (step) => {
      if (!step || typeof step !== "object") return 0;
      if (Number.isFinite(Number(step.duration_seconds))) return Number(step.duration_seconds);
      if (Number.isFinite(Number(step.duration_sec))) return Number(step.duration_sec);
      if (Number.isFinite(Number(step.duration_ms))) return Number(step.duration_ms) / 1000;
      if (Number.isFinite(Number(step.time_ms))) return Number(step.time_ms) / 1000;
      if (Number.isFinite(Number(step.time_s))) return Number(step.time_s);
      if (Number.isFinite(Number(step.duration))) return Number(step.duration);
      return 0;
    };
    const durVsCountMap = new Map();
    (sessions || []).forEach((s) => {
      const when = s?.last_updated || s?.session_end || s?.session_start || s?.created_at;
      const k = when ? dateKey(when) : "unknown";
      let totalSec = 0;
      const bd = s?.session_breakdown ?? s?.breakdown ?? [];
      if (Array.isArray(bd)) {
        bd.forEach((st) => {
          totalSec += secondsFromStep(st);
        });
      } else if (bd && typeof bd === "object") {
        Object.values(bd).forEach((st) => {
          totalSec += secondsFromStep(st);
        });
      }
      const prev = durVsCountMap.get(k) || { date: k, seconds: 0, count: 0 };
      prev.seconds += totalSec;
      prev.count += 1;
      durVsCountMap.set(k, prev);
    });
    const durationVsCount = Array.from(durVsCountMap.values()).sort((a, b) =>
      a.date > b.date ? 1 : -1
    );

    // 3) Optional project activity summary (deduce projects from sessions)
    const projMap = new Map();
    (sessions || []).forEach((s) => {
      const pid =
        s?.project_id ||
        s?.projectId ||
        s?.session_data?.project_id ||
        s?.project?.id ||
        null;
      if (!pid) return;
      const key = String(pid);
      const last =
        s?.last_updated ||
        s?.session_end ||
        s?.updated_at ||
        s?.created_at ||
        s?.session_start ||
        null;
      const prev = projMap.get(key) || { project_id: key, count: 0, last_activity: null };
      prev.count += 1;
      if (!prev.last_activity || (last && last > prev.last_activity)) {
        prev.last_activity = last;
      }
      projMap.set(key, prev);
    });
    const projectActivity = Array.from(projMap.values()).sort((a, b) =>
      (b.last_activity || "") > (a.last_activity || "") ? 1 : -1
    );

    return {
      sessionsOverTime,
      durationVsCount,
      projectActivity,
    };
  }, [sessions]);

  // Empty overall state
  const allEmpty =
    (!charts.sessionsOverTime || charts.sessionsOverTime.length === 0) &&
    (!charts.durationVsCount || charts.durationVsCount.length === 0) &&
    (!charts.projectActivity || charts.projectActivity.length === 0);

  if (loading) {
    return (
      <div role="status" aria-live="polite" style={{ minHeight: 220, display: 'grid', placeItems: 'center', color:'white' }}>
        Loading analytics…
      </div>
    );
  }
  if (err) {
    return (
      <div>
        <div role="alert" className="error">{err}</div>
        <button
          type="button"
          onClick={() => {
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
    return <div className="screen-center" style={{ minHeight: 120 }}>No analytics available for this user.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Row 1: Sessions over time + Duration vs Count */}
      <div style={{ display: "grid", gap: 12 }}>
        <section
          aria-label="Sessions over time"
          style={{
            background: "var(--bg-surface, #fff)",
            border: "1px solid var(--border-subtle, #e5e7eb)",
            borderRadius: 12,
            boxShadow: "var(--shadow, 0 1px 2px rgba(16,24,40,0.04))",
            padding: 12,
          }}
        >
          <header style={{ marginBottom: 6 }}>
            <h4 style={{ margin: 0 }}>Sessions over time</h4>
            <div style={{ color: "var(--text-secondary,#475569)", fontSize: 12 }}>Daily count</div>
          </header>
          {charts.sessionsOverTime.length === 0 ? (
            <div className="screen-center" style={{ minHeight: 220 }}>No sessions</div>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={charts.sessionsOverTime} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis dataKey="date" tick={{ fill: theme.label }} tickLine={false} axisLine={{ stroke: theme.axisTick }} minTickGap={24} />
                  <YAxis tick={{ fill: theme.label }} tickLine={false} axisLine={{ stroke: theme.axisTick }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ background: theme.tooltip.bg, border: `1px solid ${theme.tooltip.border}`, borderRadius: 8, color: theme.tooltip.text }}
                    formatter={(value) => [value, "Sessions"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="count" fill={theme.primary} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section
          aria-label="Total duration vs count"
          style={{
            background: "var(--bg-surface, #fff)",
            border: "1px solid var(--border-subtle, #e5e7eb)",
            borderRadius: 12,
            boxShadow: "var(--shadow, 0 1px 2px rgba(16,24,40,0.04))",
            padding: 12,
          }}
        >
          <header style={{ marginBottom: 6 }}>
            <h4 style={{ margin: 0 }}>Total duration vs count</h4>
            <div style={{ color: "var(--text-secondary,#475569)", fontSize: 12 }}>Seconds aggregated per day vs number of sessions</div>
          </header>
          {charts.durationVsCount.length === 0 ? (
            <div className="screen-center" style={{ minHeight: 220 }}>No session duration</div>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <AreaChart data={charts.durationVsCount} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis dataKey="date" tick={{ fill: theme.label }} />
                  <YAxis tick={{ fill: theme.label }} />
                  <Tooltip
                    contentStyle={{ background: theme.tooltip.bg, border: `1px solid ${theme.tooltip.border}`, borderRadius: 8, color: theme.tooltip.text }}
                    formatter={(v, name) =>
                      name === "seconds"
                        ? [`${Number(v).toFixed(0)} sec`, "Total Duration"]
                        : [v, "Count"]
                    }
                  />
                  <Legend />
                  <Area type="monotone" dataKey="seconds" name="Total Duration (sec)" stroke={theme.primaryHover} fill={theme.primaryHover} fillOpacity={0.25} />
                  <Area type="monotone" dataKey="count" name="Sessions" stroke={theme.primaryActive} fill={theme.primaryActive} fillOpacity={0.18} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Row 2: Project activity summary */}
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
          <div style={{ color: "var(--text-secondary,#475569)", fontSize: 12 }}>Distinct projects with last activity</div>
        </header>
        {charts.projectActivity.length === 0 ? (
          <div className="screen-center" style={{ minHeight: 120 }}>No project activity</div>
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
                <YAxis dataKey="count" name="Count" tick={{ fill: theme.label }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter
                  data={charts.projectActivity.map((p) => ({
                    last_activity: new Date(p.last_activity).getTime() || 0,
                    count: p.count,
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
