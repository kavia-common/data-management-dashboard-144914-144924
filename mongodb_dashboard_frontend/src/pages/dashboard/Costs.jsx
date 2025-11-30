import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";

import { renderCreditsWithUsd } from "../../utils/currency";
import { getApiClient } from "../../api/baseClient";
import { getOrganizationId } from "../../api/authTokenProvider";

/**
 * PUBLIC_INTERFACE
 * Costs page
 * - Renders a per-user LLM costs table (from GET /api/llm-costs with pagination)
 * - Only displays specified fields: id, organization_cost, user_id, type, user_cost, project_count
 * - Handles server-driven pagination (page/limit/total) and loading/error states
 */
export default function Costs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // Inspector modal state (retained for future nested views if needed)
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectTitle, setInspectTitle] = useState("Details");
  const [inspectPayload, setInspectPayload] = useState(null);

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

  // Render helpers
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
  const renderCurrency = (num) => {
    if (num == null || num === "" || Number.isNaN(Number(num))) return "—";
    return (
      <span className="amount-positive" style={{ whiteSpace: "nowrap" }}>
        {renderCreditsWithUsd(Number(num))}
      </span>
    );
  };
  const renderInteger = (v) => {
    if (v == null || v === "" || Number.isNaN(Number(v))) return "—";
    const n = Number(v);
    return <span title={n.toLocaleString()}>{n.toLocaleString()}</span>;
  };

  // Build fixed columns for the specified fields only
  const columns = useMemo(() => {
    return [
      { key: "id", label: "ID", render: (v, row) => renderText(v ?? row?.id), priority: 1, maxWidth: 260 },
      { key: "organization_cost", label: "Organization Cost", render: (v) => renderCurrency(v), priority: 1 },
      { key: "user_id", label: "User ID", render: (v) => renderText(v), priority: 1 },
      { key: "type", label: "Type", render: (v) => renderText(v), priority: 2 },
      { key: "user_cost", label: "User Cost", render: (v) => renderCurrency(v), priority: 1 },
      { key: "project_count", label: "Project Count", render: (v) => renderInteger(v), priority: 2 },
    ];
  }, []);

  // Core loader: GET /api/llm-costs with organization_id, page, limit
  async function load(page = 1, limit = meta.limit || 10) {
    setLoading(true);
    setError("");
    try {
      const api = getApiClient();
      const organization_id = getOrganizationId(); // appended in base client too; we also pass explicitly as query
      const { data } = await api.get("/api/llm-costs", {
        params: { organization_id, page, limit },
      });

      // Normalize based on backend envelope or fallbacks:
      // Preferred: { success, data: [], meta: { page, limit, total } }
      let items = [];
      let nextMeta = { page, limit, total: 0 };
      if (data && Array.isArray(data.data) && data.meta) {
        items = data.data;
        nextMeta = {
          page: data.meta.page || page,
          limit: data.meta.limit || limit,
          total: typeof data.meta.total === "number" ? data.meta.total : (items.length || 0),
        };
      } else if (data && Array.isArray(data.items)) {
        items = data.items;
        nextMeta = {
          page: data.page || page,
          limit: data.limit || limit,
          total: typeof data.total === "number" ? data.total : (items.length || 0),
        };
      } else if (Array.isArray(data)) {
        items = data;
        nextMeta = { page, limit, total: items.length };
      }

      // Ensure each row only has the specified fields to display
      const safeRows = (items || []).map((r) => ({
        id: r.id ?? r._id ?? r.ID ?? r.Id ?? null,
        organization_cost: r.organization_cost ?? r.org_cost ?? r.total_cost ?? null,
        user_id: r.user_id ?? r.user ?? null,
        type: r.type ?? null,
        user_cost: r.user_cost ?? null,
        project_count: r.project_count ?? r.projects_count ?? null,
      }));

      setRows(safeRows);
      setMeta(nextMeta);
    } catch (e) {
      setRows([]);
      setError(e?.payload?.message || e?.message || "Failed to load costs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial load
    load(1, meta.limit || 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Card
        title="Costs"
        subtitle="Per-user LLM costs"
        className="mt-4"
      >
        {error && <div className="error" role="alert">{error}</div>}
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          pageSize={meta.limit || 10}
          initialPage={meta.page || 1}
          serverTotal={meta.total}
          fetchPage={async (page, limit) => {
            await load(page, limit);
          }}
          paginationTitle="Users costs pages"
        />
      </Card>

      {/* Reserved inspector (not actively used for this flat dataset) */}
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
        <CostsTreeInspector
          payload={inspectPayload}
        />
      </Modal>
    </div>
  );
}

// Minimal inspector (kept to preserve prior UX hook-up)
function CostsTreeInspector({ payload }) {
  if (!payload) {
    return <div style={{ padding: "1rem" }}>No item selected</div>;
  }
  return (
    <div style={{ padding: "1rem" }}>
      <TreeView data={payload} defaultExpandedDepth={1} />
    </div>
  );
}
