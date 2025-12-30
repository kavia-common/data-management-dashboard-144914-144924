import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import { listSessions, listUsers } from "../../api";
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

// Normalize user identity from various shapes
function normalizeUserFromItem(it) {
  const id = it?.user_id ?? it?.user?.id ?? it?._user_id ?? null;
  const name =
    it?.User_name ??
    it?.user_name ??
    it?.user?.name ??
    it?.username ??
    it?.email ??
    "";
  return { id, name: String(name || "").trim() };
}

// PUBLIC_INTERFACE
export default function Sessions() {
  /**
   * Sessions page with server-side search and pagination.
   * - Debounced search across dataset via backend query param `q` (includes user filter).
   * - Keep pagination using server-provided meta.total and page/limit.
   * - Maintain a stable, full user dropdown independent of filtered results.
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // UI filters
  const [filterUserName, setFilterUserName] = useState("");
  const [filterTenantId, setFilterTenantId] = useState("");

  // Dropdown options: stable full list (primary) and tenant list
  const [fullUserNameOptions, setFullUserNameOptions] = useState([]); // [{ id, name }]
  const [tenantIdOptions, setTenantIdOptions] = useState([]);

  // Internal: map for quick user id->name merge and to avoid shrinking
  const userIdToNameRef = useRef(new Map());

  // Keep URL query params in sync for dropdowns (so back/forward works)
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    if (filterUserName) usp.set("user_name", filterUserName);
    else usp.delete("user_name");
    if (filterTenantId) usp.set("tenant_id", filterTenantId);
    else usp.delete("tenant_id");
    const next = `${window.location.pathname}?${usp.toString()}`;
    window.history.replaceState({}, "", next);
  }, [filterUserName, filterTenantId]);

  // Initialize dropdown selections from URL on first mount
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const initialUser = usp.get("user_name") || "";
    const initialTenant = usp.get("tenant_id") || "";
    if (initialUser) setFilterUserName(initialUser);
    if (initialTenant) setFilterTenantId(initialTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Merge users discovered from any array of session-like items into cache and full list
  function mergeDiscoveredUsers(itemsArr = []) {
    const map = userIdToNameRef.current;
    let changed = false;
    (itemsArr || []).forEach((it) => {
      const { id, name } = normalizeUserFromItem(it);
      if (!id) return;
      const current = map.get(id);
      const nextName = name || current || "";
      if (!current || (nextName && current !== nextName)) {
        map.set(id, nextName);
        changed = true;
      }
    });
    if (changed) {
      // Rebuild stable options array sorted by name, with fallback label if empty
      const arr = Array.from(map.entries())
        .map(([id, nm]) => ({ id, name: nm || String(id) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setFullUserNameOptions(arr);
    }
  }

  async function loadAggregates(qStr = "") {
    /**
     * Fetch sessions across multiple pages (capped) and build client-side aggregates
     * for charts: by organization_name and by session_type. Also merge-in discovered users
     * and tenant ids without shrinking options when filters change.
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

      // Merge discovered users from aggregate fetch (broad set)
      mergeDiscoveredUsers(all);

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
      setAggError(e?.response?.data?.message || e?.message || "Failed to load session aggregates.");
    } finally {
      setAggLoading(false);
    }
  }

  // Try to pre-populate full user list from dedicated users endpoint (if available)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listUsers({}); // baseClient will ensure organization_id scope
        const items = Array.isArray(res?.items) ? res.items : [];
        // Normalize users to { id, name }
        const preUsers = items
          .map((u) => {
            const id = u?._id ?? u?.id ?? u?.user_id ?? null;
            const name =
              u?.name ??
              u?.full_name ??
              u?.username ??
              u?.email ??
              "";
            return { id, name: String(name || "").trim() };
          })
          .filter((u) => u.id);
        // Fill map first to avoid flicker
        const map = userIdToNameRef.current;
        preUsers.forEach((u) => {
          if (!map.has(u.id)) map.set(u.id, u.name || String(u.id));
        });
        if (!cancelled) {
          const arr = Array.from(map.entries())
            .map(([id, nm]) => ({ id, name: nm || String(id) }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setFullUserNameOptions(arr);
        }
      } catch {
        // If listUsers is not available or fails, ignore; we'll progressively build from sessions
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // PUBLIC_INTERFACE
  async function load(page = 1, limit = meta.limit || 10, qStr = "", sortKey, sortDir) {
    /**
     * Load sessions with pagination, q param (includes dropdown user filter), and sorting.
     * Does not rebuild user options from filtered data; only merges-in newly discovered users.
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
      if (filterUserName && filterUserName.trim()) {
        params.q = filterUserName.trim() + (qStr && qStr !== filterUserName.trim() ? ` ${qStr}` : "");
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

      // Merge-in any new users from this page (do not shrink options)
      mergeDiscoveredUsers(arr);

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

  // Debounced server-side search on query change (250ms default)
  const debouncedQuery = useDebouncedValue(query, 250);
  useEffect(() => {
    const baseQ = (debouncedQuery || "").trim();
    const userQ = (filterUserName || "").trim();
    const combinedQ = userQ ? (baseQ ? `${userQ} ${baseQ}` : userQ) : baseQ;

    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, combinedQ, key, dir);
    loadAggregates(combinedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, filterUserName]);

  // Immediate refetch when tenant filter changes (do not rebuild options from filtered data)
  useEffect(() => {
    const baseQ = (query || "").trim();
    const userQ = (filterUserName || "").trim();
    const combinedQ = userQ ? (baseQ ? `${userQ} ${baseQ}` : userQ) : baseQ;

    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    load(1, meta.limit || 10, combinedQ, key, dir);
    // Keep aggregates broad and independent of dropdown changes
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
            onChange={(e) => setQuery(e.target.value)}
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
            {fullUserNameOptions.map((u) => (
              <option key={u.id ?? u.name} value={u.id ?? u.name}>{u.name || String(u.id)}</option>
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
            await load(page, limit, (query || "").trim(), sortKey, sortDir);
          }}
          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}
        />
      </Card>
    </div>
  );
}
