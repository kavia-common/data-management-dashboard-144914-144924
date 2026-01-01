import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "./ui/Card.jsx";
import DataTable from "./DataTable.jsx";
import Button from "./ui/Button.jsx";
import { listProjects } from "../api";

/**
 * PUBLIC_INTERFACE
 * ProjectsList
 * Displays projects using server-side pagination to ensure only ONE /api/projects call per page.
 * Mirrors the approach used by UsersList.
 */
export default function ProjectsList({
  title = "Projects",
  subtitle = "All projects",
  onProjectSelect,
  onProjectRowClick,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [serverTotal, setServerTotal] = useState(0);

  // Server-side filter/search state
  const [query, setQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Drop out-of-order responses
  const requestSeq = useRef(0);

  const columns = useMemo(() => {
    const fmtDate = (v) => {
      if (!v) return "—";
      try {
        return new Date(v).toLocaleString();
      } catch {
        return String(v);
      }
    };

    return [
      { key: "project_name", label: "Project Name", priority: 1, minWidth: 180 },
      { key: "project_id", label: "Project Id", priority: 2, minWidth: 160 },
      { key: "tenant_id", label: "Tenant Id", priority: 2, minWidth: 120 },
      { key: "status", label: "Status", priority: 3, minWidth: 100 },
      { key: "created_at", label: "Created", render: fmtDate, priority: 3, minWidth: 160 },
      { key: "updated_at", label: "Updated", render: fmtDate, priority: 3, minWidth: 160 },
    ];
  }, []);

  function handleRowClick(project) {
    try {
      if (typeof onProjectRowClick === "function") return onProjectRowClick(project);
      if (typeof onProjectSelect === "function") onProjectSelect(project);
    } catch {
      // ignore
    }
  }

  const buildServerFilter = useCallback(() => {
    const f = {};
    if (tenantFilter) f.tenant_id = tenantFilter;
    if (statusFilter) f.status = statusFilter;
    return Object.keys(f).length ? f : null;
  }, [tenantFilter, statusFilter]);

  const fetchPage = useCallback(
    async (nextPage, nextPageSize, sortKey, sortDir) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError("");

      try {
        let sort;
        if (sortKey) sort = sortDir === "desc" ? `-${sortKey}` : sortKey;

        const filterObj = buildServerFilter();

        const res = await listProjects({
          page: nextPage,
          limit: nextPageSize,
          sort,
          q: (query || "").trim() || undefined,
          filter: filterObj ? JSON.stringify(filterObj) : undefined,
        });

        if (seq !== requestSeq.current) return;

        setItems(Array.isArray(res?.items) ? res.items : []);

        // In server-side pagination, the backend contract is an envelope:
        // { data, meta: { total, page, limit } }
        // Prefer meta.total to ensure correct totalPages calculation.
        const total =
          typeof res?.meta?.total === "number"
            ? res.meta.total
            : typeof res?.total === "number"
              ? res.total
              : 0;

        setServerTotal(total);
        setPage(nextPage);
      } catch (e) {
        if (seq !== requestSeq.current) return;
        setItems([]);
        setServerTotal(0);
        setError(e?.message || "Failed to load projects.");
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
    setTenantFilter("");
    setStatusFilter("");
    fetchPage(1, pageSize);
  }

  return (
    <div>
      <Card title={title} subtitle={subtitle}>
        <div
          className="toolbar"
          aria-label="Projects toolbar"
          style={{ flexWrap: "wrap", gap: 8, display: "flex", alignItems: "center" }}
        >
          <input
            className="input-search"
            placeholder="Search projects..."
            aria-label="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <input
            aria-label="Filter by tenant id"
            title="Filter by tenant id"
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            placeholder="Tenant id (optional)"
            style={{ width: 200 }}
          />

          <input
            aria-label="Filter by status"
            title="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Status (optional)"
            style={{ width: 160 }}
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
          onRowClick={handleRowClick}
          pageSize={pageSize}
          initialPage={page}
          serverTotal={serverTotal}
          fetchPage={fetchPage}
          paginationTitle="Projects pages"
        />
      </Card>
    </div>
  );
}
