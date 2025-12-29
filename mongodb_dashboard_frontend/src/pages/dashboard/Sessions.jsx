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
   * - Debounced search (300ms) across the entire dataset via backend query param `q`.
   * - Keeps existing pagination using server-provided meta.total and page/limit.
   * - Minimal loading and error states shown within the table and above toolbar.
   */

  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  // Local-only search flag to ensure no API calls are triggered due to search typing
  const [localSearch, setLocalSearch] = useState(true);
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

  // Details modal state (session details; unrelated to deprecated "View All" costs modal)
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Lock to prevent race conditions when multiple loads are inflight (e.g., debounce vs pagination)
  const activeRequestRef = useRef(0);
  // Remember the last known sort so search/debounced reloads preserve sort order across pages
  const lastSortRef = useRef({ key: "", dir: "asc" });

  // Allowed and ordered fields (column visibility)
  // Replace Task Id column with User name per requirements
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

    function formatLocal(val) {
      if (!val) return "—";
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleString();
      } catch {
        return "—";
      }
    }
    function toHms(seconds) {
      const secs = Math.max(0, Math.floor(Number(seconds) || 0));
      const h = String(Math.floor(secs / 3600)).padStart(2, "0");
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
      const sRem = String(secs % 60).padStart(2, "0");
      return `${h}:${m}:${sRem}`;
    }
    function computeDuration(start, end) {
      if (!start || !end) return null;
      try {
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        if (isNaN(s) || isNaN(e)) return null;
        const secs = Math.max(0, Math.floor((e - s) / 1000));
        return toHms(secs);
      } catch {
        return null;
      }
    }

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
        // Slightly widen column if session list is present

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
        const params = { page, limit };
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
        // Do NOT pass text query for local-only search
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
      // Keep pairs of { id, name } for filtering
      // ✅ Build distinct options for dropdowns from the aggregated dataset (all collected pages)

      // Build unique user list with IDs and names
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
  async function load(page = 1, limit = meta.limit || 10, _qStr = "", sortKey, sortDir) {
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
        User_name: "user_name", // prefer lowercase field in DB
        tenant_id: "tenant_id",
        organization_name: "organization_name",
        service_type: "service_type",
        task_id: "task_id", // legacy, not used in current allowedOrdered
      };
      // include optional date range as both from/to and start/end
      const params = { page, limit };

      // Date range params: ONLY send start/end, never from/to (backend expects only start/end)
      if (startDate) {
        params.start = new Date(startDate).toISOString();
      }
      if (endDate) {
        // end as end-of-day
        params.end =
          endDate && !/T/.test(endDate)
            ? new Date(new Date(endDate).setHours(23, 59, 59, 999)).toISOString()
            : new Date(endDate).toISOString();
      }

      // Build filter: exact match on tenant_id and case-insensitive match handled server-side for user_name
      const filter = {};
      if (filterTenantId && filterTenantId.trim()) {
        filter.tenant_id = filterTenantId.trim();
      }
      if (filterUserName && filterUserName.trim()) {
        filter.user_id = filterUserName.trim();
      }

      if (Object.keys(filter).length > 0) {
        params.filter = filter;
      }

      if (sortKey) {
        const backendField = sortFieldMap[sortKey] || String(sortKey);
        params.sort = sortDir === "desc" ? `-${backendField}` : backendField;
      }
      const res = await listSessions(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);
      // If a newer request started after this one, ignore late response
      if (requestId !== activeRequestRef.current) return;

      // Client-side fallback date filtering
      let filtered = Array.isArray(arr) ? arr : [];
      if (startDate || endDate) {
        const fromMs = startDate ? new Date(startDate).getTime() : null;
        const toMs = endDate
          ? (/T/.test(endDate)
            ? new Date(endDate).getTime()
            : new Date(new Date(endDate).setHours(23, 59, 59, 999)).getTime())
          : null;
        filtered = filtered.filter((it) => {
          // derive session start and end
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

          // If only start exists, check it against window
          const inFrom = fromMs == null || (sMs != null ? sMs >= fromMs : eMs != null ? eMs >= fromMs : false);
          const inTo = toMs == null || (sMs != null ? sMs <= toMs : eMs != null ? eMs <= toMs : true);
          return inFrom && inTo;
        });
      }
      // Save full dataset only on first page load
      if (page === 1) {
        setAllItems(filtered);
      } else {
        setAllItems((prev) => {
          const map = new Map(prev.map((i) => [i.id || i._id, i]));
          filtered.forEach((i) => map.set(i.id || i._id, i));
          return Array.from(map.values());
        });

      }


      // Update columns dynamically based on currently returned data
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  // Debounced server-side search on query change (250ms default)
  // const debouncedQuery = useDebouncedValue(query, 250);
  // Debounced text search only
  // useEffect(() => {
  //   const q = (debouncedQuery || "").trim();
  //   const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
  //   load(1, meta.limit || 10, q, key, dir);
  //   loadAggregates(q);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [debouncedQuery, startDate, endDate]);


  useEffect(() => {
    // Client-side filtering across the full dataset (allItems) before pagination
    let filtered = Array.isArray(allItems) ? allItems.slice() : [];

    const q = (query || "").trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((row) => {
        // Strongly include user fields for matching
        const userValues = [
          row?.User_name,
          row?.user_name,
          row?.user?.name,
          row?.username,
          row?.email,
          row?.user_id, // identifier allowed
        ];

        const otherValues = [
          row?.organization_name,
          row?.tenant_id,
          row?.service_type,
          row?.session_type,
          row?.status,
        ];

        return [...userValues, ...otherValues]
          .filter((v) => v != null && v !== "")
          .map((v) => String(v).toLowerCase())
          .some((v) => v.includes(q));
      });
    }

    // Dedicated dropdown filters (still local)
    if (filterUserName) {
      filtered = filtered.filter((r) => String(r?.user_id || "") === String(filterUserName));
    }
    if (filterTenantId) {
      filtered = filtered.filter((r) => String(r?.tenant_id || "") === String(filterTenantId));
    }

    setItems(filtered);
    // Preserve pagination UI but update total to filtered length
    setMeta((m) => ({
      ...m,
      page: 1,
      total: filtered.length,
    }));
  }, [query, filterUserName, filterTenantId, allItems]);


  // Immediate refetch when dropdown filters change (no debounce)
  useEffect(() => {
    if (query.trim()) return; // 🔒 frontend search active

    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, "", key, dir);
  }, [filterUserName, filterTenantId, startDate, endDate]);




  // Toggle global dimming class while modal is open (align with user modal UX)
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
        console.debug("[Sessions] Row clicked (tenant_id scoped) -> opening details modal with keys:", keys);
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

      {/* Charts stacked vertically (normal flow, with spacing below so table doesn't overlap) */}
      <div
        className="sessions-charts"
        role="region"
        aria-label="Session insights"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          marginBottom: 32, // ensure spacing before the table card
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
          {/* Wrapper participates in normal flow; no absolute positioning */}
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

      {/* Existing table card remains below charts */}
      <Card title="Session Tracking" subtitle="Search and filter sessions without page reloads">
        <div className="toolbar" aria-label="Sessions toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            className="input-search"
            placeholder="Search sessions (user, org, service, status, etc.)..."
            aria-label="Search sessions"
            value={query}
            onChange={(e) => {
              setLocalSearch(true); // ensure client-side mode
              setQuery(e.target.value);
            }}
            style={{ minWidth: 280 }}
          />
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
          data={Array.isArray(items) ? items : []}
          loading={!!loading}

          pageSize={meta.limit || 10}
          initialPage={meta.page || 1}
          serverTotal={meta.total}
          fetchPage={(page, limit) => {
            const start = (page - 1) * limit;
            const end = start + limit;

            const source = query.trim() ? items : allItems;
            setItems(source.slice(start, end));

            setMeta((m) => ({ ...m, page }));
          }}

          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}

        />
      </Card>
    </div>
  );
}
