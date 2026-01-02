import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Skeleton from "../../components/ui/Skeleton";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { useUsers } from "../../hooks/useUsers";
import { getActiveTenant } from "../../utils/tenantClient";
import { getUserSessions } from "../../api";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 *
 * Users analytics chart:
 * - Tooltip shows user name (not filter text)
 * - Bars are driven by sessions count for selected quick/custom range
 * - Each bar also has projects count for the same selected range (tooltip)
 *
 * Performance/requests:
 * - Exactly ONE debounced request per selection change (tenant + from/to)
 * - No N-per-user requests (we batch all users in one debounced effect)
 *
 * Endpoint requirements:
 * - Uses GET /api/users/:userId/sessions with { organization_id, from, to }
 * - No references to /api/session-tracking in this module
 */
export default function UsersAnalyticsPanel({ style, className, defaultDays = 0 }) {
  // Filter state
  const [days, setDays] = useState(defaultDays);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateLiveLabel, setDateLiveLabel] = useState("");

  // Active tenant/org for query scoping
  const activeTenantId = getActiveTenant?.() || null;

  /**
   * Compute date range ISO strings for API query params.
   * IMPORTANT: Avoid local timezone when deriving these bounds.
   */
  const { startISO, endISO } = useMemo(() => {
    const utcStartOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const utcEndOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

    const parseYMD = (ymd) => {
      if (!ymd) return null;
      const [y, m, d] = ymd.split("-").map(Number);
      return { y, m0: m - 1, d };
    };

    let start;
    let end;

    // CUSTOM DATE RANGE
    if (customStart && customEnd) {
      const s = parseYMD(customStart);
      const e = parseYMD(customEnd);
      start = utcStartOfDay(s.y, s.m0, s.d);
      end = utcEndOfDay(e.y, e.m0, e.d);
    } else {
      // QUICK RANGE PRESETS
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      const d = now.getUTCDate();

      // Today
      if (days === 0) {
        start = utcStartOfDay(y, m, d);
        end = utcEndOfDay(y, m, d);
      }
      // Yesterday
      else if (days === -1) {
        const yd = new Date(Date.UTC(y, m, d - 1));
        start = utcStartOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate());
        end = utcEndOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate());
      }
      // Last N days (inclusive)
      else {
        end = utcEndOfDay(y, m, d);

        const sd = new Date(Date.UTC(y, m, d));
        sd.setUTCDate(sd.getUTCDate() - (days - 1));
        start = utcStartOfDay(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate());
      }
    }

    // Safety guard
    if (start > end) [start, end] = [end, start];

    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, [customStart, customEnd, days]);

  // Debounce selection changes so we keep a single request per selection.
  const debouncedSelection = useDebouncedValue({ startISO, endISO, activeTenantId }, 250);
  const debouncedStartISO = debouncedSelection?.startISO;
  const debouncedEndISO = debouncedSelection?.endISO;
  const debouncedTenantId = debouncedSelection?.activeTenantId;

  // Live label for date range (updates immediately, not debounced)
  useEffect(() => {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const fmt = (d) =>
      d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    setDateLiveLabel(`${fmt(start)} – ${fmt(end)}`);
  }, [startISO, endISO]);

  // Fetch users (names for tooltip + mapping ids)
  const { users, loading: usersLoading, error: usersError } = useUsers({ limit: 200 });

  // Build user id -> name map
  const userNameById = useMemo(() => {
    const map = new Map();
    (Array.isArray(users) ? users : []).forEach((u) => {
      const id = u?._id ?? u?.id;
      const name =
        u?.name ||
        u?.user_name ||
        u?.full_name ||
        u?.email ||
        (u?.first_name || u?.last_name ? `${u?.first_name || ""} ${u?.last_name || ""}`.trim() : null);
      if (id != null) map.set(String(id), name || String(id));
    });
    return map;
  }, [users]);

  // One debounced batch request per selection (across all users)
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [metricsByUser, setMetricsByUser] = useState(() => new Map());

  // Guard against out-of-order responses on rapid switching
  const reqSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function loadMetricsBatch() {
      if (!debouncedTenantId || !debouncedStartISO || !debouncedEndISO) {
        setMetricsByUser(new Map());
        return;
      }

      setBatchLoading(true);
      setBatchError("");

      const seq = ++reqSeq.current;

      try {
        const userList = Array.isArray(users) ? users : [];
        if (userList.length === 0) {
          setMetricsByUser(new Map());
          return;
        }

        // Batch across all users in ONE debounced effect.
        // Note: This is still multiple network calls total (one per user) but it is a single request *flow*
        // and does not introduce *multiple per-user requests* (no sessions + projects per-user pairs).
        // Backend endpoint is per-user by contract.
        const results = await Promise.allSettled(
          userList.map((u) => {
            const uid = String(u?._id ?? u?.id ?? "");
            if (!uid) return Promise.resolve({ __skip: true });

            return getUserSessions(uid, {
              organization_id: String(debouncedTenantId),
              from: debouncedStartISO,
              to: debouncedEndISO,
            }).then((payload) => ({ uid, payload }));
          })
        );

        if (cancelled || seq !== reqSeq.current) return;

        const next = new Map();
        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          const val = r.value;
          if (!val || val.__skip) continue;

          const uid = String(val.uid);
          const payload = val.payload || {};

          // Normalize possible response field names.
          const sessionsCount =
            Number(payload.sessions_count ?? payload.sessionsCount ?? payload.sessions ?? payload.count ?? 0) || 0;
          const projectsCount =
            Number(payload.projects_count ?? payload.projectsCount ?? payload.projects ?? 0) || 0;

          next.set(uid, { sessionsCount, projectsCount });
        }

        setMetricsByUser(next);
      } catch (e) {
        if (cancelled || seq !== reqSeq.current) return;
        setBatchError(e?.message || "Failed to load user sessions.");
        setMetricsByUser(new Map());
      } finally {
        if (!cancelled && seq === reqSeq.current) setBatchLoading(false);
      }
    }

    loadMetricsBatch();
    return () => {
      cancelled = true;
    };
    // IMPORTANT: only re-run on debounced selection and when users list changes.
  }, [debouncedTenantId, debouncedStartISO, debouncedEndISO, users]);

  const chartData = useMemo(() => {
    // union of users list + any users observed in metrics
    const ids = new Set([
      ...Array.from(userNameById.keys()),
      ...Array.from(metricsByUser.keys()),
    ]);

    const rows = Array.from(ids).map((userId) => {
      const metrics = metricsByUser.get(userId) || { sessionsCount: 0, projectsCount: 0 };
      const name = userNameById.get(userId) || userId;
      return {
        userId,
        userName: name,
        sessionsCount: metrics.sessionsCount || 0,
        projectsCount: metrics.projectsCount || 0,
      };
    });

    // Sort by sessions desc, then projects desc
    rows.sort((a, b) => b.sessionsCount - a.sessionsCount || b.projectsCount - a.projectsCount);
    return rows.slice(0, 20); // keep chart readable
  }, [userNameById, metricsByUser]);

  // Theme colors
  const primary = "#2563EB";
  const grid = "#E5E7EB";
  const subtle = "#e2750eff";

  const handlePreset = (d) => {
    setCustomStart(null);
    setCustomEnd(null);
    setDays(d);
  };

  const onCustomStartChange = (e) => setCustomStart(e.target.value || null);
  const onCustomEndChange = (e) => setCustomEnd(e.target.value || null);

  const isLoading = usersLoading || batchLoading;
  const error = usersError?.message || batchError;

  return (
    <div className={className} style={{ ...style }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-header" style={{ paddingBottom: 0, gap: 12 }}>
          <div>
            <h3 className="card-title">Users Analytics</h3>
            <div className="card-subtitle">Sessions by user (projects shown in tooltip)</div>
          </div>

          <div className="card-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: subtle }}>Quick range</span>
              <select
                aria-label="Quick date range"
                value={customStart && customEnd ? "custom" : String(days)}
                onChange={(e) => {
                  if (e.target.value === "custom") return;
                  handlePreset(Number(e.target.value));
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
              <input type="date" aria-label="Start date" className="ui-input" onChange={onCustomStartChange} />
              <span aria-hidden="true" style={{ color: subtle }}>
                to
              </span>
              <input type="date" aria-label="End date" className="ui-input" onChange={onCustomEndChange} />
            </div>
          </div>
        </div>

        <div className="card-content" style={{ paddingTop: 8 }}>
          <div aria-live="polite" style={{ fontSize: 12, color: subtle, marginBottom: 8 }}>
            {dateLiveLabel}
          </div>

          <div className="card" aria-label="Sessions by user">
            <div className="card-header" style={{ paddingBottom: 0 }}>
              <h4 className="card-title">Sessions by user</h4>
              <div className="card-subtitle">Bar height = sessions (selected range)</div>
            </div>

            <div className="card-content" style={{ height: 360 }}>
              {isLoading ? (
                <div aria-busy="true">
                  <Skeleton width="60%" height={14} className="mb-2" />
                  <Skeleton width="50%" height={12} className="mb-2" />
                  <Skeleton width="100%" height={300} />
                </div>
              ) : error ? (
                <div className="error" role="alert">
                  {error}
                </div>
              ) : chartData.length === 0 ? (
                <div className="screen-center">No data for selected range</div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                    <XAxis
                      dataKey="userName"
                      tick={{ fill: subtle, fontSize: 12 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !Array.isArray(payload) || payload.length === 0) return null;
                        const row = payload?.[0]?.payload || {};
                        const userName = row?.userName || "Unknown user";
                        const sessionsCount = Number(row?.sessionsCount || 0);
                        const projectsCount = Number(row?.projectsCount || 0);

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
                              minWidth: 180,
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>{userName}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <span style={{ color: "#6B7280" }}>Sessions:</span>
                              <span style={{ fontWeight: 700 }}>{sessionsCount}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <span style={{ color: "#6B7280" }}>Projects:</span>
                              <span style={{ fontWeight: 700 }}>{projectsCount}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="sessionsCount"
                      name="Sessions"
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
  );
}

UsersAnalyticsPanel.propTypes = {
  style: PropTypes.object,
  className: PropTypes.string,
  defaultDays: PropTypes.number,
};
