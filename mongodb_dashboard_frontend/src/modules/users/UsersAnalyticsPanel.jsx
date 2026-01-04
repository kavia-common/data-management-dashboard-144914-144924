// import { useState, useEffect, useMemo } from "react";
// import PropTypes from "prop-types";
// import {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
// } from "recharts";
// import { useUsers } from "../../hooks/useUsers";
// import { getUsersProjectsBatch } from "../../api/users";
// import { getActiveTenant } from "../../utils/tenantClient";
// import { getOrganizationId } from "../../api/authTokenProvider";
// import Skeleton from "../../components/ui/Skeleton";
// import { shapeUsersProjectsBatchResponse } from "../../utils/users/shapeUsersProjectsBatchResponse";

// /**
//  * PUBLIC_INTERFACE
//  * UsersAnalyticsPanel
//  * A charts/analytics panel for the Users page, with independent filters.
//  *
//  * Data source:
//  * - Reuses /api/users to get users, then uses /api/users/:userId/projects
//  *   (or batch POST /api/users/projects) to fetch per-user projects/activity.
//  *
//  * Filters:
//  * - Quick range + Custom date range.
//  *
//  * Date normalization requirement:
//  * - Always send full-day UTC bounds:
//  *   - from = YYYY-MM-DDT00:00:00.000Z
//  *   - to   = YYYY-MM-DDT23:59:59.999Z
//  */
// export default function UsersAnalyticsPanel({ style, className, defaultDays = 0 }) {
//   // Filter state (independent from Overview)
//   const [days, setDays] = useState(defaultDays);
//   const [customStart, setCustomStart] = useState(null);
//   const [customEnd, setCustomEnd] = useState(null);
//   const [dateLiveLabel, setDateLiveLabel] = useState("");

//   // Active tenant/org id.
//   // IMPORTANT: some flows store it as `activeOrganization` (preferred),
//   // older flows store it as `activeTenant`. Read both.
//   const activeTenantId = getOrganizationId?.() || getActiveTenant?.() || null;

//   /**
//    * Compute date range ISO strings for API query params.
//    * IMPORTANT: Avoid local timezone when deriving these bounds. We construct
//    * dates using UTC components via Date.UTC(...).
//    */
//   const { startISO, endISO } = useMemo(() => {
//     const utcStartOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
//     const utcEndOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

//     const parseYMD = (ymd) => {
//       if (!ymd) return null;
//       const [y, m, d] = ymd.split("-").map(Number);
//       return { y, m0: m - 1, d };
//     };

//     let start;
//     let end;

//     // -------------------------
//     // CUSTOM DATE RANGE
//     // -------------------------
//     if (customStart && customEnd) {
//       const s = parseYMD(customStart);
//       const e = parseYMD(customEnd);

//       start = utcStartOfDay(s.y, s.m0, s.d);
//       end = utcEndOfDay(e.y, e.m0, e.d);
//     }

//     // -------------------------
//     // QUICK RANGE PRESETS
//     // -------------------------
//     else {
//       const now = new Date();
//       const y = now.getUTCFullYear();
//       const m = now.getUTCMonth();
//       const d = now.getUTCDate();

//       // Today
//       if (days === 0) {
//         start = utcStartOfDay(y, m, d);
//         end = utcEndOfDay(y, m, d);
//       }

//       // Yesterday
//       else if (days === -1) {
//         const yd = new Date(Date.UTC(y, m, d - 1));
//         start = utcStartOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate());
//         end = utcEndOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate());
//       }

//       // Last N days (inclusive)
//       else {
//         end = utcEndOfDay(y, m, d);

//         const sd = new Date(Date.UTC(y, m, d));
//         sd.setUTCDate(sd.getUTCDate() - (days - 1));

//         start = utcStartOfDay(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate());
//       }
//     }

//     // Safety guard
//     if (start > end) [start, end] = [end, start];

//     return { startISO: start.toISOString(), endISO: end.toISOString() };
//   }, [customStart, customEnd, days]);

