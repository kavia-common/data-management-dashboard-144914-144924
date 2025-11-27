import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";

import { renderCreditsWithUsd } from "../../utils/currency";
import { listLlmCosts } from "../../api";
import useLlmCostsHierarchy from "../../hooks/useLlmCostsHierarchy";

/**
 * PUBLIC_INTERFACE
 * Costs page
 * - Update to show enriched per-user columns using hierarchy endpoint when available.
 */
export default function Costs() {
  const [allItems, setAllItems] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // Inspector modal state
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectTitle, setInspectTitle] = useState("Details");
  const [inspectPayload, setInspectPayload] = useState(null);

  // Prefer hierarchy dataset for enriched view
  const { data: hierarchyData, loading: hierarchyLoading, error: hierarchyError } = useLlmCostsHierarchy();

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

  // Helpers
  const toNumber = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string") {
      const n = Number(v.replace(/[$,]/g, "").trim());
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Map hierarchy response into rows for table
  const mapHierarchyToRows = (payload) => {
    if (!payload) return [];
    // Accept both array or object with .items or .data
    const root = Array.isArray(payload) ? payload : (payload.items || payload.data || payload.nodes || payload);
    // Expected shapes:
    // - Array of user nodes or tenant->groups->users; try to find users collection too for name resolution
    const allUsersList = Array.isArray(payload?.users) ? payload.users : (Array.isArray(payload?.data?.users) ? payload.data.users : []);
    const usersIndex = new Map();
    allUsersList.forEach((u) => {
      const id = String(u?.user_id ?? u?.id ?? u?._id ?? "");
      if (id) usersIndex.set(id, u);
    });

    // Flatten nodes that represent users with feature/type and projects
    const rows = [];

    const pushUserNode = (uNode, parentFeature) => {
      if (!uNode) return;
      const userId = String(uNode.user_id ?? uNode.id ?? uNode._id ?? "");
      const refUser = (userId && usersIndex.get(userId)) || null;

      // derive name
      const name =
        uNode.user_name ||
        uNode.name ||
        refUser?.name ||
        refUser?.full_name ||
        refUser?.username ||
        refUser?.email ||
        userId ||
        "Unknown";

      // feature/type
      const feature =
        uNode.feature ||
        uNode.type ||
        uNode.Feature ||
        parentFeature ||
        "—";

      // costs
      // prefer user_cost; fallback to total_cost or cost
      const costsUsed = toNumber(uNode.user_cost ?? uNode.total_cost ?? uNode.cost ?? uNode.amount ?? 0);

      // projects array length
      const projectsArr = Array.isArray(uNode.projects) ? uNode.projects : (Array.isArray(uNode.children) ? uNode.children.filter((c) => c?.project_id || c?.project) : []);
      const projectsCount = Array.isArray(projectsArr) ? projectsArr.length : 0;

      rows.push({
        user_id: userId || undefined,
        user_name: name,
        feature,
        costs_used: costsUsed,
        credits_consumed: costsUsed, // rendered with renderCreditsWithUsd
        projects: projectsCount,
        _raw: uNode,
      });
    };

    const visit = (node, ctx = {}) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach((n) => visit(n, ctx));
        return;
      }
      // If it looks like a user node
      const isUserish =
        node.user_id != null ||
        node.type === "User" ||
        node.kind === "user" ||
        (node.role === "user" && node.user_cost != null);

      if (isUserish) {
        pushUserNode(node, ctx.feature);
      }

      // Recurse into common containers
      const children = node.children || node.users || node.nodes || node.projects || [];
      const nextCtx = { ...ctx, feature: node.feature || node.type || ctx.feature };
      if (Array.isArray(children)) {
        children.forEach((c) => visit(c, nextCtx));
      }
    };

    visit(root);

    // De-duplicate by user_id+feature if repeated
    const uniq = new Map();
    rows.forEach((r) => {
      const key = `${r.user_id || r.user_name}::${r.feature}`;
      if (!uniq.has(key)) uniq.set(key, r);
      else {
        // Merge costs/projects if duplicates
        const existing = uniq.get(key);
        existing.costs_used += toNumber(r.costs_used);
        existing.credits_consumed = existing.costs_used;
        existing.projects = Math.max(existing.projects || 0, r.projects || 0);
      }
    });

    return Array.from(uniq.values());
  };

  // Fixed columns for enriched view
  const enrichedColumns = useMemo(() => {
    return [
      {
        key: "user_name",
        label: "User Name",
        className: "td--emphasis-name",
      },
      {
        key: "feature",
        label: "Feature",
      },
      {
        key: "costs_used",
        label: "Costs Used",
        render: (v, row) => renderCreditsWithUsd(Number(row?.costs_used ?? v)),
      },
      {
        key: "credits_consumed",
        label: "Credits Consumed",
        render: (v, row) => renderCreditsWithUsd(Number(row?.credits_consumed ?? row?.costs_used ?? v)),
      },
      {
        key: "projects",
        label: "Projects",
        render: (v) => {
          const n = Number(v);
          return Number.isFinite(n) ? n.toLocaleString() : "0";
        },
      },
    ];
  }, []);

  // Fallback table supports dynamic columns for raw list mode
  function buildColumnsFromSample(rows = []) {
    // Minimal fallback if hierarchy not available; keep previous behavior
    const sample = rows[0] || {};
    const fields = Object.keys(sample);
    if (!fields.length) return [{ key: "id", label: "ID" }];
    return fields.slice(0, 6).map((k) => ({
      key: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    }));
  }

  // Loaders
  async function loadList(page = 1, limit = meta.limit || 10, sortKey, sortDir) {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit };
      if (sortKey) params.sort = sortDir === "desc" ? `-${sortKey}` : String(sortKey);
      const res = await listLlmCosts(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);
      setAllItems(arr);
      setItems(arr);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: res?.meta?.total ?? arr.length,
      });
    } catch (e) {
      setAllItems([]);
      setItems([]);
      setError(e?.response?.data?.message || e?.message || "Failed to load LLM costs.");
    } finally {
      setLoading(false);
    }
  }

  // On mount, if hierarchy is loading we wait; if hierarchy errors, fall back to list endpoint.
  useEffect(() => {
    if (hierarchyLoading) {
      setLoading(true);
      return;
    }
    if (hierarchyError) {
      // fallback mode
      loadList();
      return;
    }
    if (hierarchyData) {
      // Map and paginate client-side for enriched rows; sorting handled client-side via DataTable
      const rows = mapHierarchyToRows(hierarchyData);
      setAllItems(rows);
      setItems(rows);
      setMeta((m) => ({ ...m, page: 1, total: rows.length }));
      setLoading(false);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchyLoading, hierarchyError, hierarchyData]);

  // Search filter
  useEffect(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) {
      setItems(allItems);
      return;
    }
    const filtered = (allItems || []).filter((doc) => {
      return Object.entries(doc || {}).some(([k, v]) => {
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
  }, [query, allItems]);

  const usingHierarchy = !!hierarchyData && !hierarchyError;

  const columns = useMemo(() => {
    if (usingHierarchy) return enrichedColumns;
    return buildColumnsFromSample(items || []);
  }, [usingHierarchy, enrichedColumns, items]);

  // Sorting behavior:
  // - In hierarchy mode (client data), allow client-side sorting by costs_used and projects (DataTable already does client sorting).
  // - In fallback list mode (server data), we rely on server sorting via fetchPage params.

  return (
    <div>
      <Card
        title="Costs"
        subtitle={usingHierarchy ? "Per-user feature costs (hierarchy)" : "LLM usage cost records — compact view"}
        className="mt-4"
      >
        <div className="toolbar" aria-label="Costs toolbar" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            className="input-search"
            placeholder="Search costs..."
            aria-label="Search costs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div style={{ flex: 1 }} />
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          pageSize={meta.limit || 10}
          initialPage={meta.page || 1}
          serverTotal={usingHierarchy ? undefined : meta.total}
          fetchPage={
            usingHierarchy
              ? undefined // client-side paginate/sort for hierarchy rows
              : async (page, limit, sortKey, sortDir) => {
                  await loadList(page, limit, sortKey, sortDir);
                }
          }
          paginationTitle={usingHierarchy ? "Users pages" : "Cost records pages"}
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
          <button className="btn btn-ghost" onClick={closeInspector} aria-label="Close details">Close</button>
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

  const { default: useProgressiveExpand } = require("../../hooks/useProgressiveExpand");
  const { running, progress, counts, startFromItems, cancel } = useProgressiveExpand({
    applyBatch: (batch) => treeRef.current?.applyExpandBatch?.(batch),
    timeSliceMs: 8,
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
              border: "1px solid #E5E7EB",
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

        <button className="btn btn-secondary" onClick={expandAll} title="Expand all" disabled={running}>
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
