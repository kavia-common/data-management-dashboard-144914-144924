import React, { useEffect, useMemo, useState, Fragment } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";
import { useSearchParams } from "react-router-dom";
import { listLlmCosts, normalizeEnvelope as normalizeCostsEnvelope } from "../../api/llmCosts";

/**
 * Renders a nested table of users for an organization row.
 * Each user row is expandable to show projects with project_id and project_cost.
 */
function UsersNestedTable({ org }) {
  const users = Array.isArray(org?.users) ? org.users : [];

  if (!users.length) {
    return (
      <div style={{ padding: "8px 12px", fontStyle: "italic", color: "#6b7280" }}>
        No users found for this organization.
      </div>
    );
  }

  // derive safe values per user using requested mapping rules and fallbacks
  const getUserId = (userItem) => {
    // Prefer users[i].user_id; fallback to users[i].user?._id or users[i]?._id
    return userItem?.user_id ?? userItem?.user?._id ?? userItem?._id ?? "—";
  };
  const getType = (userItem) => {
    // Prefer users[i].type, otherwise item.type
    const userType = userItem?.type ?? userItem?.role;
    const itemType = org?.type ?? org?.cost_type ?? org?.kind;
    return userType ?? itemType ?? "—";
  };
  const getUserCost = (userItem) => {
    // users[i].cost or users[i].user_cost, default 0
    const n = userItem?.user_cost ?? userItem?.cost ?? 0;
    const num = Number(n || 0);
    return Number.isNaN(num) ? 0 : num;
  };
  const getProjectCount = (userItem) => {
    // users[i].project_count or derive from response (org.projects length if present)
    const direct = userItem?.project_count;
    if (typeof direct === "number") return direct;
    if (Array.isArray(org?.projects)) return org.projects.length;
    return 0;
  };

  return (
    <table className="nested-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
      <thead>
        <tr style={{ textAlign: "left" }}>
          <th style={{ padding: "6px 8px" }}>User ID</th>
          <th style={{ padding: "6px 8px" }}>Type</th>
          <th style={{ padding: "6px 8px" }}>User Cost</th>
          <th style={{ padding: "6px 8px" }}>Project Count</th>
          <th style={{ padding: "6px 8px" }}>Details</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u, idx) => {
          const userId = getUserId(u);
          const type = getType(u);
          const userCost = getUserCost(u);
          const projectCount = getProjectCount(u);
          const projects = Array.isArray(org?.projects) ? org.projects : [];

          return (
            <UserRowWithProjects
              key={`${userId || idx}`}
              userId={userId}
              type={type}
              userCost={userCost}
              projectCount={projectCount}
              projects={projects}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function UserRowWithProjects({ userId, type, userCost, projectCount, projects }) {
  const [open, setOpen] = useState(false);

  return (
    <Fragment>
      <tr style={{ borderTop: "1px solid #e5e7eb" }}>
        <td style={{ padding: "6px 8px" }}>{String(userId || "—")}</td>
        <td style={{ padding: "6px 8px" }}>{type || "—"}</td>
        <td style={{ padding: "6px 8px" }}>${Number(userCost || 0).toFixed(4)}</td>
        <td style={{ padding: "6px 8px" }}>{Number(projectCount || 0)}</td>
        <td style={{ padding: "6px 8px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setOpen((v) => !v)}
            style={{ padding: "4px 8px", fontSize: 12 }}
            aria-expanded={open}
            aria-controls={`projects-${userId}`}
          >
            {open ? "Hide Projects" : "Show Projects"}
          </button>
        </td>
      </tr>
      {open && (
        <tr id={`projects-${userId}`}>
          <td colSpan={5} style={{ background: "#f9fafb" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", margin: "6px 0 8px 0" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "4px 8px" }}>Project ID</th>
                  <th style={{ padding: "4px 8px" }}>Project Cost</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(projects) ? projects : []).length ? (
                  projects.map((p, idx) => (
                    <tr key={`${p?.project_id || p?._id || idx}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "4px 8px" }}>{p?.project_id || p?._id || "—"}</td>
                      <td style={{ padding: "4px 8px" }}>${Number(p?.project_cost ?? p?.cost ?? 0).toFixed(4)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} style={{ padding: "4px 8px", fontStyle: "italic", color: "#6b7280" }}>
                      No projects found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/**
 * PUBLIC_INTERFACE
 * LlmCostsList with expandable organization rows to show users and per-user projects.
 */
export default function LlmCostsList() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  const [open, setOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailPayload, setDetailPayload] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const organizationIdParam =
    searchParams.get("organization_id") ||
    searchParams.get("tenant_id") ||
    undefined;

  const closeDetails = () => {
    setOpen(false);
    setDetailPayload(null);
    setDetailTitle("");
  };

  const countOrZero = (arr) => (Array.isArray(arr) ? arr.length : 0);

  const columns = useMemo(
    () => [
      {
        key: "organization_id",
        label: "Organization",
        render: (v, row) => String(v || row?.tenant_id || "—"),
      },
      {
        key: "organization_cost",
        label: "Total Cost",
        render: (v, row) => {
          const value = row?.total_cost ?? row?.organization_cost ?? row?.totalCost ?? 0;
          return `$${Number(value || 0).toFixed(4)}`;
        },
      },
      {
        key: "projects",
        label: "Projects",
        render: (v, row) => countOrZero(row?.projects),
      },
      {
        key: "users",
        label: "Users",
        render: (v, row) => countOrZero(row?.users),
      },
      {
        key: "updatedAt",
        label: "Updated",
        render: (v, row) => row.updatedAt || row.timestamp || row.createdAt || "—",
      },
      {
        key: "__expander__",
        label: "Details",
        render: (_, row) => {
          const id = row?.organization_id || row?.tenant_id || row?._id || JSON.stringify(row);
          const isOpen = !!expanded[id];
          return (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
                if (!isOpen) {
                  setDetailTitle(`Users and Projects — ${String(row?.organization_id || row?.tenant_id || '—')}`);
                }
              }}
              style={{ padding: "4px 8px", fontSize: 12 }}
              aria-expanded={isOpen}
              aria-controls={`users-${id}`}
            >
              {isOpen ? "Hide Users" : "Show Users"}
            </button>
          );
        },
      },
    ],
    [expanded]
  );

  function normalize(res, { page, limit }) {
    const env = normalizeCostsEnvelope(res);
    return {
      data: (env?.data || []).map((item) => ({
        ...item,
        users: Array.isArray(item?.users) ? item.users : [],
        projects: Array.isArray(item?.projects) ? item.projects : [],
      })),
      meta: env?.meta || { page, limit, total: env?.data?.length || 0 },
    };
  }

  async function load(page = 1, limit = meta.limit || 20) {
    setLoading(true);
    setError("");
    try {
      const res = await listLlmCosts({
        page,
        limit,
        sort: "-updatedAt",
        ...(organizationIdParam ? { organization_id: organizationIdParam } : {}),
      });

      const { data: items, meta: nextMeta } = normalize(res, { page, limit });

      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[llm-costs] sample row:", Array.isArray(items) && items.length ? items[0] : null);
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
  }, [organizationIdParam]);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)));

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
      <Card title="LLM Costs" subtitle="Nested view with Users and per-user Projects">
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
            <DataTable columns={columns} data={rows} loading={loading} pageSize={meta.limit || 20} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button onClick={() => handlePageChange((meta.page || 1) - 1)} disabled={(meta.page || 1) <= 1}>
                Previous
              </button>
              <div>Page {meta.page || 1} of {totalPages}</div>
              <button onClick={() => handlePageChange((meta.page || 1) + 1)} disabled={(meta.page || 1) >= totalPages}>
                Next
              </button>
            </div>
          </>
        )}
      </Card>

      {/* Row sub-components: rendered below main table based on expanded state */}
      <div style={{ marginTop: 8 }}>
        {rows.map((row) => {
          const id = row?.organization_id || row?.tenant_id || row?._id || JSON.stringify(row);
          if (!expanded[id]) return null;
          return (
            <div key={`sub-${id}`} id={`users-${id}`} style={{ padding: "8px 4px 12px 4px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Users — {String(row?.organization_id || row?.tenant_id || "—")}
              </div>
              <UsersNestedTable org={row} />
            </div>
          );
        })}
      </div>

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
