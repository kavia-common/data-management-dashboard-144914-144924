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
import { getUsersProjectsBatch } from "../../api/users";
import { getActiveTenant } from "../../utils/tenantClient";
import { getOrganizationId } from "../../api/authTokenProvider";
import Skeleton from "../../components/ui/Skeleton";
import { shapeUsersProjectsBatchResponse } from "../../utils/users/shapeUsersProjectsBatchResponse";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page, with independent filters.
 *
 * Data source:
 * - Reuses /api/users to get users, then uses /api/users/:userId/projects
 *   (or batch POST /api/users/projects) to fetch per-user projects/activity.
 *
 * Filters:
 * - Quick range + Custom date range.
 *
 * Date normalization requirement:
 * - Always send full-day UTC bounds:
 *   - from = YYYY-MM-DDT00:00:00.000Z
 *   - to   = YYYY-MM-DDT23:59:59.999Z
 */
export default function UsersAnalyticsPanel({ style, className, defaultDays = 0 }) {
  // Filter state (independent from Overview)
  const [days, setDays] = useState(defaultDays);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [dateLiveLabel, setDateLiveLabel] = useState("");

  // Active tenant/org id.
  // IMPORTANT: some flows store it as `activeOrganization` (preferred),
  // older flows store it as `activeTenant`. Read both.
  const activeTenantId = getOrganizationId?.() || getActiveTenant?.() || null;

  /**
   * Compute date range ISO strings for API query params.
   * IMPORTANT: Avoid local timezone when deriving these bounds. We construct
   * dates using UTC components via Date.UTC(...).
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

    // -------------------------
    // CUSTOM DATE RANGE
    // -------------------------
    if (customStart && customEnd) {
      const s = parseYMD(customStart);
      const e = parseYMD(customEnd);

      start = utcStartOfDay(s.y, s.m0, s.d);
      end = utcEndOfDay(e.y, e.m0, e.d);
    }

    // -------------------------
    // QUICK RANGE PRESETS
    // -------------------------
    else {
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
    setDateLiveLabel(`${fmt(start)} \u2013 ${fmt(end)}`);
  }, [startISO, endISO]);

  // Fetch users; table is unchanged elsewhere
  const { users, loading: usersLoading, error: usersError } = useUsers({ limit: 200 });

  // Fetch projects/activity per user when needed
  const [projectsByUser, setProjectsByUser] = useState({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Debug logging (console-safe and off by default).
    // Enable by setting REACT_APP_DEBUG_USERS_ANALYTICS=1
    const debugEnabled =
      String(process.env.REACT_APP_DEBUG_USERS_ANALYTICS || "").toLowerCase() === "1" ||
      String(process.env.REACT_APP_DEBUG_USERS_ANALYTICS || "").toLowerCase() === "true";

    async function run() {
      if (!Array.isArray(users) || users.length === 0 || !activeTenantId) {
        setProjectsByUser({});
        return;
      }

      setProjectsLoading(true);
      setProjectsError("");

      const userIds = users.map((u) => String(u?._id || "")).filter(Boolean);

      try {
        // Optimization:
        // Use the backend batch endpoint so the chart triggers ONE request for N users.
        // IMPORTANT:
        // - Do NOT treat "all zero counts" as a batch failure; it's a valid state for quick ranges.
        // - Abort stale in-flight requests on quick range change to avoid race overwrites.
        const batchRes = await getUsersProjectsBatch(
          {
            userIds,
            organization_id: activeTenantId,
            from: startISO,
            to: endISO,
          },
          { signal: controller.signal }
        );

        const shaped = shapeUsersProjectsBatchResponse({
          userIds,
          batchResponse: batchRes,
        });

        if (debugEnabled && process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("[UsersAnalyticsPanel] batch shaped map size:", Object.keys(shaped || {}).length, {
            requestedUserIds: userIds.length,
            from: startISO,
            to: endISO,
            // Sample a few entries to validate `total_count` and key presence.
            sample: userIds.slice(0, 3).map((id) => ({
              id,
              total_count: shaped?.[id]?.total_count,
              projects_len: Array.isArray(shaped?.[id]?.projects) ? shaped[id].projects.length : null,
            })),
          });
        }

        if (!cancelled) setProjectsByUser(shaped);
      } catch (e) {
        // IMPORTANT: Do not reintroduce per-user calls. If the batch request fails, surface an error.
        // Avoid overwriting state on abort/cancel.
        if (e?.name === "AbortError" || cancelled) return;

        if (!cancelled) {
          setProjectsError(e?.message || "Failed to load user projects (batch).");
          setProjectsByUser({});
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [users, activeTenantId, startISO, endISO]);

  const aggregates = useMemo(() => {
    const projectsCountByUser = [];

    for (const u of users || []) {
      const uid = String(u?._id || u?.id || "");
      const res = projectsByUser[uid];

      // Projects: derived from distinct projects list length
      const projectsCount = Array.isArray(res?.projects)
        ? res.projects.length
        : Array.isArray(res)
          ? res.length
          : 0;

      // Sessions: derived from backend total_count (from shaping util)
      const sessionsCount =
        typeof res?.total_count === "number"
          ? res.total_count
          : Number.isFinite(Number(res?.total_count))
            ? Number(res.total_count)
            : 0;

      projectsCountByUser.push({
        user: u?.name || u?.full_name || u?.email || uid,
        user_id: uid,
        // keep `count` for tooltip display (projects count)
        count: projectsCount,
        // CRITICAL: keep `total_count` for the bar chart `dataKey`
        total_count: sessionsCount,
      });
    }

    // Bars should be based on sessions count, so sort accordingly.
    projectsCountByUser.sort((a, b) => (b.total_count || 0) - (a.total_count || 0));

    const debugEnabled =
      String(process.env.REACT_APP_DEBUG_USERS_ANALYTICS || "").toLowerCase() === "1" ||
      String(process.env.REACT_APP_DEBUG_USERS_ANALYTICS || "").toLowerCase() === "true";

    if (debugEnabled && process.env.NODE_ENV !== "production") {
      // Targeted log: right before rendering, print the final rows and keys used by the chart.
      // eslint-disable-next-line no-console
      console.debug("[UsersAnalyticsPanel] Activity by User chart debug", {
        barDataKey: "total_count",
        xAxisDataKey: "user",
        rows: projectsCountByUser.slice(0, 20),
      });
    }

    return { projectsCountByUser };
  }, [users, projectsByUser]);

  // Theme colors
  const primary = "#2563EB";
  const grid = "#E5E7EB";
  const subtle = "#e2750eff";

  const ariaDateId = "users-analytics-date-label";

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

          <div className="card-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div className="card" aria-label="Activity by User">
              <div className="card-header" style={{ paddingBottom: 0 }}>
                <h4 className="card-title">Activity by User</h4>
                <div className="card-subtitle">Counts derived from associated activity</div>
              </div>

              <div className="card-content" style={{ height: 360, minHeight: 360 }}>
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
                ) : !Array.isArray(users) || users.length === 0 ? (
                  <div className="screen-center">No users</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
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
                      <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !Array.isArray(payload) || payload.length === 0) return null;

                          const row = payload?.[0]?.payload || {};
                          const projectsCount = Number.isFinite(Number(row?.count)) ? Number(row.count) : 0;
                          const sessionsCount = Number.isFinite(Number(row?.total_count))
                            ? Number(row.total_count)
                            : 0;

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
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>

                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                <span style={{ color: "#6B7280" }}>Projects:</span>
                                <span style={{ fontWeight: 600 }}>{projectsCount}</span>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  marginTop: 4,
                                }}
                              >
                                <span style={{ color: "#6B7280" }}>Sessions:</span>
                                <span style={{ fontWeight: 600 }}>{sessionsCount}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="total_count"
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
    </div>
  );
}

UsersAnalyticsPanel.propTypes = {
  style: PropTypes.object,
  className: PropTypes.string,
  defaultDays: PropTypes.number,
};
