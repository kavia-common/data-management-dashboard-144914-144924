import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card.jsx";
import DataTable from "../../components/DataTable.jsx";
import Modal from "../../components/ui/Modal.jsx";
import { listLlmCostsUnderscore } from "../../api";

import { renderCreditsWithUsd } from "../../utils/currency";

/**
 * PUBLIC_INTERFACE
 * Costs page (underscore endpoint)
 * - Fetches from GET /api/llm_costs with explicit user action or pagination controls.
 * - Applies client-side filtering and sorting on the loaded dataset.
 * - Renders a tabular view for fields:
 *   organization_id, organization_name, organization_cost, users (count), user_id, type, user_cost, projects (count)
 * - Preserves state (filters, sort, page) while navigating within the page.
 */
export default function Costs() {
  // API controls
  const [organizationId, setOrganizationId] = useState(() => sessionStorage.getItem("costs.organizationId") || "");
  const [rawItems, setRawItems] = useState(() => {
    const cached = sessionStorage.getItem("costs.rawItems");
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pagination UI (client-side paging on filtered/sorted result)
  const [page, setPage] = useState(() => parseInt(sessionStorage.getItem("costs.page") || "1", 10));
  const [limit, setLimit] = useState(() => parseInt(sessionStorage.getItem("costs.limit") || "10", 10));

  // Filters (client-side)
  const [filterOrgName, setFilterOrgName] = useState(() => sessionStorage.getItem("costs.filter.orgName") || "");
  const [filterUserId, setFilterUserId] = useState(() => sessionStorage.getItem("costs.filter.userId") || "");
  const [filterType, setFilterType] = useState(() => sessionStorage.getItem("costs.filter.type") || "");
  const [filterOrgCostMin, setFilterOrgCostMin] = useState(() => sessionStorage.getItem("costs.filter.orgCostMin") || "");
  const [filterOrgCostMax, setFilterOrgCostMax] = useState(() => sessionStorage.getItem("costs.filter.orgCostMax") || "");
  const [filterUserCostMin, setFilterUserCostMin] = useState(() => sessionStorage.getItem("costs.filter.userCostMin") || "");
  const [filterUserCostMax, setFilterUserCostMax] = useState(() => sessionStorage.getItem("costs.filter.userCostMax") || "");

  // Sorting (client-side) - { key, direction: 'asc' | 'desc' }
  const [sortBy, setSortBy] = useState(() => {
    const cached = sessionStorage.getItem("costs.sortBy");
    return cached ? JSON.parse(cached) : { key: "", direction: "asc" };
  });

  // Persist state to sessionStorage (preserve within page navigation)
  useEffect(() => { sessionStorage.setItem("costs.organizationId", organizationId); }, [organizationId]);
  useEffect(() => { sessionStorage.setItem("costs.rawItems", JSON.stringify(rawItems)); }, [rawItems]);
  useEffect(() => { sessionStorage.setItem("costs.page", String(page)); }, [page]);
  useEffect(() => { sessionStorage.setItem("costs.limit", String(limit)); }, [limit]);
  useEffect(() => { sessionStorage.setItem("costs.filter.orgName", filterOrgName); }, [filterOrgName]);
  useEffect(() => { sessionStorage.setItem("costs.filter.userId", filterUserId); }, [filterUserId]);
  useEffect(() => { sessionStorage.setItem("costs.filter.type", filterType); }, [filterType]);
  useEffect(() => { sessionStorage.setItem("costs.filter.orgCostMin", filterOrgCostMin); }, [filterOrgCostMin]);
  useEffect(() => { sessionStorage.setItem("costs.filter.orgCostMax", filterOrgCostMax); }, [filterOrgCostMax]);
  useEffect(() => { sessionStorage.setItem("costs.filter.userCostMin", filterUserCostMin); }, [filterUserCostMin]);
  useEffect(() => { sessionStorage.setItem("costs.filter.userCostMax", filterUserCostMax); }, [filterUserCostMax]);
  useEffect(() => { sessionStorage.setItem("costs.sortBy", JSON.stringify(sortBy)); }, [sortBy]);

  // Distinct types from current dataset for select
  const distinctTypes = useMemo(() => {
    const set = new Set();
    rawItems.forEach((r) => {
      if (r?.type) set.add(String(r.type));
    });
    return Array.from(set).sort();
  }, [rawItems]);

  const columns = useMemo(() => {
    return [
      { key: "organization_id", label: "Organization Id", sortable: true },
      { key: "organization_name", label: "Organization Name", sortable: true },
      {
        key: "organization_cost",
        label: "Organization Cost",
        sortable: true,
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
        sortable: true,
        render: (v) => {
          const num = typeof v === "number" ? v : Number.parseInt(v || 0, 10);
          return <span title={String(num)}>{Number.isFinite(num) ? num.toLocaleString() : "0"}</span>;
        },
        className: "num",
      },
      { key: "user_id", label: "User Id", sortable: true },
      { key: "type", label: "Type", sortable: true },
      {
        key: "user_cost",
        label: "User Cost",
        sortable: true,
        render: (v) => {
          const num = typeof v === "number" ? v : Number(v || 0);
          return <span className="amount-positive">{renderCreditsWithUsd(isFinite(num) ? num : 0)}</span>;
        },
        className: "num",
      },
      {
        key: "projects",
        label: "Projects",
        sortable: true,
        render: (v) => {
          const num = typeof v === "number" ? v : Number.parseInt(v || 0, 10);
          return <span title={String(num)}>{Number.isFinite(num) ? num.toLocaleString() : "0"}</span>;
        },
        className: "num",
      },
    ];
  }, []);

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

  // Fetcher for underscore endpoint (API unchanged)
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
      setRawItems(rows);
      // Reset page to 1 when fresh load to avoid empty pages after filter
      setPage(1);
    } catch (e) {
      setError(e?.message || "Failed to load costs");
    } finally {
      setLoading(false);
    }
  }

  // Apply filters
  const filtered = useMemo(() => {
    const orgNameQuery = filterOrgName.trim().toLowerCase();
    const userIdQuery = filterUserId.trim().toLowerCase();

    const orgMin = filterOrgCostMin !== "" ? Number(filterOrgCostMin) : null;
    const orgMax = filterOrgCostMax !== "" ? Number(filterOrgCostMax) : null;
    const userMin = filterUserCostMin !== "" ? Number(filterUserCostMin) : null;
    const userMax = filterUserCostMax !== "" ? Number(filterUserCostMax) : null;

    return rawItems.filter((r) => {
      // text filters
      if (orgNameQuery) {
        const val = (r.organization_name ?? "").toString().toLowerCase();
        if (!val.includes(orgNameQuery)) return false;
      }
      if (userIdQuery) {
        const val = (r.user_id ?? "").toString().toLowerCase();
        if (!val.includes(userIdQuery)) return false;
      }
      if (filterType) {
        if ((r.type ?? "") !== filterType) return false;
      }

      // numeric ranges
      const orgCostNum = Number(r.organization_cost ?? 0);
      const userCostNum = Number(r.user_cost ?? 0);

      if (orgMin !== null && !(orgCostNum >= orgMin)) return false;
      if (orgMax !== null && !(orgCostNum <= orgMax)) return false;
      if (userMin !== null && !(userCostNum >= userMin)) return false;
      if (userMax !== null && !(userCostNum <= userMax)) return false;

      return true;
    });
  }, [
    rawItems,
    filterOrgName,
    filterUserId,
    filterType,
    filterOrgCostMin,
    filterOrgCostMax,
    filterUserCostMin,
    filterUserCostMax,
  ]);

  // Apply sorting
  const sorted = useMemo(() => {
    if (!sortBy?.key) return filtered;
    const dir = sortBy.direction === "desc" ? -1 : 1;

    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a?.[sortBy.key];
      const bv = b?.[sortBy.key];

      // Try numeric comparison if both look numeric
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) {
        if (an < bn) return -1 * dir;
        if (an > bn) return 1 * dir;
        return 0;
      }

      // Fallback to string comparison
      const as = (av ?? "").toString().toLowerCase();
      const bs = (bv ?? "").toString().toLowerCase();
      if (as < bs) return -1 * dir;
      if (as > bs) return 1 * dir;
      return 0;
    });
    return copy;
  }, [filtered, sortBy]);

  // Paged (client-side)
  const total = sorted.length;
  const paged = useMemo(() => {
    const start = (page - 1) * limit;
    return sorted.slice(start, start + limit);
  }, [sorted, page, limit]);

  // Sorting handler
  function toggleSort(key) {
    setPage(1);
    setSortBy((prev) => {
      if (prev.key === key) {
        const direction = prev.direction === "asc" ? "desc" : "asc";
        return { key, direction };
      }
      return { key, direction: "asc" };
    });
  }

  // Render header with sort toggles
  const columnsWithHeaderRender = useMemo(() => {
    return columns.map((col) => {
      if (!col.sortable) return col;
      return {
        ...col,
        headerRender: () => {
          const isActive = sortBy.key === col.key;
          const dir = isActive ? sortBy.direction : undefined;
          return (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => toggleSort(col.key)}
              title={`Sort by ${col.label}${isActive ? ` (${dir})` : ""}`}
              style={{ padding: "6px 10px", fontWeight: isActive ? 800 : 600 }}
              aria-label={`Sort by ${col.label}`}
            >
              <span>{col.label}</span>
              <span style={{ marginLeft: 6, opacity: isActive ? 1 : 0.5 }}>
                {isActive ? (dir === "asc" ? "▲" : "▼") : "↕"}
              </span>
            </button>
          );
        },
      };
    });
  }, [columns, sortBy]);

  // Hook pagination controls to client-side paging
  const fetchPage = async (p, l) => {
    setPage(p);
    setLimit(l);
  };

  return (
    <div>
      <Card
        title="Costs"
        subtitle="LLM usage cost records — underscore API"
        className="mt-4"
      >
        <div
          className="toolbar"
          aria-label="Costs toolbar"
          style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}
        >
          <input
            className="input"
            placeholder="organization_id (API param)"
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
          {error ? (
            <div className="error" role="alert" style={{ marginLeft: 8 }}>
              {error}
            </div>
          ) : null}
          <div style={{ flex: 1 }} />
          <label className="muted" htmlFor="costs-pagesize" style={{ fontSize: 12 }}>
            Page size
          </label>
          <select
            id="costs-pagesize"
            className="input"
            value={limit}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10) || 10;
              setLimit(next);
              setPage(1);
            }}
          >
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Filter row */}
        <div
          className="toolbar"
          aria-label="Filters"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 12,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>organization_name</label>
            <input
              className="input"
              placeholder="contains…"
              value={filterOrgName}
              onChange={(e) => {
                setFilterOrgName(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>user_id</label>
            <input
              className="input"
              placeholder="contains…"
              value={filterUserId}
              onChange={(e) => {
                setFilterUserId(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>type</label>
            <select
              className="input"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {distinctTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>organization_cost (min-max)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                inputMode="decimal"
                placeholder="min"
                value={filterOrgCostMin}
                onChange={(e) => {
                  setFilterOrgCostMin(e.target.value);
                  setPage(1);
                }}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder="max"
                value={filterOrgCostMax}
                onChange={(e) => {
                  setFilterOrgCostMax(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--text-tertiary)" }}>user_cost (min-max)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                inputMode="decimal"
                placeholder="min"
                value={filterUserCostMin}
                onChange={(e) => {
                  setFilterUserCostMin(e.target.value);
                  setPage(1);
                }}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder="max"
                value={filterUserCostMax}
                onChange={(e) => {
                  setFilterUserCostMax(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setFilterOrgName("");
                setFilterUserId("");
                setFilterType("");
                setFilterOrgCostMin("");
                setFilterOrgCostMax("");
                setFilterUserCostMin("");
                setFilterUserCostMax("");
                setSortBy({ key: "", direction: "asc" });
                setPage(1);
              }}
              title="Clear filters and sorting"
            >
              Clear
            </button>
          </div>
        </div>

        <DataTable
          columns={columnsWithHeaderRender}
          data={paged}
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
          <button className="btn btn-ghost" onClick={closeInspector} aria-label="Close details">
            Close
          </button>
        }
      >
        <div style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() => openInspector("Raw Rows", rawItems)}
            title="View raw rows JSON"
          >
            View raw rows
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => openInspector("Filtered Rows", filtered)}
            title="View filtered rows JSON"
          >
            View filtered rows
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => openInspector("Sorted Rows", sorted)}
            title="View sorted rows JSON"
          >
            View sorted rows
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => openInspector("Paged Rows", paged)}
            title="View paged rows JSON"
          >
            View paged rows
          </button>
        </div>
      </Modal>
    </div>
  );
}