//   // Live label for date range for accessibility
//   useEffect(() => {
//     const start = new Date(startISO);
//     const end = new Date(endISO);
//     const fmt = (d) =>
//       d.toLocaleDateString(undefined, {
//         year: "numeric",
//         month: "short",
//         day: "numeric",
//       });
//     setDateLiveLabel(`${fmt(start)} \u2013 ${fmt(end)}`);
//   }, [startISO, endISO]);

//   // Fetch users; table is unchanged elsewhere
//   const { users, loading: usersLoading, error: usersError } = useUsers({ limit: 200 });

//   // Fetch projects/activity per user when needed
//   const [projectsByUser, setProjectsByUser] = useState({});
//   const [projectsLoading, setProjectsLoading] = useState(false);
//   const [projectsError, setProjectsError] = useState("");

//   const debugEnabled =
//     String(process.env.REACT_APP_DEBUG_USERS_ANALYTICS || "").toLowerCase() === "1" ||
//     String(process.env.REACT_APP_DEBUG_USERS_ANALYTICS || "").toLowerCase() === "true";

//   const [debugInfo, setDebugInfo] = useState({
//     organization_id: null,
//     from: null,
//     to: null,
//     requestedUserIdsCount: 0,
//     // Minimal “trust but verify” debug: show first rows and totals right above chart
//     first5Rows: [],
//     totalSum: 0,
//   });

//   useEffect(() => {
//     let cancelled = false;
//     const controller = new AbortController();

//     async function run() {
//       if (!Array.isArray(users) || users.length === 0 || !activeTenantId) {
//         setProjectsByUser({});
//         if (debugEnabled) {
//           setDebugInfo({
//             organization_id: activeTenantId,
//             from: startISO,
//             to: endISO,
//             requestedUserIdsCount: 0,
//             first5Rows: [],
//             totalSum: 0,
//           });
//         }
//         return;
//       }

//       setProjectsLoading(true);
//       setProjectsError("");

//       const userIds = users.map((u) => String(u?._id || "")).filter(Boolean);

//       try {
//         // Optimization:
//         // Use the backend batch endpoint so the chart triggers ONE request for N users.
//         // IMPORTANT:
//         // - Do NOT treat "all zero counts" as a batch failure; it's a valid state for quick ranges.
//         // - Abort stale in-flight requests on quick range change to avoid race overwrites.
//         const batchRes = await getUsersProjectsBatch(
//           {
//             userIds,
//             organization_id: activeTenantId,
//             from: startISO,
//             to: endISO,
//           },
//           { signal: controller.signal }
//         );

//         const shaped = shapeUsersProjectsBatchResponse({
//           userIds,
//           batchResponse: batchRes,
//         });

//         if (!cancelled) setProjectsByUser(shaped);

//         if (debugEnabled) {
//           // Build the exact chart rows here too (so debug shows the same values the chart uses).
//           const rows = userIds.map((id) => {
//             const userFromList = users.find((u) => String(u?._id || "") === id);
//             const shapedUser = shaped?.[id];

//             // Prefer backend-provided name when present (useful for super-admin multi-tenant results),
//             // otherwise fall back to users list fields.
//             const name =
//               shapedUser?.name ||
//               shapedUser?.user_name ||
//               userFromList?.name ||
//               userFromList?.full_name ||
//               userFromList?.email ||
//               id;

//             // `total_count` is the authoritative sessions count for the selected date range.
//             // Keep defensive fallbacks to tolerate older/alternate backend shapes, but prefer `total_count`.
//             const total_count =
//               Number.isFinite(Number(shapedUser?.total_count))
//                 ? Number(shapedUser.total_count)
//                 : Array.isArray(shapedUser?.sessions)
//                   ? shapedUser.sessions.length
//                   : Array.isArray(shapedUser?.activities)
//                     ? shapedUser.activities.length
//                     : Number.isFinite(Number(shapedUser?.count))
//                       ? Number(shapedUser.count)
//                       : 0;

