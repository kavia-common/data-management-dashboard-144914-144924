import { useEffect, useMemo, useState } from "react";
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
  LabelList,
} from "recharts";
import Skeleton from "../../components/ui/Skeleton";
import { listDashboardUsersAnalytics } from "../../api/baseClient";
import { fetchTenantsForDropdown } from "../../api/tenants";
import { deriveTenantsForDropdownFromUsers } from "../../api/usersTenants";
import { useQuickRange } from "./quickRangeContext";
import { useTenantFilter } from "./tenantFilterContext";

/**
 * Build a stable, readable, and unique label for the Y-axis.
 * Recharts/DOM rendering can behave oddly when category labels collide (duplicates/empty),
 * so we enforce uniqueness deterministically to avoid implicit de-dupe effects.
 */
function buildUniqueUserLabel(baseLabel, userId, index, seen) {
  const raw = String(baseLabel || "").trim();
  const fallback = userId ? `User ${String(userId).slice(0, 8)}` : `User ${index + 1}`;
  const candidate = raw || fallback;

  const key = candidate.toLowerCase();
  const count = (seen.get(key) || 0) + 1;
  seen.set(key, count);

  // Only suffix when we truly have a collision.
  return count === 1 ? candidate : `${candidate} (${count})`;
}

/**
 * Normalize an hourly bucket key to an integer hour in [0..23].
 * Accepts:
 *  - numbers: 0..23
 *  - strings: "0", "00", "23", "23:00", "2026-01-01T23:00:00Z" (best effort)
 *
 * Returns null when the value cannot be interpreted as an hour.
 */
function toHourInt(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const h = Math.trunc(value);
    return h >= 0 && h <= 23 ? h : null;
  }

  const s = String(value).trim();
  if (!s) return null;

  // Common: "00".."23" or "0".."23"
  if (/^\d{1,2}$/.test(s)) {
    const h = Number(s);
    return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
  }

  // Common: "HH:..." (e.g., "23:00", "23:15")
  const m = s.match(/^(\d{1,2}):/);
  if (m) {
    const h = Number(m[1]);
    return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
  }

  // ISO-ish: "...THH:..." (e.g., "2026-02-09T23:00:00Z")
  const iso = s.match(/T(\d{2}):/);
  if (iso) {
    const h = Number(iso[1]);
    return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
  }

  return null;
}

function formatHourLabel(hourInt) {
  const h = typeof hourInt === "number" ? hourInt : Number(hourInt);
  if (!Number.isFinite(h)) return String(hourInt ?? "");
  return String(Math.trunc(h)).padStart(2, "0");
}

/**
 * Decide which hour ticks to show on the X-axis to avoid crowding.
 * Returns an array of numeric hour values that must match the X axis `dataKey` values.
 */
function buildHourTicks() {
  // Show every 2 hours. Keep ends included (00 and 23) by appending 23 if needed.
  const ticks = [];
  for (let h = 0; h <= 23; h += 2) ticks.push(h);
  if (ticks[ticks.length - 1] !== 23) ticks.push(23);
  return ticks;
}

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page.
 *
 * Requirements (enforced by implementation):
 * - Exactly ONE request on initial load for analytics:
 *     GET /api/dashboard/users
 * - No per-user requests, no batching, and no frontend aggregation.
 * - The backend is responsible for date filtering, grouping, counting, joining user metadata,
 *   and sorting by activity.
 *
 * Date filtering:
 * - When no from/to are supplied, the backend defaults to TODAY in UTC
 *   (00:00:00.000Z -> 23:59:59.999Z).
 * - When date-only values are selected, we pass YYYY-MM-DD; backend expands to full-day UTC bounds.
 */
