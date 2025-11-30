import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";
import { getApiClient } from "../../api/baseClient";

/**
 * PUBLIC_INTERFACE
 * LlmCostsList
 * A paginated listing consuming ListEnvelope from GET /api/llm-costs and rendering column-wise:
 * _id, organization_id, organization_name, organization_cost, counts (users.length, projects.length, agents.length).
 * Supports expandable details to view arrays (users, projects, agents). Null/empty guards show 0 counts.
 */
export default function LlmCostsList() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // details modal
  const [open, setOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailPayload, setDetailPayload] = useState(null);

  const openDetails = (title, payload) => {
    setDetailTitle(title);
    setDetailPayload(payload);
    setOpen(true);
  };
  const closeDetails = () => {
    setOpen(false);
    setDetailPayload(null);
  };

  const countOrZero = (arr) => (Array.isArray(arr) ? arr.length : 0);

  const columns = useMemo(() => {
    return [
      { key: "_id", label: "ID", render: (v) => <span title={v || ""}>{String(v || "—")}</span> },
      { key: "organization_id", label: "Organization ID", render: (v) => <span title={v || ""}>{String(v || "—")}</span> },
      { key: "organization_name", label: "Organization Name", render: (v) => <span title={v || ""}>{String(v || "—")}</span> },
      { key: "organization_cost", label: "Org Cost", render: (v) => <span title={String(v ?? "—")}>{String(v ?? "—")}</span> },
      {
        key: "users",
        label: "Users",
        render: (v, row) => {
          const n = countOrZero(row?.users);
          return (
            <button className="btn btn-ghost" onClick={() => openDetails("Users", row?.users || [])} aria-label="Show users">
              {n.toString()}
            </button>
          );
        },
      },
      {
        key: "projects",
        label: "Projects",
        render: (v, row) => {
          const n = countOrZero(row?.projects);
          return (
            <button className="btn btn-ghost" onClick={() => openDetails("Projects", row?.projects || [])} aria-label="Show projects">
              {n.toString()}
            </button>
          );
        },
      },
      {
        key: "agents",
        label: "Agents",
        render: (v, row) => {
          const n = countOrZero(row?.agents);
          return (
            <button className="btn btn-ghost" onClick={() => openDetails("Agents", row?.agents || [])} aria-label="Show agents">
              {n.toString()}
            </button>
          );
        },
      },
    ];
  }, []);

  async function load(page = 1, limit = meta.limit || 20, params = {}) {
    setLoading(true);
    setError("");
    try {
      const api = getApiClient();
      const { data } = await api.get("/api/llm-costs", {
        params: { page, limit, ...params },
      });

      let items = [];
      let nextMeta = { page, limit, total: 0 };
      if (data && Array.isArray(data.data) && data.meta) {
        items = data.data || [];
        nextMeta = { page: data.meta.page || page, limit: data.meta.limit || limit, total: data.meta.total || 0 };
      } else if (Array.isArray(data)) {
        items = data;
        nextMeta = { page, limit, total: items.length };
      } else if (data && Array.isArray(data.items)) {
        items = data.items;
        nextMeta = { page: data.page || page, limit: data.limit || limit, total: data.total || items.length };
      }

      // minimal log when no matches
      if (!items.length && process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.info("[llm-costs] no matches for current filter/page");
      }

      setRows(items);
      setMeta(nextMeta);
    } catch (e) {
      setRows([]);
      setMeta((m) => ({ ...m, total: 0 }));
      setError(e?.message || "Failed to load LLM costs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, meta.limit || 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Card title="LLM Costs" subtitle="Raw LLM cost documents (as-is)">
        {error && <div className="error" role="alert">{error}</div>}
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          pageSize={meta.limit || 20}
          initialPage={meta.page || 1}
          serverTotal={meta.total}
          fetchPage={async (page, limit) => load(page, limit)}
          paginationTitle="LLM costs pages"
        />
      </Card>

      <Modal
        title={detailTitle}
        open={open}
        onClose={closeDetails}
        headerOffset={60}
        width="min(96vw, 900px)"
        footer={<button className="btn btn-ghost" onClick={closeDetails}>Close</button>}
      >
        <div style={{ padding: "1rem" }}>
          <TreeView data={detailPayload || []} defaultExpandedDepth={1} />
        </div>
      </Modal>
    </div>
  );
}
