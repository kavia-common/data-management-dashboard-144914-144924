import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "./ui/Card.jsx";
import DataTable from "./DataTable.jsx";
import Button from "./ui/Button.jsx";
import { listUsers } from "../api";

/**
 * PUBLIC_INTERFACE
 * UsersList
 * Displays users using server-side pagination to ensure only ONE users API call per page:
 * - Loads page 1 on initial render
 * - Loads selected page on pagination change
 *
 * This intentionally avoids per-row downstream fetch effects by not loading the full dataset at once.
 */
// PUBLIC_INTERFACE
export default function UsersList({
  title = "Users",
  subtitle = "All users",
  showActions = false,
  onUserSelect,
  onUserRowClick,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10); // keep existing UI default
  const [serverTotal, setServerTotal] = useState(0);

  // Server-side filter/search state
  const [query, setQuery] = useState("");
  const [organizationFilter, setOrganizationFilter] = useState("");

  // Used to drop out-of-order responses (e.g., quick page switching).
  const requestSeq = useRef(0);

  const columns = useMemo(() => {
    const renderTenant = (v, row) =>
      row?.tenant_id ||
      row?.organization_name ||
      row?.organization ||
      row?.organization_id ||
      "—";

    const renderSessionTotalCount = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n.toLocaleString() : "0";
    };

    const renderSessionTotalDuration = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n.toFixed(2) : "0.00";
    };

    return [
      { key: "name", label: "Name", priority: 1 },
      { key: "__tenant", label: "Tenant Id", render: renderTenant, priority: 2 },
      { key: "email", label: "Mail", priority: 2 },
      { key: "department", label: "Department", priority: 3 },
      {
        key: "session_total_count",
        label: "Session Total Count",
        render: renderSessionTotalCount,
        priority: 3,
        minWidth: 140,
      },
      {
        key: "session_total_duration",
        label: "Session Total Duration",
        render: renderSessionTotalDuration,
        priority: 3,
        minWidth: 160,
      },
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

  const buildServerFilter = useCallback(() => {
    // Backend /api/users supports JSON `filter` string; we only apply tenant filtering
    // when explicitly selected by the user.
    const filter = {};
    if (organizationFilter) {
      // Prefer canonical tenant field when present
      filter.tenant_id = organizationFilter;
    }
    return Object.keys(filter).length ? filter : null;
  }, [organizationFilter]);

  const fetchPage = useCallback(
    async (nextPage, nextPageSize, sortKey, sortDir) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError("");

      try {
        // Match backend sort format: "-created_at" for desc, "created_at" for asc.
        // If no sort chosen in UI, omit sort.
        let sort;
        if (sortKey) sort = sortDir === "desc" ? `-${sortKey}` : sortKey;

        const filterObj = buildServerFilter();

        const res = await listUsers({
          page: nextPage,
          limit: nextPageSize,
          sort,
          q: (query || "").trim() || undefined,
          filter: filterObj ? JSON.stringify(filterObj) : undefined,
        });

        // Ignore stale results
        if (seq !== requestSeq.current) return;

        setItems(Array.isArray(res?.items) ? res.items : []);
        setServerTotal(
          typeof res?.total === "number"
            ? res.total
            : typeof res?.meta?.total === "number"
              ? res.meta.total
              : Array.isArray(res?.items)
                ? res.items.length
                : 0
        );
        setPage(nextPage);
      } catch (e) {
        if (seq !== requestSeq.current) return;
        setItems([]);
        setServerTotal(0);
        setError(e?.message || "Failed to load users.");
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [buildServerFilter, query]
  );

  // Load page 1 on initial render and whenever filters/search change.
  useEffect(() => {
    fetchPage(1, pageSize);
  }, [fetchPage, pageSize]);

  function resetFilters() {
    setQuery("");
    setOrganizationFilter("");
    // fetchPage effect will re-run; but trigger immediately to keep UI snappy.
    fetchPage(1, pageSize);
  }

  return (
    <div>
      <Card title={title} subtitle={subtitle}>
        <div
          className="toolbar"
          aria-label="Users toolbar"
          style={{ flexWrap: "wrap", gap: 8, display: "flex", alignItems: "center" }}
        >
          <input
            className="input-search"
            placeholder="Search users..."
            aria-label="Search users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {/* Tenant filter: in server-side mode this is a scoped query (filter.tenant_id). */}
          <input
            aria-label="Filter by tenant id"
            title="Filter by tenant id"
            value={organizationFilter}
            onChange={(e) => setOrganizationFilter(e.target.value)}
            placeholder="Tenant id (optional)"
            style={{ width: 200 }}
          />

          <Button
            variant="secondary"
            onClick={resetFilters}
            aria-label="Reset filters"
            title="Reset filters"
          >
            Reset
          </Button>
        </div>

        {error && (
          <div className="error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          onDelete={showActions ? (row) => setConfirmDelete(row) : undefined}
          onRowClick={handleRowClick}
          pageSize={pageSize}
          initialPage={page}
          serverTotal={serverTotal}
          fetchPage={fetchPage}
          paginationTitle="Users pages"
        />
      </Card>

      {confirmDelete && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Delete user"
        >
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
