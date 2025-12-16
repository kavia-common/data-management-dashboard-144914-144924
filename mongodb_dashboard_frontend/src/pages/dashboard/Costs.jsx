import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";
import { listLlmCostsUnderscore } from "../../api";

import { renderCreditsWithUsd } from "../../utils/currency";

/**
 * PUBLIC_INTERFACE
 * Costs page (underscore endpoint)
 * - Fetches from GET /api/llm_costs with explicit user action or pagination controls.
 * - Renders a tabular view for fields:
 *   organization_id, organization_name, organization_cost, users (count), user_id, type, user_cost, projects (count)
 */
export default function Costs() {
  const [organizationId, setOrganizationId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Inspector modal state
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

  const columns = useMemo(() => {
    return [
      { key: "organization_id", label: "Organization Id" },
      { key: "organization_name", label: "Organization Name" },
      {
        key: "organization_cost",
        label: "Organization Cost",
        render: (v) => {
          const num = typeof v === "number" ? v : Number(v || 0);
          return <span className="amount-positive">{renderCreditsWithUsd(isFinite(num) ? num : 0)}</span>;
        },
        className: "num",
        priority: 1,
      },
      {
        key: "users",
        label: "Users",
        render: (v) => {
          const num = typeof v === "number" ? v : Number.parseInt(v || 0, 10);
          return <span title={String(num)}>{Number.isFinite(num) ? num.toLocaleString() : "0"}</span>;
        },
        className: "num",
      },
      { key: "user_id", label: "User Id" },
      { key: "type", label: "Type" },
      {
        key: "user_cost",
        label: "User Cost",
        render: (v) => {
          const num = typeof v === "number" ? v : Number(v || 0);
          return <span className="amount-positive">{renderCreditsWithUsd(isFinite(num) ? num : 0)}</span>;
        },
        className: "num",
      },
      {
        key: "projects",
        label: "Projects",
        render: (v) => {
          const num = typeof v === "number" ? v : Number.parseInt(v || 0, 10);
          return <span title={String(num)}>{Number.isFinite(num) ? num.toLocaleString() : "0"}</span>;
        },
        className: "num",
      },
    ];
  }, []);

  // Fetcher for underscore endpoint
  async function doFetch(nextPage = page, nextLimit = limit) {
    setLoading(true);
    setError("");
    try {
      const params = {
        organization_id: organizationId || undefined,
        page: nextPage,
        limit: nextLimit,
      };
      const res = await listLlmCostsUnderscore(params);
      const rows = Array.isArray(res.items) ? res.items : [];
      setItems(rows);
      setTotal(typeof res.total === "number" ? res.total : rows.length);
      setPage(nextPage);
      setLimit(nextLimit);
    } catch (e) {
      setError(e?.message || "Failed to load costs");
    } finally {
      setLoading(false);
    }
  }

  // Hook pagination controls to server load
  const fetchPage = async (p, l) => {
    await doFetch(p, l);
  };

  return (
    <div>
      <Card
        title="Costs"
        subtitle="LLM usage cost records — underscore API"
        className="mt-4"
      >
        <div className="toolbar" aria-label="Costs toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="organization_id"
            aria-label="Organization ID"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => doFetch(1, limit)}
            aria-label="Load costs"
            title="Load costs"
            disabled={loading}
          >
            {loading ? "Loading..." : "Load"}
          </button>
          {error ? <div className="error" role="alert" style={{ marginLeft: 8 }}>{error}</div> : null}
          <div style={{ flex: 1 }} />
          <label className="muted" htmlFor="costs-pagesize" style={{ fontSize: 12 }}>Page size</label>
          <select
            id="costs-pagesize"
            className="input"
            value={limit}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10) || 10;
              setLimit(next);
            }}
          >
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          pageSize={limit}
          initialPage={page}
          serverTotal={total}
          fetchPage={fetchPage}
          paginationTitle="Costs pages"
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
        <div style={{ padding: 12 }}>
          <button
            className="btn btn-secondary"
            onClick={() => openInspector("Raw Rows", items)}
            title="View raw rows JSON"
          >
            View raw rows
          </button>
        </div>
      </Modal>
    </div>
  );
}
