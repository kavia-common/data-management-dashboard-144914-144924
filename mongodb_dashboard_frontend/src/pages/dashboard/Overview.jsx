import React, { useEffect, useMemo, useState, useCallback } from "react";
import Card from "../../components/ui/Card.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import { listUsers, listSessions, listDeployments, health } from "../../api";
import { fetchSessionTracking } from "../../api/sessionTracking";
import { fetchSessionTrackingAggregates, fetchSessionTrackingRaw } from "../../api/sessionTrackingAggregates";
import LoadingState from "../../components/common/LoadingState";
import ErrorState from "../../components/common/ErrorState";
import KPIChart from "../../components/charts/KPIChart.jsx";
import TimeBucketFilter from "../../components/common/TimeBucketFilter.jsx";
import { getActiveUsersTrend } from "../../api/usersActiveTrend";

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
  /** Overview page with KPIs and two trend charts (Sessions, Users) and a new Overall Features chart. */
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ users: 0, sessions: 0, deployments: 0 });
  const [error, setError] = useState("");
  const [, setApiStatus] = useState("checking");

  // Sessions controls (independent)
  const [sessionsRangeKey, setSessionsRangeKey] = useState("30d"); // default last 30 days
  const [sessionsCustomRange, setSessionsCustomRange] = useState({ start: null, end: null });
  const [sessionsGranularity, setSessionsGranularity] = useState("daily"); // 'daily' | 'weekly' | 'monthly' | 'custom'
  const [sessionsBucketsDebugOpen, setSessionsBucketsDebugOpen] = useState(false);

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

  // Overall Features chart state (service_type distribution)
  const [featuresDebug, setFeaturesDebug] = useState(localStorage.getItem('debug_features') === '1');
  const [featuresInterval, setFeaturesInterval] = useState("daily"); // align with sessions trend intervals
  const [featuresRangeKey, setFeaturesRangeKey] = useState("30d");
  const [featuresCustomRange, setFeaturesCustomRange] = useState({ start: null, end: null });

  // features resolved tenant
  const featuresTenantId = useMemo(
    () => localStorage.getItem('organization_id') || undefined,
    []
  );

  // KPI metrics
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const [usersRes, sessionsRes, deploymentsRes] = await Promise.all([
          listUsers({ limit: 5 }),
          listSessions({ limit: 5 }),
          listDeployments({ limit: 5 }),
        ]);
        if (cancelled) return;
        setMetrics({
          users: usersRes?.total || usersRes?.length || 0,
          sessions: sessionsRes?.total || sessionsRes?.length || 0,
          deployments: deploymentsRes?.total || deploymentsRes?.length || 0,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.message || e?.message || "Failed to load overview data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
    // include API functions as dependencies to satisfy exhaustive-deps; they are module-stable
  }, [listUsers, listSessions, listDeployments]);

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
  // Memoize custom ranges to provide stable references for dependency arrays
  const stableSessionsCustomRange = useMemo(
    () => ({ start: sessionsCustomRange.start, end: sessionsCustomRange.end }),
    [sessionsCustomRange.start, sessionsCustomRange.end]
  );
  const stableUsersCustomRange = useMemo(
    () => ({ start: usersCustomRange.start, end: usersCustomRange.end }),
    [usersCustomRange.start, usersCustomRange.end]
  );

  const sessionsRange = useMemo(
    () => computeRange(sessionsRangeKey, stableSessionsCustomRange),
    [sessionsRangeKey, stableSessionsCustomRange]
  );
  const usersRange = useMemo(
    () => computeRange(usersRangeKey, stableUsersCustomRange),
    [usersRangeKey, stableUsersCustomRange]
  );

  // Sessions trend fetcher — use /api/session-tracking with interval and UTC boundaries, render local labels
  useEffect(() => {
    let aborted = false;

    async function loadSessions() {
      setSessionsLoading(true);
      setSessionsError(null);

      try {
        // Normalize interval
        let interval = sessionsGranularity;
        if (!['daily', 'weekly', 'monthly', 'custom'].includes(interval)) interval = 'daily';

        // Determine tenant scope (persisted during auth/tenant selection)
        const tenant_id = localStorage.getItem('organization_id') || undefined;

        // Compute start/end UTC boundaries
        let startISO;
        let endISO;
        if ((sessionsRangeKey === 'custom' || interval === 'custom') && sessionsCustomRange.start && sessionsCustomRange.end) {
          const s = new Date(sessionsCustomRange.start);
          s.setUTCHours(0, 0, 0, 0);
          const e = new Date(sessionsCustomRange.end);
          e.setUTCHours(23, 59, 59, 999);
          startISO = s.toISOString();
          endISO = e.toISOString();
        } else if (interval === 'weekly') {
          const e = new Date();
          e.setUTCHours(23, 59, 59, 999);
          const s = new Date(e);
          s.setUTCDate(e.getUTCDate() - (12 * 7 - 1));
          startISO = s.toISOString();
          endISO = e.toISOString();
        } else if (interval === 'monthly') {
          const e = new Date();
          e.setUTCHours(23, 59, 59, 999);
          const s = new Date(e);
          s.setUTCMonth(s.getUTCMonth() - 11, 1);
          s.setUTCHours(0, 0, 0, 0);
          startISO = s.toISOString();
          endISO = e.toISOString();
        } else {
          // daily (default): last 30 days inclusive
          const e = new Date();
          e.setUTCHours(23, 59, 59, 999);
          const s = new Date(e);
          s.setUTCDate(e.getUTCDate() - 29);
          s.setUTCHours(0, 0, 0, 0);
          startISO = s.toISOString();
          endISO = e.toISOString();
        }

        // Fetch from sessionsTrend API
        const DEBUG_SESSIONS_TREND = localStorage.getItem('debug_sessions_trend') === '1';
        const { fetchSessionsTrend } = await import('../../api/sessionsTrend');
        const { shapeSessionsTrendSeries } = await import('../../utils/sessions/shapeSessionsTrendSeries');

        const resp = await fetchSessionsTrend({
          tenant_id,
          interval,
          start_date: startISO,
          end_date: endISO,
          debug: DEBUG_SESSIONS_TREND,
        });

        if (aborted) return;

        const { series } = shapeSessionsTrendSeries(resp, { debug: DEBUG_SESSIONS_TREND });

        // Fill continuity when possible
        const fillStart = resp?.meta?.start || startISO;
        const fillEnd = resp?.meta?.end || endISO;
        if (fillStart && fillEnd) {
          const map = new Map(series.map((p) => [p.label, p.value]));
          const filled = fillSeries(map, fillStart, fillEnd, interval === 'weekly' ? 'weekly' : 'daily');
          setSessionsSeries(filled);
        } else {
          setSessionsSeries(series);
        }
      } catch (e) {
        if (aborted) return;
        setSessionsError(e);
        setSessionsSeries([]);
      } finally {
        if (!aborted) setSessionsLoading(false);
      }
    }

    loadSessions();
    return () => {
      aborted = true;
    };
  }, [sessionsRangeKey, sessionsCustomRange.start, sessionsCustomRange.end, sessionsGranularity, fillSeries]);

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
              ...(usersStatus === "active"
                ? [{ $or: [{ status: { $exists: false } }, { status: { $nin: ["deleted", "inactive"] } }] }]
                : []),
            ],
          };

          const usersRes = await listUsers({
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
  }, [usersRange, usersGranularity, usersStatus, fillSeries]);

  // Overall Features chart data via API /api/session-tracking/services
  const featuresRange = useMemo(
    () => computeRange(featuresRangeKey, featuresCustomRange),
    [featuresRangeKey, featuresCustomRange]
  );

  const { useOverallFeatures } = (() => {
    // local import shim to avoid top-level import churn
    // eslint-disable-next-line global-require
    const mod = require("../../hooks/useOverallFeatures.js");
    return mod;
  })();

  const {
    loading: featuresLoading,
    error: featuresError,
    data: featuresRawData,
    meta: featuresMeta,
  } = useOverallFeatures({
    tenant_id: featuresTenantId,
    interval: featuresInterval,
    start_date: featuresRange.startISO,
    end_date: featuresRange.endISO,
    top: 12,
    include_unknown: false,
    withTimeBuckets: false,
    debug: featuresDebug,
  });

  // normalize to KPIChart shape {label, value}
  const featuresData = useMemo(() => {
    const arr = Array.isArray(featuresRawData) ? featuresRawData : [];
    return arr.map((d) => ({
      label: d.label,
      value: Number(d.count ?? d.value ?? 0),
    }));
  }, [featuresRawData]);

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
      <div role="group" aria-label="Sessions interval" style={{ display: "inline-flex", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        {[
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
          { value: "custom", label: "Custom" },
        ].map((opt, idx) => {
          const active = sessionsGranularity === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSessionsGranularity(opt.value)}
              aria-pressed={active}
              style={{
                padding: "6px 10px",
                border: "none",
                background: active ? "#2563EB" : "transparent",
                color: active ? "#fff" : "#111827",
                borderRight: idx < 3 ? "1px solid #E5E7EB" : "none",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
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
      <button
        type="button"
        onClick={() => setSessionsBucketsDebugOpen((v) => !v)}
        className="btn btn-ghost"
        aria-expanded={sessionsBucketsDebugOpen}
        aria-controls="sessions-buckets-debug"
        style={{ marginLeft: 8 }}
      >
        {sessionsBucketsDebugOpen ? "Hide Buckets" : "Show Buckets"}
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
          subtitle="Session counts over time"
          actions={SessionsControls}
        >
          {(sessionsRangeKey === "custom" || sessionsGranularity === "custom") ? (
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
            sessionsRangeKey === "custom" && (!sessionsCustomRange.start || !sessionsCustomRange.end) ? (
              <div style={{ marginBottom: 8, color: "#6B7280", fontSize: 12 }}>
                Select start and end dates to apply custom range.
              </div>
            ) : null
          )}
          {sessionsLoading && <LoadingState message="Loading sessions trend…" height={220} />}
          {sessionsError && <ErrorState message={sessionsError?.message || "Failed to load sessions."} />}
          {!sessionsLoading && !sessionsError && (
            <>
              <KPIChart data={sessionsSeries} xKey="label" yKey="value" color="#2563EB" />
              <div id="sessions-buckets-debug" style={{ marginTop: 12 }}>
                {sessionsBucketsDebugOpen && (
                  <details open>
                    <summary style={{ cursor: "pointer", color: "#2563EB" }}>Aggregated Buckets (debug)</summary>
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 8 }}>
                      {(sessionsSeries || []).length === 0 ? (
                        <div>No buckets</div>
                      ) : (
                        <ul style={{ listStyle: "disc", paddingLeft: 18 }}>
                          {sessionsSeries.map((p) => (
                            <li key={p.label}>
                              <strong>{p.label}</strong>: {p.value}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div style={{ marginTop: 6, color: "#6B7280" }}>
                        Verification tips:
                        <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                          <li>Set localStorage.debug_sessions_trend = "1" and reload to view network/shape logs.</li>
                          <li>Change interval buttons (Daily/Weekly/Monthly/Custom) and ensure series updates.</li>
                          <li>Use custom date pickers; labels are shown in your local time, boundaries are UTC.</li>
                        </ul>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            </>
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

      {/* Overall Features (service_type distribution) */}
      <div className="block-full" style={{ gridColumn: "1 / -1" }}>
        <Card
          title="Overall Features"
          subtitle="Counts by feature type (service_type) from session activity"
          actions={
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {/* Interval selector aligned with Sessions Trend */}
              <div role="group" aria-label="Features interval" style={{ display: "inline-flex", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                {[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ].map((opt, idx) => {
                  const active = featuresInterval === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFeaturesInterval(opt.value)}
                      aria-pressed={active}
                      style={{
                        padding: "6px 10px",
                        border: "none",
                        background: active ? "#F59E0B" : "transparent",
                        color: active ? "#fff" : "#111827",
                        borderRight: idx < 2 ? "1px solid #E5E7EB" : "none",
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Range selector mirroring Sessions Trend presets */}
              <div style={{ display: "flex", gap: 6, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 4 }}>
                {["7d", "14d", "30d", "custom"].map((key) => (
                  <button
                    key={key}
                    onClick={() => setFeaturesRangeKey(key)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: featuresRangeKey === key ? "#2563EB" : "transparent",
                      color: featuresRangeKey === key ? "#fff" : "#111827",
                      cursor: "pointer",
                      transition: "background 120ms ease, color 120ms ease",
                    }}
                    aria-pressed={featuresRangeKey === key}
                  >
                    {key.toUpperCase()}
                  </button>
                ))}
              </div>

              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {renderDateRangeLabel(featuresRangeKey, featuresCustomRange, featuresRange)}
              </span>

              <label className="text-sm text-gray-600 flex items-center gap-2" style={{ marginLeft: "auto" }}>
                <input
                  type="checkbox"
                  checked={featuresDebug}
                  onChange={(e) => {
                    setFeaturesDebug(e.target.checked);
                    // persist for refreshable debugging
                    if (e.target.checked) localStorage.setItem('debug_features', '1');
                    else localStorage.removeItem('debug_features');
                  }}
                />
                Debug
              </label>

              <button
                type="button"
                onClick={() => {
                  setFeaturesInterval("daily");
                  setFeaturesRangeKey("30d");
                  setFeaturesCustomRange({ start: null, end: null });
                }}
                className="btn btn-ghost"
                style={{ marginLeft: 8 }}
                aria-label="Clear features filters"
              >
                Clear
              </button>
            </div>
          }
        >
          {featuresRangeKey === "custom" ? (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "#6B7280" }}>
                  Start:
                  <input
                    type="date"
                    onChange={(e) => setFeaturesCustomRange((r) => ({ ...r, start: e.target.value }))}
                    value={featuresCustomRange.start || ""}
                    style={{ marginLeft: 6 }}
                    aria-label="Features custom range start date"
                  />
                </label>
                <label style={{ fontSize: 12, color: "#6B7280" }}>
                  End:
                  <input
                    type="date"
                    onChange={(e) => setFeaturesCustomRange((r) => ({ ...r, end: e.target.value }))}
                    value={featuresCustomRange.end || ""}
                    style={{ marginLeft: 6 }}
                    aria-label="Features custom range end date"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {featuresLoading && <LoadingState message="Loading features…" height={220} />}
          {featuresError && <ErrorState message={featuresError?.message || "Failed to load features."} />}
          {!featuresLoading && !featuresError && (
            <>
              {Array.isArray(featuresData) && featuresData.length > 0 ? (
                <KPIChart data={featuresData} xKey="label" yKey="value" color="#F59E0B" />
              ) : (
                <div style={{ marginTop: 8, color: "#6B7280", fontSize: 12, textAlign: "center" }}>
                  No service usage found for selected period
                </div>
              )}
            </>
          )}
          {!!featuresDebug && (
            <div style={{ marginTop: 8, color: "#6B7280", fontSize: 12 }}>
              Debug tips: Inspect the Network tab for /api/session-tracking/services requests. The hook logs the exact URL and response when Debug is enabled.
            </div>
          )}
        </Card>
      </div>

      {error && (
        <div className="block-full" role="alert" style={{ alignSelf: "start" }}>
          <div className="error">{error}</div>
        </div>
      )}
    </div>
  );
}