//             // Projects count must reflect number of distinct projects (derived from projects array).
//             // This intentionally differs from sessions total_count.
//             const projects_count = Array.isArray(shapedUser?.projects)
//               ? shapedUser.projects.length
//               : 0;

//             return { id, name, total_count, projects_count };
//           });

//           const totalSum = rows.reduce(
//             (acc, r) => acc + (Number.isFinite(r.total_count) ? r.total_count : 0),
//             0
//           );

//           setDebugInfo({
//             organization_id: activeTenantId,
//             from: startISO,
//             to: endISO,
//             requestedUserIdsCount: userIds.length,
//             first5Rows: rows.slice(0, 5),
//             totalSum,
//           });
//         }
//       } catch (e) {
//         // IMPORTANT: Do not reintroduce per-user calls. If the batch request fails, surface an error.
//         // Avoid overwriting state on abort/cancel.
//         if (e?.name === "AbortError" || cancelled) return;

//         if (!cancelled) {
//           setProjectsError(e?.message || "Failed to load user projects (batch).");
//           setProjectsByUser({});
//         }
//       } finally {
//         if (!cancelled) setProjectsLoading(false);
//       }
//     }

//     run();
//     return () => {
//       cancelled = true;
//       controller.abort();
//     };
//   }, [users, activeTenantId, startISO, endISO, debugEnabled]);

//   const aggregates = useMemo(() => {
//     /**
//      * IMPORTANT:
//      * Recharts BarChart renders bars only when:
//      * - `data` is a non-empty array
//      * - the Bar's `dataKey` exists on each datum AND is numeric
//      *
//      * We keep the chart row shape minimal and explicit:
//      *   { id, name, total_count }
//      *
//      * Bugfix note:
//      * - The tooltip must show UNIQUE project counts (distinct project ids).
//      * - Some backend data shapes can include duplicate project entries; therefore
//      *   `projects.length` is not always a safe "unique projects" count.
//      * - We keep session counting flow untouched: bar dataKey remains `total_count`.
//      */
//     const activityByUserRows = [];

//     const getUniqueProjectCount = (projects) => {
//       if (!Array.isArray(projects) || projects.length === 0) return 0;
//       const ids = new Set();
//       for (const p of projects) {
//         const pid = p?.project_id ?? p?.projectId ?? p?.id ?? null;
//         if (!pid) continue;
//         ids.add(String(pid));
//       }
//       return ids.size;
//     };

//     for (const u of users || []) {
//       const uid = String(u?._id || u?.id || "");
//       if (!uid) continue;

//       const res = projectsByUser?.[uid];

//       // Latest backend shape: res is an object { total_count, projects, name?/user_name? }
//       // Ensure numeric fields to prevent invisible bars / tooltip NaNs.
//       // Sessions MUST use total_count (authoritative). Keep light fallbacks for alternate shapes.
//       const total_count =
//         Number.isFinite(Number(res?.total_count))
//           ? Number(res.total_count)
//           : Array.isArray(res?.sessions)
//             ? res.sessions.length
//             : Array.isArray(res?.activities)
//               ? res.activities.length
//               : Number.isFinite(Number(res?.count))
//                 ? Number(res.count)
//                 : 0;

//       // Projects count must reflect UNIQUE projects (distinct project ids).
//       // This intentionally differs from sessions total_count.
//       const projects_count = getUniqueProjectCount(res?.projects);

//       const name =
//         res?.name ||
//         res?.user_name ||
//         u?.name ||
//         u?.full_name ||
//         u?.email ||
//         uid;

//       activityByUserRows.push({ id: uid, name, total_count, projects_count });
//     }

//     activityByUserRows.sort((a, b) => (b.total_count || 0) - (a.total_count || 0));

//     if (debugEnabled && process.env.NODE_ENV !== "production") {
//       // eslint-disable-next-line no-console
//       console.debug("[UsersAnalyticsPanel] ActivityByUser rows (final)", {
//         length: activityByUserRows.length,
//         sum: activityByUserRows.reduce(
//           (acc, r) => acc + (Number.isFinite(r.total_count) ? r.total_count : 0),
//           0
//         ),
//         first3: activityByUserRows.slice(0, 3),
//       });
//     }