export default function UsersAnalyticsPanel({ style, className }) {
  const {
    selection,
    fromParam,
    toParam,
    label: dateLiveLabel,
    setQuickRange,
    setCustomRange,
  } = useQuickRange();

  const { selectedTenantId, setSelectedTenantId } = useTenantFilter();

  const [tenantOptions, setTenantOptions] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsNotice, setTenantsNotice] = useState("");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Load tenants for dropdown (best-effort).
  // Strategy:
  //  1) Prefer /api/session/tenants (auth-scoped) if it returns any tenants.
  //  2) If empty, derive tenants from users API by extracting tenant_id/organization_id.
  // On error/empty, we fall back to showing only "All tenants".
  useEffect(() => {
    const controller = new AbortController();

    async function loadTenants() {
      setTenantsLoading(true);
      setTenantsNotice("");

      try {
        let tenants = [];
        let shouldFallbackToUsers = false;

        try {
          tenants = await fetchTenantsForDropdown({ signal: controller.signal });
          if (!Array.isArray(tenants) || tenants.length === 0) {
            // Endpoint responded but doesn't provide tenants; derive from users as a robustness fallback.
            shouldFallbackToUsers = true;
          }
        } catch (e) {
          // 401 is expected when session is missing/expired or when endpoint strictly requires Authorization.
          if (e?.status === 401) {
            shouldFallbackToUsers = true;

            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.warn(
                "[UsersAnalyticsPanel] /api/session/tenants returned 401; falling back to users-derived tenants."
              );
            }

            setTenantsNotice(
              "Tenant list is limited due to authorization; showing tenants derived from users."
            );
          } else if (e?.name !== "AbortError") {
            // For other errors (network etc.), still try fallback for resiliency.
            shouldFallbackToUsers = true;
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.warn(
                "[UsersAnalyticsPanel] Failed to load tenants from /api/session/tenants; falling back.",
                e
              );
            }
          }
        }

        if (shouldFallbackToUsers) {
          const derived = await deriveTenantsForDropdownFromUsers({ signal: controller.signal });
          tenants = derived;
        }

        // Final safety: ensure array + de-dupe by id (works for both sources).
        const byId = new Map();
        (Array.isArray(tenants) ? tenants : []).forEach((t) => {
          if (!t?.id) return;
          byId.set(String(t.id), { id: String(t.id), name: String(t.name || t.id) });
        });

        setTenantOptions(Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        if (e?.name !== "AbortError") {
          setTenantOptions([]);
        }
      } finally {
        setTenantsLoading(false);
      }
    }

    loadTenants();
    return () => controller.abort();
    // Refresh when analytics refreshes to keep dropdown aligned with freshest data
  }, []);

  // Single aggregated fetch (no per-user calls)
  const [activity, setActivity] = useState(null);
  const [activityByUser, setActivityByUser] = useState(null);
  const [activityMode, setActivityMode] = useState(null);
  const [interval, setInterval] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setErr("");
      try {
        const data = await listDashboardUsersAnalytics(
          {
            from: fromParam || undefined,
            to: toParam || undefined,
            tenant_id: selectedTenantId || undefined,
          },
          { signal: controller.signal }
        );

        // New shape: { activity, activityByUser, mode, users, interval }
        if (data && typeof data === "object" && ("users" in data || "activity" in data)) {
          setRows(Array.isArray(data.users) ? data.users : []);
          setActivity(Array.isArray(data.activity) ? data.activity : null);
          setActivityByUser(
            data.activityByUser && typeof data.activityByUser === "object" ? data.activityByUser : null
          );
          setActivityMode(typeof data.mode === "string" ? data.mode : null);
          setInterval(typeof data.interval === "string" ? data.interval : null);
        } else {
          // Safety fallback (should not happen)
          setRows(Array.isArray(data) ? data : []);
          setActivity(null);
          setActivityByUser(null);
          setActivityMode(null);
          setInterval(null);
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          setErr(e?.message || "Failed to load users analytics.");
          setRows([]);
          setActivity(null);
          setActivityByUser(null);
          setActivityMode(null);
          setInterval(null);
        }
      } finally {
        setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [fromParam, toParam, selectedTenantId]);

  const chartRows = useMemo(() => {
    // Backend already sorts by activity; keep it stable but ensure numbers are numbers.
    // IMPORTANT: ensure the Y-axis category label is unique/stable to prevent rendering artifacts.
    const seen = new Map();

    const mapped = (rows || []).map((r, index) => {
      const baseLabel = r?.name || r?.email || r?.userId || "";
      const userId = r?.userId || "";
      const user = buildUniqueUserLabel(baseLabel, userId, index, seen);

      return {
        user,
        userId,
        // keep an unmodified string for tooltips/full display (avoid showing "(2)" suffix there)
        userRaw: String(baseLabel || "").trim() || user,
        totalSessions: Number(r?.totalSessions || 0),
        distinctProjects: Number(r?.distinctProjects || 0),
        lastActivityAt: r?.lastActivityAt || null,
        email: r?.email || "",
      };
    });

    // Temporary debug logs (remove after verifying fix)
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] range:", {
        mode: selection.mode,
        quickValue: selection.quickValue,
        fromParam,
        toParam,
      });
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] tenant:", selectedTenantId || "(all)");
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] per-user rows length:", rows?.length ?? 0);
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] activity mode:", activityMode || "(none)");
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] activity buckets length:", activity?.length ?? 0);
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] activityByUser series length:", activityByUser?.series?.length ?? 0);
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] interval:", interval || "(none)");
    }

    return mapped;
  }, [
    rows,
    selection.mode,
    selection.quickValue,
    fromParam,
    toParam,
    selectedTenantId,
    activity,
    activityByUser,
    activityMode,
    interval,
  ]);

  const totalSessionsKpi = useMemo(() => {
    // Compute from the same server-returned per-user rows used by the panel.
    // This ensures alignment with the selected quick range + tenant filter.
    return (rows || []).reduce((sum, r) => sum + Number(r?.totalSessions || 0), 0);
  }, [rows]);

  const activityChartData = useMemo(() => {
    /**
     * Range-based mode (backend-driven):
     * - mode === 'per_user' (range <= 31 days):
     *     backend returns activityByUser: { buckets: [{key,label}], series: [{userId,name,sessionsByKey}] }
     *     We render stacked bars per user (same chart component).
     * - mode === 'aggregated' (range > 31 days):
     *     backend returns activity: [{key,label,sessions,users}] (existing)
     */
    const isPerUser = activityMode === "per_user" && activityByUser && typeof activityByUser === "object";

    if (isPerUser) {
      const buckets = Array.isArray(activityByUser?.buckets) ? activityByUser.buckets : [];
      const series = Array.isArray(activityByUser?.series) ? activityByUser.series : [];

      /**
       * IMPORTANT (hourly mode):
       * - Normalize any backend bucket keys to [0..23] hour integers
       * - Enforce numeric sorting to guarantee 00..23 ordering
       * - Keep labels stable but display as 00..23
       */
      if (interval === "hour") {
        const labelByHour = new Map(); // hourInt -> label
        buckets.forEach((b) => {
          const hour = toHourInt(b?.key);
          if (hour === null) return;
          const lblRaw = b?.label ?? b?.key;
          // Always render hour labels as 2-digit; ignore any verbose label coming from backend
          labelByHour.set(hour, formatHourLabel(hour));
        });

        // Build templated 0..23 axis
        const hourKeys = Array.from({ length: 24 }, (_, h) => h);

        return hourKeys.map((hour) => {
          const row = {
            // Recharts XAxis uses this numeric value for proper ordering
            key: hour,
            label: labelByHour.get(hour) ?? formatHourLabel(hour),
          };

          series.forEach((s) => {
            const uid = String(s?.userId ?? "").trim();
            if (!uid) return;

            // sessionsByKey might be keyed as "0"/"00"/"23" etc. Normalize to hour.
            let v = 0;
            const sbk = s?.sessionsByKey && typeof s.sessionsByKey === "object" ? s.sessionsByKey : null;
            if (sbk) {
              Object.entries(sbk).forEach(([k, val]) => {
                const h = toHourInt(k);
                if (h === hour) v = Number(val || 0);
              });
            }

            row[uid] = Number(v || 0);
          });

          return row;
        });
      }

      // Non-hour intervals: preserve existing formatting (only ensure stable axis templating where applicable).
      // Bucket label map (key -> label)
      const labelByKey = new Map();
      buckets.forEach((b) => {
        const k = String(b?.key ?? "").trim();
        if (!k) return;
        labelByKey.set(k, String(b?.label ?? k));
      });

      const templateKeys = () => {
        if (interval === "month") return Array.from({ length: 12 }, (_, i) => String(i + 1));
        if (interval === "day") return Array.from({ length: 31 }, (_, i) => String(i + 1));
        // Fallback (unknown interval): no templating
        return null;
      };

      const templated = templateKeys();
      const bucketKeys = templated || Array.from(labelByKey.keys());

      // Shape rows: { key, label, <userId1>: count, <userId2>: count, ... }
      return bucketKeys.map((key) => {
        const row = {
          key,
          label:
            labelByKey.get(key) ??
            (interval === "month"
              ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
                  Number(key) - 1
                ] || key
              : key),
        };

        series.forEach((s) => {
          const uid = String(s?.userId ?? "").trim();
          if (!uid) return;
          const v =
            s?.sessionsByKey && typeof s.sessionsByKey === "object" ? s.sessionsByKey[key] : 0;
          row[uid] = Number(v || 0);
        });

        return row;
      });
    }

    /**
     * Aggregated mode (existing behavior): use backend `activity` buckets.
     */
    const buckets = Array.isArray(activity) ? activity : [];

    // Defensive: if backend returns malformed buckets (e.g., missing keys), treat as empty.
    const hasAnyKey = buckets.some((b) => String(b?.key ?? "").trim() !== "");
    const safeBuckets = hasAnyKey ? buckets : [];

    /**
     * IMPORTANT (hourly mode):
     * - Normalize bucket keys to hourInt [0..23]
     * - Enforce 0..23 templating
     * - Ensure label is always 00..23
     */
    if (interval === "hour") {
      const byHour = new Map(); // hourInt -> { sessions, users, label }
      safeBuckets.forEach((b) => {
        const hour = toHourInt(b?.key);
        if (hour === null) return;

        const sessions = Number(b?.sessions ?? 0);
        const users = Number(b?.users ?? 0);

        const existing = byHour.get(hour) || { sessions: 0, users: 0 };
        byHour.set(hour, {
          sessions: existing.sessions + (Number.isFinite(sessions) ? sessions : 0),
          users: existing.users + (Number.isFinite(users) ? users : 0),
        });
      });

      return Array.from({ length: 24 }, (_, hour) => {
        const existing = byHour.get(hour);
        return {
          key: hour,
          label: formatHourLabel(hour),
          sessions: existing ? existing.sessions : 0,
          users: existing ? existing.users : 0,
        };
      });
    }

    // Non-hour intervals: preserve existing behavior/formatting.
    const normalizeBucket = (b) => ({
      key: String(b?.key ?? ""),
      label: String(b?.label ?? ""),
      sessions: Number(b?.sessions ?? 0),
      users: Number(b?.users ?? 0),
    });

    const bucketMap = new Map();
    safeBuckets.forEach((b) => {
      const nb = normalizeBucket(b);
      if (nb.key) bucketMap.set(nb.key, nb);
    });

    if (interval === "month") {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        const key1 = String(m);
        const key2 = String(m).padStart(2, "0");
        const existing = bucketMap.get(key1) || bucketMap.get(key2);
        return {
          key: key1,
          label: existing?.label ? String(existing.label) : monthNames[idx],
          sessions: existing ? existing.sessions : 0,
          users: existing ? existing.users : 0,
        };
      });
    }

    if (interval === "day") {
      return Array.from({ length: 31 }, (_, idx) => {
        const d = idx + 1;
        const key1 = String(d);
        const key2 = String(d).padStart(2, "0");
        const existing = bucketMap.get(key1) || bucketMap.get(key2);
        return {
          key: key1,
          label: existing?.label ? String(existing.label) : String(d),
          sessions: existing ? existing.sessions : 0,
          users: existing ? existing.users : 0,
        };
      });
    }

    const normalized = safeBuckets.map(normalizeBucket);
    const sortable = normalized.every((b) => b.key !== "");
    if (!sortable) return normalized;

    const toSortableNumber = (k) => {
      const n = Number(k);
      return Number.isFinite(n) ? n : null;
    };

    return normalized
      .slice()
      .sort((a, b) => {
        const an = toSortableNumber(a.key);
        const bn = toSortableNumber(b.key);
        if (an !== null && bn !== null) return an - bn;
        return String(a.key).localeCompare(String(b.key));
      });
  }, [activity, activityByUser, activityMode, interval]);

  const hourTicks = useMemo(() => {
    return interval === "hour" ? buildHourTicks() : undefined;
  }, [interval]);

  // Theme colors
  const primary = "#2563EB";
  const secondary = "#f57c0bff";
  const grid = "#E5E7EB";
  const subtle = "#6B7280";

  const onCustomStartChange = (e) => {
    const start = e.target.value || null;
    setCustomRange(start, selection.customEnd);
  };
  const onCustomEndChange = (e) => {
    const end = e.target.value || null;
    setCustomRange(selection.customStart, end);
  };

  // Scrolling behavior:
  // Recharts does not support "scroll" natively; instead we create a scroll container and
  // increase chart height based on row count so the wrapper scrolls.
  const SCROLL_THRESHOLD = 20;
  const BAR_SIZE = 20; // px per bar
  const BAR_GAP = 10; // px gap between bars
  const CHART_PADDING = 120; // allowance for margins/axes/legend
  const shouldScroll = chartRows.length > SCROLL_THRESHOLD;
  const chartHeight = shouldScroll
    ? Math.min(1200, chartRows.length * (BAR_SIZE + BAR_GAP) + CHART_PADDING)
    : 360;

  return (
    <div className={className} style={{ ...style }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ paddingBottom: 0, gap: 12 }}>
          <div>
            <h3 className="card-title">Users Analytics</h3>
            <div className="card-subtitle">Per-user activity (server-aggregated)</div>
          </div>

          <div className="card-actions users-analytics-controls">
            <label className="users-analytics-control">
              <span className="users-analytics-control__label" style={{ color: subtle }}>
                Quick range
              </span>
              <select
                aria-label="Quick date range"
                value={selection.mode === "custom" ? "custom" : String(selection.quickValue)}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    // user will set dates using date inputs
                  } else {
                    setQuickRange(Number(e.target.value));
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

            <label className="users-analytics-control">
              <span className="users-analytics-control__label" style={{ color: subtle }}>
                Tenant
              </span>
              <select
                aria-label="Tenant filter"
                value={selectedTenantId || ""}
                onChange={(e) => setSelectedTenantId(e.target.value || null)}
                className="ui-input"
                style={{ minWidth: 180 }}
                disabled={tenantsLoading && tenantOptions.length === 0}
              >
                <option value="">
                  {tenantsLoading
                    ? "Loading tenants…"
                    : tenantOptions.length === 0
                      ? "All tenants"
                      : "All tenants"}
                </option>
                {tenantOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <div
              role="group"
              aria-label="Custom date range"
              className="users-analytics-control users-analytics-control--dates"
            >
              <input
                type="date"
                aria-label="Start date"
                className="ui-input"
                value={selection.customStart || ""}
                onChange={onCustomStartChange}
              />
              <span aria-hidden="true" style={{ color: subtle }}>
                to
              </span>
              <input
                type="date"
                aria-label="End date"
                className="ui-input"
                value={selection.customEnd || ""}
                onChange={onCustomEndChange}
              />
            </div>
          </div>
        </div>

        <div className="card-content" style={{ paddingTop: 8 }}>
          <div aria-live="polite" style={{ fontSize: 12, color: subtle, marginBottom: 8 }}>
            {dateLiveLabel}
            {tenantsNotice ? (
              <>
                {" "}
                <span style={{ color: subtle }}>•</span>{" "}
                <span style={{ color: subtle }}>{tenantsNotice}</span>
              </>
            ) : null}
          </div>

          {/* Compact KPI immediately below the date range div */}
          <div
            aria-label="Total Sessions Count"
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 10px",
              border: `1px solid ${grid}`,
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, color: subtle }}>Total Sessions Count</div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
              {loading ? "—" : err ? "—" : chartRows.length === 0 ? "0" : totalSessionsKpi}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div className="card" aria-label="Activity by User">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Activity by User</h4>
                <div className="card-subtitle">
                  {interval === "hour"
                    ? "Hourly activity (00–23)"
                    : interval === "day"
                      ? "Daily activity (by date)"
                      : interval === "month"
                        ? "Monthly activity (Jan–Dec)"
                        : "Activity (server-aggregated)"}
                </div>
              </div>

              <div className="card-content" style={{ paddingTop: 8 }}>
                {loading ? (
                  <div aria-busy="true">
                    <Skeleton width="60%" height={14} className="mb-2" />
                    <Skeleton width="50%" height={12} className="mb-2" />
                    <Skeleton width="100%" height={320} />
                  </div>
                ) : err ? (
                  <div className="error" role="alert">
                    {err}
                  </div>
                ) : activityChartData.length === 0 ? (
                  <div className="screen-center">No analytics data</div>
                ) : (
                  <div style={{ width: "100%", height: 360 }} aria-label="Activity by User chart">
                    <ResponsiveContainer>
                      <BarChart
                        data={activityChartData}
                        margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                        barCategoryGap={12}
                        barSize={18}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                        <XAxis
                          dataKey="key"
                          tick={{ fill: subtle, fontSize: 12 }}
                          tickLine={false}
                          axisLine={{ stroke: grid }}
                          ticks={hourTicks}
                          interval={interval === "hour" ? "preserveStartEnd" : "preserveStartEnd"}
                          minTickGap={interval === "hour" ? 10 : 12}
                          tickFormatter={(value) => {
                            if (interval === "hour") return formatHourLabel(value);
                            const row = activityChartData.find((d) => String(d.key) === String(value));
                            const lbl = row?.label ?? value;
                            return String(lbl);
                          }}
                        />
                        <YAxis
                          tick={{ fill: subtle, fontSize: 12 }}
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={{ stroke: grid }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !Array.isArray(payload) || payload.length === 0) return null;

                            // In per-user mode, payload will contain multiple stacked users.
                            if (activityMode === "per_user") {
                              const lines = payload
                                .filter((p) => p && p.dataKey && Number(p.value) > 0)
                                .sort((a, b) => Number(b.value) - Number(a.value))
                                .slice(0, 12); // avoid overly tall tooltip

                              const total = payload.reduce((sum, p) => sum + Number(p?.value || 0), 0);

                              const tooltipLabel =
                                interval === "hour" ? formatHourLabel(label) : String(label ?? "");

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
                                    maxWidth: 280,
                                  }}
                                >
                                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{tooltipLabel}</div>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                    <span style={{ color: "#6B7280" }}>Total sessions:</span>
                                    <span style={{ fontWeight: 600 }}>{total}</span>
                                  </div>

                                  <div style={{ marginTop: 8 }}>
                                    {lines.length === 0 ? (
                                      <div style={{ color: "#6B7280" }}>No activity</div>
                                    ) : (
                                      lines.map((p) => (
                                        <div
                                          key={String(p.dataKey)}
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 12,
                                            marginTop: 4,
                                          }}
                                        >
                                          <span style={{ color: "#6B7280" }}>
                                            {String(p.name || p.dataKey).slice(0, 28)}
                                          </span>
                                          <span style={{ fontWeight: 600 }}>{Number(p.value || 0)}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // Aggregated mode tooltip (existing)
                            const row = payload?.[0]?.payload || {};
                            const sessions = Number.isFinite(Number(row?.sessions)) ? Number(row.sessions) : 0;
                            const users = Number.isFinite(Number(row?.users)) ? Number(row.users) : 0;

                            const tooltipLabel =
                              interval === "hour" ? formatHourLabel(label) : String(label ?? "");

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
                                <div style={{ fontWeight: 600, marginBottom: 6 }}>{tooltipLabel}</div>

                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                  <span style={{ color: "#6B7280" }}>Sessions:</span>
                                  <span style={{ fontWeight: 600 }}>{sessions}</span>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    marginTop: 4,
                                  }}
                                >
                                  <span style={{ color: "#6B7280" }}>Users:</span>
                                  <span style={{ fontWeight: 600 }}>{users}</span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Legend />

                        {activityMode === "per_user" && activityByUser?.series?.length ? (
                          // Per-user stacked bars: render one Bar per userId (stacked)
                          (activityByUser.series || []).slice(0, 25).map((s, idx) => {
                            const uid = String(s?.userId || "").trim();
                            if (!uid) return null;

                            // Keep palette stable-ish without adding a new chart component.
                            // (We intentionally do not change overall layout; just provide distinct fills.)
                            const palette = [
                              "#2563EB",
                              "#f57c0bff",
                              "#10B981",
                              "#8B5CF6",
                              "#EF4444",
                              "#14B8A6",
                              "#F59E0B",
                              "#3B82F6",
                              "#EC4899",
                              "#22C55E",
                            ];
                            const fill = palette[idx % palette.length];

                            return (
                              <Bar
                                key={uid}
                                dataKey={uid}
                                name={String(s?.name || uid)}
                                fill={fill}
                                stroke={fill}
                                stackId="a"
                                radius={[6, 6, 0, 0]}
                                isAnimationActive={false}
                              />
                            );
                          })
                        ) : (
                          // Aggregated mode: keep existing stacked behavior + colors
                          <>
                            <Bar
                              dataKey="sessions"
                              name="Sessions"
                              fill={primary}
                              stroke={primary}
                              stackId="a"
                              radius={[6, 6, 0, 0]}
                            />
                            <Bar
                              dataKey="users"
                              name="Users"
                              fill={secondary}
                              stroke={secondary}
                              stackId="a"
                              radius={[6, 6, 0, 0]}
                            />
                          </>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
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
};
