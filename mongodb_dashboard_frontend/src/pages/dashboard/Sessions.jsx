import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import { listSessions } from "../../api";
import SessionDetailsModal from "../../components/sessions/SessionDetailsModal";
import SessionsByOrganization from "../../components/charts/SessionsByOrganization.jsx";
import SessionsByType from "../../components/charts/SessionsByType.jsx";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * Extracts tenant_id and user identifier from the stored token payload if it's a JWT.
 * Falls back to tenantId saved in utils/auth and to raw sub if available.
 */
function useScopedIdentity() {
  const { token } = useAuth();
  const [identity, setIdentity] = useState({ tenantId: null, userId: null, userLabel: null });

  useEffect(() => {
    let tenantId = null;
    let userId = null;
    let userLabel = null;

    // Try JWT decoding without external libs
    try {
      if (token && token.split(".").length === 3) {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map(function (c) {
              return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join("")
        );
        const payload = JSON.parse(jsonPayload || "{}");
        // common fields
        userId = payload.sub || null;
        // custom tenant claim variations
        tenantId =
          (payload["custom:tenant_id"] ||
            payload["tenant_id"] ||
            payload["orgId"] ||
            payload["organization_id"] ||
            null);

        // label preference
        userLabel = payload.name || payload.email || payload.preferred_username || userId || null;
      }
    } catch {
      // ignore decoding errors
    }

    // Fallback to utils/auth storage for tenantId if not in token
    if (!tenantId) {
      try {
        // dynamic import to avoid circular deps
        import("../../utils/auth").then((m) => {
          const t = typeof m.getTenantId === "function" ? m.getTenantId() : null;
          setIdentity({
            tenantId: t || null,
            userId: userId || null,
            userLabel: userLabel || userId || null,
          });
        }).catch(() => {
          setIdentity({ tenantId: null, userId: userId || null, userLabel: userLabel || userId || null });
        });
      } catch {
        setIdentity({ tenantId: null, userId: userId || null, userLabel: userLabel || userId || null });
      }
    } else {
      setIdentity({ tenantId, userId: userId || null, userLabel: userLabel || userId || null });
    }
  }, [token]);

  return identity;
}

// PUBLIC_INTERFACE
export default function Sessions() {
  /**
   * Sessions page with server-side search and pagination.
   * - Debounced search (300ms) via backend q param.
   * - Backend scoping strictly by Authorization token; we do not pass tenant_id/user_id.
   * - UI shows restored tenant and user selectors, but each contains a single option derived from token.
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // Restored UI controls: tenant and user selectors (single-option, derived from auth)
  const { tenantId, userId, userLabel } = useScopedIdentity();
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // Details modal state
  const [selectedSession, setSelectedSession] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Locks/state for sorting and inflight
  const activeRequestRef = useRef(0);
  const lastSortRef = useRef({ key: "", dir: "asc" });

  // Allowed/ordered columns
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
      return { key: k, label, render, priority: 2 };
    });
  }
  const [columns, setColumns] = useState(buildRestrictedColumns([]));

  // Aggregates
  const [aggLoading, setAggLoading] = useState(false);
  const [aggError, setAggError] = useState("");
  const [byOrg, setByOrg] = useState([]);
  const [byType, setByType] = useState([]);

  async function loadAggregates(qStr = "") {
    setAggLoading(true);
    setAggError("");
    try {
      const limit = 200;
      const maxPages = 10;
      let page = 1;
      const all = [];
      while (page <= maxPages) {
        const res = await listSessions({ page, limit, q: qStr });
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
    const requestId = ++activeRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const sortFieldMap = {
        User_name: "user_name",
        tenant_id: "tenant_id",
        organization_name: "organization_name",
        service_type: "service_type",
        task_id: "task_id",
      };
      const params = { page, limit, q: qStr };
      // Bearer-only; do not send tenant_id/user_id even if selected in UI

      if (sortKey) {
        const backendField = sortFieldMap[sortKey] || String(sortKey);
        params.sort = sortDir === "desc" ? `-${backendField}` : backendField;
      }
      const res = await listSessions(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);
      if (requestId !== activeRequestRef.current) return;

      setItems(arr);
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

  // Initialize selectors from scoped identity when available
  useEffect(() => {
    if (tenantId && !selectedTenant) setSelectedTenant(tenantId);
    if ((userId || userLabel) && !selectedUser) setSelectedUser(userId || userLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, userId, userLabel]);

  // Prevent duplicate initial loads
  const didInitRef = useRef(false);

  // Initial load
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    const initialQ = (query || "").trim();
    load(1, meta.limit || 10, initialQ, key, dir);
    loadAggregates(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initial mount only

  // Debounced server-side search on query change (250ms default)
  const debouncedQuery = useDebouncedValue(query, 250);
  useEffect(() => {
    if (!didInitRef.current) return;
    const q = (debouncedQuery || "").trim();
    const { key, dir } = lastSortRef.current || { key: "", dir: "asc" };
    // Changing selectors should still refresh table; values aren't sent to server.
    load(1, meta.limit || 10, q, key, dir);
    loadAggregates(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, selectedTenant, selectedUser]);

  // Modal body class toggle
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
        console.debug("[Sessions] Row clicked -> opening details modal with keys:", keys);
      } catch {
        // ignore
      }
    }
    setSelectedSession(row);
    setDetailsOpen(true);
  };

  // Build single-option lists for selectors
  const tenantOptions = useMemo(() => {
    const label = tenantId || "Current tenant";
    const value = tenantId || "current";
    return [{ label, value }];
  }, [tenantId]);

  const userOptions = useMemo(() => {
    const label = userLabel || userId || "Current user";
    const value = userId || userLabel || "current";
    return [{ label, value }];
  }, [userId, userLabel]);

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

      {/* Table card with restored filter controls */}
      <Card title="Session Tracking" subtitle="Search and filter sessions without page reloads">
        <div
          className="toolbar"
          aria-label="Sessions toolbar"
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          {/* Tenant selector (single-option) */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#555" }}>Tenant</span>
            <select
              aria-label="Tenant"
              value={selectedTenant || (tenantOptions[0] && tenantOptions[0].value) || ""}
              onChange={(e) => setSelectedTenant(e.target.value)}
              style={{ minWidth: 200 }}
            >
              {tenantOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* User selector (single-option) */}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "#555" }}>User</span>
            <select
              aria-label="User"
              value={selectedUser || (userOptions[0] && userOptions[0].value) || ""}
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{ minWidth: 200 }}
            >
              {userOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Search input */}
          <input
            className="input-search"
            placeholder="Search sessions (org, service, status, etc.)..."
            aria-label="Search sessions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 280 }}
          />
        </div>

        {error && (
          <div className="error" role="alert" style={{ marginBottom: 8 }}>
            {error}
          </div>
        )}

        <DataTable
          columns={columns}
          data={items}
          loading={loading}
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
