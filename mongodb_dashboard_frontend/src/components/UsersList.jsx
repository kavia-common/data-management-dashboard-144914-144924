import React, { useEffect, useMemo, useState } from "react";
import Card from "./ui/Card.jsx";
import DataTable from "./DataTable.jsx";
import Button from "./ui/Button.jsx";
import { useUsers } from "../hooks/useUsers";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

/**
 * PUBLIC_INTERFACE
 * UsersList
 * Displays users with filters: search and tenant.
 * Uses a single paginated API call via useUsers hook.
 */
export default function UsersList({
  title = "Users",
  subtitle = "All users",
  showActions = false,
  onUserSelect,
  onUserRowClick,
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [organizationFilter, setOrganizationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { users, loading, error, meta } = useUsers({
    page,
    limit,
    search: debouncedQuery || undefined,
    tenantId: organizationFilter || undefined,
  });

  // Build tenant options from current page items to avoid extra calls
  const tenantOptions = useMemo(() => {
    return [...new Set(
      (users || []).map(
        (u) =>
          u?.tenant_id ??
          u?.organization_name ??
          u?.organization ??
          u?.organization_id
      )
    )]
      .filter(Boolean)
      .sort();
  }, [users]);

  const columns = useMemo(() => {
    const renderTenant = (v, row) =>
      row?.tenant_id ||
      row?.organization_name ||
      row?.organization ||
      row?.organization_id ||
      "—";
    return [
      { key: "name", label: "Name", priority: 1 },
      { key: "__tenant", label: "Tenant Id", render: renderTenant, priority: 2 },
      { key: "email", label: "Mail", priority: 2 },
      { key: "department", label: "Department", priority: 3 },
    ];
  }, []);

  function handleRowClick(user) {
    try {
      if (typeof onUserRowClick === "function") return onUserRowClick(user);
      if (typeof onUserSelect === "function") onUserSelect(user);
    } catch {
      // ignore callback errors
    }
  }

  // Reset to page 1 whenever filters/search change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, organizationFilter, limit]);

  const tableKey = useMemo(
    () => `${(debouncedQuery || "").trim().toLowerCase()}|${organizationFilter}|${users?.length || 0}|${page}|${limit}`,
    [debouncedQuery, organizationFilter, users?.length, page, limit]
  );

  return (
    <div>
      <Card title={title} subtitle={subtitle}>
        <div
          className="toolbar"
          aria-label="Users toolbar"
          style={{ flexWrap: "wrap", gap: 8, display: "flex", alignItems: "center" }}
        >
          {/* 🔎 Search */}
          <input
            className="input-search"
            placeholder="Search users..."
            aria-label="Search users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {/* 🏢 Tenant Filter */}
          <select
            aria-label="Filter by tenant"
            title="Filter by tenant"
            value={organizationFilter}
            onChange={(e) => setOrganizationFilter(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="">All Tenant</option>
            {tenantOptions.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>

          {/* Page size */}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6B7280" }}>Page size</span>
            <select
              aria-label="Page size"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          {/* 🔁 Reset Button */}
          <Button
            variant="secondary"
            onClick={() => {
              setQuery("");
              setOrganizationFilter("");
              setPage(1);
              setLimit(10);
            }}
            aria-label="Reset filters"
            title="Reset filters"
          >
            Reset
          </Button>
        </div>

        {/* ⚠️ Error Message */}
        {error && (
          <div className="error" role="alert" style={{ marginBottom: 12 }}>
            {error?.response?.data?.message || error?.message || "Failed to load users."}
          </div>
        )}

        {/* 📋 Data Table */}
        <DataTable
          key={tableKey}
          columns={columns}
          data={users || []}
          loading={loading}
          onDelete={showActions ? (row) => setConfirmDelete(row) : undefined}
          onRowClick={handleRowClick}
          pageSize={limit}
          initialPage={page}
          paginationTitle="Users pages"
          // Wire client-side pagination controls to server pagination
          onPageChange={(nextPage) => setPage(nextPage)}
          totalItems={meta?.total || 0}
        />
        {/* Simple pagination footer if DataTable doesn't render controls from props */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>
            Page {meta?.page || page} of {Math.max(1, Math.ceil((meta?.total || 0) / limit))}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="ghost"
              disabled={(meta?.page || page) <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              disabled={(meta?.page || page) >= Math.max(1, Math.ceil((meta?.total || 0) / limit)) || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* 🗑️ Delete Modal */}
      {confirmDelete && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete user">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Delete user</h3>
              <Button variant="ghost" aria-label="Close" onClick={() => setConfirmDelete(null)}>
                ✕
              </Button>
            </div>
            <div className="modal-body">
              <p>This is a placeholder delete dialog. Actual deletion logic goes in the parent page.</p>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
