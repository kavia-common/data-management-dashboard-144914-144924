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

// ─── Date Range Presets ────────────────────────────────────────────────────────

/**
 * Available date range presets sent to the backend as the `range` query param.
 * Each item has:
 *   id      – the value sent to the backend API
 *   label   – the human-readable label shown in the UI
 *   isCustom – true for the "Custom" option which shows date pickers
 */
const DATE_RANGE_PRESETS = [
  { id: "last7", label: "Last 7 Days" },
  { id: "last14", label: "Last 14 Days" },
  { id: "lastMonth", label: "Last Month" },
  { id: "custom", label: "Custom Range", isCustom: true },
  { id: "all", label: "All Data" },
];

/** Default selected range when the component first mounts */
const DEFAULT_RANGE = "last7";

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

/**
 * Format a Date object to YYYY-MM-DD for use with date input elements.
 * @param {Date} date
 * @returns {string}
 */
function formatDateForInput(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Get the default startDate for the custom range picker:
 * 30 days ago in YYYY-MM-DD format.
 * @returns {string}
 */
function getDefaultCustomStart() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return formatDateForInput(d);
}

/**
 * Get today's date in YYYY-MM-DD format (for the endDate default).
 * @returns {string}
 */
function getDefaultCustomEnd() {
  return formatDateForInput(new Date());
}

/**
 * Build a human-readable label describing the active date range.
 * Used in the chart/table card subtitles.
 * @param {string} rangeId
 * @param {string|null} startDate
 * @param {string|null} endDate
 * @returns {string}
 */
function buildRangeLabel(rangeId, startDate, endDate) {
  if (rangeId === "custom" && startDate && endDate) {
    return `${startDate} → ${endDate}`;
  }
  const preset = DATE_RANGE_PRESETS.find((p) => p.id === rangeId);
  return preset ? preset.label : rangeId;
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

// ─── Table Column Definitions ─────────────────────────────────────────────────

/**
 * Column definitions for the per-user sessions data table.
 * Includes the Organization column which shows aggregated organization IDs
 * as a comma-separated string (added as an additive enhancement).
 */
const USER_TABLE_COLUMNS = [
  {
    key: "email",
    label: "Email",
    priority: 1,
    render: (v) => v || "—",
  },
  {
    // organizationId: aggregated comma-separated organization IDs from the users collection.
    // Single-org users display one value; multi-org users display all values separated by commas.
    key: "organizationId",
    label: "Organization",
    priority: 1,
    render: (v) =>
      v ? (
        <span title={v}>{v}</span>
      ) : (
        "—"
      ),
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

// ─── Session Breakdown Sub-table ──────────────────────────────────────────────

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
 *
 * Columns (in order): expand toggle, Email, Organization, Total Duration,
 * Credits, Sessions, User ID.
 * The Organization column shows the aggregated organizationId field returned
 * by the backend (comma-separated string when a user belongs to multiple orgs).
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
        {/* Organization — aggregated organizationId from the backend */}
        <td
          style={{
            padding: "8px 10px",
            wordBreak: "break-word",
            maxWidth: 200,
            fontSize: 12,
          }}
          title={user.organizationId || ""}
        >
          {user.organizationId || "—"}
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
      {/* Expandable breakdown row — colSpan updated to 7 to match new column count */}
      {expanded && (
        <tr>
          <td
            colSpan={7}
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

// ─── Date Range Filter Control ────────────────────────────────────────────────

/**
 * DateRangeFilter
 * Renders a row of preset buttons (Last 7 Days, Last 14 Days, etc.) and
 * conditionally shows start/end date pickers when "Custom Range" is selected.
 *
 * Props:
 *   selectedRange   – currently selected range id (string)
 *   onRangeChange   – called with (rangeId) when a preset is clicked
 *   customStart     – current custom start date (YYYY-MM-DD string)
 *   customEnd       – current custom end date (YYYY-MM-DD string)
 *   onCustomStart   – called with new start date string
 *   onCustomEnd     – called with new end date string
 *   onApply         – called when the "Apply" button is clicked (for custom range)
 *   disabled        – when true, all controls are disabled
 */
function DateRangeFilter({
  selectedRange,
  onRangeChange,
  customStart,
  customEnd,
  onCustomStart,
  onCustomEnd,
  onApply,
  disabled = false,
}) {
  const isCustom = selectedRange === "custom";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        marginTop: 12,
      }}
      aria-label="Date range filter"
      role="group"
    >
      {/* Label */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          opacity: 0.65,
          whiteSpace: "nowrap",
          marginRight: 4,
        }}
      >
        Date range:
      </span>

      {/* Preset buttons */}
      {DATE_RANGE_PRESETS.map((preset) => {
        const isActive = selectedRange === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onRangeChange(preset.id)}
            aria-pressed={isActive}
            style={{
              padding: "4px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: isActive ? 700 : 500,
              border: isActive
                ? "1.5px solid var(--color-primary, #e65c00)"
                : "1.5px solid rgba(255,255,255,0.18)",
              background: isActive
                ? "var(--color-primary-faint, rgba(230,92,0,0.13))"
                : "transparent",
              color: isActive
                ? "var(--color-primary, #e65c00)"
                : "var(--color-text-secondary, #B0A8A0)",
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {preset.label}
          </button>
        );
      })}

      {/* Custom date pickers — only shown when "Custom Range" is active */}
      {isCustom && (
        <>
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => onCustomStart(e.target.value)}
            disabled={disabled}
            aria-label="Custom start date"
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.05)",
              color: "var(--color-text, #f0ece8)",
              fontSize: 12,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          />
          <span style={{ opacity: 0.5, fontSize: 12 }}>→</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(e) => onCustomEnd(e.target.value)}
            disabled={disabled}
            aria-label="Custom end date"
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.05)",
              color: "var(--color-text, #f0ece8)",
              fontSize: 12,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          />
          <button
            type="button"
            disabled={disabled || !customStart || !customEnd}
            onClick={onApply}
            className="btn btn-primary"
            style={{ fontSize: 12, padding: "4px 14px", borderRadius: 20 }}
          >
            Apply
          </button>
        </>
      )}
    </div>
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
 *  - Date range filter: Last 7 Days (default), Last 14 Days, Last Month,
 *    Custom Date Range, or All Data — applied to both graph and table
 *  - Bar chart: x = user email (abbreviated), y = totalSessionDuration (seconds)
 *  - Custom tooltip shows per-session breakdown on bar hover
 *  - Expandable table below the chart for detailed per-session view
 *  - Organization column showing aggregated organizationId(s) per user
 *
 * Data source: GET /api/users/session-stats-by-domain?domain=<domain>&range=<range>
 *              (also accepts startDate/endDate for custom range)
 *
 * @returns {JSX.Element}
 */
