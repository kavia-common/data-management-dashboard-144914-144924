import React, { useEffect, useMemo, useState, useCallback } from "react";
import Card from "../../components/ui/Card.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import { listUsers, listSessions, listDeployments, listLlmCosts, health } from "../../api";
import { fetchSessionTracking } from "../../api/sessionTracking";
import LoadingState from "../../components/common/LoadingState";
import ErrorState from "../../components/common/ErrorState";
import KPIChart from "../../components/charts/KPIChart.jsx";
import { getActiveUsersTrend } from "../../api/usersActiveTrend";
import ScrollableDateRangePicker from "../../components/common/ScrollableDateRangePicker";
import "../../styles/scrollable-date-range.css";

/**
 * Utility helpers for date bucketing and formatting.
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
function toYYYYMM(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Compute ISO range from preset key or custom dates.
 * Supports presets: 7d, 14d, 30d, 90d, custom.
 */
function computeRange(rangeKey, customRange) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(end);
  if (rangeKey === "7d") start.setDate(end.getDate() - 6);
  else if (rangeKey === "14d") start.setDate(end.getDate() - 13);
  else if (rangeKey === "30d") start.setDate(end.getDate() - 29);
  else if (rangeKey === "90d") start.setDate(end.getDate() - 89);
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
 * Displays KPIs and three charts with independent dropdown filters like Users Analytics.
 */
