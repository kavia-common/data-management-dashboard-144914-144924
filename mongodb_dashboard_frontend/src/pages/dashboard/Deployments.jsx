import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import { listDeployments } from "../../api/client";
import DeploymentsOverTime from "../../components/charts/DeploymentsOverTime.jsx";

/**
 * PUBLIC_INTERFACE
 * Deployments page (read-only)
 */
export default function Deployments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  const allowedOrdered = useMemo(
    () => ["project_display", "branch_name", "status", "created_at", "updated_at"],
    []
  );

  function fmtDate(val) {
    if (!val) return "—";
    try {
      return new Date(val).toLocaleString();
    } catch {
      return String(val);
    }
  }

  function renderProject(v, row) {
    const projectName = row?.project_name || row?.projectName || "";
    const projectId = row?.project_id || row?.projectId || "";
    const primary = projectName || projectId || "—";
    return (
      <span style={{ display: "inline-block", whiteSpace: "normal", overflowWrap: "anywhere", fontWeight: 600 }}>
        {String(primary)}
      </span>
    );
  }

  function renderStatus(v) {
    const text = v == null || v === "" ? "—" : String(v);
    return text === "—" ? "—" : <span className="status-badge">{text}</span>;
  }

  function buildColumns() {
    return [
      { key: "project_display", label: "Project", render: (v, row) => renderProject(v, row), priority: 1 },
      { key: "branch_name", label: "Branch Name", render: (v) => (v == null || v === "" ? "—" : String(v)), priority: 2 },
      { key: "status", label: "Status", render: renderStatus, priority: 2 },
      { key: "created_at", label: "Created At", render: (v) => fmtDate(v), priority: 3 },
      { key: "updated_at", label: "Updated At", render: (v) => fmtDate(v), priority: 3 },
    ];
  }

  async function load(page = 1, limit = meta.limit || 10, sortKey, sortDir) {
    setLoading(true);
    setError("");
    try {
      const sortFieldMap = {
        project_display: "project_name",
        branch_name: "branch_name",
        status: "status",
        created_at: "created_at",
        updated_at: "updated_at",
      };
      const params = { page, limit };
      if (sortKey) {
        const backendField = sortFieldMap[sortKey] || String(sortKey);
        params.sort = sortDir === "desc" ? `-${backendField}` : backendField;
      }

      const res = await listDeployments(params);
      const arr = res?.items ?? (Array.isArray(res) ? res : []);
      const mapped = (arr || []).map((it) => {
        const projectName = it?.project_name || it?.projectName || "";
        const projectId = it?.project_id || it?.projectId || "";
        return {
          ...it,
          project_display: projectName || projectId || "",
        };
      });
      setItems(mapped);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: res?.meta?.total ?? arr.length,
      });
    } catch (e) {
      setItems([]);
      setError(e?.response?.data?.message || e?.message || "Failed to load deployments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = buildColumns();

  return (
    <div className="grid">
      <div className="block-full">
        <DeploymentsOverTime height={340} />
      </div>

      <div className="block-full">
        <Card title="App Deployments" subtitle="Selected columns only">
          {error && <div className="error" role="alert">{error}</div>}
          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            pageSize={meta.limit || 10}
            initialPage={meta.page || 1}
            serverTotal={meta.total}
            fetchPage={async (page, limit, sortKey, sortDir) => {
              await load(page, limit, sortKey, sortDir);
            }}
            paginationTitle="Deployment pages"
          />
        </Card>
      </div>
    </div>
  );
}
