import React, { useEffect, useMemo, useState, useCallback } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";

import { renderCreditsWithUsd } from "../../utils/currency";
import { listLlmCosts } from "../../api";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import ErrorState from "../../components/common/ErrorState.jsx";

/**
 * PUBLIC_INTERFACE
 * Costs page
 * - Fetches LLM costs from /api/llm-costs with page/limit and renders columns directly from the items.
 * - Keeps pagination aligned with backend envelope shape. Lightweight error handling.
 */
export default function Costs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);

  // Default pagination aligned with backend common defaults (page=1, limit=10)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // Inspector modal state
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectTitle, setInspectTitle] = useState("Details");
  const [inspectPayload, setInspectPayload] = useState(null);

  // Request controller ref to cancel inflight calls
  const inflightRef = React.useRef(null);

  // PUBLIC_INTERFACE
  function openInspector(title, payload) {
    setInspectTitle(title);
    setInspectPayload(payload);
    setInspectOpen(true);
  }
  function closeInspector() {
    setInspectOpen(false);
    setInspectPayload(null);
  }

  const dateFieldHints = useMemo(
    () =>
      new Set([
        "timestamp",
        "created_at",
        "updated_at",
        "createdAt",
        "updatedAt",
        "date",
      ]),
    []
  );
  const currencyKeys = useMemo(
    () =>
      new Set(
        [
          "total_cost",
          "cost",
          "price",
          "amount",
          "usd",
          "usd_cost",
          "total_usd",
          "amount_usd",
          "charge",
        ].map((s) => s.toLowerCase())
      ),
    []
  );
  const isCurrencyKey = useCallback(
    (key) => {
      const k = String(key || "").toLowerCase();
      if (currencyKeys.has(k)) return true;
      if (/_usd\b|\busd_|\busd$/i.test(k)) return true;
      return false;
    },
    [currencyKeys]
  );

  function toLabel(k) {
    return k === "_id"
      ? "ID"
      : k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

  const renderText = useCallback((value) => {
    const text = value == null || value === "" ? "—" : String(value);
    return (
      <span
        title={text}
        style={{
          display: "inline-block",
          maxWidth: 280,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          verticalAlign: "middle",
        }}
      >
        {text}
      </span>
    );
  }, []);
  const renderNumber = useCallback(
    (value, key) => {
      if (value == null || value === "") return "—";
      const num =
        typeof value === "number"
          ? value
          : Number(String(value).replace(/[$,]/g, ""));
      if (Number.isFinite(num) && isCurrencyKey(key)) {
        return (
          <span className="amount-positive" style={{ whiteSpace: "nowrap" }}>
            {renderCreditsWithUsd(num)}
          </span>
        );
      }
      return renderText(value);
    },
    [isCurrencyKey, renderText]
  );
  const renderDate = useCallback(
    (value) => {
      if (!value) return "—";
      try {
        const txt = new Date(value).toLocaleString();
        return <span title={txt}>{txt}</span>;
      } catch {
        return renderText(value);
      }
    },
    [renderText]
  );
  const renderCompact = useCallback(
    function renderCompact(value, fieldLabel = "Details") {
      if (Array.isArray(value)) {
        const len = value.length;
        if (len === 0) return "0 items";
        const previewMax = 2;
        const shown = value.slice(0, previewMax);
        const previewText = shown
          .map((v) => {
            if (v && typeof v === "object") {
              return v.name || v.id || v._id || JSON.stringify(v);
            }
            return String(v);
          })
          .join(", ");
        const overflow = len > previewMax ? ` +${len - previewMax} more` : "";
        const summary = `${previewText}${overflow}`;
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              title={summary}
              style={{
                display: "inline-block",
                maxWidth: 320,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {summary}
            </span>
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 8px", height: 28 }}
              onClick={() => openInspector(fieldLabel, value)}
              aria-label={`View details for ${fieldLabel}`}
              title={`View details for ${fieldLabel}`}
            >
              View details
            </button>
          </div>
        );
      }
      if (value && typeof value === "object") {
        const keys = Object.keys(value);
        const shown = keys.slice(0, 2);
        const summary = `${shown.join(", ")}${
          keys.length > 2 ? ` +${keys.length - 2} more` : ""
        }`;
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              title={summary}
              style={{
                maxWidth: 320,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "inline-block",
              }}
            >
              {summary || "—"}
            </span>
            <button
              className="btn btn-ghost"
              style={{ padding: "4px 8px", height: 28 }}
              onClick={() => openInspector(fieldLabel, value)}
              aria-label={`View ${fieldLabel}`}
              title={`View ${fieldLabel}`}
            >
              View
            </button>
          </div>
        );
      }
      return renderText(value);
    },
    [renderText]
  );

  // Columns built directly from sample item fields (no enrichment)
  const buildColumnsFromSample = useCallback(
    (rows = []) => {
      const sample = rows[0] || {};
      const cols = [];

      // Prefer common backend fields if present; otherwise fallback to first N keys
      const preferred = [
        "_id",
        "tenant_id",
        "project_id",
        "user_id",
        "llm_model",
        "total_cost",
        "total_tokens",
        "timestamp",
        "created_at",
        "updated_at",
      ].filter((k) => Object.prototype.hasOwnProperty.call(sample, k));
      const main = preferred.length ? preferred : Object.keys(sample).slice(0, 8);

      main.forEach((k) => {
        cols.push({
          key: k,
          label: toLabel(k),
          render: (v, row) => {
            const val = v ?? row?.[k];
            if (val == null) return "—";
            if (dateFieldHints.has(k)) return renderDate(val);
            if (typeof val === "number") return renderNumber(val, k);
            return renderText(val);
          },
          priority: ["_id", "llm_model", "total_cost"].includes(k) ? 1 : 2,
        });
      });

      // A couple of nested fields if exist for inspection
      ["metadata", "params", "prompt", "response"].forEach((name) => {
        if (Object.prototype.hasOwnProperty.call(sample, name)) {
          cols.push({
            key: name,
            label: toLabel(name),
            render: (v) => renderCompact(v, toLabel(name)),
            priority: 3,
          });
        }
      });

      // Ensure uniqueness by key
      const seen = new Set();
      const unique = [];
      for (const c of cols) {
        if (seen.has(c.key)) continue;
        seen.add(c.key);
        unique.push(c);
      }
      return unique.length ? unique : [{ key: "_id", label: "ID" }];
    },
    [dateFieldHints, renderCompact, renderDate, renderNumber, renderText]
  );

  const columns = useMemo(() => buildColumnsFromSample(rows), [rows, buildColumnsFromSample]);

  // Normalize API response: supports envelope {success,data,meta} or raw array
  const normalizeListResponse = (payload, page, limit) => {
    if (payload && Array.isArray(payload.data)) {
      const meta = payload.meta || {};
      return {
        data: payload.data,
        meta: {
          page: meta.page ?? page ?? 1,
          limit: meta.limit ?? limit ?? 10,
          total: meta.total ?? payload.data.length,
        },
      };
    }
    if (Array.isArray(payload)) {
      return {
        data: payload,
        meta: {
          page: page ?? 1,
          limit: limit ?? payload.length,
          total: payload.length,
        },
      };
    }
    // fallback unknown
    return { data: [], meta: { page: page ?? 1, limit: limit ?? 10, total: 0 } };
  };

  // Core loader: fetch from /api/llm-costs with page & limit, and set rows directly
  const load = useCallback(
    async (page = 1, limit = meta.limit || 10, sortKey, sortDir) => {
      // cancel previous request if any
      if (inflightRef.current) {
        try {
          inflightRef.current.abort();
        } catch {}
        inflightRef.current = null;
      }

      const controller = new AbortController();
      inflightRef.current = controller;

      setLoading(true);
      setError("");

      const sortParam = sortKey
        ? sortDir === "desc"
          ? `-${sortKey}`
          : String(sortKey)
        : undefined;

      try {
        const params = { page, limit };
        if (sortParam) params.sort = sortParam;

        const res = await listLlmCosts(params, { signal: controller.signal });
        const { data, meta: m } = normalizeListResponse(res, page, limit);

        setRows(data);
        setMeta({ page: m.page, limit: m.limit, total: m.total });
      } catch (e) {
        setRows([]);
        setMeta((prev) => ({ ...prev, total: 0 }));
        setError(e?.message || "Failed to load LLM costs.");
      } finally {
        setLoading(false);
        if (inflightRef.current === controller) inflightRef.current = null;
      }
    },
    [meta.limit]
  );

  // Initial load
  useEffect(() => {
    load(1, 10);
  }, [load]);

  // Simple client-side contains filter on current page data
  const filteredRows = useMemo(() => {
    const q = (debouncedQuery || "").trim().toLowerCase();
    if (!q) return rows;
    return (rows || []).filter((doc) => {
      return Object.entries(doc || {}).some(([, v]) => {
        if (v == null) return false;
        try {
          const s = typeof v === "object" ? JSON.stringify(v) : String(v);
          return s.toLowerCase().includes(q);
        } catch {
          return false;
        }
      });
    });
  }, [rows, debouncedQuery]);

  return (
    <div>
      <Card
        title="Costs"
        subtitle="LLM usage cost records — direct view"
        className="mt-4"
      >
        <div
          className="toolbar"
          aria-label="Costs toolbar"
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          <input
            className="input-search"
            placeholder="Search costs..."
            aria-label="Search costs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ flex: 1 }} />
        </div>

        {error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              load(meta.page || 1, meta.limit || 10);
            }}
          />
        ) : null}

        <DataTable
          columns={columns}
          data={filteredRows}
          loading={loading}
          pageSize={Math.min(Math.max(1, meta.limit || 10), 25)}
          initialPage={meta.page || 1}
          serverTotal={meta.total}
          fetchPage={async (page, limit, sortKey, sortDir) => {
            const effLimit = Math.min(Math.max(1, limit || 10), 25);
            await load(page, effLimit, sortKey, sortDir);
          }}
          paginationTitle="Cost records pages"
        />
      </Card>

      <Modal
        title={inspectTitle}
        open={inspectOpen}
        onClose={closeInspector}
        headerOffset={60}
        width="min(96vw, 880px)"
        className="modal--costs"
        footer={
          <button
            className="btn btn-ghost"
            onClick={closeInspector}
            aria-label="Close details"
          >
            Close
          </button>
        }
      >
        <CostsTreeInspector payload={inspectPayload} />
      </Modal>
    </div>
  );
}

