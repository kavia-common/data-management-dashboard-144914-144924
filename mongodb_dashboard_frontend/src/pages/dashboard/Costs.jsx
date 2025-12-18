// import React, { useMemo, useState } from "react";
// import Card from "../../components/ui/Card.jsx";
// import DataTable from "../../components/DataTable.jsx";
// import Modal from "../../components/ui/Modal.jsx";
// import { listLlmCostsUnderscore } from "../../api";

// // PUBLIC_INTERFACE
// function formatCurrencyUSD(n) {
//   if (typeof n === "string") {
//     n = n.replace(/[^0-9.-]/g, "");
//   }
//   const num = Number(n || 0);
//   if (!Number.isFinite(num)) return "$0.00";

//   return new Intl.NumberFormat(undefined, {
//     style: "currency",
//     currency: "USD",
//     maximumFractionDigits: 6,
//   }).format(num);
// }


// // PUBLIC_INTERFACE
// function formatInt(n) {
//   /** Formats integer with locale commas; falls back to 0 when invalid. */
//   const num = typeof n === "number" ? n : Number.parseInt(n || 0, 10);
//   return Number.isFinite(num) ? num.toLocaleString() : "0";
// }

// /**
//  * PUBLIC_INTERFACE
//  * Costs page (underscore endpoint)
//  * - Fetches from GET /api/llm_costs with optional organization_id and pagination.
//  * - Renders a tabular view with exact keys:
//  *   organization_id, organization_name, organization_cost, user_id, user_cost, projects
//  */
// export default function Costs() {
//   const [organizationId, setOrganizationId] = useState("");
//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [page, setPage] = useState(1);
//   const [limit, setLimit] = useState(10);
//   const [total, setTotal] = useState(0);

//   // Modal inspector for raw view
//   const [inspectOpen, setInspectOpen] = useState(false);
//   const [inspectTitle, setInspectTitle] = useState("Details");
//   const [inspectPayload, setInspectPayload] = useState(null);

//   // PUBLIC_INTERFACE
//   function openInspector(title, payload) {
//     setInspectTitle(title);
//     setInspectPayload(payload);
//     setInspectOpen(true);
//   }
//   function closeInspector() {
//     setInspectOpen(false);
//     setInspectPayload(null);
//   }

//   const columns = useMemo(() => {
//     return [
//       // organization_id removed per requirement
//       { key: "organization_name", label: "organization_name" },
//       {
//         key: "organization_cost",
//         label: "organization_cost",
//         render: (v) => <span className="amount-positive">{formatCurrencyUSD(v)}</span>,
//         className: "num",
//         priority: 1,
//       },
//       // Replace user_id with user_name; fallback to "Unknown User" when missing
//       {
//         key: "user_name",
//         label: "user_name",
//         render: (v, row) => {
//           const name = v || row?.user_name || "Unknown User";
//           return <span className="td--emphasis-name">{name}</span>;
//         },
//       },
//       {
//         key: "user_cost",
//         label: "user_cost",
//         render: (v) => <span className="amount-positive">{formatCurrencyUSD(v)}</span>,
//         className: "num",
//       },
//       {
//         key: "projects",
//         label: "projects",
//         render: (v) => <span title={String(v ?? 0)}>{formatInt(v)}</span>,
//         className: "num",
//       },
//     ];
//   }, []);

//   // Fetcher for underscore endpoint with optional organization_id
//   async function doFetch(nextPage = page, nextLimit = limit) {
//     setLoading(true);
//     setError("");
//     try {
//       const params = {
//         organization_id: organizationId || undefined,
//         page: nextPage,
//         limit: nextLimit,
//       };
//       const res = await listLlmCostsUnderscore(params);
//       const rows = Array.isArray(res.items) ? res.items : [];
//       setItems(rows);
//       setTotal(typeof res.total === "number" ? res.total : rows.length);
//       setPage(nextPage);
//       setLimit(nextLimit);
//     } catch (e) {
//       setError(e?.message || "Failed to load costs");
//     } finally {
//       setLoading(false);
//     }
//   }