//     return { activityByUserRows };
//   }, [users, projectsByUser, debugEnabled]);

//   // Theme colors
//   const primary = "#2563EB";
//   const grid = "#E5E7EB";
//   const subtle = "#e2750eff";

//   const ariaDateId = "users-analytics-date-label";

//   const handlePreset = (d) => {
//     setCustomStart(null);
//     setCustomEnd(null);
//     setDays(d);
//   };

//   const onCustomStartChange = (e) => setCustomStart(e.target.value || null);
//   const onCustomEndChange = (e) => setCustomEnd(e.target.value || null);

//   return (
//     <div className={className} style={{ ...style }}>
//       <div className="card" style={{ marginBottom: 12 }}>
//         <div className="card-header" style={{ paddingBottom: 0, gap: 12 }}>
//           <div>
//             <h3 className="card-title">Users Analytics</h3>
//             <div className="card-subtitle">User activity distribution</div>
//           </div>

//           <div className="card-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
//             <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
//               <span style={{ fontSize: 12, color: subtle }}>Quick range</span>
//               <select
//                 aria-label="Quick date range"
//                 value={customStart && customEnd ? "custom" : String(days)}
//                 onChange={(e) => {
//                   if (e.target.value === "custom") {
//                     // leave as-is; user will pick dates below
//                   } else {
//                     handlePreset(Number(e.target.value));
//                   }
//                 }}
//                 className="ui-input"
//                 style={{ minWidth: 140 }}
//               >
//                 <option value="0">Today</option>
//                 <option value="-1">Yesterday</option>
//                 <option value="7">Last 7 days</option>
//                 <option value="14">Last 14 days</option>
//                 <option value="30">Last 30 days</option>
//                 <option value="90">Last 90 days</option>
//                 <option value="custom">Custom...</option>
//               </select>
//             </label>

//             <div
//               role="group"
//               aria-label="Custom date range"
//               style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
//             >
//               <input
//                 type="date"
//                 aria-label="Start date"
//                 className="ui-input"
//                 onChange={onCustomStartChange}
//               />
//               <span aria-hidden="true" style={{ color: subtle }}>
//                 to
//               </span>
//               <input
//                 type="date"
//                 aria-label="End date"
//                 className="ui-input"
//                 onChange={onCustomEndChange}
//               />
//             </div>
//           </div>
//         </div>

//         <div className="card-content" style={{ paddingTop: 8 }}>
//           <div
//             id={ariaDateId}
//             aria-live="polite"
//             style={{ fontSize: 12, color: subtle, marginBottom: 8 }}
//           >
//             {dateLiveLabel}
//           </div>

//           <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
//             <div className="card" aria-label="Activity by User">
//               <div className="card-header" style={{ paddingBottom: 0 }}>
//                 <h4 className="card-title">Activity by User</h4>
//                 <div className="card-subtitle">Counts derived from associated activity</div>
//               </div>

//               {debugEnabled ? (
//                 <div
//                   className="card-content"
//                   style={{
//                     paddingTop: 8,
//                     paddingBottom: 0,
//                   }}
//                 >
//                   <div
//                     style={{
//                       border: "1px dashed #F59E0B",
//                       background: "rgba(245, 158, 11, 0.08)",
//                       borderRadius: 10,
//                       padding: "10px 12px",
//                       fontSize: 12,
//                       color: "#111827",
//                     }}
//                   >
//                     <div style={{ fontWeight: 700, marginBottom: 6 }}>Users Analytics Debug</div>
//                     <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 4 }}>
//                       <div style={{ color: "#6B7280" }}>organization_id</div>
//                       <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
//                         {String(debugInfo.organization_id ?? "")}
//                       </div>

//                       <div style={{ color: "#6B7280" }}>from</div>
//                       <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
//                         {String(debugInfo.from ?? "")}
//                       </div>

//                       <div style={{ color: "#6B7280" }}>to</div>
//                       <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
//                         {String(debugInfo.to ?? "")}
//                       </div>

