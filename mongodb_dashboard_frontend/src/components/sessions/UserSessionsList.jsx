import React, { useEffect, useMemo, useState } from "react";
import { getUserSessions } from "../../api/userSessions";

/** Convert seconds to "Xh Ym Zs" */
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

/** Format ISO date/time to localized string */
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
 * Displays only session_breakdown entries filtered by user_id (+ tenant_id, optional project_id).
 *
 * Props:
 * - userId: string (required)
 * - tenantId: string (required)
 * - projectId?: string | null
 */
function UserSessionsList({ userId, tenantId, projectId = null }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Sum total duration from returned entries; fallback to computed diff when duration missing.
  const totalDuration = useMemo(() => {
    return (items || []).reduce((acc, it) => {
      const d = Number(it?.duration);
      if (Number.isFinite(d) && d >= 0) return acc + d;
      const s = it?.session_start ? new Date(it.session_start).getTime() : NaN;
      const e = it?.session_end ? new Date(it.session_end).getTime() : NaN;
      if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
        return acc + Math.floor((e - s) / 1000);
      }
      return acc;
    }, 0);
  }, [items]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!userId || !tenantId) {
        setItems([]);
        setErr("");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErr("");
        // Always pass tenantId and userId; include optional projectId.
        const { items: list } = await getUserSessions(userId, tenantId, {
          page: 1,
          limit: 100,
          projectId,
        });
        if (!ignore) {
          setItems(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        if (!ignore) {
          setItems([]);
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
  }, [userId, tenantId, projectId]);

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

      <div
        style={{
          marginBottom: 12,
          fontSize: 13,
          color: "var(--text-secondary, #374151)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        Total Duration:{" "}
        <strong style={{ color: "var(--text-primary, #111827)" }}>{formatDuration(totalDuration)}</strong>
        {projectId ? (
          <span
            aria-label="Project filter applied"
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(37,99,235,0.1)",
              color: "#2563EB",
              fontSize: 12,
              border: "1px solid rgba(37,99,235,0.2)",
            }}
          >
            Project: {String(projectId)}
          </span>
        ) : null}
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
            No session activity matched your filters for this user.
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
