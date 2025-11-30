import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";
import { getApiClient } from "../../api/baseClient";
import { useSearchParams } from "react-router-dom";

/**
 * PUBLIC_INTERFACE
 * LlmCostsList
 * Paginated listing that calls GET /api/llm-costs and renders:
 * _id, organization_id, organization_name, organization_cost, users_count, projects_count, agents_count.
 * Uses backend envelope { success, data, meta } when page/limit are provided.
 * Supports optional filtering by organization_id via query params (?organization_id or ?tenant_id).
 * Renders empty states and basic pagination controls.
 */
export default function LlmCostsList() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // details modal (useful to inspect arrays)
  const [open, setOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailPayload, setDetailPayload] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const organizationIdParam =
    searchParams.get("organization_id") ||
    searchParams.get("tenant_id") ||
    undefined;

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
      {
        key: "_id",
        label: "ID",
        render: (v) => <span title={v || ""}>{String(v || "—")}</span>,
      },
      {
        key: "organization_id",
        label: "Organization ID",
        render: (v) => <span title={v || ""}>{String(v || "—")}</span>,
      },
      {
        key: "organization_name",
        label: "Organization Name",
        render: (v) => <span title={v || ""}>{String(v || "—")}</span>,
      },
      {
        key: "organization_cost",
        label: "Organization Cost",
        // Render the value exactly as provided by API (e.g., "$3005.442509"); show "-" if undefined/null/empty string
        render: (v, row) => {
          const val = row?.organization_cost ?? v;
          const display = (val === null || val === undefined || val === "") ? "—" : String(val);
          return <span title={display}>{display}</span>;
        },
      },
      {
        key: "users",
        label: "Users Count",
        render: (v, row) => {
          const n = countOrZero(row?.users);
          return (
            <button
              className="btn btn-ghost"
              onClick={() => openDetails("Users", row?.users || [])}
              aria-label="Show users"
            >
              {n.toString()}
            </button>
          );
        },
      },
      {
        key: "projects",
        label: "Projects Count",
        render: (v, row) => {
          const n = countOrZero(row?.projects);
          return (
            <button
              className="btn btn-ghost"
              onClick={() => openDetails("Projects", row?.projects || [])}
              aria-label="Show projects"
            >
              {n.toString()}
            </button>
          );
        },
      },
      {
        key: "agents",
        label: "Agents Count",
        render: (v, row) => {
          const n = countOrZero(row?.agents);
          return (
            <button
              className="btn btn-ghost"
              onClick={() => openDetails("Agents", row?.agents || [])}
              aria-label="Show agents"
            >
              {n.toString()}
            </button>
          );
        },
      },
    ];
  }, []);

  function normalizeEnvelope(respData, { page, limit }) {
    // Preferred: { success, data: [], meta: { page, limit, total } }
    if (respData && typeof respData === "object" && Array.isArray(respData.data) && respData.meta) {
      return {
        data: respData.data || [],
        meta: {
          page: respData.meta.page || page || 1,
          limit: respData.meta.limit || limit || 20,
          total: typeof respData.meta.total === "number" ? respData.meta.total : (respData.data?.length || 0),
        },
      };
    }
    // Some endpoints use { items, page, limit, total }
    if (respData && typeof respData === "object" && Array.isArray(respData.items)) {
      return {
        data: respData.items,
        meta: {
          page: respData.page || page || 1,
          limit: respData.limit || limit || 20,
          total: typeof respData.total === "number" ? respData.total : (respData.items?.length || 0),
        },
      };
    }
    // Raw array fallback when pagination params not provided
    if (Array.isArray(respData)) {
      return {
        data: respData,
        meta: {
          page: page || 1,
          limit: limit || respData.length || 20,
          total: respData.length || 0,
        },
      };
    }
    return { data: [], meta: { page: page || 1, limit: limit || 20, total: 0 } };
  }

  async function load(page = 1, limit = meta.limit || 20) {
    setLoading(true);
    setError("");
    try {
      const api = getApiClient();
      const { data } = await api.get("/api/llm-costs", {
        params: {
          page,
          limit,
          ...(organizationIdParam ? { organization_id: organizationIdParam } : {}),
        },
      });

      const { data: items, meta: nextMeta } = normalizeEnvelope(data, {
        page,
        limit,
      });

      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        const first = Array.isArray(items) && items.length ? items[0] : null;
        console.log("[llm-costs] sample row:", first);
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
    // initial and when org filter changes
    load(1, meta.limit || 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationIdParam]);

  const totalPages = Math.max(
    1,
    Math.ceil((meta.total || 0) / (meta.limit || 20))
  );

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setMeta((m) => ({ ...m, page: newPage }));
    load(newPage, meta.limit || 20);
  };

  const handleLimitChange = (e) => {
    const newLimit = Number(e.target.value);
    setMeta((m) => ({ ...m, page: 1, limit: newLimit }));
    load(1, newLimit);
  };

  const handleOrgFilterCommit = (e) => {
    const val = e.target.value.trim();
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set("organization_id", val);
      next.delete("tenant_id");
    } else {
      next.delete("organization_id");
      next.delete("tenant_id");
    }
    setSearchParams(next, { replace: false });
  };

  return (
    <div>
      <Card title="LLM Costs" subtitle="Raw LLM cost documents (as-is)">
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div>
            <label>
              Organization ID:{" "}
              <input
                type="text"
                placeholder="Filter by organization_id"
                defaultValue={organizationIdParam || ""}
                onBlur={handleOrgFilterCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </label>
          </div>
          <div>
            <label>
              Page size:{" "}
              <select value={meta.limit} onChange={handleLimitChange}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div>No LLM cost records found.</div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={rows}
              loading={loading}
              pageSize={meta.limit || 20}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button
                onClick={() => handlePageChange((meta.page || 1) - 1)}
                disabled={(meta.page || 1) <= 1}
              >
                Previous
              </button>
              <div>
                Page {meta.page || 1} of {totalPages}
              </div>
              <button
                onClick={() => handlePageChange((meta.page || 1) + 1)}
                disabled={(meta.page || 1) >= totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </Card>

      <Modal
        title={detailTitle}
        open={open}
        onClose={closeDetails}
        headerOffset={60}
        width="min(96vw, 900px)"
        footer={
          <button className="btn btn-ghost" onClick={closeDetails}>
            Close
          </button>
        }
      >
        <div style={{ padding: "1rem" }}>
          <TreeView data={detailPayload || []} defaultExpandedDepth={1} />
        </div>
      </Modal>
    </div>
  );
}
