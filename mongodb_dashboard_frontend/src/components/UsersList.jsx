import React, { useEffect, useMemo, useState } from "react";
import Card from "./ui/Card.jsx";
import DataTable from "./DataTable.jsx";
import Button from "./ui/Button.jsx";
import { useUsers } from "../hooks/useUsers";

/**
 * PUBLIC_INTERFACE
 * UsersList
 * Displays users with filters: search and tenant.
 * Fetches data from API driven strictly by pagination (single call on mount).
 */
export default function UsersList({
  title = "Users",
  subtitle = "All users",
  showActions = false,
  onUserSelect,
  onUserRowClick,
}) {
  const [query, setQuery] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");

  // Use the optimized hook: pagination is the sole trigger for fetching.
  const {
    users,
    loading,
    error,
    page,
    setPage,
    total,
  } = useUsers({ initialPage: 1 });

  // Local client-side filtering; does NOT trigger additional API calls.
  const allowedFields = useMemo(
    () => [
      "name",
      "email",
      "department",
      "tenant_id",
      "organization_name",
      "organization",
      "organization_id",
    ],
    []
  );

  const filteredItems = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    let filtered = users || [];

    if (q) {
      filtered = filtered.filter((u) => {
        const vals = allowedFields
          .map((f) => u?.[f])
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v).toLowerCase());
        return vals.some((v) => v.includes(q));
      });
    }

    if (organizationFilter) {
      filtered = filtered.filter((u) => {
        const org =
          u?.tenant_id ?? u?.organization_name ?? u?.organization ?? u?.organization_id;
        return String(org ?? "").trim() === organizationFilter;
      });
    }

    return filtered;
  }, [users, query, allowedFields, organizationFilter]);

  const [pageSize] = useState(10);
  // DataTable pagination controls
  const handlePageChange = (nextPage) => {
    // Only pagination change should trigger fetch
    if (typeof nextPage === "number" && nextPage > 0 && nextPage !== page) {
      setPage(nextPage);
    }
  };

  // Derive tenant options from the current page's items
  const tenantOptions = useMemo(
    () =>
      [...new Set(
        (users || []).map(
          (u) =>
            u?.tenant_id ??
            u?.organization_name ??
            u?.organization ??
            u?.organization_id
        )
      )]
        .filter(Boolean)
        .sort(),
    [users]
  );

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

  function resetFilters() {
    setQuery("");
    setOrganizationFilter("");
  }

  function handleRowClick(user) {
    try {
      if (typeof onUserRowClick === "function") return onUserRowClick(user);
      if (typeof onUserSelect === "function") onUserSelect(user);
    } catch {
      // ignore callback errors
    }
  }

  const tableKey = useMemo(
    () => `${(query || "").trim().toLowerCase()}|${organizationFilter}|${filteredItems.length}`,
    [query, organizationFilter, filteredItems.length]
  );

  // Keep focus/ARIA nuances same as before where applicable
  useEffect(() => {
    // no-op placeholder to preserve side-effect hook ordering if needed in future
  }, []);

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

          {/* 🔁 Reset Button */}
          <Button
            variant="secondary"
            onClick={resetFilters}
            aria-label="Reset filters"
            title="Reset filters"
          >
            Reset
          </Button>
        </div>

        {/* ⚠️ Error Message */}
        {error && (
          <div className="error" role="alert" style={{ marginBottom: 12 }}>
            {error.message || String(error)}
          </div>
        )}

        {/* 📋 Data Table */}
        <DataTable
          key={tableKey}
          columns={columns}
          data={filteredItems}
          loading={loading}
          onDelete={showActions ? () => {} : undefined}
          onRowClick={handleRowClick}
          pageSize={pageSize}
          initialPage={page}
          paginationTitle="Users pages"
          onPageChange={handlePageChange}
          totalItems={total}
        />
      </Card>
    </div>
  );
}
