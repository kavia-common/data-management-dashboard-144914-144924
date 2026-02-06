import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Card from "../ui/Card.jsx";
import DataTable from "../DataTable.jsx";
import { listDashboardUsersAnalytics } from "../../api/baseClient";
import { useQuickRange } from "../../modules/users/quickRangeContext";
import { useTenantFilter } from "../../modules/users/tenantFilterContext";

/**
 * PUBLIC_INTERFACE
 * UsersTableByQuickRange
 * Shows a Users table aligned to the Users Analytics Quick Range selection.
 *
 * Enhancement:
 * - Adds a local text search input that filters the already-fetched table rows by user name/email,
 *   without changing the underlying backend request or impacting other modules.
 *
 * Key requirements:
 * - No hard-coded cap (e.g., 25) should trim results.
 * - Pagination remains 20 per page (controlled via `pageSize` prop).
 *
 * Implementation notes:
 * - Uses the same aggregated backend endpoint as the analytics panel:
 *     GET /api/dashboard/users
 *   This endpoint returns already-filtered, already-aggregated per-user rows for the selected
 *   quick range (and optional tenant_id), and is not subject to the /api/users param-stripping
 *   rules that can accidentally lead to capped result sets.
 * - Pagination is handled purely by DataTable (client-side slicing) at `pageSize` items/page.
 * - Search filtering is client-side on the already-loaded rows to avoid changing backend APIs.
 */
export default function UsersTableByQuickRange({ pageSize = 20 }) {
  const { fromParam, toParam, label } = useQuickRange();
  const { selectedTenantId } = useTenantFilter();

  const [rows, setRows] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Single aggregated fetch per range/tenant (no client-side trimming).
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await listDashboardUsersAnalytics(
          {
            from: fromParam || undefined,
            to: toParam || undefined,
            tenant_id: selectedTenantId || undefined,
          },
          { signal: controller.signal }
        );
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (e?.name !== "AbortError") {
          setRows([]);
          setError(e?.message || "Failed to load users for the selected Quick Range.");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [fromParam, toParam, selectedTenantId]);

  const tableRows = useMemo(() => {
    // Normalize server rows into a table-friendly shape.
    // Backend already filters by date window and sorts by activity.
    const base = Array.isArray(rows) ? rows : [];

    return base.map((r) => ({
      // Keep both id variants to reduce the chance DataTable keying issues.
      _id: r?.userId || r?._id || r?.id,
      id: r?.userId || r?._id || r?.id,
      userId: r?.userId,
      name: r?.name || "",
      email: r?.email || "",
      __activityCount: Number(r?.totalSessions || 0),
      __distinctProjects: Number(r?.distinctProjects || 0),
      lastActivityAt: r?.lastActivityAt || null,
    }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = String(searchText || "").trim().toLowerCase();
    if (!q) return tableRows;

    return (Array.isArray(tableRows) ? tableRows : []).filter((r) => {
      const name = String(r?.name || "").toLowerCase();
      const email = String(r?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [tableRows, searchText]);

  const columns = useMemo(() => {
    return [
      {
        key: "name",
        label: "Name",
        priority: 1,
        render: (_v, row) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600 }}>{row?.name || "—"}</span>
          </div>
        ),
      },
      { key: "email", label: "Email", priority: 2, render: (v) => v || "—" },
      {
        key: "__activityCount",
        label: "Sessions",
        priority: 1,
        render: (v) => Number(v || 0).toLocaleString(),
      },
      {
        key: "__distinctProjects",
        label: "Projects",
        priority: 2,
        render: (v) => Number(v || 0).toLocaleString(),
      },
      {
        key: "lastActivityAt",
        label: "Last activity",
        priority: 3,
        render: (v) => (v ? new Date(v).toLocaleString() : "—"),
      },
    ];
  }, []);

  return (
    <Card
      title="Users (filtered by Quick Range)"
      subtitle={`Showing users with activity in: ${label}`}
    >
      <div className="card-content users-quickrange-table" style={{ paddingTop: 0 }}>
        {error ? (
          <div role="alert" className="error" style={{ marginBottom: 8 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <label style={{ flex: 1 }}>
            <span
              style={{
                display: "block",
                fontSize: 12,
                color: "#6B7280",
                marginBottom: 6,
              }}
            >
              Search by user name
            </span>
            <input
              type="text"
              className="ui-input"
              value={searchText}
              placeholder="Type a name (or email)…"
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="Search users by name"
            />
          </label>

          {searchText ? (
            <button
              type="button"
              className="ui-button"
              onClick={() => setSearchText("")}
              aria-label="Clear user name search"
              style={{ whiteSpace: "nowrap" }}
            >
              Clear
            </button>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          data={filteredRows}
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
