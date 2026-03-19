import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import { listSessions } from "../../api";
import SessionDetailsModal from "../../components/sessions/SessionDetailsModal";
import SessionsByOrganization from "../../components/charts/SessionsByOrganization.jsx";
import SessionsByType from "../../components/charts/SessionsByType.jsx";
import useDebouncedValue from "../../hooks/useDebouncedValue";

// PUBLIC_INTERFACE
export default function Sessions() {
  /**
   * Sessions page with server-side search and pagination.
   * - Debounced search across dataset via backend query param `q`.
   * - Dedicated user-name search via backend query param `user_name`.
   * - Tenant filter remains a dropdown based on discovered tenant ids.
   * - Pagination uses server-provided meta.total and page/limit.
   *
   * Contract:
   * - Inputs: UI state (tenant_id dropdown, `userNameQuery` string).
   * - Output: Table rows + chart aggregates fetched from GET /api/session-tracking.
   * - Errors: surfaced via `error` / `aggError` blocks.
   * - Side effects: updates browser URL query param `tenant_id`.
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Kept for backward compatibility (currently not shown in UI).
  const [query, setQuery] = useState("");
  // Dedicated user-name search used by the "Search users..." input.
  const [userNameQuery, setUserNameQuery] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // UI filters
  const [filterTenantId, setFilterTenantId] = useState("");

  // Tenant dropdown options
  const [tenantIdOptions, setTenantIdOptions] = useState([]);

  // Keep URL query params in sync (so back/forward works)
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    if (filterTenantId) usp.set("tenant_id", filterTenantId);
    else usp.delete("tenant_id");
    const next = `${window.location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, "", next);
  }, [filterTenantId]);

  // Initialize filter selections from URL on first mount
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const initialTenant = usp.get("tenant_id") || "";
    if (initialTenant) setFilterTenantId(initialTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search to avoid request spam while typing
  const debouncedQuery = useDebouncedValue(query, 250);
  const debouncedUserNameQuery = useDebouncedValue(userNameQuery, 250);

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

  async function loadAggregates(qStr = "", userNameStr = "") {
    /**
     * Fetch sessions across multiple pages (capped) and build client-side aggregates
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
        const params = { page, limit, q: qStr };
        // This MUST be sent for the "Search users..." input to affect results server-side.
        // Backend expects exact match on canonical field name `User_name`.
        if (userNameStr && userNameStr.trim()) params.User_name = userNameStr.trim();
        if (filterTenantId && filterTenantId.trim()) {
          params.tenant_id = filterTenantId.trim();
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
          it?.organization_name || it?.organization?.name || it?.tenant_id || "";
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

      // Merge tenant IDs (union)
      const tenantIds = new Set(tenantIdOptions);
      (all || []).forEach((it) => {
        const t = String(it?.tenant_id ?? "").trim();
        if (t) tenantIds.add(t);
      });
      setTenantIdOptions(
        Array.from(tenantIds).sort((a, b) => a.localeCompare(b))
      );
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
    userNameStr = "",
    sortKey,
    sortDir
  ) {
    /**
     * Load sessions with pagination, optional text search (qStr), optional user-name filter,
     * and sorting.
     *
     * Contract:
     * - Inputs:
     *   - page/limit: integers
     *   - qStr: string (server-side text search)
     *   - userNameStr: string (server-side user_name match)
     *   - sortKey/sortDir: optional DataTable sort inputs
     * - Output: updates state (items/meta/columns)
     * - Errors: sets `error` string
     * - Side effects: HTTP GET to /api/session-tracking
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
      // Backend expects exact match on canonical field name `User_name`.
      if (userNameStr && userNameStr.trim()) params.User_name = userNameStr.trim();

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
    load(1, meta.limit || 10, "", "", key, dir);
    loadAggregates("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  // Debounced server-side search on query change (now includes dedicated user-name search)
  useEffect(() => {
    const qStr = (debouncedQuery || "").trim();
    const uStr = (debouncedUserNameQuery || "").trim();
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, qStr, uStr, key, dir);
    loadAggregates(qStr, uStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, debouncedUserNameQuery]);

  // Immediate refetch when tenant filter changes
  useEffect(() => {
    const qStr = (query || "").trim();
    const uStr = (userNameQuery || "").trim();
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, qStr, uStr, key, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTenantId]);

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
          <input
            className="input-search"
            placeholder="Search users..."
            aria-label="Search users"
            value={userNameQuery}
            onChange={(e) => setUserNameQuery(e.target.value)}
            style={{ minWidth: 240 }}
          />

          {/* Optional (kept for future) general search:
          <input
            className="input-search"
            placeholder="Search sessions (user, org, service, status, etc.)..."
            aria-label="Search sessions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 280 }}
          /> */}

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
            await load(
              page,
              limit,
              (debouncedQuery || "").trim(),
              (debouncedUserNameQuery || "").trim(),
              sortKey,
              sortDir
            );
          }}
          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}
        />
      </Card>
    </div>
  );
}
