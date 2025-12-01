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
 * - Uses GET /api/llm-costs with pagination and flattens per-item users[] into table rows.
 * - Renders columns: User ID, Type, User Cost, Project Count (with required fallbacks).
 * - Preserves loading/empty/error states and server-driven pagination via organization_id, page, limit.
 */
export default function Costs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  // Inspector modal (kept for viewing raw payloads if needed)
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
  const renderUsd = (num) => {
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

  // Columns: Only the requested fields
  const columns = useMemo(() => {
    return [
      {
        key: "user_id",
        label: "User ID",
        render: (v, row) => renderText(v ?? row?.user?._id ?? row?.userId ?? row?._id ?? "—"),
        priority: 1,
        maxWidth: 280,
      },
      {
        key: "type",
        label: "Type",
        render: (v, row) => {
          // Prefer users[i].type, else top-level item.type if present (we keep an originType on flatten)
          const t = v ?? row?.originType ?? "—";
          return renderText(t);
        },
        priority: 2,
        maxWidth: 180,
      },
      {
        key: "user_cost",
        label: "User Cost",
        render: (v, row) => {
          // Must use users[i].user_cost for each user entry
          const cost = row?.user_cost ?? null;
          return renderUsd(cost);
        },
        priority: 1,
      },
      {
        key: "project_count",
        label: "Project Count",
        render: (v) => renderInteger(v),
        priority: 2,
      },
    ];
  }, []);

  // Normalize and flatten users into rows with required fallbacks
  function flattenItemsToUserRows(items) {
    const out = [];
    (items || []).forEach((item) => {
      const topLevelType = item?.type ?? item?.cost_type ?? item?.kind ?? null;
      const users = Array.isArray(item?.users) ? item.users : [];
      if (users.length) {
        users.forEach((u) => {
          // Compute user-specific fields with null-safe access.
          const userId =
            u?.user_id ?? u?.user?._id ?? u?._id ?? u?.user_id_str ?? null;
          const type = u?.type ?? topLevelType ?? null;
          // User Cost strictly from users[i].user_cost (null if missing)
          const userCost =
            typeof u?.user_cost === "number" ? u.user_cost : u?.user_cost ?? null;
          // Project Count from users[i].projects?.length || 0
          const projectCount = Array.isArray(u?.projects)
            ? u.projects.length
            : 0;

          out.push({
            user_id: userId,
            type,
            user_cost: userCost,
            project_count: projectCount,
            __origin: item,
            originType: topLevelType,
          });
        });
      } else {
        // Without users[], push a placeholder context row; keep counts safe.
        out.push({
          user_id: null,
          type: topLevelType ?? null,
          user_cost: null,
          project_count: 0,
          __origin: item,
          originType: topLevelType,
        });
      }
    });
    return out;
  }

  // Loader using /api/llm-costs with pagination and organization_id
  async function load(page = 1, limit = meta.limit || 10) {
    setLoading(true);
    setError("");
    try {
      const api = getApiClient();
      const organization_id = getOrganizationId();
      const res = await api.get("/api/llm-costs", {
        params: { organization_id, page, limit },
      });

      let items = [];
      let nextMeta = { page, limit, total: 0 };

      const data = res?.data;
      if (data && Array.isArray(data?.data) && data?.meta) {
        items = data.data;
        nextMeta = {
          page: data.meta?.page || page,
          limit: data.meta?.limit || limit,
          total: typeof data.meta?.total === "number" ? data.meta.total : (data.data?.length || 0),
        };
      } else if (data && Array.isArray(data?.items)) {
        items = data.items;
        nextMeta = {
          page: data?.page || page,
          limit: data?.limit || limit,
          total: typeof data?.total === "number" ? data.total : (data.items?.length || 0),
        };
      } else if (Array.isArray(data)) {
        items = data;
        nextMeta = { page, limit, total: items.length };
      }

      const flatRows = flattenItemsToUserRows(items);

      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[Costs] flat sample row:", flatRows?.[0] || null);
      }

      setRows(flatRows);
      setMeta(nextMeta);
    } catch (e) {
      setRows([]);
      setError(e?.payload?.message || e?.message || "Failed to load costs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, meta.limit || 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Card title="Costs" subtitle="Per-user LLM costs (flattened view)" className="mt-4">
        {loading && !rows.length && !error && (
          <div className="text-muted" aria-live="polite">Loading…</div>
        )}
        {error && <div className="error" role="alert">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-muted" role="status">No data</div>
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
          paginationTitle="User cost pages"
          onRowClick={(row) => openInspector("Row details", row?.__origin || row)}
        />
      </Card>

      {/* Inspector for context payloads */}
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