export default function TataSessionsTab() {
  const theme = getChartTheme();

  // ── Domain input state ────────────────────────────────────────────────────
  const [domainInput, setDomainInput] = useState("");
  const [activeDomain, setActiveDomain] = useState("");

  // ── Date range filter state ───────────────────────────────────────────────
  /** Currently selected range preset id */
  const [selectedRange, setSelectedRange] = useState(DEFAULT_RANGE);
  /** Applied range id (committed after fetch) */
  const [appliedRange, setAppliedRange] = useState(DEFAULT_RANGE);
  /** Custom range start (YYYY-MM-DD) */
  const [customStart, setCustomStart] = useState(getDefaultCustomStart);
  /** Custom range end (YYYY-MM-DD) */
  const [customEnd, setCustomEnd] = useState(getDefaultCustomEnd);

  // ── Fetch state ───────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  // ── Chart active bar ──────────────────────────────────────────────────────
  const [activeBarIndex, setActiveBarIndex] = useState(null);

  // ── AbortController ref for in-flight requests ────────────────────────────
  const abortRef = useRef(null);

  /**
   * Trigger a fetch for the given domain and date range parameters.
   * Cancels any previous in-flight request.
   *
   * @param {string} domain - Email domain to query
   * @param {object} rangeParams - { range, startDate, endDate }
   */
  const fetchDomain = useCallback(async (domain, rangeParams = {}) => {
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
    setAppliedRange(rangeParams.range || DEFAULT_RANGE);

    try {
      const data = await getSessionStatsByDomain(
        cleaned,
        {
          range: rangeParams.range || DEFAULT_RANGE,
          startDate: rangeParams.startDate || null,
          endDate: rangeParams.endDate || null,
        },
        { signal: abortRef.current.signal }
      );
      setResults(data);
    } catch (err) {
      // Ignore abort errors (user typed another domain or changed filter)
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

  /**
   * Build the rangeParams object based on current filter state.
   * For custom range, includes startDate/endDate.
   * For presets, only includes range id.
   */
  const buildRangeParams = useCallback(
    (range = selectedRange) => {
      if (range === "custom") {
        return { range: "custom", startDate: customStart, endDate: customEnd };
      }
      return { range };
    },
    [selectedRange, customStart, customEnd]
  );

  /** Handle form submission (Enter key or button click) */
  const handleSubmit = (e) => {
    e && e.preventDefault();
    fetchDomain(domainInput, buildRangeParams());
  };

  /**
   * Handle preset button clicks.
   * If a domain is already active, immediately re-fetches with the new range.
   * For "custom", just switches the UI to show the date pickers without fetching.
   */
  const handleRangeChange = (rangeId) => {
    setSelectedRange(rangeId);
    // If already showing results and it's not custom (requires explicit Apply),
    // auto-refresh with the new range.
    if (activeDomain && rangeId !== "custom") {
      fetchDomain(activeDomain, { range: rangeId });
    }
  };

  /**
   * Handle the "Apply" button for custom date ranges.
   * Validates the dates and re-fetches if a domain is already active.
   */
  const handleApplyCustomRange = () => {
    if (!customStart || !customEnd) return;
    if (activeDomain) {
      fetchDomain(activeDomain, {
        range: "custom",
        startDate: customStart,
        endDate: customEnd,
      });
    }
  };

  // ── Derived chart + table data ────────────────────────────────────────────
  const userRows = Array.isArray(results?.data) ? results.data : [];

  // Sort by totalSessionDuration descending for better visual hierarchy
  const chartData = [...userRows].sort(
    (a, b) => (b.totalSessionDuration || 0) - (a.totalSessionDuration || 0)
  );

  /** Human-readable label for the active date range (shown in card subtitles) */
  const rangeLabel = buildRangeLabel(
    appliedRange,
    results?.dateFilter?.startDate || customStart,
    results?.dateFilter?.endDate || customEnd
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Domain Input + Date Range Filter Card */}
      <Card
        title="Session Stats by Domain"
        subtitle="Enter an email domain and choose a date range to load session data"
      >
        {/* Domain search form */}
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
            disabled={loading || !domainInput.trim() || (selectedRange === "custom" && (!customStart || !customEnd))}
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
              {" "}·{" "}
              <span style={{ opacity: 0.75 }}>{rangeLabel}</span>
            </span>
          )}
        </form>

        {/* Date range filter controls */}
        <DateRangeFilter
          selectedRange={selectedRange}
          onRangeChange={handleRangeChange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStart={setCustomStart}
          onCustomEnd={setCustomEnd}
          onApply={handleApplyCustomRange}
          disabled={loading}
        />

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
            No users found for domain <strong>@{activeDomain}</strong>{" "}
            within the selected date range ({rangeLabel}).
          </div>
        )}
      </Card>

      {/* Bar Chart Card — only visible when we have data */}
      {userRows.length > 0 && (
        <Card
          title={`Session Duration by User — @${activeDomain}`}
          subtitle={`Hover a bar to see per-session breakdown · Y-axis in seconds · ${rangeLabel}`}
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
          subtitle={`Click a row to expand per-session details · ${rangeLabel}`}
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
                  // Build flat rows for CSV: one row per user with aggregated fields.
                  // The Organization column is included as a comma-separated string of
                  // all organization IDs associated with the user.
                  const csvColumns = [
                    { key: "email", label: "Email", getValue: (r) => r.email || "" },
                    {
                      // organizationId: aggregated org IDs from backend, comma-separated
                      key: "organizationId",
                      label: "Organization",
                      getValue: (r) => r.organizationId != null ? String(r.organizationId) : "",
                    },
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
                  const rangeStr = appliedRange === "custom"
                    ? `${customStart}-to-${customEnd}`
                    : appliedRange;
                  const safeFilename = `sessions-${activeDomain}-${rangeStr}-${new Date().toISOString().slice(0, 10)}.csv`;
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
                    "Organization",
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
              &nbsp;· Default filter: <strong>Last 7 Days</strong>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
