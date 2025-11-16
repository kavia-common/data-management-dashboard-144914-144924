import React, { useEffect, useMemo, useState } from "react";
import { getUserSessions } from "../../api/userSessions";
import { useAuth } from "../../context/AuthContext.jsx";

// Format seconds to "Xh Ym Zs"
function formatDuration(secs) {
  const n = Number(secs);
  if (!Number.isFinite(n) || n < 0) return "—";
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || h) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

// Format ISO/Date to local string
function formatDate(val) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

/**
 * PUBLIC_INTERFACE
 * UserSessionsList
 * Displays a vertical list of user session breakdown entries across sessions (flattened).
 *
 * Props:
 * - userId: string (required)
 * - tenantId: string (required)
 */
function UserSessionsList({ userId, tenantId }) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const totalDuration = useMemo(
    () =>
      items.reduce((acc, it) => {
        const d = Number(it?.duration);
        if (Number.isFinite(d) && d >= 0) return acc + d;
        const s = it?.session_start ? new Date(it.session_start).getTime() : NaN;
        const e = it?.session_end ? new Date(it.session_end).getTime() : NaN;
        if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) return acc + Math.floor((e - s) / 1000);
        return acc;
      }, 0),
    [items]
  );

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!userId || !tenantId) {
        setItems([]);
        setMeta(null);
        setLoading(false);
        setErr("");
        return;
      }
      try {
        setLoading(true);
        setErr("");
        const { items: list, meta: m } = await getUserSessions(userId, tenantId, { page: 1, limit: 50 });
        if (!ignore) {
          setItems(Array.isArray(list) ? list : []);
          setMeta(m || null);
        }
      } catch (e) {
        if (!ignore) {
          setItems([]);
          setMeta(null);
          setErr(e?.message || "Failed to load user sessions.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [userId, tenantId]);

  return (
    <section
      aria-label="User Sessions"
      style={{
        position: "relative",
        background: "var(--bg-surface, #ffffff)",
        border: "1px solid var(--border-subtle, #E5E7EB)",
        borderRadius: 12,
        padding: 16,
        boxShadow: "var(--shadow-sm, 0 1px 2px rgba(16,24,40,0.04))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary, #111827)" }}>
          User Sessions
        </h3>
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-secondary, #374151)" }}>
        Total Duration: <strong style={{ color: "var(--text-primary, #111827)" }}>{formatDuration(totalDuration)}</strong>
      </div>

      <div role="list" aria-label="User sessions list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && (
          <div role="status" style={{ padding: 12, fontSize: 14, color: "var(--text-tertiary, #64748B)" }}>
            Loading sessions...
          </div>
        )}
        {err && !loading && (
          <div role="alert" style={{ padding: 12, fontSize: 14, color: "var(--error, #EF4444)" }}>
            {err}
          </div>
        )}
        {!loading && !err && items.length === 0 && (
          <div style={{ padding: 12, fontSize: 14, color: "var(--text-tertiary, #64748B)" }}>
            No sessions found for this user.
          </div>
        )}
        {!loading &&
          !err &&
          items.map((it, idx) => (
            <div
              key={`${it.session_id || "sid"}-${idx}`}
              role="listitem"
              style={{
                border: "1px solid var(--border-subtle, #E5E7EB)",
                borderRadius: 10,
                padding: 12,
                background: "var(--bg-surface, #ffffff)",
                boxShadow: "var(--shadow-sm, 0 1px 2px rgba(16,24,40,0.04))",
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}
              className="user-sessions-card"
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary, #64748B)", fontWeight: 600, marginBottom: 4 }}>
                  Session Start
                </div>
                <div style={{ fontSize: 14, color: "var(--text-primary, #111827)", fontWeight: 600 }}>
                  {formatDate(it?.session_start)}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary, #64748B)", fontWeight: 600, marginBottom: 4 }}>
                  Session End
                </div>
                <div style={{ fontSize: 14, color: "var(--text-primary, #111827)", fontWeight: 600 }}>
                  {formatDate(it?.session_end)}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary, #64748B)", fontWeight: 600, marginBottom: 4 }}>
                  Duration
                </div>
                <div style={{ fontSize: 14, color: "var(--text-primary, #111827)", fontWeight: 600 }}>
                  {formatDuration(it?.duration)}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-tertiary, #64748B)", fontWeight: 600, marginBottom: 4 }}>
                  Agents
                </div>
                <div style={{ fontSize: 14, color: "var(--text-primary, #111827)", fontWeight: 600 }}>
                  {Array.isArray(it?.agents) && it.agents.length
                    ? it.agents
                        .map((a) => {
                          if (a == null) return "";
                          if (typeof a === "string") return a;
                          if (typeof a === "object") return a.name || a["Agent Name"] || a.agent || a.id || "";
                          return "";
                        })
                        .filter(Boolean)
                        .join(", ")
                    : "—"}
                </div>
              </div>

              <style>{`
                @media (max-width: 639px) {
                  .user-sessions-card {
                    grid-template-columns: 1fr !important;
                  }
                }
              `}</style>
            </div>
          ))}
      </div>
    </section>
  );
}

export default UserSessionsList;