//                       <div style={{ color: "#6B7280" }}>userIds sent</div>
//                       <div>{Number(debugInfo.requestedUserIdsCount || 0)}</div>

//                       <div style={{ color: "#6B7280" }}>sum(total_count)</div>
//                       <div>
//                         <strong>{Number(debugInfo.totalSum || 0)}</strong>
//                       </div>

//                       <div style={{ color: "#6B7280" }}>first 5 rows</div>
//                       <div>
//                         {(debugInfo.first5Rows || []).length === 0 ? (
//                           <span style={{ color: "#6B7280" }}>n/a</span>
//                         ) : (
//                           <ol style={{ margin: "4px 0 0 18px", padding: 0 }}>
//                             {(debugInfo.first5Rows || []).map((r) => (
//                               <li key={r.id}>
//                                 {r.name}: <strong>{r.total_count}</strong>
//                               </li>
//                             ))}
//                           </ol>
//                         )}
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               ) : null}

//               <div className="card-content" style={{ height: 360, minHeight: 360 }}>
//                 {usersLoading || projectsLoading ? (
//                   <div aria-busy="true">
//                     <Skeleton width="60%" height={14} className="mb-2" />
//                     <Skeleton width="50%" height={12} className="mb-2" />
//                     <Skeleton width="100%" height={300} />
//                   </div>
//                 ) : usersError ? (
//                   <div className="error" role="alert">
//                     {usersError.message || "Failed to load users"}
//                   </div>
//                 ) : projectsError ? (
//                   <div className="error" role="alert">
//                     {projectsError}
//                   </div>
//                 ) : !Array.isArray(users) || users.length === 0 ? (
//                   <div className="screen-center">No users</div>
//                 ) : (
//                   // IMPORTANT: ResponsiveContainer needs a measurable parent. Enforce minHeight and 100% height.
//                   <div style={{ height: "100%", minHeight: 320 }}>
//                     {(() => {
//                       // One-time gated debug immediately before the chart render:
//                       // prints first 5 rows and sum(total_count) for the *final rows passed to Recharts*.
//                       if (
//                         debugEnabled &&
//                         process.env.NODE_ENV !== "production" &&
//                         typeof window !== "undefined" &&
//                         !window.__usersActivityByUserChartLogged
//                       ) {
//                         const rows = (aggregates.activityByUserRows || []).slice(0, 20);
//                         const sum = rows.reduce(
//                           (acc, r) => acc + (Number.isFinite(Number(r?.total_count)) ? Number(r.total_count) : 0),
//                           0
//                         );

//                         // eslint-disable-next-line no-console
//                         console.log("[UsersAnalyticsPanel] ActivityByUser BarChart rows (first 5) + sum(total_count)", {
//                           first5: rows.slice(0, 5),
//                           sum,
//                           length: rows.length,
//                         });

//                         window.__usersActivityByUserChartLogged = true;
//                       }
//                       return null;
//                     })()}
//                     <ResponsiveContainer width="100%" height="100%">
//                       <BarChart
//                         data={(aggregates.activityByUserRows || []).slice(0, 20)}
//                         margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
//                       >
//                         <CartesianGrid strokeDasharray="3 3" stroke={grid} />
//                         <XAxis
//                           dataKey="name"
//                           tick={{ fill: subtle, fontSize: 12 }}
//                           interval={0}
//                           angle={-25}
//                           textAnchor="end"
//                           height={50}
//                         />
//                         <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} />
//                         <Tooltip
//                           content={({ active, payload, label }) => {
//                             if (!active || !Array.isArray(payload) || payload.length === 0) return null;

//                             const row = payload?.[0]?.payload || {};

//                             // IMPORTANT:
//                             // - "Projects" must be UNIQUE projects count only.
//                             // - Do not fall back to any "count" fields (those are often session/event counts).
//                             const projectsCount = Number.isFinite(Number(row?.projects_count))
//                               ? Number(row.projects_count)
//                               : 0;

