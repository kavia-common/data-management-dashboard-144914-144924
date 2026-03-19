import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import {
  getMostLeastUsedServices,
  getSessionsByOrganization,
  getSessionsByType,
  listSessions,
} from "../../api";
import SessionDetailsModal from "../../components/sessions/SessionDetailsModal";
import SessionsByOrganization from "../../components/charts/SessionsByOrganization.jsx";
import SessionsByType from "../../components/charts/SessionsByType.jsx";
import useDebouncedValue from "../../hooks/useDebouncedValue";

// PUBLIC_INTERFACE
export default function Sessions() {
  /**
   * Sessions page with server-side search and pagination.
   * - Debounced search across dataset via backend query param `q`.
   * - "Filter by User name" is a plain text input (no dropdown).
   * - Tenant filter remains a dropdown based on discovered tenant ids.
   * - Pagination uses server-provided meta.total and page/limit.
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // UI filters
  const [filterUserName, setFilterUserName] = useState("");
  const [filterTenantId, setFilterTenantId] = useState("");

  // Tenant dropdown options
  const [tenantIdOptions, setTenantIdOptions] = useState([]);

  // Keep URL query params in sync (so back/forward works)
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    if (filterUserName) usp.set("user_name", filterUserName);
    else usp.delete("user_name");
    if (filterTenantId) usp.set("tenant_id", filterTenantId);
    else usp.delete("tenant_id");
    const next = `${window.location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, "", next);
  }, [filterUserName, filterTenantId]);

  // Initialize filter selections from URL on first mount
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const initialUser = usp.get("user_name") || "";
    const initialTenant = usp.get("tenant_id") || "";
    if (initialUser) setFilterUserName(initialUser);
    if (initialTenant) setFilterTenantId(initialTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced filters/search to avoid request spam while typing
  const debouncedFilterUserName = useDebouncedValue(filterUserName, 250);
  const debouncedQuery = useDebouncedValue(query, 250);

  // Details modal state
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Concurrency + sort memory
  const activeRequestRef = useRef(0);
  const lastSortRef = useRef({ key: "", dir: "asc" });

  // Allowed and ordered fields (column visibility)
  const allowedOrdered = useMemo(
    () => ["User_name", "tenant_id", "organization_name", "service_type"],
    []
  );

  // PUBLIC_INTERFACE
  function toLabel(key) {
    /** Convert snake_case to Title Case label. */
    return String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  // PUBLIC_INTERFACE
  function buildRestrictedColumns(rows = []) {
    /** Build DataTable columns strictly from the allowed list, preserving order. */
    return allowedOrdered.map((k) => {
      const label = k === "User_name" ? "User name" : toLabel(k);

      const render = (v, row) => {
        if (k === "User_name") {
          const val =
            row?.User_name ??
            row?.user_name ??
            row?.user?.name ??
            row?.username ??
            row?.email ??
            v;
          return val == null || val === "" ? "—" : String(val);
        }
        return v == null || v === "" ? "—" : String(v);
      };

      return {
        key: k,
        label,
        render,
        priority: 2,
      };
    });
  }

  const [columns, setColumns] = useState(buildRestrictedColumns([]));

  // Aggregates for charts
  const [aggLoading, setAggLoading] = useState(false);
  const [aggError, setAggError] = useState("");
  const [byOrg, setByOrg] = useState([]); // [{ organization_name, session_count }]
  const [byType, setByType] = useState([]); // [{ session_type, session_count }]

  async function loadAggregates(qStr = "") {
    /**
     * Fetch server-side aggregates for charts:
     * - Sessions by Organization
     * - Sessions by Type
     * - (also ensure most/least used services are consistent since SessionsByType derives lists)
     *
     * IMPORTANT:
     * - Keep logic/output the same shape as before so the UI does not change.
     * - Keep tenant scoping the same as listSessions (tenant_id), using filterTenantId when selected.
     */
    setAggLoading(true);
    setAggError("");
    try {
      const params = { q: qStr };
      if (filterTenantId && filterTenantId.trim()) {
        params.tenant_id = filterTenantId.trim();
      }

      const [orgRes, typeRes] = await Promise.all([
        getSessionsByOrganization(params),
        getSessionsByType(params),
        // Ensure backend endpoint is exercised end-to-end (even though UI derives lists from byType today).
        // This preserves future extensibility without changing current rendering behavior.
        getMostLeastUsedServices({ ...params, maxItems: 5 }).catch(() => null),
      ]);

      const orgArr = Array.isArray(orgRes?.items) ? orgRes.items : [];
      const typeArr = Array.isArray(typeRes?.items) ? typeRes.items : [];

      setByOrg(orgArr);
      setByType(typeArr);
    } catch (e) {
      setByOrg([]);
      setByType([]);
      setAggError(
        e?.response?.data?.message || e?.message || "Failed to load session aggregates."
      );
    } finally {
      setAggLoading(false);
    }
  }

  // PUBLIC_INTERFACE
  async function load(page = 1, limit = meta.limit || 10, qStr = "", sortKey, sortDir) {
    /**
     * Load sessions with pagination, optional text search (qStr), and sorting.
     *
     * IMPORTANT:
     * - qStr is treated as the fully-composed query string. Do NOT append user filter again here,
     *   otherwise q duplicates (e.g. "Aditi S Aditi S").
     */
    const requestId = ++activeRequestRef.current;
    setLoading(true);
    setError("");

    try {
      const sortFieldMap = {
        User_name: "user_name",
        tenant_id: "tenant_id",
        organization_name: "organization_name",
        service_type: "service_type",
      };

      const params = { page, limit, q: qStr };

      if (filterTenantId && filterTenantId.trim()) {
        params.tenant_id = filterTenantId.trim();
      }

      if (sortKey) {
        const backendField = sortFieldMap[sortKey] || String(sortKey);
        params.sort = sortDir === "desc" ? `-${backendField}` : backendField;
      }

      const res = await listSessions(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);
      if (requestId !== activeRequestRef.current) return;

      setItems(Array.isArray(arr) ? arr : []);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: res?.meta?.total ?? (Array.isArray(arr) ? arr.length : 0),
      });
      setColumns(buildRestrictedColumns(arr));

      // Merge-in tenant IDs seen on this page as well
      const tenants = new Set(tenantIdOptions);
      (arr || []).forEach((it) => {
        const t = String(it?.tenant_id ?? "").trim();
        if (t) tenants.add(t);
      });
      setTenantIdOptions(Array.from(tenants).sort((a, b) => a.localeCompare(b)));
    } catch (e) {
      if (requestId !== activeRequestRef.current) return;
      setItems([]);
      setColumns(buildRestrictedColumns([]));
      setError(e?.response?.data?.message || e?.message || "Failed to load sessions.");
    } finally {
      if (requestId === activeRequestRef.current) setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, "", key, dir);
    loadAggregates("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  // Build ONE canonical q string used everywhere (table + aggregates + pagination)
  const effectiveQ = useMemo(() => {
    const baseQ = String(debouncedQuery || "").trim();
    const userQ = String(debouncedFilterUserName || "").trim();
    return userQ ? (baseQ ? `${userQ} ${baseQ}` : userQ) : baseQ;
  }, [debouncedQuery, debouncedFilterUserName]);

  // Debounced server-side search on query change and user-name filter change
  useEffect(() => {
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, effectiveQ, key, dir);
    loadAggregates(effectiveQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveQ]);

  // Immediate refetch when tenant filter changes
  useEffect(() => {
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, effectiveQ, key, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTenantId, effectiveQ]);

  // Toggle global dimming class while modal is open
  useEffect(() => {
    if (detailsOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [detailsOpen]);

  // Row click -> open modal
  const handleRowClick = (row) => {
    if (process.env.NODE_ENV !== "production") {
      try {
        const keys = Object.keys(row || {});
        // eslint-disable-next-line no-console
        console.debug(
          "[Sessions] Row clicked (tenant_id scoped) -> opening details modal with keys:",
          keys
        );
      } catch {
        // ignore logging errors
      }
    }
    setSelectedSession(row);
    setDetailsOpen(true);
  };

  return (
    <div>
      {/* Details Modal */}
      <SessionDetailsModal
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setTimeout(() => setSelectedSession(null), 0);
        }}
        session={selectedSession}
      />

      {/* Charts */}
      <div
        className="sessions-charts"
        role="region"
        aria-label="Session insights"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          marginBottom: 32,
        }}
      >
        <Card
          className="chart-card"
          title="Sessions by Organization"
          subtitle="Count of sessions per organization"
        >
          <div className="chart-wrapper" style={{ height: 320 }}>
            <SessionsByOrganization data={byOrg} loading={aggLoading} error={aggError} />
          </div>
        </Card>

        <Card
          className="chart-card"
          title="Sessions by Type"
          subtitle="Count of sessions per type"
        >
          <div className="chart-wrapper" style={{ minHeight: 320 }}>
            <SessionsByType
              data={byType}
              loading={aggLoading}
              error={aggError}
              maxItems={5}
            />
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card title="Session Tracking" subtitle="Search and filter sessions without page reloads">
        <div
          className="toolbar"
          aria-label="Sessions toolbar"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          {/* <input
            className="input-search"
            placeholder="Search sessions (user, org, service, status, etc.)..."
            aria-label="Search sessions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 280 }}
          /> */}

          <label htmlFor="filter-user" className="sr-only">
            Filter by User name
          </label>
          <input
            id="filter-user"
            className="input-filter"
            aria-label="Filter by User name"
            value={filterUserName}
            onChange={(e) => setFilterUserName(e.target.value)}
            placeholder="Filter by User name"
            style={{ minWidth: 220 }}
          />

          <label htmlFor="filter-tenant" className="sr-only">
            Filter by Tenant ID
          </label>
          <select
            id="filter-tenant"
            className="input-filter"
            aria-label="Filter by Tenant ID"
            value={filterTenantId}
            onChange={(e) => setFilterTenantId(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">All tenants</option>
            {tenantIdOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={{ width: 8 }} />
          <div className="spacer" style={{ flex: 1 }} />
        </div>

        {error && (
          <div className="error" role="alert" style={{ marginBottom: 8 }}>
            {error}
          </div>
        )}

        <DataTable
          columns={Array.isArray(columns) ? columns : []}
          data={Array.isArray(items) ? items : []}
          loading={!!loading}
          pageSize={meta.limit || 10}
          initialPage={meta.page || 1}
          serverTotal={meta.total}
          fetchPage={async (page, limit, sortKey, sortDir) => {
            if (sortKey) {
              lastSortRef.current = { key: sortKey, dir: sortDir || "asc" };
            } else if (!lastSortRef.current) {
              lastSortRef.current = { key: "", dir: "asc" };
            }
            await load(page, limit, effectiveQ, sortKey, sortDir);
          }}
          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}
        />
      </Card>
    </div>
  );
}