// Inline helper component for the Costs inspector modal body with TreeView actions
function CostsTreeInspector({ payload }) {
  const [search, setSearch] = React.useState("");
  const treeRef = React.useRef(null);

  const onSearchChange = (e) => setSearch(e.target.value);

  if (!payload) {
    return <div style={{ padding: "1rem" }}>No item selected</div>;
  }

  return (
    <div style={{ padding: "0" }}>
      <div
        className="sticky-header"
        style={{
          top: 0,
          zIndex: 1,
          background: "var(--bg-canvas, var(--ocean-bg, #f9fafb))",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <input
          className="input-search"
          placeholder="Search keys and values..."
          aria-label="Search in details"
          value={search}
          onChange={onSearchChange}
          style={{ flex: "1 1 260px", minWidth: 200 }}
        />
        <div style={{ flex: 1 }} />

        <button
          className="btn btn-secondary"
          onClick={() => treeRef.current?.expandAll?.()}
          title="Expand all"
        >
          Expand all
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => treeRef.current?.collapseAll?.()}
          title="Collapse all"
        >
          Collapse all
        </button>
      </div>

      <div
        style={{
          padding: "12px 16px",
          maxHeight: "60vh",
          overflow: "auto",
          background: "var(--bg-canvas, var(--ocean-bg, #f9fafb))",
        }}
      >
        <TreeView ref={treeRef} data={payload} defaultExpandedDepth={1} searchTerm={search} />
      </div>
    </div>
  );
}