//                             // Sessions count flow must remain unchanged.
//                             const sessionsCount = Number.isFinite(Number(row?.total_count))
//                               ? Number(row.total_count)
//                               : 0;

//                             return (
//                               <div
//                                 style={{
//                                   background: "#ffffff",
//                                   border: "1px solid #E5E7EB",
//                                   borderRadius: 8,
//                                   padding: "10px 12px",
//                                   boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
//                                   color: "#111827",
//                                   fontSize: 12,
//                                   lineHeight: 1.35,
//                                 }}
//                               >
//                                 <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>

//                                 <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
//                                   <span style={{ color: "#6B7280" }}>Projects:</span>
//                                   <span style={{ fontWeight: 600 }}>{projectsCount}</span>
//                                 </div>

//                                 <div
//                                   style={{
//                                     display: "flex",
//                                     justifyContent: "space-between",
//                                     gap: 12,
//                                     marginTop: 4,
//                                   }}
//                                 >
//                                   <span style={{ color: "#6B7280" }}>Sessions:</span>
//                                   <span style={{ fontWeight: 600 }}>{sessionsCount}</span>
//                                 </div>
//                               </div>
//                             );
//                           }}
//                         />
//                         <Legend />
//                         <Bar
//                           dataKey="total_count"
//                           name="Sessions"
//                           fill={primary}
//                           stroke={primary}
//                           radius={[6, 6, 0, 0]}
//                         />
//                       </BarChart>
//                     </ResponsiveContainer>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// UsersAnalyticsPanel.propTypes = {
//   style: PropTypes.object,
//   className: PropTypes.string,
//   defaultDays: PropTypes.number,
// };


