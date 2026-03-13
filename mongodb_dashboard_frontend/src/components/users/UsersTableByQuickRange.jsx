import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Card from "../ui/Card.jsx";
import DataTable from "../DataTable.jsx";
import Button from "../ui/Button.jsx";
import { listDashboardUsersAnalytics } from "../../api/baseClient";
import { useQuickRange } from "../../modules/users/quickRangeContext";
import { useTenantFilter } from "../../modules/users/tenantFilterContext";
import { exportRowsToCsvFlow } from "../../utils/csvExport";

/**
 * PUBLIC_INTERFACE
 * UsersTableByQuickRange
 * Shows a Users table aligned to the Users Analytics Quick Range selection.
 *
 * Enhancement:
 * - Adds an Export CSV control that exports exactly the dataset currently populated in the table
 *   AFTER Quick Range + tenant + local search filters are applied.
 *
 * Key requirements:
 * - No hard-coded cap (e.g., 25) should trim results.
 * - Pagination remains 20 per page (controlled via `pageSize` prop).
 * - CSV export must match the filtered dataset currently shown in the table (not refetched, not unfiltered).
 *
 * Implementation notes:
 * - Uses the same aggregated backend endpoint as the analytics panel:
 *     GET /api/dashboard/users
 * - Search filtering is client-side on the already-loaded rows to avoid changing backend APIs.
 * - Export uses a reusable flow: ExportRowsToCsvFlow (src/utils/csvExport.js)
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

        // listDashboardUsersAnalytics returns an object shape:
        // { users: [...], activity, activityByUser, mode, interval, meta }
        // The table should render the per-user rows under `users`.
        setRows(Array.isArray(data?.users) ? data.users : []);
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

    return base.map((r) => {
      // Backend may send either tenant_id or organization_id and (optionally) a name.
      // We normalize to a single "tenantId" for display/export purposes.
      const tenantIdRaw = r?.tenant_id ?? r?.organization_id ?? r?.tenantId ?? r?.organizationId ?? null;
      const tenantNameRaw =
        r?.tenant_name ?? r?.organization_name ?? r?.tenantName ?? r?.organizationName ?? null;

      return {
        // Keep both id variants to reduce the chance DataTable keying issues.
        _id: r?.userId || r?._id || r?.id,
        id: r?.userId || r?._id || r?.id,
        userId: r?.userId,
        name: r?.name || "",
        email: r?.email || "",

        tenantId: tenantIdRaw ? String(tenantIdRaw) : "",
        tenantName: tenantNameRaw ? String(tenantNameRaw) : "",

        __activityCount: Number(r?.totalSessions || 0),
        __distinctProjects: Number(r?.distinctProjects || 0),
        lastActivityAt: r?.lastActivityAt || null,
      };
    });
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

      // Tenant/Organization columns (requested)
      { key: "tenantId", label: "Tenant ID", priority: 3, render: (v) => v || "—" },
      { key: "tenantName", label: "Tenant Name", priority: 3, render: (v) => v || "—" },

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

  const csvColumns = useMemo(() => {
    // Explicit CSV mapping to ensure export matches exactly what this table represents.
    // (We intentionally avoid exporting React-rendered nodes.)
    return [
      { key: "name", label: "Name", getValue: (r) => r?.name || "" },
      { key: "email", label: "Email", getValue: (r) => r?.email || "" },

      // Tenant/Organization columns (requested)
      { key: "tenantId", label: "Tenant ID", getValue: (r) => r?.tenantId || "" },
      { key: "tenantName", label: "Tenant Name", getValue: (r) => r?.tenantName || "" },

      { key: "__activityCount", label: "Sessions", getValue: (r) => Number(r?.__activityCount || 0) },
      { key: "__distinctProjects", label: "Projects", getValue: (r) => Number(r?.__distinctProjects || 0) },
      {
        key: "lastActivityAt",
        label: "Last activity",
        getValue: (r) => (r?.lastActivityAt ? new Date(r.lastActivityAt).toISOString() : ""),
      },
    ];
  }, []);

  const onExportCsv = () => {
    // Export EXACTLY what is currently populated in the table after filters.
    // Note: DataTable paginates client-side; requirement states "data currently populated in the Users view"
    // (i.e., the filtered dataset), so we export filteredRows (all filtered, not just current page).
    const tenantPart = selectedTenantId ? `tenant-${selectedTenantId}` : "all-tenants";
    const filename = `users-${tenantPart}-${label.replace(/\s+/g, "_").replace(/[^\w-]/g, "")}.csv`;

    exportRowsToCsvFlow({
      filename,
      columns: csvColumns,
      rows: filteredRows,
    });
  };

  return (
    <Card title="Users (filtered by Quick Range)" subtitle={`Showing users with activity in: ${label}`}>
      <div className="card-content users-quickrange-table" style={{ paddingTop: 0 }}>
        {error ? (
          <div role="alert" className="error" style={{ marginBottom: 8 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 240 }}>
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

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap" }}>
              {loading ? "—" : `${filteredRows.length.toLocaleString()} users`}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onExportCsv}
              disabled={loading || filteredRows.length === 0}
              aria-label="Export users to CSV"
              title="Export CSV"
              style={{ whiteSpace: "nowrap" }}
            >
              Export CSV
            </Button>
          </div>
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
