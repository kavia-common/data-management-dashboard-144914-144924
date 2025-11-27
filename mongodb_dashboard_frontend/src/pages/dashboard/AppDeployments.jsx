import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import { listDeployments } from "../../api";
import getOceanColors from "../../theme/colors";
import { formatStatusLabel } from "../../utils/formatStatusLabel";

/**
 * PUBLIC_INTERFACE
 * AppDeployments
 * Renders a responsive table of application deployments with Ocean Professional styling.
 * Columns: Project Name, Status (colored badge), App URL (clickable), Branch.
 * Data source: GET /api/app-deployments (paginated or raw array).
 * - Sorting: by project_name and status (server-side when available; client-side fallback supported by DataTable)
 * - Pagination: server-side via DataTable.fetchPage and serverTotal meta when present, otherwise client-side page
 * - States: loading spinner skeleton (provided by DataTable), empty state, and error state with retry.
 */
export default function AppDeployments() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Theme colors for status badges
  const oc = getOceanColors();

  // PUBLIC_INTERFACE
  function toLabel(key) {
    /** Convert snake_case to Title Case label. */
    return String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  // Map status value to themed badge color per style guide
  function statusBadgeColor(status) {
    const s = String(status || "").toLowerCase();
    if (s === "success" || s === "succeeded" || s === "ok" || s === "completed") {
      return "#10B981"; // green as success
    }
    if (s === "failed" || s === "error" || s === "failure") {
      return "#EF4444"; // error red
    }
    if (s === "inprogress" || s === "in_progress" || s === "in-progress" || s === "queued" || s === "pending") {
      return "#F59E0B"; // amber for in-progress/queued
    }
    // default accent
    return oc.primary;
  }

  // Render status badge with normalized label
  function StatusBadge({ value }) {
    const label = formatStatusLabel(value);
    const bg = statusBadgeColor(value);
    const fg = "#ffffff";
    return (
      <span
        className="status-badge"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 8px",
          borderRadius: 999,
          fontSize: 12,
          lineHeight: "18px",
          background: bg,
          color: fg,
          boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
        }}
        title={label}
        aria-label={`Status ${label}`}
      >
        {label}
      </span>
    );
  }

  // Build table columns to match acceptance criteria
  const columns = useMemo(() => {
    return [
      {
        key: "project_name",
        label: "Project Name",
        render: (v, row) => {
          const name = v || row?.projectName || row?.project?.name || "—";
          return <span title={name}>{name}</span>;
        },
        priority: 1,
        minWidth: 160,
        maxWidth: 420,
      },
      {
        key: "status",
        label: "Status",
        render: (v) => <StatusBadge value={v} />,
        priority: 2,
        minWidth: 120,
        maxWidth: 220,
        className: "col-status",
      },
      {
        key: "app_url",
        label: "App URL",
        render: (v, row) => {
          const url = v || row?.url || row?.application_url || "";
          if (!url) return "—";
          return (
            <a
              href={String(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
              title={String(url)}
              onClick={(e) => e.stopPropagation()}
              style={{ color: oc.primary, textDecoration: "underline" }}
            >
              {String(url)}
            </a>
          );
        },
        priority: 2,
        minWidth: 200,
        maxWidth: 560,
      },
      {
        key: "branch_name",
        label: "Branch",
        render: (v, row) => {
          const value = v || row?.branch || row?.git_branch || "—";
          return <span title={value}>{value}</span>;
        },
        priority: 3,
        minWidth: 120,
        maxWidth: 280,
      },
    ];
  }, [oc.primary]);

  const lastSortRef = useRef({ key: "project_name", dir: "asc" });

  // PUBLIC_INTERFACE
  async function load(page = 1, limit = meta.limit || 10, sortKey, sortDir) {
    /**
     * Fetch deployments via listDeployments({ page, limit, sort }).
     * Normalize response to rows and meta for the DataTable.
     */
    setLoading(true);
    setError("");
    try {
      const sortFieldMap = {
        project_name: "project_name",
        status: "status",
      };
      const params = { page, limit };
      if (sortKey) {
        const backendField = sortFieldMap[sortKey] || sortKey;
        params.sort = sortDir === "desc" ? `-${backendField}` : backendField;
      }

      const res = await listDeployments(params);
      // normalize to { items, total, meta }
      const items = res?.items || (Array.isArray(res) ? res : []);
      const safeRows = (items || []).map((it) => {
        const id = it?._id || it?.id || it?.deployment_id || it?.deploymentId || Math.random().toString(36).slice(2);
        return { _id: id, ...it };
      });

      setRows(safeRows);
      setMeta({
        page: res?.meta?.page || page,
        limit: res?.meta?.limit || limit,
        total: typeof res?.meta?.total === "number" ? res.meta.total : (Array.isArray(safeRows) ? safeRows.length : 0),
      });
    } catch (e) {
      setRows([]);
      setMeta((m) => ({ ...m, total: 0 }));
      setError(e?.response?.data?.message || e?.message || "Failed to load app deployments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, meta.limit || 10, lastSortRef.current.key, lastSortRef.current.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid">
      <div className="block-full">
        <Card
          title="App Deployments"
          subtitle="Latest deployments across projects"
          className="elevated"
        >
          {error ? (
            <ErrorState message={error} onRetry={() => load(meta.page || 1, meta.limit || 10, lastSortRef.current.key, lastSortRef.current.dir)} />
          ) : null}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              border: "1px solid #E5E7EB",
            }}
          >
            <DataTable
              columns={columns}
              data={rows}
              loading={loading}
              pageSize={meta.limit || 10}
              initialPage={meta.page || 1}
              serverTotal={meta.total}
              paginationTitle="Deployment pages"
              fetchPage={async (page, limit, sortKey, sortDir) => {
                if (sortKey) lastSortRef.current = { key: sortKey, dir: sortDir || "asc" };
                await load(page, limit, sortKey, sortDir);
              }}
              maxBodyHeight={420}
            />
          </div>
          {!loading && !error && Array.isArray(rows) && rows.length === 0 && (
            <div className="table-empty" style={{ paddingTop: 12 }}>No deployments found</div>
          )}
        </Card>
      </div>
    </div>
  );
}
