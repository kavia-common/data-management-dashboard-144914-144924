import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { getUserProjects } from "../../api/users";
import { getActiveTenant } from "../../utils/tenantClient";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import Skeleton from "../../components/ui/Skeleton";

/**
 * PUBLIC_INTERFACE
 * UsersAnalyticsPanel
 * A charts/analytics panel for the Users page, with independent filters.
 *
 * Optimization goals:
 * - When switching quick date ranges rapidly, only ONE final API request should be executed
 *   (debounced selection), and in-flight requests are cancelled (AbortController).
 * - All data fetching is centralized in a single effect keyed by the selected/debounced range.
 *
 * Data source:
 * - Uses /api/users to get users, then uses /api/users/:userId/projects
 *   to fetch per-user projects (time-scoped).
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

  // Active tenant (scoped by client too, but visible here for explicit query params when needed)
  const activeTenantId = getActiveTenant?.() || null;

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

    /** -------------------------
     * CUSTOM DATE RANGE
     * ------------------------*/
    if (customStart && customEnd) {
      const s = parseYMD(customStart);
      const e = parseYMD(customEnd);

      start = utcStartOfDay(s.y, s.m0, s.d);
      end = utcEndOfDay(e.y, e.m0, e.d);
    }

    /** -------------------------
     * QUICK RANGE PRESETS
     * ------------------------*/
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

  // Debounce date bounds so rapid selections only trigger the final fetch.
  // 250ms is a good balance between responsiveness and eliminating redundant calls.
  const debouncedStartISO = useDebouncedValue(startISO, 250);
  const debouncedEndISO = useDebouncedValue(endISO, 250);

  // Live label for date range for accessibility (reflect immediate selection, not debounced)
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

  // Stable dependency to avoid re-running fetch due to array identity changes
  const userIdsKey = useMemo(() => {
    return Array.isArray(users) ? users.map((u) => String(u._id)).sort().join(",") : "";
  }, [users]);

  // Fetch projects per user when needed
  const [projectsByUser, setProjectsByUser] = useState({});
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [wasCancelled, setWasCancelled] = useState(false);

  // Cache to avoid refetching same date-range data
  const projectsCacheRef = useRef({});
  // Store controller to abort in-flight requests on rapid changes/unmount
  const abortRef = useRef(null);

  const isAbortError = (err) => {
    // Axios/fetch abort errors show up differently depending on versions.
    const name = err?.name || err?.cause?.name;
    const code = err?.code;
    const message = String(err?.message || "");
    return name === "AbortError" || code === "ERR_CANCELED" || message.toLowerCase().includes("canceled");
  };

  const fetchProjectsForUsers = useCallback(
    async ({ signal, tenantId, from, to }) => {
      /**
       * NOTE:
       * - This function does NOT read from component state except `users`.
       * - It is invoked by a single effect that controls cancellation/debouncing.
       */
      const acc = {};
      const batchSize = 8;

      for (let i = 0; i < users.length; i += batchSize) {
        const slice = users.slice(i, i + batchSize);

        await Promise.all(
          slice.map(async (u) => {
            if (!u?._id) return;

            // If we already got aborted, fail fast before issuing more requests.
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

            try {
              const res = await getUserProjects(
                String(u._id),
                {
                  organization_id: tenantId,
                  from,
                  to,
                },
                { signal }
              );

              acc[String(u._id)] = res || { projects: [] };
            } catch (e) {
              // If aborted, propagate so the effect can mark cancellation distinctly.
              if (isAbortError(e) || signal?.aborted) throw e;
              // Preserve prior behavior: user still exists, but no projects response.
              acc[String(u._id)] = { projects: [] };
            }
          })
        );

        // Allow abort between batches.
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      }

      return acc;
    },
    [users]
  );

  /**
   * Centralized chart data loading effect.
   * - Tied ONLY to: tenant, debounced date range, and users identity (via userIdsKey).
   * - Cancels in-flight requests on changes (AbortController).
   * - Uses a cache keyed by tenant+range+usersKey to avoid refetching.
   */
  useEffect(() => {
    // Reset transient UI states
    setProjectsError("");
    setWasCancelled(false);

    // Guard: if not ready, clear out dependent state
    if (!userIdsKey || !activeTenantId || !Array.isArray(users) || users.length === 0) {
      // Abort any in-flight request because dependent inputs are no longer valid
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setProjectsByUser({});
      setProjectsLoading(false);
      return;
    }

    const cacheKey = `${activeTenantId}_${debouncedStartISO}_${debouncedEndISO}_${userIdsKey}`;

    // Serve from cache immediately
    if (projectsCacheRef.current[cacheKey]) {
      // Abort any older request and just show cached data
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setProjectsByUser(projectsCacheRef.current[cacheKey]);
      setProjectsLoading(false);
      return;
    }

    // Cancel any in-flight request before starting a new one
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let didFinish = false;

    async function run() {
      setProjectsLoading(true);
      setProjectsError("");
      setWasCancelled(false);

      try {
        const acc = await fetchProjectsForUsers({
          signal: controller.signal,
          tenantId: activeTenantId,
          from: debouncedStartISO,
          to: debouncedEndISO,
        });

        if (controller.signal.aborted) return;

        projectsCacheRef.current[cacheKey] = acc;
        setProjectsByUser(acc);
      } catch (e) {
        if (controller.signal.aborted || isAbortError(e)) {
          // Cancellation is not an error; keep UI responsive and distinguish from failures.
          setWasCancelled(true);
          return;
        }
        setProjectsError(e?.message || "Failed to load user projects.");
        setProjectsByUser({});
      } finally {
        didFinish = true;
        if (!controller.signal.aborted) setProjectsLoading(false);
      }
    }

    run();

    return () => {
      // Only abort if request is still in flight; avoids aborting completed requests.
      if (!didFinish) controller.abort();
    };
  }, [
    userIdsKey,
    users,
    activeTenantId,
    debouncedStartISO,
    debouncedEndISO,
    fetchProjectsForUsers,
  ]);

  const aggregates = useMemo(() => {
    const projectsCountByUser = [];

    for (const u of users || []) {
      const uid = String(u?._id || u?.id || "");
      const res = projectsByUser[uid];

      // Existing behavior (Projects): derived from distinct projects list length
      const projectsCount = Array.isArray(res?.projects)
        ? res.projects.length
        : Array.isArray(res)
          ? res.length
          : 0;

      // Sessions: derived from backend total_count
      const sessionsCount =
        typeof res?.total_count === "number"
          ? res.total_count
          : Number.isFinite(Number(res?.total_count))
            ? Number(res.total_count)
            : 0;

      projectsCountByUser.push({
        user: u?.name || u?.full_name || u?.email || uid,
        user_id: uid,
        count: projectsCount,
        total_count: sessionsCount,
      });
    }

    // Bars are based on sessions count, so sort accordingly.
    projectsCountByUser.sort((a, b) => (b.total_count || 0) - (a.total_count || 0));
    return { projectsCountByUser };
  }, [users, projectsByUser]);

  // Theme colors
  const primary = "#2563EB";
  const grid = "#E5E7EB";
  const subtle = "#e2750eff";

  const ariaDateId = "users-analytics-date-label";

  const handlePreset = (d) => {
    // IMPORTANT: do not call fetch here; fetching is centralized in effect.
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
                ) : wasCancelled ? (
                  <div className="screen-center" style={{ color: "#6B7280" }}>
                    Updating range…
                  </div>
                ) : aggregates.projectsCountByUser.length === 0 ? (
                  <div className="screen-center">No sessions data</div>
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
                      <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !Array.isArray(payload) || payload.length === 0) return null;

                          const row = payload?.[0]?.payload || {};
                          const projectsCount = Number.isFinite(Number(row?.count))
                            ? Number(row.count)
                            : 0;
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
