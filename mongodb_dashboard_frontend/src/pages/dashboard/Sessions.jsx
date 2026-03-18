import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import { listSessions } from "../../api";
import SessionDetailsModal from "../../components/sessions/SessionDetailsModal";
import SessionsByOrganization from "../../components/charts/SessionsByOrganization.jsx";
import SessionsByType from "../../components/charts/SessionsByType.jsx";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import Input from "../../components/ui/Input.jsx";

// PUBLIC_INTERFACE
export default function Sessions() {
  /**
   * Session Tracking module page with server-side search and pagination.
   *
   * Requirement implemented:
   * - Add a User_name search filter in the Session Tracking table UI.
   * - The filter searches across ALL sessions server-side (via backend query param `q`)
   *   so only that user’s sessions are returned, including across pagination.
   *
   * Implementation details:
   * - We send `q=userName` to /api/session-tracking.
   * - We keep tenant_id filter as-is and combine it with q.
   * - We debounce typing to avoid request spam.
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // UI filters
  const [filterTenantId, setFilterTenantId] = useState("");
  const [userNameQuery, setUserNameQuery] = useState("");

  // Tenant dropdown options
  const [tenantIdOptions, setTenantIdOptions] = useState([]);

  // Pagination meta (server-driven)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // Debounced search to avoid request spam while typing
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
  function buildRestrictedColumns() {
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

  const [columns, setColumns] = useState(buildRestrictedColumns());

  // Aggregates for charts
  const [aggLoading, setAggLoading] = useState(false);
  const [aggError, setAggError] = useState("");
  const [byOrg, setByOrg] = useState([]); // [{ organization_name, session_count }]
  const [byType, setByType] = useState([]); // [{ session_type, session_count }]

  // Keep URL query params in sync (so back/forward works)
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);

    if (filterTenantId) usp.set("tenant_id", filterTenantId);
    else usp.delete("tenant_id");

    // We intentionally persist the username filter in the URL to support sharing/back-forward.
    if (userNameQuery && userNameQuery.trim()) usp.set("user_name", userNameQuery.trim());
    else usp.delete("user_name");

    const next = `${window.location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, "", next);
  }, [filterTenantId, userNameQuery]);

  // Initialize filter selections from URL on first mount
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const initialTenant = usp.get("tenant_id") || "";
    const initialUserName = usp.get("user_name") || "";

    if (initialTenant) setFilterTenantId(initialTenant);
    if (initialUserName) setUserNameQuery(initialUserName);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAggregates(qStr = "") {
    /**
     * Fetch sessions across multiple pages (capped) and build client-side aggregates
     * for charts: by organization_name and by session_type.
     *
     * - Free-text search uses backend `q` (here used to represent username filter).
     * - Tenant scoping is applied via tenant_id.
     */
    setAggLoading(true);
    setAggError("");
    try {
      const limit = 200;
      const maxPages = 10;
      let page = 1;
      const all = [];

      const effectiveQ = qStr && String(qStr).trim() ? String(qStr).trim() : "";

      while (page <= maxPages) {
        const params = { page, limit };
        if (effectiveQ) params.q = effectiveQ;

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
        let org = it?.organization_name || it?.organization?.name || it?.tenant_id || "";
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
      setTenantIdOptions(Array.from(tenantIds).sort((a, b) => a.localeCompare(b)));
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
     * NOTE: We use backend `q` for the User_name filter to ensure the filtering happens
     * server-side and applies across ALL sessions (and across pagination).
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

      const effectiveQ = qStr && String(qStr).trim() ? String(qStr).trim() : "";

      const params = { page, limit };
      if (effectiveQ) params.q = effectiveQ;

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

      const safeArr = Array.isArray(arr) ? arr : [];
      setItems(safeArr);

      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: res?.meta?.total ?? safeArr.length,
      });

      setColumns(buildRestrictedColumns());

      // Merge-in tenant IDs seen on this page as well
      const tenants = new Set(tenantIdOptions);
      safeArr.forEach((it) => {
        const t = String(it?.tenant_id ?? "").trim();
        if (t) tenants.add(t);
      });
      setTenantIdOptions(Array.from(tenants).sort((a, b) => a.localeCompare(b)));
    } catch (e) {
      if (requestId !== activeRequestRef.current) return;
      setItems([]);
      setColumns(buildRestrictedColumns());
      setError(e?.response?.data?.message || e?.message || "Failed to load sessions.");
    } finally {
      if (requestId === activeRequestRef.current) setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, (userNameQuery || "").trim(), key, dir);
    loadAggregates((userNameQuery || "").trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  // Debounced server-side username search
  useEffect(() => {
    const q = (debouncedUserNameQuery || "").trim();
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    // Always reset to page 1 when filter changes.
    load(1, meta.limit || 10, q, key, dir);
    loadAggregates(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedUserNameQuery]);

  // Immediate refetch when tenant filter changes
  useEffect(() => {
    const q = (userNameQuery || "").trim();
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, q, key, dir);
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

        <Card className="chart-card" title="Sessions by Type" subtitle="Count of sessions per type">
          <div className="chart-wrapper" style={{ minHeight: 320 }}>
            <SessionsByType data={byType} loading={aggLoading} error={aggError} maxItems={5} />
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card title="Session Tracking" subtitle="Filter sessions without page reloads">
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
          <label htmlFor="filter-user-name" className="sr-only">
            Filter by User name
          </label>
          <Input
            id="filter-user-name"
            className="input-search"
            placeholder="Filter by User name (server-side)..."
            aria-label="Filter by User name"
            value={userNameQuery}
            onChange={(e) => setUserNameQuery(e.target.value)}
            style={{ minWidth: 280 }}
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

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setUserNameQuery("")}
            disabled={!userNameQuery}
            aria-label="Clear user name filter"
            title="Clear"
          >
            Clear
          </button>
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
          disableInitialFetch
          fetchPage={async (page, limit, sortKey, sortDir) => {
            if (sortKey) {
              lastSortRef.current = { key: sortKey, dir: sortDir || "asc" };
            } else if (!lastSortRef.current) {
              lastSortRef.current = { key: "", dir: "asc" };
            }
            // Critical: pass the username filter to ensure server-side filtering across pagination.
            await load(page, limit, (userNameQuery || "").trim(), sortKey, sortDir);
          }}
          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}
        />
      </Card>
    </div>
  );
}
