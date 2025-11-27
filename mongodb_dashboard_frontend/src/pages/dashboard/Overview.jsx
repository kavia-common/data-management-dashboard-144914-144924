import React, { useEffect, useMemo, useState, useCallback } from "react";
import Card from "../../components/ui/Card.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import { listUsers, listSessions, listDeployments, health } from "../../api";
import LoadingState from "../../components/common/LoadingState";
import ErrorState from "../../components/common/ErrorState";
import KPIChart from "../../components/charts/KPIChart.jsx";
import TimeBucketFilter from "../../components/common/TimeBucketFilter.jsx";
import { getActiveUsersTrend } from "../../api/usersActiveTrend";
import OverviewFeatureCharts from "../../components/overview/OverviewFeatureCharts.jsx";

/**
 * Utility functions to bucket timestamps by day/week and compute counts.
 * We normalize dates to YYYY-MM-DD for day buckets and ISO week start for weekly buckets.
 * These mirror utils/sessions/bucketing.js to avoid cross-import churn in this page.
 */
function toYMD(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

/**
 * Compute ISO start/end based on a range key and optional custom date inputs.
 */
function computeRange(rangeKey, customRange) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(end);
  if (rangeKey === "7d") start.setDate(end.getDate() - 6);
  else if (rangeKey === "14d") start.setDate(end.getDate() - 13);
  else if (rangeKey === "30d") start.setDate(end.getDate() - 29);
  else if (rangeKey === "custom" && customRange.start && customRange.end) {
    const s = new Date(customRange.start);
    const e = new Date(customRange.end);
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    return { startISO: s.toISOString(), endISO: e.toISOString() };
  } else {
    start.setDate(end.getDate() - 29);
  }
  start.setHours(0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/**
 * PUBLIC_INTERFACE
 * Overview
 */
export default function Overview() {
  /** Overview page with KPIs and three trend charts (Sessions, Users, Costs). */
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ users: 0, sessions: 0, deployments: 0 });
  const [error, setError] = useState("");
  const [, setApiStatus] = useState("checking");

  // Sessions controls (independent)
  const [sessionsRangeKey, setSessionsRangeKey] = useState("30d"); // default last 30 days
  const [sessionsCustomRange, setSessionsCustomRange] = useState({ start: null, end: null });
  // Support daily/weekly/monthly via dropdown; backend expects day|week|month, internal mapping below
  const [sessionsGranularity, setSessionsGranularity] = useState("daily"); // 'daily' | 'weekly' | 'monthly'

  // Users controls (independent)
  const [usersRangeKey, setUsersRangeKey] = useState("30d");
  const [usersCustomRange, setUsersCustomRange] = useState({ start: null, end: null });
  const [usersGranularity, setUsersGranularity] = useState("daily");
  const [usersStatus, setUsersStatus] = useState("active"); // 'active' | 'all'

  // Sessions chart state
  const [sessionsSeries, setSessionsSeries] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);

  // Users chart state
  const [usersSeries, setUsersSeries] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);

  // KPI metrics
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [users, sessions, deployments] = await Promise.all([
          listUsers({ limit: 5 }),
          listSessions({ limit: 5 }),
          listDeployments({ limit: 5 }),
        ]);
        setMetrics({
          users: users?.total || users?.length || 0,
          sessions: sessions?.total || sessions?.length || 0,
          deployments: deployments?.total || deployments?.length || 0,
        });
      } catch (e) {
        setError(e?.response?.data?.message || e?.message || "Failed to load overview data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Backend health check (non-blocking)
  useEffect(() => {
    let mounted = true;
    async function ping() {
      try {
        const info = await health();
        if (!mounted) return;
        setApiStatus(info ? "ok" : "error");
      } catch {
        if (!mounted) return;
        setApiStatus("error");
      }
    }
    ping();
    return () => {
      mounted = false;
    };
  }, []);

  // Helper to fill continuous daily/weekly series from a Map
  const fillSeries = useCallback(function fillSeries(map, start, end, bucket = "daily") {
    const s = new Date(start);
    const e = new Date(end);
    const series = [];
    if (bucket === "weekly") {
      let c = startOfWeek(s);
      while (c <= e) {
        const key = toYMD(c);
        series.push({ label: key, value: map.get(key) || 0 });
        c = new Date(c);
        c.setDate(c.getDate() + 7);
      }
    } else if (bucket === "monthly") {
      let c = startOfMonth(s);
      while (c <= e) {
        const key = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}-01`;
        series.push({ label: key, value: map.get(key) || 0 });
        c = new Date(c);
        c.setMonth(c.getMonth() + 1, 1);
      }
    } else {
      let c = new Date(s);
      c.setHours(0, 0, 0, 0);
      while (c <= e) {
        const key = toYMD(c);
        series.push({ label: key, value: map.get(key) || 0 });
        c = new Date(c);
        c.setDate(c.getDate() + 1);
      }
    }
    return series;
  }, []);

  // Derived ISO ranges for each chart
  const sessionsRange = useMemo(
    () => computeRange(sessionsRangeKey, sessionsCustomRange),
    [sessionsRangeKey, sessionsCustomRange.start, sessionsCustomRange.end]
  );
  const usersRange = useMemo(
    () => computeRange(usersRangeKey, usersCustomRange),
    [usersRangeKey, usersCustomRange.start, usersCustomRange.end]
  );


  // Sessions trend: fetch session-tracking and aggregate client-side by day/week/month
  useEffect(() => {
    let aborted = false;

    async function loadSessions() {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const { startISO, endISO } = sessionsRange;

        // Pull a relatively high limit to get a meaningful trend without pagination loops.
        // Stay within helper/API capabilities
        const params = {
          page: 1,
          limit: 500,
          sort: '-last_updated,-session_start,-createdAt,-timestamp',
          // tenant_id is applied by base client from auth/session when present; we can pass through if needed.
        };

        // Prefer the base listSessions if available; otherwise use fetchSessionTracking helper
        let items = [];
        try {
          const res = await listSessions(params);
          items = res?.items || (Array.isArray(res) ? res : res?.data) || [];
        } catch (e) {
          try {
            // Fallback to direct session-tracking client if base listSessions shape differs
            const mod = await import('../../api/sessionTracking');
            const alt = await mod.fetchSessionTracking(params);
            items = alt?.items || [];
          } catch (e2) {
            throw e;
          }
        }

        // Map each item to a timestamp with priority:
        // session_start, then last_updated, then timestamp/createdAt fallback
        const timestamps = [];
        (items || []).forEach((it) => {
          const t =
            it.session_start ||
            it.sessionStart ||
            it.last_updated ||
            it.lastUpdated ||
            it.timestamp ||
            it.createdAt ||
            it.created_at ||
            it.start_time ||
            it.started_at;
          if (!t) return;
          const d = new Date(t);
          if (Number.isNaN(d.getTime())) return;
          // Only include those within the selected range (when set)
          if (startISO && endISO) {
            const ds = new Date(startISO).getTime();
            const de = new Date(endISO).getTime();
            const tt = d.getTime();
            if (tt < ds || tt > de) {
              // skip out-of-range for trend integrity
            } else {
              timestamps.push(d);
            }
          } else {
            timestamps.push(d);
          }
        });

        // Aggregate by bucket including monthly
        const map = new Map();
        const s = new Date(startISO);
        const e = new Date(endISO);

        if (sessionsGranularity === 'weekly') {
          timestamps.forEach((t) => {
            const wk = toYMD(startOfWeek(t));
            map.set(wk, (map.get(wk) || 0) + 1);
          });
        } else if (sessionsGranularity === 'monthly') {
          timestamps.forEach((t) => {
            const mStart = startOfMonth(t);
            const key = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}-01`;
            map.set(key, (map.get(key) || 0) + 1);
          });
        } else {
          timestamps.forEach((t) => {
            const key = toYMD(t);
            map.set(key, (map.get(key) || 0) + 1);
          });
        }

        const series = fillSeries(map, s, e, sessionsGranularity);
        if (!aborted) {
          setSessionsSeries(series);
        }
      } catch (e) {
        if (!aborted) {
          setSessionsError(e);
          setSessionsSeries([]);
        }
      } finally {
        if (!aborted) setSessionsLoading(false);
      }
    }

    if (sessionsRange.startISO && sessionsRange.endISO) {
      loadSessions();
    }
    return () => {
      aborted = true;
    };
  }, [sessionsRange.startISO, sessionsRange.endISO, sessionsGranularity, fillSeries]);

  // Users trend fetcher — independent
  useEffect(() => {
    let aborted = false;
    async function loadUsers() {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const { startISO, endISO } = usersRange;
        const backendGranularity = usersGranularity === "weekly" ? "week" : "day";
        const statusParam = usersStatus === "active" ? "completed|active" : undefined;

        let items = [];
        let backendOk = false;
        try {
          const resp = await getActiveUsersTrend({
            from: startISO,
            to: endISO,
            granularity: backendGranularity,
            status: statusParam,
          });
          items = Array.isArray(resp?.items) ? resp.items : [];
          backendOk = items.length > 0 || Array.isArray(resp?.items);
        } catch {
          backendOk = false;
        }

        if (!backendOk) {
          // Fallback: derive from users collection using created_at for bucketing plus status filter
          const createdFilter = {
            $and: [
              {
                $or: [
                  { created_at: { $gte: startISO, $lte: endISO } },
                  { createdAt: { $gte: startISO, $lte: endISO } },
                ],
              },
              // status filter: if 'active' exclude deleted; if 'all' do not filter
              ...(usersStatus === "active"
                ? [{ $or: [{ status: { $exists: false } }, { status: { $nin: ["deleted", "inactive"] } }] }]
                : []),
            ],
          };

          const usersRes = await listUsers({
            // Directly stringify the filter; listUsers will sanitize endpoint-specific params
            filter: JSON.stringify(createdFilter),
            limit: 2000,
            sort: "-created_at",
          });

          const users = usersRes?.items || (Array.isArray(usersRes) ? usersRes : []);
          const bucketUsers = new Map();
          users.forEach((u) => {
            const t = u.created_at || u.createdAt || u.date;
            const d = t ? new Date(t) : null;
            if (!d || Number.isNaN(d.getTime())) return;
            const key = usersGranularity === "weekly" ? toYMD(startOfWeek(d)) : toYMD(d);
            const uid = String(u._id ?? u.id ?? u.user_id ?? u.userId ?? u.email ?? "");
            if (!uid) return;
            if (!bucketUsers.has(key)) bucketUsers.set(key, new Set());
            bucketUsers.get(key).add(uid);
          });

          items = Array.from(bucketUsers.entries()).map(([date, set]) => ({
            date,
            total: (set && set.size) || 0,
          }));
        }

        if (aborted) return;

        const map = new Map();
        (items || []).forEach((row) => {
          const label = row.date || row.label || row.day || row.week;
          const total = Number(row.total ?? row.count ?? row.value ?? 0);
          if (!label) return;
          map.set(String(label), (map.get(String(label)) || 0) + (Number.isFinite(total) ? total : 0));
        });

        const series = fillSeries(map, usersRange.startISO, usersRange.endISO, usersGranularity);
        setUsersSeries(series);
      } catch (e) {
        if (aborted) return;
        setUsersError(e);
        setUsersSeries([]);
      } finally {
        if (!aborted) setUsersLoading(false);
      }
    }
    if (usersRange.startISO && usersRange.endISO) loadUsers();
    return () => {
      aborted = true;
    };
  }, [usersRange.startISO, usersRange.endISO, usersGranularity, usersStatus, fillSeries]);



  // Reusable controls renderers (per-chart)
  const renderDateRangeLabel = useCallback((rangeKey, customRange, range) => {
    if (rangeKey === "custom") {
      const opts = { year: "numeric", month: "short", day: "numeric" };
      const hasStart = Boolean(customRange.start);
      const hasEnd = Boolean(customRange.end);
      const fmtStart = hasStart ? new Date(customRange.start).toLocaleDateString(undefined, opts) : null;
      const fmtEnd = hasEnd ? new Date(customRange.end).toLocaleDateString(undefined, opts) : null;
      if (hasStart && hasEnd) return `Filtered: ${fmtStart} — ${fmtEnd}`;
      if (hasStart) return `From ${fmtStart}`;
      if (hasEnd) return `Until ${fmtEnd}`;
      return "";
    }
    if (!range?.startISO || !range?.endISO) return "";
    const start = new Date(range.startISO);
    const end = new Date(range.endISO);
    const opts = { year: "numeric", month: "short", day: "numeric" };
    return `Filtered: ${start.toLocaleDateString(undefined, opts)} — ${end.toLocaleDateString(undefined, opts)}`;
  }, []);

  const DateRangePill = ({ label }) => (
    <span
      aria-live="polite"
      aria-atomic="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 12,
        color: "#1F2937",
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );

  // Per-chart time range selectors and bucket toggles
  const SessionsControls = (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 4 }}>
        {["7d", "14d", "30d", "custom"].map((key) => (
          <button
            key={key}
            onClick={() => setSessionsRangeKey(key)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "none",
              background: sessionsRangeKey === key ? "#2563EB" : "transparent",
              color: sessionsRangeKey === key ? "#fff" : "#111827",
              cursor: "pointer",
              transition: "background 120ms ease, color 120ms ease",
            }}
            aria-pressed={sessionsRangeKey === key}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>
      <DateRangePill label={renderDateRangeLabel(sessionsRangeKey, sessionsCustomRange, sessionsRange)} />
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <label htmlFor="sessions-granularity" style={{ fontSize: 12, color: "#6B7280" }}>
          Granularity
        </label>
        <select
          id="sessions-granularity"
          value={sessionsGranularity}
          onChange={(e) => setSessionsGranularity(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #E5E7EB",
            background: "#fff",
            color: "#111827",
          }}
          aria-label="Sessions granularity"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => {
          setSessionsRangeKey("7d");
          setSessionsCustomRange({ start: null, end: null });
          setSessionsGranularity("daily");
        }}
        className="btn btn-ghost"
        aria-label="Clear sessions filters"
        style={{ marginLeft: 8 }}
      >
        Clear
      </button>
    </div>
  );

  const UsersControls = (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 4 }}>
        {["7d", "14d", "30d", "custom"].map((key) => (
          <button
            key={key}
            onClick={() => setUsersRangeKey(key)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "none",
              background: usersRangeKey === key ? "#2563EB" : "transparent",
              color: usersRangeKey === key ? "#fff" : "#111827",
              cursor: "pointer",
              transition: "background 120ms ease, color 120ms ease",
            }}
            aria-pressed={usersRangeKey === key}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>
      <DateRangePill label={renderDateRangeLabel(usersRangeKey, usersCustomRange, usersRange)} />
      <TimeBucketFilter
        value={usersGranularity}
        onChange={(v) => setUsersGranularity(v === "monthly" ? "weekly" : v)}
        options={[
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ]}
      />
      <div style={{ marginLeft: "auto", display: "inline-flex", gap: 8, alignItems: "center" }}>
        <label htmlFor="users-status-filter" style={{ fontSize: 12, color: "#6B7280" }}>
          Status
        </label>
        <div
          id="users-status-filter"
          role="group"
          aria-label="Users status filter"
          style={{ display: "inline-flex", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", background: "#fff" }}
        >
          {[
            { key: "active", label: "Active" },
            { key: "all", label: "All" },
          ].map((opt, idx) => {
            const active = usersStatus === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setUsersStatus(opt.key)}
                aria-pressed={active}
                style={{
                  padding: "6px 10px",
                  border: "none",
                  background: active ? "#0EA5E9" : "transparent",
                  color: active ? "#fff" : "#111827",
                  borderRight: idx === 0 ? "1px solid #E5E7EB" : "none",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setUsersRangeKey("7d");
          setUsersCustomRange({ start: null, end: null });
          setUsersGranularity("daily");
          setUsersStatus("active");
        }}
        className="btn btn-ghost"
        aria-label="Clear users filters"
        style={{ marginLeft: 8 }}
      >
        Clear
      </button>
    </div>
  );



  return (
    <div className="grid">
      {/* KPI cards row */}
      <Card title="Users" subtitle="Total referral users" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? (
              <Skeleton width={72} height={28} aria-label="Loading users metric" />
            ) : (
              metrics.users
            )}
          </div>
          <div className="kpi-label">Users</div>
        </div>
      </Card>

      <Card title="Sessions" subtitle="Active and historical sessions" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? (
              <Skeleton width={72} height={28} aria-label="Loading sessions metric" />
            ) : (
              metrics.sessions
            )}
          </div>
          <div className="kpi-label">Sessions</div>
        </div>
      </Card>

      <Card title="Deployments" subtitle="Recent app deployments" className="kpi-card">
        <div className="kpi">
          <div className="kpi-value">
            {loading ? (
              <Skeleton width={72} height={28} aria-label="Loading deployments metric" />
            ) : (
              metrics.deployments
            )}
          </div>
          <div className="kpi-label">Deployments</div>
        </div>
      </Card>

      {/* Sessions Trend */}
      <div className="block-full" style={{ gridColumn: "1 / -1" }}>
        <Card
          title="Sessions Trend"
          subtitle="Session counts over time (Daily/Weekly/Monthly)"
          actions={SessionsControls}
        >
          {sessionsRangeKey === "custom" || sessionsGranularity === "custom" ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "#6B7280" }}>
                  Start:
                  <input
                    type="date"
                    onChange={(e) => setSessionsCustomRange((r) => ({ ...r, start: e.target.value }))}
                    value={sessionsCustomRange.start || ""}
                    style={{ marginLeft: 6 }}
                    aria-label="Sessions custom range start date"
                  />
                </label>
                <label style={{ fontSize: 12, color: "#6B7280" }}>
                  End:
                  <input
                    type="date"
                    onChange={(e) => setSessionsCustomRange((r) => ({ ...r, end: e.target.value }))}
                    value={sessionsCustomRange.end || ""}
                    style={{ marginLeft: 6 }}
                    aria-label="Sessions custom range end date"
                  />
                </label>
              </div>
            </div>
          ) : (
            (sessionsRangeKey === "custom" || sessionsGranularity === "custom") && (!sessionsCustomRange.start || !sessionsCustomRange.end) ? (
              <div style={{ marginBottom: 8, color: "#6B7280", fontSize: 12 }}>
                Select start and end dates to apply custom range.
              </div>
            ) : null
          )}
          {sessionsLoading && <LoadingState message="Loading sessions trend…" height={220} />}
          {sessionsError && <ErrorState message={sessionsError?.message || "Failed to load sessions."} />}
          {!sessionsLoading && !sessionsError && (
            <KPIChart data={sessionsSeries} xKey="label" yKey="value" color="#2563EB" />
          )}
        </Card>
      </div>

      {/* Users Trend */}
      <div className="block-full" style={{ gridColumn: "1 / -1" }}>
        <Card
          title="Users over time"
          subtitle="Distinct active users by day/week"
          actions={UsersControls}
        >
          {usersRangeKey === "custom" ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "#6B7280" }}>
                  Start:
                  <input
                    type="date"
                    onChange={(e) => setUsersCustomRange((r) => ({ ...r, start: e.target.value }))}
                    value={usersCustomRange.start || ""}
                    style={{ marginLeft: 6 }}
                    aria-label="Users custom range start date"
                  />
                </label>
                <label style={{ fontSize: 12, color: "#6B7280" }}>
                  End:
                  <input
                    type="date"
                    onChange={(e) => setUsersCustomRange((r) => ({ ...r, end: e.target.value }))}
                    value={usersCustomRange.end || ""}
                    style={{ marginLeft: 6 }}
                    aria-label="Users custom range end date"
                  />
                </label>
              </div>
            </div>
          ) : (
            usersRangeKey === "custom" && (!usersCustomRange.start || !usersCustomRange.end) ? (
              <div style={{ marginBottom: 8, color: "#6B7280", fontSize: 12 }}>
                Select start and end dates to apply custom range.
              </div>
            ) : null
          )}
          {usersLoading && <LoadingState message="Loading users trend…" height={220} />}
          {usersError && <ErrorState message={usersError?.message || "Failed to load users trend."} />}
          {!usersLoading && !usersError && (
            <KPIChart data={usersSeries} xKey="label" yKey="value" color="#0EA5E9" />
          )}
        </Card>
      </div>

      {/* Overall Feature Charts (by service_type) */}
      <div className="block-full" style={{ gridColumn: "1 / -1" }}>
        <OverviewFeatureCharts
          from={sessionsRange.startISO}
          to={sessionsRange.endISO}
          defaultView="bar"
        />
      </div>

      {error && (
        <div className="block-full" role="alert" style={{ alignSelf: "start" }}>
          <div className="error">{error}</div>
        </div>
      )}
    </div>
  );
}
