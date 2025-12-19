import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import SessionDetailsModal from "../../components/sessions/SessionDetailsModal";
import SessionsByOrganization from "../../components/charts/SessionsByOrganization.jsx";
import SessionsByType from "../../components/charts/SessionsByType.jsx";
import { useSessionTracking } from "../../hooks";
import useDebouncedValue from "../../hooks/useDebouncedValue";

/**
 * Utility to build distinct, sorted values (string-coerced).
 */
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
   * Sessions page that uses a single consolidated hook for paginated session-tracking
   * calls. The UI controls only update state (page/limit/q/sort), which triggers the
   * single fetch inside the hook.
   */
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, 250);

  // Filter by user selection (dropdown shows user names but we pass userId for accuracy)
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");

  // Dropdown options populated from aggregated dataset
  const [userOptions, setUserOptions] = useState([]); // [{ id, name }]
  const [tenantOptions, setTenantOptions] = useState([]); // [tenantId]

  // Single source of truth: useSessionTracking manages fetches. We pass only supported params.
  const {
    items,
    total,
    loading,
    error,
    meta,
    setPage,
    setLimit,
    setQuery: setHookQuery,
    setSort: setHookSort,
    refetch,
  } = useSessionTracking({
    page: 1,
    limit: 10,
    q: "",
    sort: undefined,
  });

  // Keep URL query params in sync (user and tenant for shareable state)
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    if (selectedUserId) usp.set("user_id", selectedUserId);
    else usp.delete("user_id");
    if (selectedTenantId) usp.set("tenant_id", selectedTenantId);
    else usp.delete("tenant_id");
    const qs = usp.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", next);
  }, [selectedUserId, selectedTenantId]);

  // Initialize selections from URL once
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const initialUserId = usp.get("user_id") || "";
    const initialTenant = usp.get("tenant_id") || "";
    if (initialUserId) setSelectedUserId(initialUserId);
    if (initialTenant) setSelectedTenantId(initialTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sorting memory for DataTable integration; we pass sort string via hook
  const lastSortRef = useRef({ key: "", dir: "asc" });

  // Allowed and ordered columns for the table
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

  // Keep fixed columns
  useEffect(() => {
    setColumns(buildRestrictedColumns());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Build aggregates and dropdown options using broader fetch that doesn't interfere with main hook (tenant is enforced by base client)
  const [aggLoading, setAggLoading] = useState(false);
  const [aggError, setAggError] = useState("");
  const [byOrg, setByOrg] = useState([]);
  const [byType, setByType] = useState([]);

  async function loadAggregates(qStr = "") {
    setAggLoading(true);
    setAggError("");
    try {
      const pageLimit = 200;
      const maxPages = 10;
      let localPage = 1;
      const all = [];
      while (localPage <= maxPages) {
        const res = await (async () => {
          const params = { page: localPage, limit: pageLimit, q: qStr };
          const { listSessions } = await import("../../api/baseClient.js");
          return listSessions(params);
        })();

        const arr = Array.isArray(res?.items) ? res.items : [];
        all.push(...arr);
        if (arr.length < pageLimit) break;
        localPage += 1;
      }

      // Build dropdown options from aggregated items
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

      const tenants = distinctSorted(all.map((it) => it?.tenant_id ?? ""));

      setUserOptions(uniqueUsers);
      setTenantOptions(tenants);

      // Aggregations
      const orgCounts = new Map();
      all.forEach((it) => {
        let org = it?.organization_name || it?.organization?.name || it?.tenant_id || "";
        org = String(org || "").trim();
        if (!org) org = "Unknown";
        orgCounts.set(org, (orgCounts.get(org) || 0) + 1);
      });
      const orgArr = Array.from(orgCounts.entries())
        .map(([organization_name, session_count]) => ({ organization_name, session_count }))
        .sort((a, b) => b.session_count - a.session_count);

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
    } catch (e) {
      setByOrg([]);
      setByType([]);
      setAggError(e?.response?.data?.message || e?.message || "Failed to load session aggregates.");
    } finally {
      setAggLoading(false);
    }
  }

  // Wire global Search input to the hook's q param (single source of truth)
  useEffect(() => {
    const q = (debouncedSearch || "").trim();
    setPage(1);
    setHookQuery(q);
    loadAggregates(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // When selecting a user in dropdown, update the same hook to trigger one fetch.
  // For now, we incorporate userId into the global q to leverage backend global search (which includes user_name, etc.).
  useEffect(() => {
    // If a user is selected, combine with existing search to form a single q.
    // Keep the user's id to ensure uniqueness when names overlap; backend may match id as text when present.
    const baseQ = (debouncedSearch || "").trim();
    const q = selectedUserId ? `${baseQ} ${selectedUserId}`.trim() : baseQ;
    setPage(1);
    setHookQuery(q);
    // do not reload aggregates on user selection to avoid excessive requests
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  // Selecting tenant in dropdown should not break tenant scoping (baseClient applies tenant_id automatically).
  // We only reflect the selection in the UI and URL; table data remains scoped by active tenant.
  useEffect(() => {
    // A tenant change in this dropdown is informational; no extra fetch beyond the hook's normal lifecycle.
    // If future behavior requires changing tenant scope, a separate active-tenant selection flow should be used.
    // Trigger a soft refetch to keep parity with control change without duplicating requests.
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId]);

  // Modal open/close body class toggle
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    if (detailsOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [detailsOpen]);

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
      <SessionDetailsModal
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setTimeout(() => setSelectedSession(null), 0);
        }}
        session={selectedSession}
      />

      {/* Charts Section */}
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

      {/* Main Table */}
      <Card title="Session Tracking" subtitle="Search and filter sessions without page reloads">
        <div className="toolbar" aria-label="Sessions toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input
            className="input-search"
            placeholder="Search sessions (user, org, service, status, etc.)..."
            aria-label="Search sessions"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <label htmlFor="filter-user" className="sr-only">Filter by User name</label>
          <select
            id="filter-user"
            className="input-filter"
            aria-label="Filter by User"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{ minWidth: 220 }}
          >
            <option value="">All users</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <label htmlFor="filter-tenant" className="sr-only">Filter by Tenant ID</label>
          <select
            id="filter-tenant"
            className="input-filter"
            aria-label="Filter by Tenant ID"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">All tenants</option>
            {tenantOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Date filters removed per requirements */}

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
          pageSize={meta?.limit || 10}
          initialPage={meta?.page || 1}
          serverTotal={meta?.total ?? total}
          fetchPage={async (page, limit, sortKey, sortDir) => {
            // Update pagination controls only; hook will refetch automatically
            setPage(page);
            setLimit(limit);

            // Translate sort to backend sort string and set via hook
            if (sortKey) {
              lastSortRef.current = { key: sortKey, dir: sortDir || "asc" };
              const sortFieldMap = {
                User_name: "user_name",
                tenant_id: "tenant_id",
                organization_name: "organization_name",
                service_type: "service_type",
              };
              const backendField = sortFieldMap[sortKey] || String(sortKey);
              const sortStr = (sortDir === "desc" ? `-${backendField}` : backendField);
              setHookSort(sortStr);
            } else {
              lastSortRef.current = { key: "", dir: "asc" };
              setHookSort(undefined);
            }
          }}
          paginationTitle="Sessions pages"
          onRowClick={handleRowClick}
        />
      </Card>
    </div>
  );
}
