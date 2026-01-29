import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Card from "../ui/Card.jsx";
import DataTable from "../DataTable.jsx";
import Tag from "../ui/Tag.jsx";
import { useUsers } from "../../hooks/useUsers";
import { listSessions } from "../../api/baseClient";
import { useQuickRange } from "../../modules/users/quickRangeContext";

/**
 * PUBLIC_INTERFACE
 * UsersTableByQuickRange
 * Shows a Users table aligned to the Users Analytics Quick Range selection.
 *
 * Behavior:
 * - Uses the same from/to as UsersAnalyticsPanel (via useQuickRange()).
 * - Fetches a bounded session list (single request) and computes per-user activity counts
 *   client-side to avoid changing APIs.
 * - Sorts users by activityCount (desc) within the selected range.
 *
 * Note: If session volume grows beyond the fetch cap, this may undercount. This intentionally
 * follows the task instruction to prefer client-side filtering without API changes.
 */
export default function UsersTableByQuickRange({ pageSize = 20 }) {
  const { fromParam, toParam, label } = useQuickRange();
  const { users, loading: usersLoading, error: usersError } = useUsers({ page: 1, sort: "-created_at" });

  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [sessions, setSessions] = useState([]);

  // Fetch sessions once per range; compute activity counts per user for the table.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setSessionsLoading(true);
      setSessionsError("");
      try {
        // Pull a reasonable cap. Sorting by last_updated helps keep most recent in the window.
        const resp = await listSessions({ page: 1, limit: 5000, sort: "-last_updated" });

        const items = Array.isArray(resp?.items) ? resp.items : Array.isArray(resp) ? resp : [];
        if (!cancelled) setSessions(items);
      } catch (e) {
        if (!cancelled) {
          setSessions([]);
          setSessionsError(e?.message || "Failed to load sessions for activity counts.");
        }
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fromParam, toParam]);

  const windowBounds = useMemo(() => {
    const parse = (v) => {
      if (!v) return null;
      // Support YYYY-MM-DD by expanding locally for filtering
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return new Date(`${v}T00:00:00.000Z`);
      }
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const from = parse(fromParam);
    let to = parse(toParam);
    // For YYYY-MM-DD "to", include whole day
    if (typeof toParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      to = new Date(`${toParam}T23:59:59.999Z`);
    }
    return { from, to };
  }, [fromParam, toParam]);

  const activityByUserId = useMemo(() => {
    const map = new Map();
    const fromMs = windowBounds.from ? windowBounds.from.getTime() : null;
    const toMs = windowBounds.to ? windowBounds.to.getTime() : null;

    (sessions || []).forEach((s) => {
      const when = s?.last_updated || s?.session_end || s?.session_start || s?.created_at;
      const ts = when ? new Date(when).getTime() : NaN;
      if (!Number.isFinite(ts)) return;
      if (fromMs !== null && ts < fromMs) return;
      if (toMs !== null && ts > toMs) return;

      const uid =
        s?.user_id ??
        s?.userId ??
        s?.user?._id ??
        s?.user?.id ??
        s?.user?.user_id ??
        null;

      if (!uid) return;
      const key = String(uid);
      map.set(key, (map.get(key) || 0) + 1);
    });

    return map;
  }, [sessions, windowBounds.from, windowBounds.to]);

  const tableRows = useMemo(() => {
    const base = Array.isArray(users) ? users : [];
    const enriched = base.map((u) => {
      const id = String(u?._id ?? u?.id ?? "");
      return {
        ...u,
        __activityCount: activityByUserId.get(id) || 0,
      };
    });

    // Filter to users with activity in the selected window (as requested)
    const filtered = enriched.filter((u) => (u.__activityCount || 0) > 0);

    // Sort by activity desc, then name/email for stability
    filtered.sort((a, b) => {
      const diff = (b.__activityCount || 0) - (a.__activityCount || 0);
      if (diff !== 0) return diff;
      const an = String(a?.name || a?.email || "");
      const bn = String(b?.name || b?.email || "");
      return an.localeCompare(bn);
    });

    return filtered;
  }, [users, activityByUserId]);

  const columns = useMemo(() => {
    return [
      {
        key: "name",
        label: "Name",
        priority: 1,
        render: (_v, row) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{row?.name || "—"}</span>
            {row?.is_admin ? <Tag aria-label="Admin badge" className="tag--amber">Admin</Tag> : null}
          </div>
        ),
      },
      { key: "email", label: "Email", priority: 2, render: (v) => v || "—" },
      {
        key: "__activityCount",
        label: "Activity (sessions)",
        priority: 1,
        render: (v) => Number(v || 0).toLocaleString(),
      },
      {
        key: "status",
        label: "Status",
        priority: 3,
        render: (v) => (
          <Tag aria-label="User status" className={`tag--${String(v || "unknown").toLowerCase()}`}>
            {v || "unknown"}
          </Tag>
        ),
      },
    ];
  }, []);

  const loading = usersLoading || sessionsLoading;
  const error = usersError ? String(usersError) : sessionsError ? String(sessionsError) : "";

  return (
    <Card
      title="Users (filtered by Quick Range)"
      subtitle={`Showing users with activity in: ${label}`}
    >
      {/* Wrapper class enables targeted CSS overrides for this specific table only */}
      <div className="card-content users-quickrange-table" style={{ paddingTop: 0 }}>
        {error ? <div role="alert" className="error" style={{ marginBottom: 8 }}>{error}</div> : null}
        <DataTable
          columns={columns}
          data={tableRows}
          loading={loading}
          pageSize={pageSize}
          initialPage={1}
          maxBodyHeight={420}
          forceHorizontalScroll={false}
          paginationTitle="Users"
        />
      </div>
    </Card>
  );
}

UsersTableByQuickRange.propTypes = {
  pageSize: PropTypes.number,
};