export default function Overview() {
  // KPI/summary
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ users: 0, sessions: 0, deployments: 0 });
  const [error, setError] = useState("");
  const [, setApiStatus] = useState("checking");

  // Sessions controls (independent)
  const [sessionsPreset, setSessionsPreset] = useState("30d");
  const [sessionsCustom, setSessionsCustom] = useState({ start: null, end: null });
  const [sessionsGranularity, setSessionsGranularity] = useState("day"); // day|week

  // Users controls (independent)
  const [usersPreset, setUsersPreset] = useState("30d");
  const [usersCustom, setUsersCustom] = useState({ start: null, end: null });
  const [usersGranularity, setUsersGranularity] = useState("day"); // day|week|month
  const [usersStatus, setUsersStatus] = useState("active"); // active|all

  // Costs controls (independent)
  const [costsPreset, setCostsPreset] = useState("30d");
  const [costsCustom, setCostsCustom] = useState({ start: null, end: null });
  const [costsGranularity, setCostsGranularity] = useState("day"); // day|week

  // Sessions chart state
  const [sessionsSeries, setSessionsSeries] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState(null);

  // Users chart state
  const [usersSeries, setUsersSeries] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);

  // Costs chart state
  const [costsSeries, setCostsSeries] = useState([]);
  const [costsLoading, setCostsLoading] = useState(false);
  const [costsError, setCostsError] = useState(null);

  // KPI metrics fetch
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

  // Backend health (non-blocking)
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

  // Series filler for day/week/month
  const fillSeries = useCallback(function fillSeries(map, start, end, bucket = "day") {
    const s = new Date(start);
    const e = new Date(end);
    const out = [];
    if (bucket === "week") {
      let c = startOfWeek(s);
      while (c <= e) {
        const key = toYMD(c);
        out.push({ label: key, value: map.get(key) || 0 });
        c = new Date(c);
        c.setDate(c.getDate() + 7);
      }
    } else if (bucket === "month") {
      let c = startOfMonth(s);
      if (e < c) {
        const key = toYYYYMM(c);
        out.push({ label: key, value: map.get(key) || 0 });
        return out;
      }
      while (c <= e) {
        const key = toYYYYMM(c);
        out.push({ label: key, value: map.get(key) || 0 });
        c = new Date(c);
        c.setMonth(c.getMonth() + 1);
      }
    } else {
      let c = new Date(s);
      c.setHours(0, 0, 0, 0);
      while (c <= e) {
        const key = toYMD(c);
        out.push({ label: key, value: map.get(key) || 0 });
        c = new Date(c);
        c.setDate(c.getDate() + 1);
      }
    }
    return out;
  }, []);

  // Derived ranges
  const sessionsRange = useMemo(
    () => computeRange(sessionsPreset, sessionsCustom),
    [sessionsPreset, sessionsCustom]
  );
  const usersRange = useMemo(
    () => computeRange(usersPreset, usersCustom),
    [usersPreset, usersCustom]
  );
  const costsRange = useMemo(
    () => computeRange(costsPreset, costsCustom),
    [costsPreset, costsCustom]
  );

  // Sessions trend fetch
  useEffect(() => {
    let aborted = false;
    async function loadSessions() {
      setSessionsLoading(true);
      setSessionsError(null);
      try {
        const { startISO, endISO } = sessionsRange;
        const { items } = await fetchSessionTracking({
          start_date: startISO,
          end_date: endISO,
          limit: 200,
          sort: "-session_start",
        });
        if (aborted) return;

        const pts = (items || [])
          .map((it) => {
            const t =
              it.session_start ||
              it.last_updated ||
              it.updated_at ||
              it.startedAt ||
              it.createdAt ||
              it.timestamp ||
              it.lastActivityAt ||
              it.endedAt ||
              it.date;
            return t ? new Date(t) : null;
          })
          .filter((d) => d && !Number.isNaN(d.getTime()));

        const map = new Map();
        if (sessionsGranularity === "week") {
          pts.forEach((d) => {
            const wk = startOfWeek(d);
            const k = toYMD(wk);
            map.set(k, (map.get(k) || 0) + 1);
          });
        } else {
          pts.forEach((d) => {
            const k = toYMD(d);
            map.set(k, (map.get(k) || 0) + 1);
          });
        }

        setSessionsSeries(fillSeries(map, sessionsRange.startISO, sessionsRange.endISO, sessionsGranularity));
      } catch (e) {
        if (aborted) return;
        setSessionsError(e);
        setSessionsSeries([]);
      } finally {
        if (!aborted) setSessionsLoading(false);
      }
    }
    if (sessionsRange.startISO && sessionsRange.endISO) loadSessions();
    return () => {
      aborted = true;
    };
  }, [sessionsRange.startISO, sessionsRange.endISO, sessionsGranularity, fillSeries]);

  // Users trend fetch (calls backend endpoint and maps to series: createdCount/updatedCount)
  useEffect(() => {
    let aborted = false;

    function toIsoSafe(v) {
      if (!v) return undefined;
      try {
        return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
      } catch {
        return undefined;
      }
    }

    // Format labels based on granularity: YYYY-MM for month, YYYY-MM-DD otherwise
    function labelFor(dateStr, granularity) {
      if (!dateStr) return "";
      if (granularity === "month") {
        // Expect YYYY-MM or ISO; normalize to YYYY-MM
        const d = new Date(dateStr.length > 10 ? dateStr : `${dateStr}-01T00:00:00.000Z`);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}`;
      }
      // Day/week display as YYYY-MM-DD
      if (dateStr.length >= 10) return dateStr.slice(0, 10);
      return dateStr;
    }

    async function loadUsers() {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const { startISO, endISO } = usersRange;
        const from = toIsoSafe(startISO);
        const to = toIsoSafe(endISO);
        // Backend supports day|week granularity for active-trend; monthly is supported in overview users-trend
        const g = usersGranularity === "week" ? "week" : usersGranularity === "month" ? "month" : "day";
        const status = usersStatus === "active" ? "completed|active" : undefined;

        // Prefer overview users-trend which can support month as well
        // fallback to usersActiveTrend (sessions-based) when month not supported or if call fails.
        let createdCounts = new Map();
        let updatedCounts = new Map();
        let labelsSet = new Set();
        let usedGranularity = g;

        // Try overview users-trend first
        try {
          const { fetchUsersTrend } = await import("../../services/overviewApi");
          const resp = await fetchUsersTrend({ from, to, granularity: g, status });
          // Expected shape: { items: [{ date, createdCount, updatedCount }], meta: { granularity, from, to } }
          const items = Array.isArray(resp?.items) ? resp.items : [];
          usedGranularity = resp?.meta?.granularity || g;

          items.forEach((it) => {
            const lab = labelFor(it.date || it.label, usedGranularity);
            if (!lab) return;
            labelsSet.add(lab);
            const c = Number(it.createdCount ?? 0);
            const u = Number(it.updatedCount ?? 0);
            if (Number.isFinite(c)) createdCounts.set(lab, (createdCounts.get(lab) || 0) + c);
            if (Number.isFinite(u)) updatedCounts.set(lab, (updatedCounts.get(lab) || 0) + u);
          });
        } catch {
          // Fallback: sessions active-trend -> map to "updatedCount" as active count, createdCount=0
          try {
            const resp = await getActiveUsersTrend({ from, to, granularity: g, status });
            const items = Array.isArray(resp?.items) ? resp.items : [];
            usedGranularity = resp?.meta?.granularity || g;

            items.forEach((it) => {
              const lab = labelFor(it.date || it.label, usedGranularity);
              if (!lab) return;
              labelsSet.add(lab);
              const total = Number(it.total ?? 0);
              if (Number.isFinite(total)) updatedCounts.set(lab, (updatedCounts.get(lab) || 0) + total);
              if (!createdCounts.has(lab)) createdCounts.set(lab, 0);
            });
          } catch (err) {
            throw err;
          }
        }

        if (aborted) return;

        // Build full x-axis labels from range to align with API buckets
        const mapForFilling = new Map();
        // Use updated counts as primary for existence of points, but ensure created also filled
        labelsSet.forEach((lab) => {
          const sum = (createdCounts.get(lab) || 0) + (updatedCounts.get(lab) || 0);
          mapForFilling.set(lab, sum);
        });

        // Fill series across range to ensure continuity; derive labels from range to avoid gaps
        const filled = fillSeries(mapForFilling, usersRange.startISO, usersRange.endISO, usedGranularity);

        // Output stacked series by label with total as updated+created and primary yKey as value for chart
        const finalSeries = filled.map((pt) => {
          const lab = pt.label;
          const created = createdCounts.get(lab) || 0;
          const updated = updatedCounts.get(lab) || 0;
          const total = created + updated;
          return {
            label: lab,
            value: Number.isFinite(total) ? total : 0,
            createdCount: Number.isFinite(created) ? created : 0,
            updatedCount: Number.isFinite(updated) ? updated : 0,
          };
        });

        setUsersSeries(finalSeries);
      } catch (e) {
        if (aborted) return;
        setUsersError(new Error(e?.message || "Failed to load users trend"));
        setUsersSeries([]);
      } finally {
        if (!aborted) setUsersLoading(false);
      }
    }

    if (usersRange.startISO && usersRange.endISO) {
      loadUsers();
    }
    return () => {
      aborted = true;
    };
  }, [usersRange.startISO, usersRange.endISO, usersGranularity, usersStatus, fillSeries]);

  // Costs trend fetch
  useEffect(() => {
    let aborted = false;
    async function loadCosts() {
      setCostsLoading(true);
      setCostsError(null);
      try {
        const { startISO, endISO } = costsRange;
        const filter = {
          $or: [
            { timestamp: { $gte: startISO, $lte: endISO } },
            { created_at: { $gte: startISO, $lte: endISO } },
            { createdAt: { $gte: startISO, $lte: endISO } },
          ],
        };
        const res = await listLlmCosts({
          filter: JSON.stringify(filter),
          limit: 500,
          sort: "-timestamp",
        });

        const items = res?.items || (Array.isArray(res) ? res : []);
        if (aborted) return;

        const map = new Map();
        (items || []).forEach((doc) => {
          const t = doc.timestamp || doc.created_at || doc.createdAt || doc.date;
          const d = t ? new Date(t) : null;
          if (!d || Number.isNaN(d.getTime())) return;

          const raw =
            doc.total_cost ??
            doc.total_usd ??
            doc.usd ??
            doc.amount_usd ??
            doc.cost ??
            doc.price ??
            doc.amount ??
            0;
          const num = typeof raw === "number" ? raw : Number(String(raw).replace(/[$,]/g, ""));
          const value = Number.isFinite(num) ? num : 0;

          const key = costsGranularity === "week" ? toYMD(startOfWeek(d)) : toYMD(d);
          map.set(key, (map.get(key) || 0) + value);
        });

        const series = fillSeries(map, startISO, endISO, costsGranularity);
        setCostsSeries(series);
      } catch (e) {
        if (aborted) return;
        setCostsError(e);
        setCostsSeries([]);
      } finally {
        if (!aborted) setCostsLoading(false);
      }
    }
    if (costsRange.startISO && costsRange.endISO) loadCosts();
    return () => {
      aborted = true;
    };
  }, [costsRange.startISO, costsRange.endISO, costsGranularity, fillSeries]);

  // Helpers
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

  // Dropdown control elements (explicit select elements like Users Analytics)
  const PresetDropdown = ({ id, value, onChange, label = "Quick range" }) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ui-input"
        style={{ minWidth: 140 }}
      >
        <option value="7d">Last 7 days</option>
        <option value="14d">Last 14 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="custom">Custom...</option>
      </select>
    </label>
  );

  const GranularityDropdown = ({ id, value, onChange, allowMonthly = false }) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#6B7280" }}>Aggregation</span>
      <select
        id={id}
        aria-label="Aggregation granularity"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ui-input"
        style={{ minWidth: 140 }}
      >
        <option value="day">Daily</option>
        <option value="week">Weekly</option>
        {allowMonthly && <option value="month">Monthly</option>}
      </select>
    </label>
  );

  const CustomDateInputs = ({ start, end, onStart, onEnd, groupLabel }) => {
    // Adapt new ScrollableDateRangePicker while preserving external state shape (start/end as ISO strings or null)
    const fromDate = start ? new Date(start) : null;
    const toDate = end ? new Date(end) : null;

    const handleChange = ({ from, to }) => {
      onStart(from ? from.toISOString().slice(0, 10) : null);
      onEnd(to ? to.toISOString().slice(0, 10) : null);
    };

    return (
      <div role="group" aria-label={groupLabel} style={{ display: "inline-flex", alignItems: "flex-start", gap: 6 }}>
        <ScrollableDateRangePicker
          from={fromDate}
          to={toDate}
          onChange={handleChange}
          numberOfMonths={2}
          ariaLabel={`${groupLabel} date range picker`}
        />
      </div>
    );
  };

  // Per-chart controls assembled into Card actions

  const SessionsControls = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <GranularityDropdown
        id="sessions-granularity"
        value={sessionsGranularity}
        onChange={(v) => setSessionsGranularity(v === "month" ? "week" : v)}
        allowMonthly={true /* UI consistency; will map month->week */}
      />
      <PresetDropdown id="sessions-preset" value={sessionsPreset} onChange={setSessionsPreset} />
      <CustomDateInputs
        groupLabel="Sessions custom date range"
        start={sessionsCustom.start}
        end={sessionsCustom.end}
        onStart={(v) => setSessionsCustom((s) => ({ ...s, start: v }))}
        onEnd={(v) => setSessionsCustom((s) => ({ ...s, end: v }))}
      />
      <DateRangePill label={renderDateRangeLabel(sessionsPreset, sessionsCustom, sessionsRange)} />
    </div>
  );

  const UsersControls = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
      <GranularityDropdown
        id="users-granularity"
        value={usersGranularity}
        onChange={setUsersGranularity}
        allowMonthly={true}
      />
      <PresetDropdown id="users-preset" value={usersPreset} onChange={setUsersPreset} />
      <CustomDateInputs
        groupLabel="Users custom date range"
        start={usersCustom.start}
        end={usersCustom.end}
        onStart={(v) => setUsersCustom((s) => ({ ...s, start: v }))}
        onEnd={(v) => setUsersCustom((s) => ({ ...s, end: v }))}
      />
      <div style={{ marginLeft: "auto", display: "inline-flex", gap: 8, alignItems: "center" }}>
        <label htmlFor="users-status-filter" style={{ fontSize: 12, color: "#6B7280" }}>
          Status
        </label>
        <select
          id="users-status-filter"
          aria-label="Users status filter"
          value={usersStatus}
          onChange={(e) => setUsersStatus(e.target.value)}
          className="ui-input"
          style={{ minWidth: 120 }}
        >
          <option value="active">Active</option>
          <option value="all">All</option>
        </select>
      </div>
      <DateRangePill label={renderDateRangeLabel(usersPreset, usersCustom, usersRange)} />
    </div>
  );

  const CostsControls = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <GranularityDropdown
        id="costs-granularity"
        value={costsGranularity}
        onChange={(v) => setCostsGranularity(v === "month" ? "week" : v)}
        allowMonthly={true /* UI consistency; map month->week */}
      />
      <PresetDropdown id="costs-preset" value={costsPreset} onChange={setCostsPreset} />
      <CustomDateInputs
        groupLabel="Costs custom date range"
        start={costsCustom.start}
        end={costsCustom.end}
        onStart={(v) => setCostsCustom((s) => ({ ...s, start: v }))}
        onEnd={(v) => setCostsCustom((s) => ({ ...s, end: v }))}
      />
      <DateRangePill label={renderDateRangeLabel(costsPreset, costsCustom, costsRange)} />
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
          subtitle="Distinct active users by day/week/month"
          actions={UsersControls}
        >
          {usersLoading && <LoadingState message="Loading users trend…" height={220} />}
          {usersError && <ErrorState message={usersError?.message || "Failed to load users trend."} />}
          {!usersLoading && !usersError && (
            <KPIChart
              data={usersSeries}
              xKey="label"
              yKey="value"
              color="#0EA5E9"
            />
          )}
        </Card>
      </div>

      {/* Costs Trend */}
      <div className="block-full" style={{ gridColumn: "1 / -1" }}>
        <Card
          title="Costs over time"
          subtitle="Total USD by day/week"
          actions={CostsControls}
        >
          {costsLoading && <LoadingState message="Loading costs trend…" height={220} />}
          {costsError && <ErrorState message={costsError?.message || "Failed to load costs trend."} />}
          {!costsLoading && !costsError && (
            <KPIChart data={costsSeries} xKey="label" yKey="value" color="#F59E0B" />
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