//   // Server pagination handler
//   const fetchPage = async (p, l) => {
//     await doFetch(p, l);
//   };

//   return (
//     <div>
//       <Card
//         title="Costs"
//         subtitle="LLM usage cost records (underscore API)"
//         className="mt-4"
//       >
//         <div className="toolbar" aria-label="Costs toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
//           <input
//             className="input"
//             placeholder="Filter by tenant (optional)"
//             aria-label="Organization ID"
//             value={organizationId}
//             onChange={(e) => setOrganizationId(e.target.value)}
//             style={{ minWidth: 220 }}
//           />
//           <button
//             className="btn btn-primary"
//             type="button"
//             onClick={() => doFetch(1, limit)}
//             aria-label="Load costs"
//             title="Load costs"
//             disabled={loading}
//           >
//             {loading ? "Loading..." : "Load"}
//           </button>
//           {error ? <div className="error" role="alert" style={{ marginLeft: 8, color: '#EF4444' }}>{error}</div> : null}
//           <div style={{ flex: 1 }} />
//           <label className="muted" htmlFor="costs-pagesize" style={{ fontSize: 12 }}>Page size</label>
//           <select
//             id="costs-pagesize"
//             className="input"
//             value={limit}
//             onChange={(e) => {
//               const next = parseInt(e.target.value, 10) || 10;
//               setLimit(next);
//             }}
//           >
//             {[10, 20, 50, 100, 200].map((n) => (
//               <option key={n} value={n}>{n}</option>
//             ))}
//           </select>
//           <button
//             className="btn btn-secondary"
//             type="button"
//             onClick={() => openInspector("Rows JSON", items)}
//             title="View raw rows JSON"
//             disabled={items.length === 0}
//           >
//             View rows
//           </button>
//         </div>

//         <DataTable
//           columns={columns}
//           data={items}
//           loading={loading}
//           pageSize={limit}
//           initialPage={page}
//           serverTotal={total}
//           fetchPage={fetchPage}
//           paginationTitle="Costs pages"
//           forceHorizontalScroll
//         />
//       </Card>

//       <Modal
//         title={inspectTitle}
//         open={inspectOpen}
//         onClose={closeInspector}
//         headerOffset={60}
//         width="min(96vw, 880px)"
//         className="modal--costs"
//         footer={
//           <button className="btn btn-ghost" onClick={closeInspector} aria-label="Close details">Close</button>
//         }
//       >
//         <pre style={{ margin: 0, padding: 12, maxHeight: '60vh', overflow: 'auto', background: '#0b1020', color: '#e6edf3', borderRadius: 8 }}>
// {typeof inspectPayload === 'string'
//   ? inspectPayload
//   : JSON.stringify(inspectPayload, null, 2)}
//         </pre>
//       </Modal>
//     </div>
//   );
// }
 

import React, { useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import { listLlmCostsUnderscore } from "../../api";

/* =========================
   Formatters
========================= */

// PUBLIC_INTERFACE
function formatCurrencyUSD(n) {
  if (typeof n === "string") {
    n = n.replace(/[^0-9.-]/g, "");
  }
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return "$0.00";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6,
  }).format(num);
}

// PUBLIC_INTERFACE
function formatInt(n) {
  const num = typeof n === "number" ? n : Number.parseInt(n || 0, 10);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
}

/**
 * PUBLIC_INTERFACE
 * Costs page (underscore endpoint)
 * - Fetches from GET /api/llm_costs
 * - Server-side pagination
 * - Improved UI + safe fallbacks
 */
