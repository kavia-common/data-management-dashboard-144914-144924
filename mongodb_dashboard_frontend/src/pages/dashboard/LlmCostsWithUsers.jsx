import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import TreeView from "../../components/TreeView.jsx";
import { useSearchParams } from "react-router-dom";
import { listLlmCosts, normalizeEnvelope as normalizeCostsEnvelope } from "../../api/llmCosts";
import { renderCreditsWithUsd } from "../../utils/currency";

// Normalize safe access to nested user info for display
function safeUserLabel(userObj) {
  if (!userObj) return "—";
  const name = userObj.name || userObj.fullName || userObj.displayName || "";
  const email = userObj.email || "";
  const id = userObj.id || userObj._id || userObj.user_id || "";
  const parts = [name || email || id].filter(Boolean);
  return parts.length ? parts.join("") : "—";
}

// Render helper for cost USD formatting
function renderUsd(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  const num = Number(n);
  try {
    return renderCreditsWithUsd(num);
  } catch {
    return `$${num.toFixed(6)}`;
  }
}

// Extract users array; API shape provides users: [{ user: {...}, ... }] or users: [{...user fields...}]
function extractUsers(costItem) {
  const arr = Array.isArray(costItem?.users) ? costItem.users : [];
  return arr.map((u) => {
    const embedded = u?.user || u;
    return {
      label: safeUserLabel(embedded),
      email: embedded?.email || null,
      id: embedded?.id || embedded?._id || embedded?.user_id || null,
      raw: u,
    };
  });
}

// PUBLIC_INTERFACE
/**
 * LlmCostsWithUsers
 * Flat list of cost items (/api/llm-costs) with user details from users[].user.
 * - Displays key columns: Date/Time (or createdAt), Model/Provider (if available), Cost, Tokens (if available), Users (name/email or expandable list)
 * - Client-driven pagination UI wired to server params (page, limit)
 * - Loading and error states
 * - Preserves existing query param handling (?organization_id | tenant_id | page | limit) if present
 */
