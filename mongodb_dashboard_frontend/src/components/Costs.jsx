import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildUserIdToNameMap,
  resolveUserDisplayNameForRecord,
} from "../utils/userDisplay";

// PUBLIC_INTERFACE
export default function Costs() {
  /**
   * Costs table that fetches enriched costs from backend (/api/costs).
   *
   * Issue being patched:
   * Some recent changes caused user display to regress to "Unknown User".
   * This component now resolves user display names using multiple sources:
   *  - Embedded fields in cost records (user_name/userName/user.displayName/email)
   *  - A cached users list lookup (id->name) via existing /api/users endpoint
   *  - Safe fallbacks: email, then shortened userId
   *
   * This avoids reverting unrelated changes while restoring correct name display.
   */
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("-timestamp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState("");

  // Cache: id -> display name. Built from embedded rows + /api/users.
  const [userIdToName, setUserIdToName] = useState({});
  const userMapAbortRef = useRef(null);

  const API_BASE =
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    "";

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/costs", API_BASE).toString();
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sort", sort);
      const reqUrl = `${url}?${params.toString()}`;

      const res = await fetch(reqUrl, {
        headers: {
          "Content-Type": "application/json",
          // Tenant scoping: in demo environments this may be required
          ...(process.env.REACT_APP_ORGANIZATION_ID
            ? { "x-organization-id": process.env.REACT_APP_ORGANIZATION_ID }
            : {}),
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with ${res.status}`);
      }

      const body = await res.json();
      const data = Array.isArray(body?.data) ? body.data : [];

      setItems(data);
      setTotal(body?.meta?.total || data.length);

      // Build/refresh the user map after receiving rows
      try {
        if (userMapAbortRef.current) {
          userMapAbortRef.current.abort();
        }
        const controller = new AbortController();
        userMapAbortRef.current = controller;

        const map = await buildUserIdToNameMap(data, {
          signal: controller.signal,
        });
        setUserIdToName(map);
      } catch {
        // non-fatal; fallbacks will apply
      } finally {
        userMapAbortRef.current = null;
      }
    } catch (e) {
      setError(e?.message || "Failed to load costs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      if (userMapAbortRef.current) {
        try {
          userMapAbortRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sort]);

  const normalizedForDisplay = useMemo(() => {
    // Attach a computed display name without mutating the original row fields.
    return items.map((row) => ({
      ...row,
      __userDisplayName: resolveUserDisplayNameForRecord(row, userIdToName),
    }));
  }, [items, userIdToName]);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return normalizedForDisplay;
    return normalizedForDisplay.filter((i) => {
      const uname = (i.__userDisplayName || "Unknown User").toLowerCase();
      const provider = (i.provider || "").toLowerCase();
      const model = (i.model || i.llm_model || "").toLowerCase();
      return uname.includes(q) || provider.includes(q) || model.includes(q);
    });
  }, [normalizedForDisplay, filterText]);

  const sorted = useMemo(() => {
    // If the backend sort is used, we keep it; this client-side sort is only applied for local user_name toggle.
    return filtered.slice().sort((a, b) => {
      if (sort === "user_name") {
        return (a.__userDisplayName || "").localeCompare(
          b.__userDisplayName || ""
        );
      }
      if (sort === "-user_name") {
        return (b.__userDisplayName || "").localeCompare(
          a.__userDisplayName || ""
        );
      }
      return 0; // keep server ordering for other sorts
    });
  }, [filtered, sort]);

  const onHeaderClick = (key) => {
    setPage(1);
    if (sort === key) setSort(`-${key}`);
    else if (sort === `-${key}`) setSort(key);
    else setSort(key);
  };

  return (
    <div className="costs-container" style={{ padding: 16 }}>
      <h2>Costs</h2>

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Filter by user, provider, or model"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            padding: 8,
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            minWidth: 260,
          }}
        />
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={loading || page <= 1}
        >
          Prev
        </button>
        <span>Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={loading || page * limit >= total}
        >
          Next
        </button>
      </div>

      {loading && <div>Loading costs…</div>}
      {error && <div style={{ color: "#EF4444" }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th
                  style={{ padding: "8px 6px", cursor: "pointer" }}
                  onClick={() => onHeaderClick("user_name")}
                >
                  User Name
                </th>
                <th style={{ padding: "8px 6px" }}>Provider</th>
                <th style={{ padding: "8px 6px" }}>Model</th>
                <th style={{ padding: "8px 6px" }}>Timestamp</th>
                <th style={{ padding: "8px 6px" }}>Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const displayName = row.__userDisplayName || "Unknown User";

                return (
                  <tr key={row._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 6px" }}>{displayName}</td>
                    <td style={{ padding: "8px 6px" }}>{row.provider || "-"}</td>
                    <td style={{ padding: "8px 6px" }}>
                      {row.model || row.llm_model || "-"}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      {row.timestamp ? new Date(row.timestamp).toLocaleString() : "-"}
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      {typeof row.cost_usd === "number"
                        ? row.cost_usd.toFixed(6)
                        : typeof row.total_cost === "number"
                          ? row.total_cost.toFixed(6)
                          : "-"}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: "12px 6px", color: "#6b7280" }}>
                    No results
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
