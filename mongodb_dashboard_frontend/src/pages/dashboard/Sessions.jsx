import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import { listSessions } from "../../api";
import SessionDetailsModal from "../../components/sessions/SessionDetailsModal";
import SessionsByOrganization from "../../components/charts/SessionsByOrganization.jsx";
import SessionsByType from "../../components/charts/SessionsByType.jsx";
import { debounce } from "../../utils/debounce";

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
   * Sessions page with global client-side text search and server-side pagination.
   * - Query empty: use server-side pagination (fetchPage + serverTotal).
   * - Query non-empty: fetch all pages once and filter client-side across fields.
   * - Debounced input avoids re-filter spam.
   */
  const [items, setItems] = useState([]);
  // All pages cache for client-side search
  const [allItems, setAllItems] = useState([]);
  const [hasAllLoaded, setHasAllLoaded] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // New UI filters
  const [filterUserName, setFilterUserName] = useState("");
  const [filterTenantId, setFilterTenantId] = useState("");

  // Date filters: start date and optional end date (range)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Dropdown options populated from fetched session data (distinct lists)
  const [userNameOptions, setUserNameOptions] = useState([]);
  const [tenantIdOptions, setTenantIdOptions] = useState([]);

  // Keep URL query params in sync for dropdowns (so back/forward works)
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    if (filterUserName) usp.set("user_name", filterUserName);
    else usp.delete("user_name");
    if (filterTenantId) usp.set("tenant_id", filterTenantId);
    else usp.delete("tenant_id");
    if (startDate) usp.set("from", startDate);
    else usp.delete("from");
    if (endDate) usp.set("to", endDate);
    else usp.delete("to");
    const next = `${window.location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, "", next);
  }, [filterUserName, filterTenantId, startDate, endDate]);

  // Initialize dropdown selections from URL on first mount
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const initialUser = usp.get("user_name") || "";
    const initialTenant = usp.get("tenant_id") || "";
    const urlFrom = usp.get("from") || "";
    const urlTo = usp.get("to") || "";
    if (initialUser) setFilterUserName(initialUser);
    if (initialTenant) setFilterTenantId(initialTenant);
    if (urlFrom) setStartDate(urlFrom);
    if (urlTo) setEndDate(urlTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Details modal state
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Lock to prevent race conditions when multiple loads are inflight
  const activeRequestRef = useRef(0);
  // Remember the last known sort
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
    const presentKeys = new Set();
    (rows || []).forEach((r) => Object.keys(r || {}).forEach((k) => presentKeys.add(k)));

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
  const [byOrg, setByOrg] = useState([]);   // [{ organization_name, session_count }]
  const [byType, setByType] = useState([]); // [{ session_type, session_count }]

  async function loadAggregates(qStr = "") {
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
        const params = { page, limit, q: qStr };
        // Use ONLY start/end for date range API request
        if (startDate) {
          params.start = new Date(startDate).toISOString();
        }
        if (endDate) {
          params.end =
            endDate && !/T/.test(endDate)
              ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString()
              : new Date(endDate).toISOString();
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
        .map(([organization_name, session_count]) => ({ organization_name, session_count }))
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

      // Build distinct options for dropdowns from the aggregated dataset (all collected pages)
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

      const tenantIds = distinctSorted(all.map((it) => it?.tenant_id ?? ""));

      setUserNameOptions(uniqueUsers);
      setTenantIdOptions(tenantIds);
    } catch (e) {
      setByOrg([]);
      setByType([]);
      setAggError(e?.response?.data?.message || e?.message || "Failed to load session aggregates.");
    } finally {
      setAggLoading(false);
    }
  }

  // PUBLIC_INTERFACE
  async function load(page = 1, limit = meta.limit || 10, qStr = "", sortKey, sortDir) {
    /**
     * Load sessions from server with pagination, optional query string, and server-driven sorting.
     * When sortKey is provided, pass `sort` using:
     *  - asc: field
     *  - desc: -field
     */
    const requestId = ++activeRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const sortFieldMap = {
        // Map UI column keys to backend fields
        User_name: "user_name",
        user_name: "user_name",
        organization_name: "organization_name",
        tenant_id: "tenant_id",
        service_type: "service_type",
        session_name: "session_name",
        "session_data.session_name": "session_data.session_name",
        task_id: "task_id",
      };

      const params = { page, limit, q: qStr };

      // Date range params: send only start/end
      if (startDate) params.start = new Date(startDate).toISOString();
      if (endDate) {
        params.end =
          endDate && !/T/.test(endDate)
            ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString()
            : new Date(endDate).toISOString();
      }

      // Exact-match filters
      const filter = {};
      if (filterTenantId && filterTenantId.trim()) filter.tenant_id = filterTenantId.trim();
      if (filterUserName && filterUserName.trim()) filter.user_id = filterUserName.trim();
      if (Object.keys(filter).length > 0) params.filter = filter;

      if (sortKey) {
        const backendField = sortFieldMap[sortKey] || String(sortKey);
        params.sort = sortDir === "desc" ? `-${backendField}` : backendField;
      }

      const res = await listSessions(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);

      // If a newer request started after this one, ignore
      if (requestId !== activeRequestRef.current) return;

      // Optional date clamp client-side
      let filtered = Array.isArray(arr) ? arr : [];
      if (startDate || endDate) {
        const fromMs = startDate ? new Date(startDate).getTime() : null;
        const toMs = endDate
          ? (/T/.test(endDate)
              ? new Date(endDate).getTime()
              : new Date(new Date(endDate).setHours(23, 59, 59, 999)).getTime())
          : null;
        filtered = filtered.filter((it) => {
          const s =
            it?.session_start ||
            it?.start_time ||
            it?.started_at ||
            it?.created_at ||
            it?.timestamp ||
            null;
          const e =
            it?.session_end ||
            it?.end_time ||
            it?.completed_at ||
            it?.last_updated ||
            null;

          const sMs = s ? new Date(s).getTime() : null;
          const eMs = e ? new Date(e).getTime() : null;

          const inFrom = fromMs == null || (sMs != null ? sMs >= fromMs : eMs != null ? eMs >= fromMs : false);
          const inTo = toMs == null || (sMs != null ? sMs <= toMs : eMs != null ? eMs <= toMs : true);
          return inFrom && inTo;
        });
      }

      setItems(filtered);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: res?.meta?.total ?? (Array.isArray(filtered) ? filtered.length : Array.isArray(arr) ? arr.length : 0),
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
    // Keep aggregates as initial/base load
    loadAggregates("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  // Immediate refetch when dropdown filters change (no debounce)
  useEffect(() => {
    // Reset all-items cache since scope changed
    setAllItems([]);
    setHasAllLoaded(false);
    // Server load ignores q (client-only)
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, "", key, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUserName, filterTenantId, startDate, endDate]);

  // Debounce the query to avoid re-filter spam
  useEffect(() => {
    const run = debounce((q) => setDebouncedQuery(q), 300);
    run(query);
  }, [query]);

  // Reset to page 1 on mode switch (search on/off)
  useEffect(() => {
    setMeta((m) => ({ ...m, page: 1 }));
  }, [debouncedQuery]);

  // Prepare fetchAllSessions to cache all pages for client-side search
  const fetchAllSessionsRef = useRef(null);
  useEffect(() => {
    fetchAllSessionsRef.current = async () => {
      setLoadingAll(true);
      setHasAllLoaded(false);
      try {
        const limit = 100;
        let page = 1;
        let collected = [];
        let total = Infinity;

        const paramsBase = { page, limit };

        if (startDate) paramsBase.start = new Date(startDate).toISOString();
        if (endDate) {
          paramsBase.end =
            endDate && !/T/.test(endDate)
              ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString()
              : new Date(endDate).toISOString();
        }
        const filter = {};
        if (filterTenantId && filterTenantId.trim()) filter.tenant_id = filterTenantId.trim();
        if (filterUserName && filterUserName.trim()) filter.user_id = filterUserName.trim();
        if (Object.keys(filter).length > 0) paramsBase.filter = filter;

        const sortKey = lastSortRef.current?.key;
        const sortDir = lastSortRef.current?.dir || "asc";
        if (sortKey) {
          const sortFieldMap = {
            User_name: "user_name",
            user_name: "user_name",
            organization_name: "organization_name",
            tenant_id: "tenant_id",
            service_type: "service_type",
            session_name: "session_name",
            "session_data.session_name": "session_data.session_name",
            task_id: "task_id",
          };
          const backendField = sortFieldMap[sortKey] || String(sortKey);
          paramsBase.sort = sortDir === "desc" ? `-${backendField}` : backendField;
        }

        while (true) {
          const res = await listSessions({ ...paramsBase, page });
          const arr = Array.isArray(res?.items) ? res.items : [];
          collected = collected.concat(arr);

          const mt = res?.meta?.total;
          if (typeof mt === "number") {
            total = mt;
            if (collected.length >= total) break;
          }
          if (arr.length < limit) break;

          page += 1;
          if (page > 10000) break; // guard
        }
        setAllItems(collected);
        setHasAllLoaded(true);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[Sessions] fetchAllSessions failed", err);
        setAllItems([]);
        setHasAllLoaded(false);
      } finally {
        setLoadingAll(false);
      }
    };
  }, [filterTenantId, filterUserName, startDate, endDate]);

  // Client-side filtering across global cached items when searching
  const filteredItems = useMemo(() => {
    const q = (debouncedQuery || "").trim().toLowerCase();
    if (!q) return Array.isArray(items) ? items : [];
    const source = hasAllLoaded ? allItems : items;
    const arr = Array.isArray(source) ? source : [];

    return arr.filter((it) => {
      const fields = [
        it?.User_name,
        it?.user_name,
        it?.user?.name,
        it?.username,
        it?.email,
        it?.organization_name,
        it?.tenant_id,
        it?.service_type,
        it?.status,
        it?.session_name,
        it?.session_data?.session_name,
        it?.session_data?.description,
        it?.session_data?.llm_model,
      ];
      return fields.some((f) => {
        if (f == null) return false;
        try {
          return String(f).toLowerCase().includes(q);
        } catch {
          return false;
        }
      });
    });
  }, [items, allItems, hasAllLoaded, debouncedQuery]);

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
        console.debug("[Sessions] Row clicked -> details modal keys:", keys);
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

      {/* Charts stacked vertically */}
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
            <SessionsByOrganization
              data={byOrg}
              loading={aggLoading}
              error={aggError}
            />
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
        <div className="toolbar" aria-label="Sessions toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            className="input-search"
            placeholder="Search sessions (user, org, service, status, etc.)..."
            aria-label="Search sessions"
            value={query}
            onChange={async (e) => {
              const next = e.target.value;
              setQuery(next);
              const trimmed = (next || "").trim();
              if (trimmed && !hasAllLoaded && !loadingAll && fetchAllSessionsRef.current) {
                try {
                  await fetchAllSessionsRef.current();
                } catch {
                  // flags handled in fetcher
                }
              }
            }}
            style={{ minWidth: 280 }}
          />
          {Boolean((debouncedQuery || "").trim()) && (
            <span aria-live="polite" style={{ fontSize: 12, color: "#6B7280" }}>
              {loadingAll ? "Loading all pages…" : hasAllLoaded ? `Loaded ${allItems.length} records` : ""}
            </span>
          )}

          <label htmlFor="filter-user" className="sr-only">Filter by User name</label>
          <select
            id="filter-user"
            className="input-filter"
            aria-label="Filter by User"
            value={filterUserName}
            onChange={(e) => setFilterUserName(e.target.value)}
            style={{ minWidth: 220 }}
          >
            <option value="">All users</option>
            {userNameOptions.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <label htmlFor="filter-tenant" className="sr-only">Filter by Tenant ID</label>
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
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Date range controls */}
          <div role="group" aria-label="Date filters" style={{ display: "inline-flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
            <label htmlFor="start-date" style={{ fontSize: 12, color: "#374151" }}>Start</label>
            <input
              id="start-date"
              type="date"
              className="input-filter"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <label htmlFor="end-date" style={{ fontSize: 12, color: "#374151" }}>End</label>
            <input
              id="end-date"
              type="date"
              className="input-filter"
              aria-label="End date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="spacer" style={{ flex: 1 }} />
        </div>
        {error && (
          <div className="error" role="alert" style={{ marginBottom: 8 }}>
            {error}
          </div>
        )}
        <DataTable
          columns={Array.isArray(columns) ? columns : []}
          data={(debouncedQuery || "").trim() ? filteredItems : Array.isArray(items) ? items : []}
          loading={!!loading || (!!(debouncedQuery || "").trim() && loadingAll && !hasAllLoaded)}
          pageSize={meta.limit || 10}
          initialPage={(debouncedQuery || "").trim() ? 1 : (meta.page || 1)}
          {...(((debouncedQuery || "").trim())
            ? {} // client-side mode: no server fetch props
            : {
                serverTotal: meta?.total ?? 0,
                fetchPage: async (page, limit, sortKey, sortDir) => {
                  if (sortKey) {
                    lastSortRef.current = { key: sortKey, dir: sortDir || "asc" };
                  } else if (!lastSortRef.current) {
                    lastSortRef.current = { key: "", dir: "asc" };
                  }
                  await load(page, limit, "", sortKey, sortDir);
                },
              })}
          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}
        />
      </Card>
    </div>
  );
}
