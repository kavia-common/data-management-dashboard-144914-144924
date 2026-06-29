import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Card from "../../../components/ui/Card.jsx";
import DataTable from "../../../components/DataTable.jsx";
import { getChartTheme } from "../../../components/charts/chartTheme.js";
import { getSessionStatsByDomain } from "../../../api/users.js";
import { exportRowsToCsvFlow } from "../../../utils/csvExport.js";

/**
 * Credits configuration constant (frontend display).
 * This mirrors the backend CREDIT_MULTIPLIER in src/config/creditsConfig.js.
 *
 * *** TO EDIT THE CREDITS MULTIPLIER ***
 * Change the value in the backend: mongodb_dashboard_backend/src/config/creditsConfig.js
 * The value here is for display fallback only — actual credits are computed on the backend.
 */
// NOTE: Edit CREDIT_MULTIPLIER in mongodb_dashboard_backend/src/config/creditsConfig.js to change the multiplier
const CREDIT_MULTIPLIER = 20000;

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Format a duration value (seconds) into a human-readable string.
 * e.g. 3661 → "1h 1m 1s"
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "0s";
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

/**
 * Format a credits value for display.
 * Uses thousands separator formatting.
 * @param {number} credits
 * @returns {string}
 */
function formatCredits(credits) {
  const n = typeof credits === "number" && Number.isFinite(credits) ? credits : 0;
  try {
    return n.toLocaleString();
  } catch {
    return String(n);
  }
}

/**
 * Truncate a long email / user label for the chart X-axis.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncateLabel(str, maxLen = 14) {
  if (!str || str.length <= maxLen) return str || "";
  return str.slice(0, maxLen - 1) + "…";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

/** Status badge renderer for session table rows */
function StatusBadge({ status }) {
  const colorMap = {
    completed: { bg: "rgba(34,197,94,0.15)", color: "#22c55e" },
    active: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6" },
    failed: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
    error: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
  };
  const s = (status || "").toLowerCase();
  const style = colorMap[s] || { bg: "rgba(160,160,160,0.15)", color: "#a0a0a0" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        textTransform: "capitalize",
      }}
    >
      {status || "—"}
    </span>
  );
}

// ─── Custom Tooltip for the Bar Chart ─────────────────────────────────────────

/**
 * CustomBarTooltip
 * Renders the per-user total session duration AND a list of individual session
 * breakdowns when the user hovers over a bar.
 *
 * Recharts passes: { active, payload, label }
 * payload[0].payload contains the full data item (including sessionBreakdown).
 */
