import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "./ui/Card.jsx";
import DataTable from "./DataTable.jsx";
import Button from "./ui/Button.jsx";
import { listUsers } from "../api";
import { debounce } from "../utils/debounce";

/**
 * PUBLIC_INTERFACE
 * UsersList
 * Displays users in a controlled table. Single source of fetching with pagination/sorting/filter.
 * Ensures only one API call per page by suppressing DataTable initial events and cancelling in-flight requests.
 */
export default function UsersList({
  title = "Users",
  subtitle = "All users",
  showActions = false,
  onUserSelect,
  onUserRowClick,
}) {
  // Controlled table state
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Query/filter primitives
  const [query, setQuery] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");

  // Pagination/sort meta
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, sort: undefined });

  // Ref to prevent duplicate initial load when table emits initial page event
  const mountedRef = useRef(false);

  // Abort controller for cancelling in-flight requests
  const currentAbortRef = useRef(null);

  // Memoized columns definition
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

  // PUBLIC_INTERFACE
  const loadUsers = useCallback(
    async ({ page, limit, sort } = {}) => {
      // build stable primitives for filter params
      const q = (query || "").trim();
      const org = (organizationFilter || "").trim();
      const nextPage = page ?? meta.page ?? 1;
      const nextLimit = limit ?? meta.limit ?? 10;
      const nextSort = sort ?? meta.sort;

      // Cancel any in-flight request
      if (currentAbortRef.current) {
        currentAbortRef.current.abort();
      }
      const controller = new AbortController();
      currentAbortRef.current = controller;

      setLoading(true);
      setError("");

      try {
        const filterPayload = {};
        if (q) {
          // Backend does not support 'q' across fields for /api/users by default;
          // we pass it as filter hint when supported, otherwise server will ignore.
          filterPayload.q = q;
        }
        if (org) {
          filterPayload.organization_id = org;
          filterPayload.tenant_id = org;
        }

        const params = {
          page: nextPage,
          limit: nextLimit,
          sort: nextSort,
          filter: Object.keys(filterPayload).length ? JSON.stringify(filterPayload) : undefined,
        };

        const res = await listUsers(params, { signal: controller.signal });
        // normalize envelope/array
        const data =
          res?.items ??
          res?.data ??
          (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []);
        const total =
          res?.total ??
          res?.meta?.total ??
          (Array.isArray(data) ? data.length : 0);

        setRows(Array.isArray(data) ? data : []);
        setMeta({
          page: nextPage,
          limit: nextLimit,
          sort: nextSort,
          total: typeof total === "number" ? total : 0,
        });
      } catch (e) {
        if (e?.name === "AbortError") return; // ignore aborted
        setRows([]);
        setError(e?.response?.data?.message || e?.message || "Failed to load users.");
      } finally {
        setLoading(false);
        // clear current if still this controller
        if (currentAbortRef.current === controller) {
          currentAbortRef.current = null;
        }
      }
    },
    [query, organizationFilter, meta.page, meta.limit, meta.sort]
  );

  // Debounced pagination to avoid rapid multiple requests
  const debouncedLoadUsers = useMemo(() => debounce(loadUsers, 150), [loadUsers]);

  // Initial load on mount - only once
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      loadUsers({ page: 1, limit: meta.limit });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When query or organization filter changes, reset to page 1 and refetch
  useEffect(() => {
    if (!mountedRef.current) return;
    // Debounce to avoid too frequent typing-triggered queries
    debouncedLoadUsers({ page: 1, limit: meta.limit, sort: meta.sort });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, organizationFilter]);

  const handleRowClick = useCallback(
    (user) => {
      try {
        if (typeof onUserRowClick === "function") return onUserRowClick(user);
        if (typeof onUserSelect === "function") onUserSelect(user);
      } catch {
        // ignore callback errors
      }
    },
    [onUserRowClick, onUserSelect]
  );

  const resetFilters = useCallback(() => {
    setQuery("");
    setOrganizationFilter("");
    // trigger reload on effect
  }, []);

  // Stable key to avoid unnecessary remounts and keep table controlled
  const tableKey = useMemo(
    () =>
      `${(query || "").trim().toLowerCase()}|${(organizationFilter || "")
        .trim()
        .toLowerCase()}|${meta.page}|${meta.limit}|${meta.sort || ""}`,
    [query, organizationFilter, meta.page, meta.limit, meta.sort]
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
            {/* Build list from current rows (fallback); could be enriched via a separate endpoint if needed */}
            <option value="">All Tenant</option>
            {[...new Set(
              (rows || []).map(
                (u) =>
                  u?.tenant_id ??
                  u?.organization_name ??
                  u?.organization ??
                  u?.organization_id
              )
            )]
              .filter(Boolean)
              .sort()
              .map((org) => (
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
            {error}
          </div>
        )}

        {/* 📋 Data Table - presentational, controlled by UsersList */}
        <DataTable
          key={tableKey}
          columns={columns}
          data={rows}
          loading={loading}
          onDelete={showActions ? (row) => setConfirmDelete(row) : undefined}
          onRowClick={handleRowClick}
          pageSize={meta.limit || 10}
          initialPage={meta.page || 1}
          paginationTitle="Users pages"
          suppressInitialEvent
          onPageChange={(nextPage, nextPageSize) =>
            loadUsers({ page: nextPage, limit: nextPageSize ?? meta.limit, sort: meta.sort })
          }
          onSortChange={(nextSort) =>
            loadUsers({ page: 1, limit: meta.limit, sort: nextSort })
          }
          totalItems={meta.total ?? rows.length}
        />
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
