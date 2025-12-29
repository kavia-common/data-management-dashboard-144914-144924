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
   * Sessions page with fully client-side search across all pages.
   * Requirements fulfilled:
   * - No API requests while typing or while a non-empty search query is present.
   * - On entering search (query.length > 0), switch to client mode and prefetch all pages ONCE if not cached.
   * - Local filtering across allItems with client-side pagination in search mode.
   * - Debounced input for smoother UX.
   * - Reset to page 1 when search begins; restore server mode when query clears.
   * - Tiny inline status indicator during one-time prefetch.
   */

  // Server-mode state
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Client search state
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [clientMode, setClientMode] = useState(false);

  // All pages cache for client-side search
  const [allItems, setAllItems] = useState(null); // null => not loaded; [] => loaded but empty
  const hasFetchedAllRef = useRef(false);
  const [prefetchingAll, setPrefetchingAll] = useState(false);

  // Charts/filters (kept from existing page to avoid regressions)
  const [filterUserName, setFilterUserName] = useState("");
  const [filterTenantId, setFilterTenantId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userNameOptions, setUserNameOptions] = useState([]);
  const [tenantIdOptions, setTenantIdOptions] = useState([]);
  const [aggLoading, setAggLoading] = useState(false);
  const [aggError, setAggError] = useState("");
  const [byOrg, setByOrg] = useState([]);
  const [byType, setByType] = useState([]);

  // Details modal state
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Lock to prevent race conditions when multiple loads are inflight
  const activeRequestRef = useRef(0);
  // Remember the last known sort (server mode only)
  const lastSortRef = useRef({ key: "", dir: "asc" });

  // Allowed/ordered columns builder retained from existing implementation (restricted columns)
  const allowedOrdered = React.useMemo(
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

  // Keep URL query params in sync for dropdown filters (retained behavior)
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

  // PUBLIC_INTERFACE
  async function load(page = 1, limit = meta.limit || 10, sortKey, sortDir) {
    /**
     * Load sessions from server with pagination and optional sorting.
     * IMPORTANT: Never include text query here; searching is client-only per requirements.
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

      const params = { page, limit };

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

      // listSessions here returns envelope with items/meta in this codebase usage
      const res = await listSessions(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);

      // Optional date clamp client-side (safety)
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

      if (requestId !== activeRequestRef.current) return;

      setItems(filtered);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total:
          res?.meta?.total ??
          (Array.isArray(filtered) ? filtered.length : Array.isArray(arr) ? arr.length : 0),
      });
      setColumns(buildRestrictedColumns(arr));

      // Populate dropdowns/options from current page plus cached when available
      const baseForOptions = filtered;
      const userPairs = baseForOptions
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
      const tenantIds = distinctSorted(baseForOptions.map((it) => it?.tenant_id ?? ""));
      setUserNameOptions(uniqueUsers);
      setTenantIdOptions(tenantIds);
    } catch (e) {
      if (requestId !== activeRequestRef.current) return;
      setItems([]);
      setColumns(buildRestrictedColumns([]));
      setError(e?.response?.data?.message || e?.message || "Failed to load sessions.");
    } finally {
      if (requestId === activeRequestRef.current) setLoading(false);
    }
  }

  // Initial load (server mode)
  useEffect(() => {
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, key, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  // Refetch on filter changes (server mode); also clear allItems cache because scope changed
  useEffect(() => {
    if (clientMode) return; // don't trigger server fetch during active search mode
    setAllItems(null);
    hasFetchedAllRef.current = false;
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, key, dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUserName, filterTenantId, startDate, endDate]);

  // Debounce the query to avoid heavy re-filtering
  useEffect(() => {
    const run = debounce((q) => setDebouncedQuery(q), 300);
    run(query);
  }, [query]);

  // PUBLIC_INTERFACE
  /**
   * One-time prefetch of all pages and aggregate them for client-side filtering.
   * - Must run only when entering search mode and cache is missing.
   * - Must not run per keystroke; we call it only on mode entry.
   */
  const prefetchAllPages = useRef(async () => {}).current;
  useEffect(() => {
    prefetchAllPages.current = async () => {
      if (hasFetchedAllRef.current || prefetchingAll) return;
      setPrefetchingAll(true);
      try {
        const limit = 200; // use higher limit to reduce calls
        let page = 1;
        let collected = [];
        let total = Infinity;

        const paramsBase = { page, limit };

        // Preserve current scope filters (but not query) when aggregating
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
          const arr = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : (res?.data || []));
          collected = collected.concat(arr);

          const mt = res?.meta?.total;
          if (typeof mt === "number") {
            total = mt;
            if (collected.length >= total) break;
          }
          if (arr.length < limit) break;

          page += 1;
          if (page > 10000) break; // hard guard
        }
        setAllItems(collected);
        hasFetchedAllRef.current = true;
      } catch (_e) {
        // On error, use whatever we have (empty/partial)
        setAllItems([]);
        hasFetchedAllRef.current = true;
      } finally {
        setPrefetchingAll(false);
      }
    };
  }, [filterTenantId, filterUserName, startDate, endDate, prefetchingAll]);

  // Toggle client/server mode based on raw query with guards to avoid flapping
  useEffect(() => {
    const isActive = Boolean(query && query.length > 0);
    if (isActive && !clientMode) {
      setClientMode(true);
      setMeta((m) => ({ ...m, page: 1 })); // reset to first page in client mode
      // Start one-time aggregation without blocking typing
      if (!hasFetchedAllRef.current && allItems == null) {
        // fire and forget
        prefetchAllPages.current?.();
      }
    } else if (!isActive && clientMode) {
      // Clearing search -> return to server mode
      setClientMode(false);
      setMeta((m) => ({ ...m, page: 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Client-side matches: case-insensitive; user_name and nested session fields if present
  const matchesQuery = (item, q) => {
    if (!q) return true;
    const v = String(q).toLowerCase();

    const fields = [];
    // direct fields
    if (item.User_name) fields.push(String(item.User_name));
    if (item.user_name) fields.push(String(item.user_name));
    if (item.userName) fields.push(String(item.userName));
    if (item.username) fields.push(String(item.username));
    if (item.email) fields.push(String(item.email));
    // nested session data
    const sd = item.session_data || item.sessionData || item.details?.session_data || {};
    if (sd.session_name) fields.push(String(sd.session_name));
    if (sd.sessionName) fields.push(String(sd.sessionName));
    if (sd.description) fields.push(String(sd.description));
    if (sd.llm_model) fields.push(String(sd.llm_model));
    if (sd.model) fields.push(String(sd.model));

    // Optional broadeners
    if (item.organization_name) fields.push(String(item.organization_name));
    if (item.tenant_id) fields.push(String(item.tenant_id));
    if (item.service_type) fields.push(String(item.service_type));
    if (item.status) fields.push(String(item.status));
    if (item.session_name) fields.push(String(item.session_name));

    return fields.some((f) => f && f.toLowerCase().includes(v));
  };

  // Compute filtered list in client mode; otherwise use current server page items
  const clientFilteredItems = useMemo(() => {
    if (!clientMode) return items;
    const base = Array.isArray(allItems) ? allItems : []; // while prefetching, could be empty
    const filtered = debouncedQuery ? base.filter((it) => matchesQuery(it, debouncedQuery)) : base.slice();
    return filtered;
  }, [clientMode, items, allItems, debouncedQuery]);

  const effectiveTotal = clientMode ? clientFilteredItems.length : meta.total;

  // Client-side pagination in search mode, server-provided page in normal mode
  const currentPageRows = useMemo(() => {
    if (!clientMode) return items;
    const start = ((meta.page || 1) - 1) * Math.max(1, meta.limit || 10);
    const end = start + Math.max(1, meta.limit || 10);
    return clientFilteredItems.slice(start, end);
  }, [clientMode, clientFilteredItems, items, meta.page, meta.limit]);

  // Reset to page 1 on debouncedQuery change (stay in client mode; do not do any network)
  useEffect(() => {
    if (clientMode) {
      setMeta((m) => ({ ...m, page: 1 }));
    }
  }, [debouncedQuery, clientMode]);

  // Debounced input handler sets debouncedQuery only (no network)
  useEffect(() => {
    const run = debounce((q) => setDebouncedQuery(q), 250);
    run(query);
  }, [query]);

  // Tiny inline status indicator during prefetch
  const inlineStatus = () => {
    if (clientMode && !hasFetchedAllRef.current) {
      return (
        <span aria-live="polite" style={{ marginLeft: 8, fontSize: 12, color: "#6B7280" }}>
          {prefetchingAll ? "Loading all sessions…" : "Preparing results…"}
        </span>
      );
    }
    return null;
  };

  // Aggregates (kept minimal; no changes to search behavior)
  async function loadAggregates() {
    setAggLoading(true);
    setAggError("");
    try {
      const limit = 200;
      const maxPages = 10;
      let page = 1;
      const all = [];
      while (page <= maxPages) {
        const params = { page, limit };
        // Carry date range scope
        if (startDate) params.start = new Date(startDate).toISOString();
        if (endDate) {
          params.end =
            endDate && !/T/.test(endDate)
              ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString()
              : new Date(endDate).toISOString();
        }
        const res = await listSessions(params);
        const arr = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : (res?.data || []));
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

      // Build distinct options for dropdowns
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

  // Initial aggregates load (does not affect search)
  useEffect(() => {
    loadAggregates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            placeholder="Search by user or session name…"
            aria-label="Search sessions"
            value={query}
            onChange={async (e) => {
              const next = e.target.value;
              const wasEmpty = !query;
              setQuery(next);
              if (wasEmpty && next && next.length > 0) {
                // entering search: reset to page 1 and ensure one-time prefetch starts
                setMeta((m) => ({ ...m, page: 1 }));
                if (!hasFetchedAllRef.current && allItems == null) {
                  try {
                    await prefetchAllPages.current?.();
                  } catch {
                    // swallow; flags handled inside
                  }
                }
              }
            }}
            style={{ minWidth: 280 }}
          />
          {inlineStatus()}

          <label htmlFor="filter-user" className="sr-only">Filter by User name</label>
          <select
            id="filter-user"
            className="input-filter"
            aria-label="Filter by User"
            value={filterUserName}
            onChange={(e) => {
              // Changing scope filters should clear client cache and if in search, keep client mode but operate on new scope once prefetch completes
              setFilterUserName(e.target.value);
              setAllItems(null);
              hasFetchedAllRef.current = false;
            }}
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
            onChange={(e) => {
              setFilterTenantId(e.target.value);
              setAllItems(null);
              hasFetchedAllRef.current = false;
            }}
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
              onChange={(e) => {
                setStartDate(e.target.value);
                setAllItems(null);
                hasFetchedAllRef.current = false;
              }}
            />
            <label htmlFor="end-date" style={{ fontSize: 12, color: "#374151" }}>End</label>
            <input
              id="end-date"
              type="date"
              className="input-filter"
              aria-label="End date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setAllItems(null);
                hasFetchedAllRef.current = false;
              }}
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
          data={clientMode ? currentPageRows : (Array.isArray(items) ? items : [])}
          loading={!!loading || (clientMode && !hasFetchedAllRef.current && prefetchingAll)}
          pageSize={meta.limit || 10}
          initialPage={clientMode ? 1 : (meta.page || 1)}
          {
            ...(clientMode
              ? {} // client-side mode: no server fetch props; no API calls during search
              : {
                  serverTotal: meta?.total ?? 0,
                  fetchPage: async (page, limit, sortKey, sortDir) => {
                    // Only in server mode
                    if (sortKey) {
                      lastSortRef.current = { key: sortKey, dir: sortDir || "asc" };
                    } else if (!lastSortRef.current) {
                      lastSortRef.current = { key: "", dir: "asc" };
                    }
                    await load(page, limit, sortKey, sortDir);
                  },
                })
          }
          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}
        />
      </Card>
    </div>
  );
}