function CustomBarTooltip({ active, payload, label }) {
  const theme = getChartTheme();

  if (!active || !payload || !payload.length) return null;

  const item = payload[0]?.payload || {};
  const totalDuration = item.totalSessionDuration || 0;
  const breakdown = Array.isArray(item.sessionBreakdown) ? item.sessionBreakdown : [];
  const totalCost = item.totalCost != null ? Number(item.totalCost) : null;
  // Use backend-computed totalCredits when available; fall back to computing from totalCost
  const totalCredits =
    item.totalCredits != null
      ? Number(item.totalCredits)
      : totalCost != null
      ? Math.round(totalCost * CREDIT_MULTIPLIER)
      : null;

  return (
    <div
      role="tooltip"
      style={{
        background: theme.tooltip.bg,
        border: `1px solid ${theme.tooltip.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        color: theme.tooltip.text,
        fontSize: 13,
        minWidth: 240,
        maxWidth: 340,
        maxHeight: 320,
        overflowY: "auto",
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
      }}
    >
      {/* User identifier */}
      <div
        style={{
          fontWeight: 700,
          marginBottom: 6,
          wordBreak: "break-all",
          color: theme.primary,
          fontSize: 13,
        }}
      >
        {item.email || label}
      </div>

      {/* Total */}
      <div style={{ marginBottom: 8, opacity: 0.9 }}>
        <span style={{ opacity: 0.7 }}>Total: </span>
        <strong>{formatDuration(totalDuration)}</strong>
        <span style={{ opacity: 0.55, marginLeft: 8, fontSize: 11 }}>
          ({totalDuration.toLocaleString()}s)
        </span>
      </div>

      {/* Total Cost */}
      {totalCost != null && (
        <div style={{ marginBottom: 4, opacity: 0.9 }}>
          <span style={{ opacity: 0.7 }}>Cost: </span>
          <strong>${totalCost.toFixed(6)}</strong>
        </div>
      )}

      {/* Total Credits */}
      {totalCredits != null && (
        <div style={{ marginBottom: 8, opacity: 0.9 }}>
          <span style={{ opacity: 0.7 }}>Credits: </span>
          <strong>{formatCredits(totalCredits)}</strong>
        </div>
      )}

      {/* Per-session breakdown */}
      {breakdown.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              opacity: 0.6,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
              borderTop: `1px solid ${theme.tooltip.border}`,
              paddingTop: 6,
            }}
          >
            Session breakdown ({breakdown.length})
          </div>
          {breakdown.map((session, idx) => {
            const sid =
              session.sessionId ||
              session.session_id ||
              session._id ||
              `#${idx + 1}`;
            const dur = session.duration || session.total_duration || 0;
            const stat = session.status || "";
            return (
              <div
                key={sid}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "3px 0",
                  fontSize: 12,
                  gap: 8,
                  borderBottom:
                    idx < breakdown.length - 1
                      ? `1px solid rgba(255,255,255,0.06)`
                      : "none",
                }}
              >
                <span
                  style={{
                    opacity: 0.65,
                    fontFamily: "monospace",
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 130,
                  }}
                  title={String(sid)}
                >
                  {String(sid).length > 14
                    ? String(sid).slice(-14)
                    : String(sid)}
                </span>
                <span style={{ whiteSpace: "nowrap", opacity: 0.85 }}>
                  {formatDuration(dur)}
                </span>
                {stat && (
                  <span
                    style={{
                      fontSize: 10,
                      opacity: 0.7,
                      textTransform: "capitalize",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stat}
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Table Column Definitions ──────────────────────────────────────────────────

/** Column definitions for the per-user sessions data table */
const USER_TABLE_COLUMNS = [
  {
    key: "email",
    label: "Email",
    priority: 1,
    render: (v) => v || "—",
  },
  {
    key: "totalSessionDuration",
    label: "Total Duration",
    priority: 1,
    render: (v) =>
      v != null ? (
        <span title={`${v} seconds`}>{formatDuration(v)}</span>
      ) : (
        "—"
      ),
  },
  {
    key: "totalCredits",
    label: "Credits",
    priority: 1,
    render: (v, row) => {
      // Use backend-returned totalCredits; fallback to computing from totalCost
      const credits =
        v != null
          ? Number(v)
          : row.totalCost != null
          ? Math.round(Number(row.totalCost) * CREDIT_MULTIPLIER)
          : null;
      if (credits == null) return "—";
      return (
        <span title={`${credits.toLocaleString()} credits`}>
          {formatCredits(credits)}
        </span>
      );
    },
  },
  {
    key: "_sessionCount",
    label: "Sessions",
    priority: 2,
    render: (_v, row) => {
      const count = Array.isArray(row.sessionBreakdown)
        ? row.sessionBreakdown.length
        : "—";
      return count;
    },
  },
  {
    key: "userId",
    label: "User ID",
    priority: 3,
    render: (v) =>
      v ? (
        <span
          style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7 }}
          title={v}
        >
          {v.length > 16 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v}
        </span>
      ) : (
        "—"
      ),
  },
];

// ─── Session Breakdown Sub-table ───────────────────────────────────────────────

/**
 * SessionBreakdownTable
 * Shows the individual sessions for a given user in an expandable sub-section.
 */
function SessionBreakdownTable({ sessions }) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return (
      <span style={{ opacity: 0.5, fontSize: 12, fontStyle: "italic" }}>
        No session details
      </span>
    );
  }

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
      }}
      aria-label="Session breakdown"
    >
      <thead>
        <tr>
          {["Session ID", "Duration", "Status"].map((h) => (
            <th
              key={h}
              style={{
                padding: "4px 8px",
                textAlign: "left",
                opacity: 0.6,
                fontWeight: 600,
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                fontSize: 11,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sessions.map((s, idx) => {
          const sid =
            s.sessionId || s.session_id || s._id || `#${idx + 1}`;
          const dur = s.duration || s.total_duration || 0;
          const stat = s.status || "—";
          return (
            <tr key={`${sid}-${idx}`}>
              <td
                style={{
                  padding: "3px 8px",
                  fontFamily: "monospace",
                  opacity: 0.75,
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={String(sid)}
              >
                {String(sid)}
              </td>
              <td style={{ padding: "3px 8px", whiteSpace: "nowrap" }}>
                {formatDuration(dur)}
              </td>
              <td style={{ padding: "3px 8px" }}>
                <StatusBadge status={stat} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Expandable User Row ───────────────────────────────────────────────────────

/**
 * ExpandableUserRow
 * Renders a DataTable-like row for each user with an expand toggle to show
 * their session breakdown.
 */
function ExpandableUserRow({ user, theme }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        {/* Expand toggle */}
        <td style={{ padding: "8px 10px", width: 28, userSelect: "none" }}>
          <span
            style={{
              display: "inline-block",
              transition: "transform 0.2s",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              fontSize: 12,
              opacity: 0.7,
            }}
            aria-hidden="true"
          >
            {/* Standard chevron icon – rotates 90° when row is expanded */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </td>
        {/* Email */}
        <td style={{ padding: "8px 10px", fontWeight: 500, wordBreak: "break-word", maxWidth: 240 }}>
          {user.email || "—"}
        </td>
        {/* Total Duration */}
        <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
          {formatDuration(user.totalSessionDuration)}
        </td>
        {/* Credits */}
        <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
          {(() => {
            const credits =
              user.totalCredits != null
                ? Number(user.totalCredits)
                : user.totalCost != null
                ? Math.round(Number(user.totalCost) * CREDIT_MULTIPLIER)
                : null;
            return credits != null ? (
              <span title={`${credits.toLocaleString()} credits`}>
                {formatCredits(credits)}
              </span>
            ) : (
              "—"
            );
          })()}
        </td>
        {/* Session Count */}
        <td style={{ padding: "8px 10px", textAlign: "center" }}>
          {Array.isArray(user.sessionBreakdown)
            ? user.sessionBreakdown.length
            : 0}
        </td>
        {/* User ID */}
        <td
          style={{
            padding: "8px 10px",
            fontFamily: "monospace",
            fontSize: 11,
            opacity: 0.65,
          }}
          title={user.userId || ""}
        >
          {user.userId
            ? user.userId.length > 16
              ? `${user.userId.slice(0, 8)}…${user.userId.slice(-6)}`
              : user.userId
            : "—"}
        </td>
      </tr>
      {/* Expandable breakdown row */}
      {expanded && (
        <tr>
          <td
            colSpan={6}
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "8px 24px 16px 40px",
              borderBottom: `1px solid rgba(255,255,255,0.08)`,
            }}
          >
            <SessionBreakdownTable sessions={user.sessionBreakdown} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * PUBLIC_INTERFACE
 * TataSessionsTab
 * Renders the Sessions view inside the TATA super-admin section.
 *
 * Features:
 *  - Domain input (e.g. "davinci.com") to fetch user session statistics
 *  - Bar chart: x = user email (abbreviated), y = totalSessionDuration (seconds)
 *  - Custom tooltip shows per-session breakdown on bar hover
 *  - Expandable table below the chart for detailed per-session view
 *
 * Data source: GET /api/users/session-stats-by-domain?domain=<domain>
 *
 * @returns {JSX.Element}
 */
export default function TataSessionsTab() {
  const theme = getChartTheme();

  // ── Domain input state ──────────────────────────────────────────────────────
  const [domainInput, setDomainInput] = useState("");
  const [activeDomain, setActiveDomain] = useState("");

  // ── Fetch state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  // ── Chart active bar ─────────────────────────────────────────────────────────
  const [activeBarIndex, setActiveBarIndex] = useState(null);

  // ── AbortController ref for in-flight requests ──────────────────────────────
  const abortRef = useRef(null);

  /**
   * Trigger a fetch for the given domain.
   * Cancels any previous in-flight request.
   */
  const fetchDomain = useCallback(async (domain) => {
    const cleaned = (domain || "").trim().toLowerCase().replace(/^@/, "");
    if (!cleaned) return;

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResults(null);
    setActiveBarIndex(null);
    setActiveDomain(cleaned);

    try {
      const data = await getSessionStatsByDomain(cleaned, {
        signal: abortRef.current.signal,
      });
      setResults(data);
    } catch (err) {
      // Ignore abort errors (user typed another domain)
      if (err?.name === "AbortError") return;
      const msg =
        err?.payload?.message ||
        err?.message ||
        "Failed to load session stats";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  /** Handle form submission (Enter key or button click) */
  const handleSubmit = (e) => {
    e && e.preventDefault();
    fetchDomain(domainInput);
  };

  // ── Derived chart + table data ───────────────────────────────────────────────
  const userRows = Array.isArray(results?.data) ? results.data : [];

  // Sort by totalSessionDuration descending for better visual hierarchy
  const chartData = [...userRows].sort(
    (a, b) => (b.totalSessionDuration || 0) - (a.totalSessionDuration || 0)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Domain Input Card */}
      <Card
        title="Session Stats by Domain"
        subtitle="Enter an email domain to load session duration data for all matching users"
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
          }}
          aria-label="Domain search form"
        >
          <label
            htmlFor="tata-domain-input"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-secondary, #B0A8A0)",
              whiteSpace: "nowrap",
            }}
          >
            Email domain:
          </label>
          <input
            id="tata-domain-input"
            className="input-filter"
            type="text"
            placeholder="e.g. davinci.com"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            style={{ minWidth: 220, maxWidth: 380 }}
            aria-label="Email domain to search"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !domainInput.trim()}
            aria-label="Fetch session stats"
            style={{ minWidth: 100 }}
          >
            {loading ? "Loading…" : "Fetch Stats"}
          </button>

          {/* Result meta info */}
          {results && !loading && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12,
                color: "var(--color-text-secondary, #B0A8A0)",
                whiteSpace: "nowrap",
              }}
            >
              {results.count ?? userRows.length} user
              {(results.count ?? userRows.length) !== 1 ? "s" : ""} for{" "}
              <strong>@{activeDomain}</strong>
            </span>
          )}
        </form>

        {/* Inline error */}
        {error && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              fontSize: 13,
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && results && userRows.length === 0 && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              color: "var(--color-text-secondary, #B0A8A0)",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            No users found for domain <strong>@{activeDomain}</strong>.
          </div>
        )}
      </Card>

      {/* Bar Chart Card — only visible when we have data */}
      {userRows.length > 0 && (
        <Card
          title={`Session Duration by User — @${activeDomain}`}
          subtitle="Hover a bar to see per-session breakdown · Y-axis in seconds"
        >
          <div style={{ width: "100%", height: 340 }}>
            <ResponsiveContainer>
              <BarChart
                data={chartData}
                margin={{ top: 12, right: 24, left: 0, bottom: 40 }}
                onMouseLeave={() => setActiveBarIndex(null)}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={theme.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="email"
                  tickFormatter={(v) => truncateLabel(v, 16)}
                  tick={{
                    fill: theme.label,
                    fontSize: 11,
                  }}
                  tickLine={false}
                  axisLine={{ stroke: theme.axisTick }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  tickFormatter={(v) => formatDuration(v)}
                  tick={{ fill: theme.label, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: theme.axisTick }}
                  allowDecimals={false}
                  width={72}
                />
                <Tooltip
                  content={<CustomBarTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar
                  dataKey="totalSessionDuration"
                  name="Total Session Duration"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={64}
                  onMouseEnter={(_data, index) => setActiveBarIndex(index)}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        activeBarIndex === index
                          ? theme.primaryActive || "#e65c00"
                          : theme.primary
                      }
                      opacity={
                        activeBarIndex === null || activeBarIndex === index
                          ? 1
                          : 0.55
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Expandable User / Session Table — only visible when we have data */}
      {userRows.length > 0 && (
        <Card
          title={`User Session Records — @${activeDomain}`}
          subtitle="Click a row to expand per-session details"
        >
          <div style={{ overflowX: "auto" }}>
            {/* CSV Export button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                title="Export table data as CSV"
                aria-label="Export User Session Records as CSV"
                onClick={() => {
                  // Build flat rows for CSV: one row per user with aggregated fields
                  const csvColumns = [
                    { key: "email", label: "Email", getValue: (r) => r.email || "" },
                    {
                      key: "totalSessionDuration",
                      label: "Total Duration (s)",
                      getValue: (r) => r.totalSessionDuration != null ? r.totalSessionDuration : "",
                    },
                    {
                      key: "totalCredits",
                      label: "Credits",
                      getValue: (r) => {
                        if (r.totalCredits != null) return Number(r.totalCredits);
                        if (r.totalCost != null) return Math.round(Number(r.totalCost) * CREDIT_MULTIPLIER);
                        return "";
                      },
                    },
                    {
                      key: "totalCost",
                      label: "Total Cost (USD)",
                      getValue: (r) => r.totalCost != null ? Number(r.totalCost) : "",
                    },
                    {
                      key: "_sessionCount",
                      label: "Session Count",
                      getValue: (r) => Array.isArray(r.sessionBreakdown) ? r.sessionBreakdown.length : 0,
                    },
                    { key: "userId", label: "User ID", getValue: (r) => r.userId || "" },
                  ];
                  const safeFilename = `sessions-${activeDomain}-${new Date().toISOString().slice(0, 10)}.csv`;
                  try {
                    exportRowsToCsvFlow({ filename: safeFilename, columns: csvColumns, rows: chartData });
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error("CSV export failed:", e);
                  }
                }}
                style={{
                  fontSize: 12,
                  padding: "5px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span aria-hidden="true">⬇</span> Export CSV
              </button>
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
              aria-label="User session statistics table"
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid rgba(255,255,255,0.1)`,
                    textAlign: "left",
                  }}
                >
                  {/* Expand toggle column */}
                  <th style={{ width: 28, padding: "6px 10px" }} />
                  {[
                    "Email",
                    "Total Duration",
                    "Credits",
                    "Sessions",
                    "User ID",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "6px 10px",
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        opacity: 0.6,
                        textAlign:
                          h === "Credits"
                            ? "right"
                            : h === "Sessions"
                            ? "center"
                            : "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((user) => (
                  <ExpandableUserRow
                    key={user.userId || user.email}
                    user={user}
                    theme={theme}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Placeholder shown before any search is performed */}
      {!results && !loading && !error && (
        <Card>
          <div
            style={{
              textAlign: "center",
              padding: "40px 24px",
              color: "var(--color-text-secondary, #B0A8A0)",
              fontSize: 14,
            }}
          >
            <div
              style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}
              aria-hidden="true"
            >
              🔍
            </div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Enter a domain above to get started
            </div>
            <div style={{ opacity: 0.65, fontSize: 12 }}>
              Example:&nbsp;
              <code
                style={{
                  background: "rgba(255,255,255,0.07)",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                davinci.com
              </code>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