import { useState, useEffect, useMemo } from "react"; import PropTypes from "prop-types"; import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, } from "recharts"; import { useUsers } from "../../hooks/useUsers"; import { getUserProjects } from "../../api/users"; import { getActiveTenant } from "../../utils/tenantClient"; import Skeleton from "../../components/ui/Skeleton"; /** * PUBLIC_INTERFACE * UsersAnalyticsPanel * A charts/analytics panel for the Users page, with independent filters. * * Data source: * - Reuses /api/users to get users, then uses /api/users/:userId/projects * to fetch per-user projects when available. * * Filters: * - Quick range + Custom date range. * * Date normalization requirement: * - Always send full-day UTC bounds: * - from = YYYY-MM-DDT00:00:00.000Z * - to = YYYY-MM-DDT23:59:59.999Z */ export default function UsersAnalyticsPanel({ style, className, defaultDays = 0 }) { // Filter state (independent from Overview) const [days, setDays] = useState(defaultDays); const [customStart, setCustomStart] = useState(null); const [customEnd, setCustomEnd] = useState(null); const [dateLiveLabel, setDateLiveLabel] = useState(""); // Active tenant (scoped by client too, but visible here for explicit query params when needed) const activeTenantId = getActiveTenant?.() || null; /** * Compute date range ISO strings for API query params. * IMPORTANT: Avoid local timezone when deriving these bounds. We construct * dates using UTC components via Date.UTC(...). */ const { startISO, endISO } = useMemo(() => { const utcStartOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 0, 0, 0, 0)); const utcEndOfDay = (y, m, d) => new Date(Date.UTC(y, m, d, 23, 59, 59, 999)); const parseYMD = (ymd) => { if (!ymd) return null; const [y, m, d] = ymd.split("-").map(Number); return { y, m0: m - 1, d }; }; let start; let end; /** ------------------------- * CUSTOM DATE RANGE * ------------------------*/ if (customStart && customEnd) { const s = parseYMD(customStart); const e = parseYMD(customEnd); start = utcStartOfDay(s.y, s.m0, s.d); end = utcEndOfDay(e.y, e.m0, e.d); } /** ------------------------- * QUICK RANGE PRESETS * ------------------------*/ else { const now = new Date(); const y = now.getUTCFullYear(); const m = now.getUTCMonth(); const d = now.getUTCDate(); // Today if (days === 0) { start = utcStartOfDay(y, m, d); end = utcEndOfDay(y, m, d); } // Yesterday else if (days === -1) { const yd = new Date(Date.UTC(y, m, d - 1)); start = utcStartOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate()); end = utcEndOfDay(yd.getUTCFullYear(), yd.getUTCMonth(), yd.getUTCDate()); } // Last N days (inclusive) else { end = utcEndOfDay(y, m, d); const sd = new Date(Date.UTC(y, m, d)); sd.setUTCDate(sd.getUTCDate() - (days - 1)); start = utcStartOfDay(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate()); } } // Safety guard if (start > end) [start, end] = [end, start]; return { startISO: start.toISOString(), endISO: end.toISOString() }; }, [customStart, customEnd, days]); // Live label for date range for accessibility useEffect(() => { const start = new Date(startISO); const end = new Date(endISO); const fmt = (d) => d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", }); setDateLiveLabel(${fmt(start)} \u2013 ${fmt(end)}); }, [startISO, endISO]); // Fetch users; table is unchanged elsewhere const { users, loading: usersLoading, error: usersError } = useUsers({ limit: 200 }); // Fetch projects per user when needed const [projectsByUser, setProjectsByUser] = useState({}); const [projectsLoading, setProjectsLoading] = useState(false); const [projectsError, setProjectsError] = useState(""); useEffect(() => { let cancelled = false; async function run() { if (!Array.isArray(users) || users.length === 0 || !activeTenantId) { setProjectsByUser({}); return; } setProjectsLoading(true); setProjectsError(""); const acc = {}; try { // Fetch in small batches to avoid overloading backend const batchSize = 8; for (let i = 0; i < users.length; i += batchSize) { const slice = users.slice(i, i + batchSize); await Promise.all( slice.map(async (u) => { if (!u?._id) return; try { // IMPORTANT: startISO/endISO are full-day UTC bounds by construction. // Use shared API helper so ISODate wrapping stays consistent. const res = await getUserProjects(String(u._id), { organization_id: activeTenantId, from: startISO, to: endISO, }); // Preserve full response so we can access: // - res.projects (distinct projects) // - res.total_count (sessions count) acc[String(u._id)] = res || { projects: [] }; } catch { // Preserve prior behavior: user still exists, but no projects response. acc[String(u._id)] = acc[String(u._id)] || { projects: [] }; } }) ); if (cancelled) return; } if (!cancelled) setProjectsByUser(acc); } catch (e) { if (!cancelled) { setProjectsError(e?.message || "Failed to load user projects."); setProjectsByUser({}); } } finally { if (!cancelled) setProjectsLoading(false); } } run(); return () => { cancelled = true; }; }, [users, activeTenantId, startISO, endISO]); const aggregates = useMemo(() => { const projectsCountByUser = []; for (const u of users || []) { const uid = String(u?._id || u?.id || ""); const res = projectsByUser[uid]; // Existing behavior (Projects): derived from distinct projects list length const projectsCount = Array.isArray(res?.projects) ? res.projects.length : Array.isArray(res) ? res.length : 0; // New behavior (Sessions): derived from backend total_count const sessionsCount = typeof res?.total_count === "number" ? res.total_count : Number.isFinite(Number(res?.total_count)) ? Number(res.total_count) : 0; projectsCountByUser.push({ user: u?.name || u?.full_name || u?.email || uid, user_id: uid, count: projectsCount, total_count: sessionsCount, }); } // IMPORTANT: Bars should be based on sessions count, so sort accordingly. projectsCountByUser.sort((a, b) => (b.total_count || 0) - (a.total_count || 0)); return { projectsCountByUser }; }, [users, projectsByUser]); // Theme colors const primary = "#2563EB"; const grid = "#E5E7EB"; const subtle = "#e2750eff"; const ariaDateId = "users-analytics-date-label"; const handlePreset = (d) => { setCustomStart(null); setCustomEnd(null); setDays(d); }; const onCustomStartChange = (e) => setCustomStart(e.target.value || null); const onCustomEndChange = (e) => setCustomEnd(e.target.value || null); return ( <div className={className} style={{ ...style }}> <div className="card" style={{ marginBottom: 12 }}> <div className="card-header" style={{ paddingBottom: 0, gap: 12 }}> <div> <h3 className="card-title">Users Analytics</h3> <div className="card-subtitle">User activity distribution</div> </div> <div className="card-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}> <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}> <span style={{ fontSize: 12, color: subtle }}>Quick range</span> <select aria-label="Quick date range" value={customStart && customEnd ? "custom" : String(days)} onChange={(e) => { if (e.target.value === "custom") { // leave as-is; user will pick dates below } else { handlePreset(Number(e.target.value)); } }} className="ui-input" style={{ minWidth: 140 }} > <option value="0">Today</option> <option value="-1">Yesterday</option> <option value="7">Last 7 days</option> <option value="14">Last 14 days</option> <option value="30">Last 30 days</option> <option value="90">Last 90 days</option> <option value="custom">Custom...</option> </select> </label> <div role="group" aria-label="Custom date range" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} > <input type="date" aria-label="Start date" className="ui-input" onChange={onCustomStartChange} /> <span aria-hidden="true" style={{ color: subtle }}> to </span> <input type="date" aria-label="End date" className="ui-input" onChange={onCustomEndChange} /> </div> </div> </div> <div className="card-content" style={{ paddingTop: 8 }}> <div id={ariaDateId} aria-live="polite" style={{ fontSize: 12, color: subtle, marginBottom: 8 }} > {dateLiveLabel} </div> <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}> <div className="card" aria-label="Activity by User"> <div className="card-header" style={{ paddingBottom: 0 }}> <h4 className="card-title">Activity by User</h4> <div className="card-subtitle">Counts derived from associated activity</div> </div> <div className="card-content" style={{ height: 340 }}> {usersLoading || projectsLoading ? ( <div aria-busy="true"> <Skeleton width="60%" height={14} className="mb-2" /> <Skeleton width="50%" height={12} className="mb-2" /> <Skeleton width="100%" height={300} /> </div> ) : usersError ? ( <div className="error" role="alert"> {usersError.message || "Failed to load users"} </div> ) : projectsError ? ( <div className="error" role="alert"> {projectsError} </div> ) : aggregates.projectsCountByUser.length === 0 ? ( <div className="screen-center">No sessions data</div> ) : ( <ResponsiveContainer> <BarChart data={aggregates.projectsCountByUser.slice(0, 20)} margin={{ top: 8, right: 16, bottom: 24, left: 8 }} > <CartesianGrid strokeDasharray="3 3" stroke={grid} /> <XAxis dataKey="user" tick={{ fill: subtle, fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={50} /> <YAxis tick={{ fill: subtle, fontSize: 12 }} allowDecimals={false} /> <Tooltip content={({ active, payload, label }) => { if (!active || !Array.isArray(payload) || payload.length === 0) return null; const row = payload?.[0]?.payload || {}; const projectsCount = Number.isFinite(Number(row?.count)) ? Number(row.count) : 0; const sessionsCount = Number.isFinite(Number(row?.total_count)) ? Number(row.total_count) : 0; return ( <div style={{ background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", color: "#111827", fontSize: 12, lineHeight: 1.35, }} > <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div> <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}> <span style={{ color: "#6B7280" }}>Projects:</span> <span style={{ fontWeight: 600 }}>{projectsCount}</span> </div> <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4, }} > <span style={{ color: "#6B7280" }}>Sessions:</span> <span style={{ fontWeight: 600 }}>{sessionsCount}</span> </div> </div> ); }} /> <Legend /> <Bar dataKey="total_count" name="Sessions" fill={primary} stroke={primary} radius={[6, 6, 0, 0]} /> </BarChart> </ResponsiveContainer> )} </div> </div> </div> </div> </div> </div> ); } UsersAnalyticsPanel.propTypes = { style: PropTypes.object, className: PropTypes.string, defaultDays: PropTypes.number, };