export default function Costs() {
  const [organizationId, setOrganizationId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Inspector modal
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectTitle, setInspectTitle] = useState("Details");
  const [inspectPayload, setInspectPayload] = useState(null);

  function openInspector(title, payload) {
    setInspectTitle(title);
    setInspectPayload(payload);
    setInspectOpen(true);
  }

  function closeInspector() {
    setInspectOpen(false);
    setInspectPayload(null);
  }

  /* =========================
     Table Columns
  ========================= */

  const columns = useMemo(() => [
    {
      key: "organization_name",
      label: "Organization",
      priority: 1,
      render: (v) => (
        <span className="td--emphasis-name">
          {v || "—"}
        </span>
      ),
    },
    {
      key: "organization_cost",
      label: "Org Cost",
      className: "num",
      render: (v) => (
        <span className="amount-positive">
          {formatCurrencyUSD(v)}
        </span>
      ),
    },
    {
      key: "user_name",
      label: "User",
      render: (v, row) => {
        // Prefer user_display_name when present; fall back to user_name then "Unknown User"
        const displayName =
          (typeof row?.user_display_name === "string" && row.user_display_name.trim()
            ? row.user_display_name
            : null) ||
          (typeof v === "string" && v.trim() ? v : "Unknown User");
        return displayName || <span className="muted">Unknown User</span>;
      },
    },
    {
      key: "user_cost",
      label: "User Cost",
      className: "num",
      render: (v) => (
        <span className="amount-positive">
          {formatCurrencyUSD(v)}
        </span>
      ),
    },
    {
      key: "projects",
      label: "Projects",
      className: "num",
      render: (v) => (
        <span className="badge badge-neutral">
          {formatInt(v)}
        </span>
      ),
    },
    {
      key: "__actions",
      label: "",
      render: (_, row) => (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => openInspector("Row Details", row)}
        >
          View
        </button>
      ),
    },
  ], []);

  /* =========================
     Data Fetching
  ========================= */

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
      const rows = Array.isArray(res?.items) ? res.items : [];

      setItems(rows);
      setTotal(typeof res?.total === "number" ? res.total : rows.length);
      setPage(nextPage);
      setLimit(nextLimit);
    } catch (e) {
      setError(e?.message || "Failed to load cost data");
    } finally {
      setLoading(false);
    }
  }

  const fetchPage = async (p, l) => {
    await doFetch(p, l);
  };

  /* =========================
     Render
  ========================= */

  return (
    <div>
      <Card
        title="Costs"
        subtitle="Aggregated LLM usage costs by organization and user"
        className="mt-4"
      >
        {/* Toolbar */}
        <div
          className="toolbar"
          aria-label="Costs toolbar"
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            className="input"
            placeholder="Filter by Organization ID (optional)"
            aria-label="Organization ID"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{ minWidth: 260 }}
          />

          <button
            className="btn btn-primary"
            type="button"
            onClick={() => doFetch(1, limit)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load"}
          </button>

          {error && (
            <div
              className="error"
              role="alert"
              style={{ color: "#EF4444" }}
            >
              {error}
            </div>
          )}

          <div style={{ flex: 1 }} />

          <label
            htmlFor="costs-pagesize"
            className="muted"
            style={{ fontSize: 12 }}
          >
            Page size
          </label>

          <select
            id="costs-pagesize"
            className="input"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 10)}
          >
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => openInspector("Rows JSON", items)}
            disabled={items.length === 0}
          >
            View rows
          </button>
        </div>

        {/* Table */}
        {(!loading && items.length === 0) ? (
          <div className="empty-state">
            No cost records found. Try adjusting filters.
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={items}
            loading={loading}
            pageSize={limit}
            initialPage={page}
            serverTotal={total}
            fetchPage={fetchPage}
            paginationTitle="Costs pages"
            forceHorizontalScroll
          />
        )}
      </Card>

      {/* Inspector Modal */}
      <Modal
        title={inspectTitle}
        open={inspectOpen}
        onClose={closeInspector}
        headerOffset={60}
        width="min(96vw, 880px)"
        footer={
          <button
            className="btn btn-ghost"
            onClick={closeInspector}
          >
            Close
          </button>
        }
      >
        <pre
          style={{
            margin: 0,
            padding: 12,
            maxHeight: "60vh",
            overflow: "auto",
            background: "#0b1020",
            color: "#e6edf3",
            borderRadius: 8,
          }}
        >
          {JSON.stringify(inspectPayload, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
