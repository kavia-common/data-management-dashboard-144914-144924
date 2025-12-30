import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import { listSessions } from "../../api";
import SessionDetailsModal from "../../components/sessions/SessionDetailsModal";
import SessionsByOrganization from "../../components/charts/SessionsByOrganization.jsx";
import SessionsByType from "../../components/charts/SessionsByType.jsx";
import useDebouncedValue from "../../hooks/useDebouncedValue";

// Simple helper to get distinct, sorted, non-empty values
function distinctSorted(arr) {
  const set = new Set();
  (arr || []).forEach((v) => {
    const s = String(v ?? "").trim();
    if (s) set.add(s);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// PUBLIC_INTERFACE
export default function Sessions() {
  /**
   * Sessions page with server-side search and pagination.
   * - Debounced search (300ms) via backend query param `q`.
   * - Selecting a user immediately filters by that user: we send userId for exact match and q as a fallback.
   * - Keeps existing pagination using server-provided meta.total and page/limit.
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // Remaining UI filters
  const [filterUserId, setFilterUserId] = useState("");
  const [filterTenantId, setFilterTenantId] = useState("");

  // Dropdown options populated from fetched session data (distinct lists)
  const [userOptions, setUserOptions] = useState([]);
  const [tenantIdOptions, setTenantIdOptions] = useState([]);

  // Keep URL query params in sync for dropdowns
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    if (filterUserId) usp.set("user_id", filterUserId);
    else usp.delete("user_id");
    if (filterTenantId) usp.set("tenant_id", filterTenantId);
    else usp.delete("tenant_id");
    const next = `${window.location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, "", next);
  }, [filterUserId, filterTenantId]);

  // Initialize dropdown selections from URL on first mount
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const initialUserId = usp.get("user_id") || "";
    const initialTenant = usp.get("tenant_id") || "";
    if (initialUserId) setFilterUserId(initialUserId);
    if (initialTenant) setFilterTenantId(initialTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Details modal state
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Lock to prevent race conditions when multiple loads are inflight (e.g., debounce vs pagination)
  const activeRequestRef = useRef(0);
  // Remember the last known sort so search/debounced reloads preserve sort order across pages
  const lastSortRef = useRef({ key: "", dir: "asc" });

  // Allowed and ordered fields
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
    const presentKeys = new Set();
    (rows || []).forEach((r) =>
      Object.keys(r || {}).forEach((k) => presentKeys.add(k))
    );

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

  async function loadAggregates(qStr = "", userId = "", tenantId = "") {
    /**
     * Fetch sessions data across multiple pages (capped) and build client-side aggregates
     * for charts: by organization_name and by session_type.
     */
    setAggLoading(true);
    setAggError("");
    try {
      const limit = 200;
      const maxPages = 10;
      let page = 1;
      const all = [];
      while (page <= maxPages) {
        const params = { page, limit };
        // If a user is selected, prefer exact userId param and set q for fallback search-supporting backends
        if (userId) {
          params.userId = userId;
          params.q = userId;
        } else if (qStr) {
          params.q = qStr;
        }
        if (tenantId && tenantId.trim()) {
          params.tenant_id = tenantId.trim();
        }
        const res = await listSessions(params);
        const arr = Array.isArray(res?.items) ? res.items : [];
        all.push(...arr);
        if (arr.length < limit) break;
        page += 1;
      }

      // Aggregate by organization
      const orgCounts = new Map();
      all.forEach((it) => {
        let org =
          it?.organization_name ||
          it?.organization?.name ||
          it?.tenant_id ||
          "";
        org = String(org || "").trim();
        if (!org) org = "Unknown";
        orgCounts.set(org, (orgCounts.get(org) || 0) + 1);
      });
      const orgArr = Array.from(orgCounts.entries())
        .map(([organization_name, session_count]) => ({
          organization_name,
          session_count,
        }))
        .sort((a, b) => b.session_count - a.session_count);

      // Aggregate by type
      const typeCounts = new Map();
      all.forEach((it) => {
        let t = it?.session_type || it?.type || it?.service_type || "";
        t = String(t || "").trim();
        if (!t) t = "Unknown";
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
      });
      const typeArr = Array.from(typeCounts.entries())
        .map(([session_type, session_count]) => ({ session_type, session_count }))
        .sort((a, b) => b.session_count - a.session_count);

      setByOrg(orgArr);
      setByType(typeArr);

      // Build dropdown options from aggregated dataset
      const userPairs = all
        .map((it) => ({
          id: it?.user_id,
          name:
            it?.User_name ??
            it?.user_name ??
            it?.user?.name ??
            it?.username ??
            it?.email ??
            "",
        }))
        .filter((u) => u.id && u.name);

      const uniqueUsers = [];
      const seen = new Set();
      userPairs.forEach((u) => {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          uniqueUsers.push(u);
        }
      });

      // Build distinct tenant IDs
      const tenantIds = distinctSorted(all.map((it) => it?.tenant_id ?? ""));

      // Update dropdown options
      setUserOptions(uniqueUsers);
      setTenantIdOptions(tenantIds);
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
  async function load(
    page = 1,
    limit = meta.limit || 10,
    qStr = "",
    sortKey,
    sortDir,
    userId = "",
    tenantId = ""
  ) {
    /**
     * Load sessions from server with pagination, optional query string, and server-driven sorting.
     */
    const requestId = ++activeRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const sortFieldMap = {
        // Map UI column keys to backend fields
        User_name: "user_name",
        tenant_id: "tenant_id",
        organization_name: "organization_name",
        service_type: "service_type",
        task_id: "task_id", // legacy
      };

      const params = { page, limit };

      // Prefer explicit userId when selected; also send q as fallback
      if (userId) {
        params.userId = userId;
        params.q = userId;
      } else if (qStr) {
        params.q = qStr;
      }

      if (tenantId && tenantId.trim()) {
        params.tenant_id = tenantId.trim();
      }

      if (sortKey) {
        const backendField = sortFieldMap[sortKey] || String(sortKey);
        params.sort = sortDir === "desc" ? `-${backendField}` : backendField;
      }

      const res = await listSessions(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);
      // If a newer request started after this one, ignore late response
      if (requestId !== activeRequestRef.current) return;

      setItems(Array.isArray(arr) ? arr : []);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: res?.meta?.total ?? (Array.isArray(arr) ? arr.length : 0),
      });
      // Update columns dynamically based on currently returned data
      setColumns(buildRestrictedColumns(arr));
    } catch (e) {
      if (requestId !== activeRequestRef.current) return;
      setItems([]);
      setColumns(buildRestrictedColumns([]));
      setError(
        e?.response?.data?.message || e?.message || "Failed to load sessions."
      );
    } finally {
      if (requestId === activeRequestRef.current) setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, "", key, dir, filterUserId, filterTenantId);
    loadAggregates("", filterUserId, filterTenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  // Debounced server-side search on query change (250ms default), applied only when no userId selected
  const debouncedQuery = useDebouncedValue(query, 250);
  useEffect(() => {
    if (filterUserId) return; // user selected takes precedence over text query
    const baseQ = (debouncedQuery || "").trim();
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, baseQ, key, dir, "", filterTenantId);
    loadAggregates(baseQ, "", filterTenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // Immediate refetch when dropdown filters change (no debounce)
  useEffect(() => {
    const baseQ = (query || "").trim();
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    // When userId is selected, we ignore baseQ; userId is used for both userId and q
    load(1, meta.limit || 10, filterUserId ? filterUserId : baseQ, key, dir, filterUserId, filterTenantId);
    loadAggregates(filterUserId ? filterUserId : baseQ, filterUserId, filterTenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUserId, filterTenantId]);

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
          "[Sessions] Row clicked -> opening details modal with keys:",
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
            <SessionsByType data={byType} loading={aggLoading} error={aggError} maxItems={5} />
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card title="Session Tracking" subtitle="Search and filter sessions without page reloads">
        <div
          className="toolbar"
          aria-label="Sessions toolbar"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
        >
          <label htmlFor="filter-user" className="sr-only">
            Filter by User
          </label>
          <select
            id="filter-user"
            className="input-filter"
            aria-label="Filter by User"
            value={filterUserId}
            onChange={(e) => {
              setFilterUserId(e.target.value);
              setMeta((m) => ({ ...m, page: 1 }));
            }}
            style={{ minWidth: 220 }}
          >
            <option value="">All users</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <label htmlFor="filter-tenant" className="sr-only">
            Filter by Tenant ID
          </label>
          <select
            id="filter-tenant"
            className="input-filter"
            aria-label="Filter by Tenant ID"
            value={filterTenantId}
            onChange={(e) => {
              setFilterTenantId(e.target.value);
              setMeta((m) => ({ ...m, page: 1 }));
            }}
            style={{ minWidth: 180 }}
          >
            <option value="">All tenants</option>
            {tenantIdOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Optional free-text search; disabled when user is selected */}
          <input
            className="input-search"
            placeholder="Search sessions (user, org, service, status, etc.)..."
            aria-label="Search sessions"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMeta((m) => ({ ...m, page: 1 }));
            }}
            style={{ minWidth: 280 }}
            disabled={!!filterUserId}
          />

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
            // Remember current sort so external triggers (search) keep ordering consistent
            if (sortKey) {
              lastSortRef.current = { key: sortKey, dir: sortDir || "asc" };
            } else if (!lastSortRef.current) {
              lastSortRef.current = { key: "", dir: "asc" };
            }
            await load(
              page,
              limit,
              filterUserId ? filterUserId : (query || "").trim(),
              sortKey,
              sortDir,
              filterUserId,
              filterTenantId
            );
          }}
          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}
        />
      </Card>
    </div>
  );
}