export default function LlmCostsWithUsers() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  // Preserve existing params if present
  const organizationIdParam =
    searchParams.get("organization_id") ||
    searchParams.get("tenant_id") ||
    undefined;
  const pageParam = Number(searchParams.get("page") || 0) || undefined;
  const limitParam = Number(searchParams.get("limit") || 0) || undefined;

  // Modal for showing full users list or raw row
  const [usersOpen, setUsersOpen] = useState(false);
  const [usersTitle, setUsersTitle] = useState("Users");
  const [usersPayload, setUsersPayload] = useState([]);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectTitle, setInspectTitle] = useState("Details");
  const [inspectPayload, setInspectPayload] = useState(null);

  function openUsersModal(title, users) {
    setUsersTitle(title);
    setUsersPayload(users || []);
    setUsersOpen(true);
  }
  function closeUsersModal() {
    setUsersOpen(false);
    setUsersPayload([]);
  }
  function openInspector(title, payload) {
    setInspectTitle(title);
    setInspectPayload(payload);
    setInspectOpen(true);
  }
  function closeInspector() {
    setInspectOpen(false);
    setInspectPayload(null);
  }

  // Build column definitions
  const columns = useMemo(() => {
    return [
      {
        key: "createdAt",
        label: "Date/Time",
        render: (v, row) => row?.timestamp || row?.period || row?.createdAt || row?.updatedAt || "—",
        priority: 1,
        maxWidth: 220,
      },
      {
        key: "model",
        label: "Model/Provider",
        render: (_, row) => {
          const model = row?.model || row?.llm_model || row?.metadata?.model || row?.usage?.model || null;
          const provider = row?.provider || row?.vendor || row?.metadata?.provider || row?.usage?.provider || null;
          const text = [model, provider].filter(Boolean).join(" • ");
          return text || "—";
        },
        priority: 1,
        maxWidth: 320,
      },
      {
        key: "total_cost",
        label: "Cost",
        render: (v, row) => {
          const n =
            row?.total_cost ??
            row?.cost ??
            row?.organization_cost ??
            row?.usage?.total_cost ??
            row?.usage?.cost ??
            null;
          return <span style={{ whiteSpace: "nowrap" }}>{renderUsd(n)}</span>;
        },
        priority: 1,
      },
      {
        key: "total_tokens",
        label: "Tokens",
        render: (_, row) => {
          const tokens =
            row?.total_tokens ??
            row?.usage?.total_tokens ??
            row?.token_count ??
            null;
          if (tokens == null) return "—";
          const n = Number(tokens);
          return Number.isNaN(n) ? "—" : n.toLocaleString();
        },
        priority: 2,
      },
      {
        key: "users",
        label: "User(s)",
        render: (_, row) => {
          const users = extractUsers(row);
          if (!users.length) return "—";
          if (users.length === 1) {
            const u = users[0];
            // single user inline render
            return (
              <span title={u.label} style={{ whiteSpace: "nowrap" }}>
                {u.label}
                {u.email ? ` (${u.email})` : ""}
              </span>
            );
          }
          // multi users: show count with action to open modal/popover
          return (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                openUsersModal(`Users (${users.length})`, users);
              }}
              aria-label={`Show ${users.length} users`}
              title={`Show ${users.length} users`}
              style={{ padding: "2px 8px", fontSize: 12 }}
            >
              {users.length} users
            </button>
          );
        },
        priority: 1,
        maxWidth: 220,
      },
    ];
  }, []);

  function normalize(res, { page, limit }) {
    const env = normalizeCostsEnvelope(res);
    const items = (env?.data || []).map((item) => ({
      ...item,
      // ensure arrays exist for downstream rendering
      users: Array.isArray(item?.users) ? item.users : [],
    }));
    return {
      data: items,
      meta:
        env?.meta || {
          page,
          limit,
          total: items.length || 0,
        },
    };
  }

  async function load(page = 1, limit = meta.limit || 10) {
    setLoading(true);
    setError("");
    try {
      const res = await listLlmCosts({
        page,
        limit,
        sort: "-createdAt",
        ...(organizationIdParam ? { organization_id: organizationIdParam } : {}),
      });

      const { data: items, meta: nextMeta } = normalize(res, { page, limit });

      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[llm-costs-with-users] sample row:", items?.[0] || null);
      }

      setRows(items);
      setMeta(nextMeta);

      // Reflect current page/limit in URL params for deep-linking
      const next = new URLSearchParams(searchParams);
      next.set("page", String(nextMeta.page || page));
      next.set("limit", String(nextMeta.limit || limit));
      if (organizationIdParam) {
        next.set("organization_id", organizationIdParam);
        next.delete("tenant_id");
      }
      setSearchParams(next, { replace: true });
    } catch (e) {
      setRows([]);
      setMeta((m) => ({ ...m, total: 0 }));
      setError(e?.message || "Failed to load LLM costs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initPage = pageParam || 1;
    const initLimit = limitParam || meta.limit || 10;
    setMeta((m) => ({ ...m, page: initPage, limit: initLimit }));
    load(initPage, initLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationIdParam]);

  return (
    <div>
      <Card
        title="LLM Costs (with Users)"
        subtitle="Flat list of LLM costs with user details"
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div>
            <label>
              Organization ID{" "}
              <input
                type="text"
                placeholder="Filter by organization_id"
                defaultValue={organizationIdParam || ""}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  const next = new URLSearchParams(searchParams);
                  if (val) {
                    next.set("organization_id", val);
                    next.delete("tenant_id");
                  } else {
                    next.delete("organization_id");
                    next.delete("tenant_id");
                  }
                  // reset page to 1 on filter change
                  next.set("page", "1");
                  setSearchParams(next, { replace: false });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </label>
          </div>
          <div>
            <label>
              Page size{" "}
              <select
                value={meta.limit || 10}
                onChange={(e) => {
                  const nextLimit = Number(e.target.value);
                  setMeta((m) => ({ ...m, page: 1, limit: nextLimit }));
                  load(1, nextLimit);
                }}
              >
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
          paginationTitle="LLM costs pages"
          onRowClick={(row) => openInspector("LLM Cost Row", row)}
          forceHorizontalScroll={false}
        />
      </Card>

      {/* Users list modal */}
      <Modal
        title={usersTitle}
        open={usersOpen}
        onClose={closeUsersModal}
        headerOffset={60}
        width="min(96vw, 720px)"
        footer={
          <button className="btn btn-ghost" onClick={closeUsersModal} aria-label="Close users">
            Close
          </button>
        }
      >
        <div style={{ padding: "1rem" }}>
          {Array.isArray(usersPayload) && usersPayload.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {usersPayload.map((u, idx) => (
                <li key={`${u.id || u.email || u.label || idx}`} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>{u.label}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {u.email ? u.email : null}
                    {u.id ? (u.email ? ` • ${u.id}` : u.id) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontStyle: "italic", color: "#6b7280" }}>No users found on this item.</div>
          )}
        </div>
      </Modal>

      {/* Row inspector */}
      <Modal
        title={inspectTitle}
        open={inspectOpen}
        onClose={closeInspector}
        headerOffset={60}
        width="min(96vw, 900px)"
        footer={
          <button className="btn btn-ghost" onClick={closeInspector} aria-label="Close details">
            Close
          </button>
        }
      >
        <div style={{ padding: "1rem" }}>
          <TreeView data={inspectPayload || []} defaultExpandedDepth={1} />
        </div>
      </Modal>
    </div>
  );
}
