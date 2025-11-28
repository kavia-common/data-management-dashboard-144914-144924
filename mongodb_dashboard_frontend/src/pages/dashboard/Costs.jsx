import React, { useEffect, useMemo, useState, useCallback } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";

import { renderCreditsWithUsd, parseUsdToNumber } from "../../utils/currency";
import { listLlmCosts, getApiClient } from "../../api";
import { getOrganizationId } from "../../api/authTokenProvider";
import { getUserProjects } from "../../api/users";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import ErrorState from "../../components/common/ErrorState.jsx";

/**
 * PUBLIC_INTERFACE
 * Costs page
 * - Keeps compact LLM costs table with inspector for large fields.
 * - Enhancements: resolve User Name, Total Projects per user, and include User Cost column.
 * - Resilience: conservative pagination, client-side timeouts with backoff, debounced filters, micro-batched enrichment, progressive skeleton UI, friendly errors.
 */
export default function Costs() {
  const [allItems, setAllItems] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [partialLoading, setPartialLoading] = useState(false); // enrichment/progressive fill
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);

  // Conservative default pagination
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // Enrichment caches
  const [userNames, setUserNames] = useState({}); // { userId: name|null }
  const [userProjectCounts, setUserProjectCounts] = useState({}); // { userId: number }

  // Inspector modal state
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectTitle, setInspectTitle] = useState("Details");
  const [inspectPayload, setInspectPayload] = useState(null);

  // Internal memo caches for enrichment to avoid refetching within session
  const userNameMemo = React.useRef(new Map()); // id -> name|null
  const userProjectsMemo = React.useRef(new Map()); // id -> number|null

  // Request controller ref to cancel slow inflight call on filter/pagination changes
  const inflightRef = React.useRef(null);

  // Client-side request timeout (AbortController)
  const withTimeout = useCallback(async (promiseFactory, ms = 22000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(new Error("Request timeout")), ms);
    inflightRef.current = controller;

    try {
      const res = await promiseFactory(controller.signal);
      return res;
    } finally {
      clearTimeout(id);
      if (inflightRef.current === controller) inflightRef.current = null;
    }
  }, []);

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
  // Normalize currency-like field names across various API shapes.
  // Handles: snake_case, camelCase, and *_usd variants.
  const CURRENCY_FIELDS = useMemo(
    () =>
      new Set(
        [
          "total_cost",
          "totalcost",
          "cost",
          "organization_cost",
          "organizationcost",
          "price",
          "amount",
          "usd",
          "usd_cost",
          "total_usd",
          "totalusd",
          "amount_usd",
          "charge",
          "user_cost",
          "usercost",
        ].map((s) => s.toLowerCase())
      ),
    []
  );

  function isCurrencyKey(key) {
    const k = String(key || "").toLowerCase();
    if (CURRENCY_FIELDS.has(k)) return true;
    // Also treat anything ending with _usd or usd_... as currency-like
    if (/_usd\b|\busd_|\busd$/i.test(k)) return true;
    return false;
  }
  const numericPrettyHints = useMemo(
    () =>
      new Set(["total_tokens", "input_tokens", "output_tokens", "tokens", "count"]),
    []
  );

  function toLabel(k) {
    return k === "_id"
      ? "ID"
      : k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  }

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

  const renderText = (value) => {
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
  };

  const renderNumber = (value, key) => {
    if (value == null || value === "") return "—";

    // Coerce to number when possible (e.g., "0.123", "$0.12")
    const num = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
    const isFiniteNum = Number.isFinite(num);

    if (isCurrencyKey(key) && isFiniteNum) {
      return (
        <span className="amount-positive" style={{ whiteSpace: "nowrap" }}>
          {renderCreditsWithUsd(num)}
        </span>
      );
    }

    if (isFiniteNum && (numericPrettyHints.has(key) || /token|count|total/i.test(String(key)))) {
      const txt = num.toLocaleString();
      return (
        <span title={txt} style={{ whiteSpace: "nowrap" }}>
          {txt}
        </span>
      );
    }

    return renderText(value);
  };

  const renderDate = (value) => {
    if (!value) return "—";
    try {
      const txt = new Date(value).toLocaleString();
      return <span title={txt}>{txt}</span>;
    } catch {
      return renderText(value);
    }
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
      const summary = `${shown.join(", ")}${keys.length > 2 ? ` +${keys.length - 2} more` : ""}`;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span title={summary} style={{ maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block" }}>
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
  }

  // Memoized normalize of items enriched with user info
  const enrichedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.map((row) => {
      const userId = row.user_id || row.userId || row.user || row.userID || row.user_id_str || null;
      const userName = userId ? userNames[userId] ?? null : null;
      const projectsCount = userId ? userProjectCounts[userId] ?? null : null;
      // Determine user_cost if present on row
      let userCost = row.user_cost ?? row.userCost ?? null;
      if (userCost == null) {
        userCost = null;
      }
      return {
        ...row,
        __userId: userId,
        __userName: userName,
        __projectsCount: projectsCount,
        __userCost: userCost,
      };
    });
  }, [items, userNames, userProjectCounts]);

  // Build columns including enriched fields
  const buildColumnsFromSample = useCallback((rows = []) => {
    const sample = rows[0] || {};

    const nestedCandidates = ["users", "projects", "agents", "details", "metadata", "params", "prompt", "response"];
    const cols = [];

    // Enriched columns
    cols.push({
      key: "__userName",
      label: "User Name",
      render: (v, row) => {
        const name = row.__userName;
        if (name === undefined) return "—";
        return name == null || name === "" ? "Unknown" : renderText(name);
      },
      priority: 1,
      minWidth: 140,
    });
    cols.push({
      key: "__projectsCount",
      label: "Total Projects",
      render: (v, row) => {
        const n = row.__projectsCount;
        if (n == null) return "—";
        try {
          const txt = Number(n).toLocaleString();
          return <span title={txt}>{txt}</span>;
        } catch {
          return String(n);
        }
      },
      priority: 1,
      minWidth: 120,
    });
    cols.push({
      key: "__userCost",
      label: "User Cost",
      render: (v, row) => {
        const val = row.__userCost;
        const num = parseUsdToNumber(val);
        if (num == null) return "—";
        return (
          <span className="amount-positive" style={{ whiteSpace: "nowrap" }}>
            {renderCreditsWithUsd(num)}
          </span>
        );
      },
      priority: 1,
      minWidth: 160,
    });

    // Main fields from sample
    const basePreferred = [
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
    ];
    const present = basePreferred.filter((k) => Object.prototype.hasOwnProperty.call(sample, k));
    const main = present.length ? present : Object.keys(sample).slice(0, 5);
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
        priority: ["_id", "llm_model", "total_cost"].includes(k) ? 2 : 3,
      });
    });

    // Nested compact fields
    const nestedCols = [];
    nestedCandidates.forEach((name) => {
      if (Object.prototype.hasOwnProperty.call(sample, name)) {
        nestedCols.push({
          key: name,
          label: toLabel(name),
          render: (v) => renderCompact(v, toLabel(name)),
          priority: 4,
        });
      }
    });

    cols.push(...nestedCols.slice(0, 3));

    // Ensure uniqueness by key
    const seen = new Set();
    const unique = [];
    for (const c of cols) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      unique.push(c);
    }

    return unique.length ? unique : [{ key: "_id", label: "ID" }];
  }, [dateFieldHints, numericPrettyHints]); // depends on stable memoized sets

  // Memo columns based on enriched items
  const columns = useMemo(() => {
    const base = buildColumnsFromSample(enrichedItems || []);
    return base.slice();
  }, [enrichedItems, buildColumnsFromSample]);

  // Debounced search filter
  useEffect(() => {
    const q = (debouncedQuery || "").trim().toLowerCase();
    if (!q) {
      setItems(allItems);
      return;
    }
    const filtered = (allItems || []).filter((doc) => {
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
    setItems(filtered);
  }, [debouncedQuery, allItems]);

  // Utility: limited concurrency map for fallback enrichment
  async function mapWithConcurrency(inputs, worker, concurrency = 2) {
    const results = {};
    const queue = [...inputs];
    const workers = new Array(Math.min(concurrency, queue.length)).fill(0).map(async () => {
      while (queue.length) {
        const id = queue.shift();
        // eslint-disable-next-line no-await-in-loop
        const value = await worker(id);
        results[String(id)] = value;
      }
    });
    await Promise.all(workers);
    return results;
  }

  // Efficient batched fetching of user names for current page
  const fetchUserNamesBatch = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return {};
    // Use memo cache first
    const pending = [];
    const fromCache = {};
    userIds.forEach((id) => {
      if (userNameMemo.current.has(id)) fromCache[id] = userNameMemo.current.get(id);
      else pending.push(id);
    });
    const api = getApiClient();
    const orgId = getOrganizationId();

    if (pending.length === 0) return fromCache;

    // Try bulk endpoint: /api/users?ids=...
    try {
      const params = { ids: pending, ...(orgId ? { organization_id: orgId } : {}) };
      const res = await api.get("/api/users", { params });
      const payload = res?.data;
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : (payload?.items || []);
      const mapping = {};
      (list || []).forEach((u) => {
        const id = u?._id || u?.id;
        if (!id) return;
        const name = u?.name || u?.full_name || u?.username || u?.email || null;
        mapping[String(id)] = name;
      });
      // Merge cache
      Object.entries(mapping).forEach(([id, name]) => userNameMemo.current.set(id, name));
      return { ...fromCache, ...mapping };
    } catch {
      // Fallback: per-user fetch GET /api/users/:id with limited concurrency
      const mapping = await mapWithConcurrency(
        pending,
        async (id) => {
          try {
            const res = await api.get(`/api/users/${encodeURIComponent(id)}`, { params: orgId ? { organization_id: orgId } : {} });
            const u = res?.data;
            return u?.name || u?.full_name || u?.username || u?.email || null;
          } catch {
            return null;
          }
        },
        2
      );
      Object.entries(mapping).forEach(([id, name]) => userNameMemo.current.set(id, name));
      return { ...fromCache, ...mapping };
    }
  }, []);

  // Efficient batched fetching of projects per user for current page
  const fetchProjectsCountBatch = useCallback(async (userIds) => {
    if (!userIds || userIds.length === 0) return {};
    // Use memo cache first
    const pending = [];
    const fromCache = {};
    userIds.forEach((id) => {
      if (userProjectsMemo.current.has(id)) fromCache[id] = userProjectsMemo.current.get(id);
      else pending.push(id);
    });
    const orgId = getOrganizationId();
    if (pending.length === 0) return fromCache;

    const mapping = await mapWithConcurrency(
      pending,
      async (id) => {
        try {
          const res = await getUserProjects(String(id), { tenantId: orgId });
          const projects = Array.isArray(res?.projects) ? res.projects : [];
          return projects.length;
        } catch {
          return null;
        }
      },
      2
    );
    Object.entries(mapping).forEach(([id, n]) => userProjectsMemo.current.set(id, n));
    return { ...fromCache, ...mapping };
  }, []);

  // Backoff helper (exponential backoff up to maxAttempts)
  const fetchWithBackoff = useCallback(async (fn, { maxAttempts = 2, initialDelay = 800 } = {}) => {
    let attempt = 0;
    let lastError;
    while (attempt < maxAttempts) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await fn();
      } catch (e) {
        lastError = e;
        const status = e?.status;
        if (![502, 503, 504].includes(status)) break;
        // exponential backoff
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, initialDelay * Math.pow(2, attempt)));
        attempt += 1;
      }
    }
    throw lastError;
  }, []);

  // Progressive enrichment
  const runEnrichment = useCallback(async (arr) => {
    const ids = Array.from(
      new Set(
        (arr || [])
          .map((r) => r.user_id || r.userId || r.user || r.userID || r.user_id_str)
          .filter(Boolean)
          .map(String)
      )
    );

    if (ids.length === 0) return;

    setPartialLoading(true);
    try {
      const [namesMap, projectsMap] = await Promise.all([
        fetchUserNamesBatch(ids),
        fetchProjectsCountBatch(ids),
      ]);
      setUserNames((prev) => ({ ...prev, ...namesMap }));
      setUserProjectCounts((prev) => ({ ...prev, ...projectsMap }));
    } catch {
      // Ignore enrichment errors, data table will still render base attributes
    } finally {
      setPartialLoading(false);
    }
  }, [fetchProjectsCountBatch, fetchUserNamesBatch]);

  // Load function with timeout and graceful degradation on limit/time range
  const load = useCallback(async (page = 1, limit = meta.limit || 10, sortKey, sortDir) => {
    // cancel previous request if any
    if (inflightRef.current) {
      try { inflightRef.current.abort(); } catch {}
      inflightRef.current = null;
    }

    setLoading(true);
    setError("");

    // Server-side sort param
    const sortParam = sortKey ? (sortDir === "desc" ? `-${sortKey}` : String(sortKey)) : undefined;

    // Conservative request builder
    const requestOnce = async (effLimit, signal) => {
      const params = { page, limit: effLimit };
      if (sortParam) params.sort = sortParam;
      // Defensive: allow user smaller ranges via limit control (DataTable page size)
      const res = await listLlmCosts(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);
      const nextMeta = {
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || effLimit,
        total: res?.meta?.total ?? arr.length,
      };
      return { arr, meta: nextMeta };
    };

    // Attempt with timeout and backoff; on timeout or 502/503/504, retry with smaller limit
    const limitsToTry = [Math.min(Math.max(1, limit), 25), 15, 10];
    let result = null;
    let lastErr = null;

    for (let i = 0; i < limitsToTry.length; i += 1) {
      const effLimit = limitsToTry[i];
      try {
        // Wrap request with timeout and backoff for gateway errors
        // eslint-disable-next-line no-loop-func
        const attempt = async () =>
          withTimeout((signal) => requestOnce(effLimit, signal), 22000);
        // eslint-disable-next-line no-await-in-loop
        result = await fetchWithBackoff(attempt, { maxAttempts: 2, initialDelay: 700 });
        setAllItems(result.arr);
        setItems(result.arr);
        setMeta(result.meta);
        // Trigger enrichment in background
        runEnrichment(result.arr);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        // on final failure we'll show a friendly inline error
      }
    }

    if (lastErr) {
      setAllItems([]);
      setItems([]);
      const status = lastErr?.status;
      const msgBase =
        status && [502, 503, 504].includes(status)
          ? "The server is busy. Try a smaller page size or narrower time range."
          : (lastErr?.message || "Failed to load LLM costs.");
      setError(msgBase);
    }

    setLoading(false);
  }, [meta.limit, fetchWithBackoff, runEnrichment, withTimeout]);

  useEffect(() => {
    // initial load on mount with conservative page size (10)
    load(1, 10);
  }, [load]);

  return (
    <div>
      {/* Table section */}
      <Card
        title="Costs"
        subtitle="LLM usage cost records — compact view with expandable details"
        className="mt-4"
      >
        <div className="toolbar" aria-label="Costs toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
              // Suggest smaller page size retry (limit 10)
              load(meta.page || 1, 10);
            }}
          />
        ) : null}

        <DataTable
          columns={columns}
          data={enrichedItems}
          loading={loading || partialLoading}
          pageSize={Math.min(Math.max(1, meta.limit || 10), 25)}
          initialPage={meta.page || 1}
          serverTotal={meta.total}
          fetchPage={async (page, limit, sortKey, sortDir) => {
            // Retry with user-selected smaller limit to avoid 504s
            const effLimit = Math.min(Math.max(1, limit || 10), 25);
            await load(page, effLimit, sortKey, sortDir);
          }}
          paginationTitle="Cost records pages"
        />
      </Card>

      {/* Modal inspector for arrays/objects to avoid expanding inside table cells */}
      <Modal
        title={inspectTitle}
        open={inspectOpen}
        onClose={closeInspector}
        headerOffset={60}
        width="min(96vw, 880px)"
        /* Costs-context variant to ensure subtle canvas tint on white surface */
        className="modal--costs"
        footer={
          <button className="btn btn-ghost" onClick={closeInspector} aria-label="Close details">Close</button>
        }
      >
        <CostsTreeInspector
          payload={inspectPayload}
        />
      </Modal>
    </div>
  );
}

