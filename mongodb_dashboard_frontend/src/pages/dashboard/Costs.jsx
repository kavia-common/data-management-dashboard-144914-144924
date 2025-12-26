import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import { listLlmCostsUnderscore } from "../../api";
import useDebouncedValue from "../../hooks/useDebouncedValue";

/* =========================
   Formatters
========================= */

// PUBLIC_INTERFACE
function formatCurrencyUSD(n) {
  if (typeof n === "string") {
    n = n.replace(/[^0-9.-]/g, "");
  }
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return "$0.00";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6,
  }).format(num);
}

// PUBLIC_INTERFACE
function formatInt(n) {
  const num = typeof n === "number" ? n : Number.parseInt(n || 0, 10);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
}

/**
 * PUBLIC_INTERFACE
 * Costs page (underscore endpoint)
 * - Fetches from GET /api/llm_costs
 * - Server-side pagination
 * - Auto re-fetch when page/limit or filters change (no manual refresh needed)
 * - In-flight request cancellation to avoid race conditions
 * - URL query kept in sync with page, limit, and organization_id
 */
export default function Costs() {
  // Derive initial state from URL if available to support deep linking and back/forward navigation
  const initialSearch = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialPage = initialSearch?.get("page") ? Number(initialSearch.get("page")) || 1 : 1;
  const initialLimit = initialSearch?.get("limit") ? Number(initialSearch.get("limit")) || 10 : 10;
  const initialOrgId = initialSearch?.get("organization_id") || "";

  const [organizationId, setOrganizationId] = useState(initialOrgId);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  // Keep debounced org id to avoid firing a request on every keystroke
  const debouncedOrgId = useDebouncedValue(organizationId, 300);

  // Track in-flight request for cancellation to avoid race conditions
  const abortRef = useRef(null);

  // Inspector modal
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectTitle, setInspectTitle] = useState("Details");
  const [inspectPayload, setInspectPayload] = useState(null);

  function openInspector(title, payload) {
    setInspectTitle(title);
    setInspectPayload(payload);
    setInspectOpen(true);
  }

  function closeInspector() {
    setInspectOpen(false);
    setInspectPayload(null);
  }

  /* =========================
     Table Columns
  ========================= */

  const columns = useMemo(() => [
    {
      key: "organization_name",
      label: "Organization",
      priority: 1,
      render: (v) => (
        <span className="td--emphasis-name">
          {v || "—"}
        </span>
      ),
    },
    {
      key: "organization_cost",
      label: "Org Cost",
      className: "num",
      render: (v) => (
        <span className="amount-positive">
          {formatCurrencyUSD(v)}
        </span>
      ),
    },
    {
      key: "user_name",
      label: "User",
      render: (v) =>
        v ? v : <span className="muted">Unknown User</span>,
    },
    {
      key: "user_cost",
      label: "User Cost",
      className: "num",
      render: (v) => (
        <span className="amount-positive">
          {formatCurrencyUSD(v)}
        </span>
      ),
    },
    {
      key: "agents",
      label: "Agents",
      render: (v, row) => {
        const arr = Array.isArray(row?.agents) ? row.agents : [];
        if (!arr.length) return <span className="muted">—</span>;
        return (
          <div className="flex flex-wrap gap-1" style={{ maxWidth: 260 }}>
            {arr.map((name, i) => (
              <span key={`${name}-${i}`} className="badge badge-neutral">
                {name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "projects",
      label: "Projects",
      className: "num",
      render: (v) => (
        <span className="badge badge-neutral">
          {formatInt(v)}
        </span>
      ),
    },
    {
      key: "__actions",
      label: "",
      render: (_, row) => (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => openInspector("Row Details", row)}
        >
          View
        </button>
      ),
    },
  ], []);

  /* =========================
     Data Fetching
  ========================= */

  async function doFetch(nextPage = page, nextLimit = limit, opts = {}) {
    // Cancel any in-flight request
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {} // ignore
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    // Effective filters (preserve any future additions via opts)
    const effectiveOrgId = (opts.organization_id ?? debouncedOrgId) || undefined;

    // Build params
    const params = {
      organization_id: effectiveOrgId,
      page: nextPage,
      limit: nextLimit,
      // Note: keep space for other filters like search terms (opts.filter) if provided
      ...(opts.filter ? { filter: opts.filter } : {}),
      ...(opts.sort ? { sort: opts.sort } : {}),
    };

    // Update URL query to reflect current state (page, limit, and org filter)
    try {
      if (typeof window !== "undefined" && window.history?.replaceState) {
        const usp = new URLSearchParams(window.location.search);
        usp.set("page", String(nextPage));
        usp.set("limit", String(nextLimit));
        if (effectiveOrgId) usp.set("organization_id", String(effectiveOrgId));
        else usp.delete("organization_id");
        const newUrl = `${window.location.pathname}?${usp.toString()}`;
        window.history.replaceState({}, "", newUrl);
      }
    } catch {
      // non-critical
    }

    try {
      const res = await listLlmCostsUnderscore(params, { signal: controller.signal });
      const rows = Array.isArray(res?.items) ? res.items : [];

      setItems(rows);
      setTotal(typeof res?.total === "number" ? res.total : rows.length);
      setPage(nextPage);
      setLimit(nextLimit);
    } catch (e) {
      // Swallow abort errors
      if (e?.name === "AbortError") return;
      setError(e?.message || "Failed to load cost data");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  // When page or limit changes via URL or controls, re-fetch data automatically
  useEffect(() => {
    // Initial and subsequent pagination changes
    doFetch(page, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedOrgId]);

  // If page size changes via the select, reset to page 1 and refetch
  useEffect(() => {
    // when limit changes, reset to first page to avoid out-of-range
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const fetchPage = async (p, l) => {
    await doFetch(p, l);
  };

  /* =========================
     Render
  ========================= */

  return (
    <div>
      <Card
        title="Costs"
        subtitle="Aggregated LLM usage costs by organization and user"
        className="mt-4"
      >
        {/* Toolbar */}
        <div
          className="toolbar"
          aria-label="Costs toolbar"
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            className="input"
            placeholder="Filter by Organization ID (optional)"
            aria-label="Organization ID"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{ minWidth: 260 }}
          />

          <button
            className="btn btn-primary"
            type="button"
            onClick={() => doFetch(1, limit)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load"}
          </button>

          {error && (
            <div
              className="error"
              role="alert"
              style={{ color: "#EF4444" }}
            >
              {error}
            </div>
          )}

          <div style={{ flex: 1 }} />

          <label
            htmlFor="costs-pagesize"
            className="muted"
            style={{ fontSize: 12 }}
          >
            Page size
          </label>

          <select
            id="costs-pagesize"
            className="input"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 10)}
          >
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => openInspector("Rows JSON", items)}
            disabled={items.length === 0}
          >
            View rows
          </button>
        </div>

        {/* Table */}
        {(!loading && items.length === 0) ? (
          <div className="empty-state">
            No cost records found. Try adjusting filters.
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            pageSize={limit}
            initialPage={page}
            serverTotal={total}
            fetchPage={fetchPage}
            paginationTitle="Costs pages"
            forceHorizontalScroll
          />
        )}
      </Card>

      {/* Inspector Modal */}
      <Modal
        title={inspectTitle}
        open={inspectOpen}
        onClose={closeInspector}
        headerOffset={60}
        width="min(96vw, 880px)"
        footer={
          <button
            className="btn btn-ghost"
            onClick={closeInspector}
          >
            Close
          </button>
        }
      >
        <pre
          style={{
            margin: 0,
            padding: 12,
            maxHeight: "60vh",
            overflow: "auto",
            background: "#0b1020",
            color: "#e6edf3",
            borderRadius: 8,
          }}
        >
          {JSON.stringify(inspectPayload, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
