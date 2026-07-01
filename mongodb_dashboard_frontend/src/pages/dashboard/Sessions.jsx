import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import {
  getMostLeastUsedServices,
  getSessionsByOrganization,
  getSessionsByType,
} from "../../api";
import { fetchSessionTracking } from "../../api/sessionTracking";
import { fetchSessionTrackingDistinctTenantIds } from "../../api/sessionTrackingTenants";
import SessionsByOrganization from "../../components/charts/SessionsByOrganization.jsx";
import SessionsByType from "../../components/charts/SessionsByType.jsx";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { evaluateUsernameSearchInput } from "../../utils/usernameSearchGate";

// PUBLIC_INTERFACE
export default function Sessions() {
  /**
   * Sessions page with server-side search and pagination.
   * - Table supports server-side username search via ?q (debounced, gated for partial typing).
   * - Tenant filter remains supported via tenant_id state, but tenant dropdown options are NOT
   *   populated from /api/session-tracking/tenants/distinct anymore (per task requirement).
   * - Analytics (charts) are unaffected by table-only filters except tenant_id (when selected).
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // UI filters
  const [filterUserName, setFilterUserName] = useState("");
  const [filterTenantId, setFilterTenantId] = useState("");

  // Tenant dropdown options (distinct tenant_id from session_tracking; NOT pagination-derived)
  const [tenantOptions, setTenantOptions] = useState([]);
  const [tenantOptionsError, setTenantOptionsError] = useState("");

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
     *
     * IMPORTANT:
     * - Keep logic/output the same shape as before so the UI does not change.
     * - Keep tenant scoping aligned with list call (tenant_id), using filterTenantId when selected.
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
        // Preserve endpoint exercise without changing rendering behavior.
        getMostLeastUsedServices({ ...params, maxItems: 5 }).catch(() => null),
      ]);

      setByOrg(Array.isArray(orgRes?.items) ? orgRes.items : []);
      setByType(Array.isArray(typeRes?.items) ? typeRes.items : []);
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

      const res = await fetchSessionTracking(params);
      const arr = res?.items ?? [];
      if (requestId !== activeRequestRef.current) return;

      setItems(Array.isArray(arr) ? arr : []);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: res?.meta?.total ?? (Array.isArray(arr) ? arr.length : 0),
      });
      setColumns(buildRestrictedColumns(arr));
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

    // Load all distinct tenant ids for dropdown (not pagination-limited)
    (async () => {
      try {
        setTenantOptionsError("");
        const ids = await fetchSessionTrackingDistinctTenantIds();
        setTenantOptions(Array.isArray(ids) ? ids : []);
      } catch (e) {
        setTenantOptions([]);
        setTenantOptionsError(
          e?.response?.data?.message || e?.message || "Failed to load tenant options."
        );
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  const tableSearch = useMemo(() => {
    /**
     * Table search contract (request gate):
     * - The "Filter by User name" input is meant to search by *full username*.
     * - To avoid backend calls for partial input (e.g. while typing), we only search when the
     *   value looks "complete enough" per evaluateUsernameSearchInput().
     */
    return evaluateUsernameSearchInput(debouncedFilterUserName);
  }, [debouncedFilterUserName]);

  const tableQ = tableSearch.normalized;

  /**
   * Single canonical table reload flow:
   * - Exactly one request per debounce tick and/or tenant change.
   */
  useEffect(() => {
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };

    // Only call the backend when the user has entered a full username (not partial typing).
    if (!tableSearch.shouldSearch && tableQ) {
      setItems([]);
      setMeta((m) => ({ ...m, page: 1, total: 0 }));
      setColumns(buildRestrictedColumns([]));
      setError("");
      return;
    }

    // Empty input -> show default table (unfiltered), consistent with prior behavior.
    load(1, meta.limit || 10, tableSearch.shouldSearch ? tableQ : "", key, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableSearch.shouldSearch, tableQ, filterTenantId]);

  // Analytics reload when tenant changes (NOT affected by username table filter)
  useEffect(() => {
    loadAggregates("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTenantId]);

  return (
    <div>
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
      <Card
        title="Session Tracking"
        subtitle="Filter by user name (server-side, debounced) and tenant without page reloads"
      >
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
            {tenantOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={{ width: 8 }} />
          <div className="spacer" style={{ flex: 1 }} />
        </div>

        {tenantOptionsError && (
          <div
            className="error"
            role="status"
            style={{ marginBottom: 8, opacity: 0.9 }}
          >
            {tenantOptionsError}
          </div>
        )}

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
          // initialPage={meta.page || 1}
          currentPage={meta.page || 1}
          serverTotal={meta.total}
          fetchPage={async (page, limit, sortKey, sortDir) => {
            console.log('FETCH PAGE:', page); // 👈 DEBUG

            if (sortKey) {
              lastSortRef.current = { key: sortKey, dir: sortDir || "asc" };
            }

            await load(page, limit, tableQ, sortKey, sortDir);
          }}
          paginationTitle="Sessions pages"
        />
      </Card>
    </div>
  );
}