// Inline helper component for the Costs inspector modal body with TreeView actions
function CostsTreeInspector({ payload }) {
  const [search, setSearch] = React.useState("");
  const treeRef = React.useRef(null);

  // Progressive expansion controller hook
  // PUBLIC_INTERFACE
  const { default: useProgressiveExpand } = require("../../hooks/useProgressiveExpand");
  const { running, progress, counts, startFromItems, cancel } = useProgressiveExpand({
    applyBatch: (batch) => treeRef.current?.applyExpandBatch?.(batch),
    timeSliceMs: 8,
    onDone: () => {},
    onCancel: () => {},
  });

  const onSearchChange = (e) => setSearch(e.target.value);

  const expandAll = React.useCallback(() => {
    const all = treeRef.current?.getAllExpandablePaths?.() || [];
    if (all.length <= 300) {
      treeRef.current?.expandAll?.();
      return;
    }
    startFromItems(all);
  }, [startFromItems]);

  const collapseAll = React.useCallback(() => {
    if (running) cancel();
    treeRef.current?.collapseAll?.();
  }, [running, cancel]);

  React.useEffect(() => {
    return () => {
      try {
        if (running) cancel();
      } catch {}
    };
  }, [running, cancel]);

  if (!payload) {
    return <div style={{ padding: "1rem" }}>No item selected</div>;
  }

  return (
    <div style={{ padding: "0" }}>
      <div className="sticky-header" style={{
        top: 0,
        zIndex: 1,
        background: "var(--bg-canvas, var(--ocean-bg, #f9fafb))",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}>
        <input
          className="input-search"
          placeholder="Search keys and values..."
          aria-label="Search in details"
          value={search}
          onChange={onSearchChange}
          style={{ flex: "1 1 260px", minWidth: 200 }}
        />
        <div style={{ flex: 1 }} />

        {running ? (
          <div aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <div title={`Expanding... ${progress}%`} style={{
              width: 120,
              height: 8,
              borderRadius: 999,
              background: "#E5E7EB",
              overflow: "hidden",
              border: "1px solid #E5E7EB"
            }}>
              <div style={{
                width: `${Math.max(4, progress)}%`,
                height: "100%",
                background: "#2563EB",
                transition: "width 120ms linear",
              }} />
            </div>
            <span style={{ fontSize: 12, color: "#0F172A" }}>
              {counts.processed}/{counts.total}
            </span>
          </div>
        ) : null}

        <button
          className="btn btn-secondary"
          onClick={expandAll}
          title="Expand all"
          disabled={running}
        >
          {running ? "Expanding..." : "Expand all"}
        </button>

        {running ? (
          <button className="btn btn-secondary" onClick={cancel} title="Stop expanding">
            Stop
          </button>
        ) : null}

        <button className="btn btn-secondary" onClick={collapseAll} title="Collapse all">Collapse all</button>
      </div>

      <div style={{
        padding: "12px 16px",
        maxHeight: "60vh",
        overflow: "auto",
        background: "var(--bg-canvas, var(--ocean-bg, #f9fafb))",
      }}>
        <TreeView
          ref={treeRef}
          data={payload}
          defaultExpandedDepth={1}
          searchTerm={search}
        />
      </div>
    </div>
  );
}
