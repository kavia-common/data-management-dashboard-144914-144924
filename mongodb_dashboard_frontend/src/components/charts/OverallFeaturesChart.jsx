import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import Card from "../common/Card.jsx";
import { getChartTheme } from "./chartTheme";
import { fetchSessionTracking } from "../../api/sessionTracking";

import getOceanColors from "../../theme/colors";

/**
 * PUBLIC_INTERFACE
 * OverallFeaturesChart
 * Bar chart aggregating session-tracking by service_type (Feature name).
 * Fetches with pagination from /api/session-tracking, supports date range filters:
 * daily, weekly, monthly, and custom based on session_start.
 *
 * Props:
 * - title?: string
 * - subtitle?: string
 * - granularity?: 'day'|'week'|'month'|'custom' (controls default date window behavior)
 * - from?: string (ISO)
 * - to?: string (ISO)
 * - tenant_id?: string
 * - limitPerPage?: number (default 100)
 * - maxPages?: number (safety cap, default 20 -> up to 2k docs)
 * - maxBars?: number (for top N display, default 12)
 */
export default function OverallFeaturesChart({
  title = "Overall Features",
  subtitle = "Counts by feature (service_type) from session tracking",
  granularity = "day",
  from,
  to,
  tenant_id,
  limitPerPage = 100,
  maxPages = 20,
  maxBars = 12,
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);

  // compute default date window if not custom and from/to not provided
  const computeWindow = useCallback(() => {
    const now = new Date();
    let start = null;
    if (granularity === "day") {
      // last 1 day
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      start = d;
    } else if (granularity === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = d;
    } else if (granularity === "month") {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      start = d;
    } else if (granularity === "custom") {
      // rely on provided from/to if any
      start = from ? new Date(from) : null;
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = d;
    }

    const windowFrom = from ? new Date(from) : start;
    const windowTo = to ? new Date(to) : now;
    return {
      fromISO: windowFrom ? windowFrom.toISOString() : undefined,
      toISO: windowTo ? windowTo.toISOString() : undefined,
    };
  }, [granularity, from, to]);

  // Build a lightweight ?q text query to hint back-end to match by fields.
  // Note: backend supports q across various text fields; we still client-filter by session_start.
  const buildSearchQ = useCallback(() => {
    // no strong text filter required for aggregation; return undefined
    return undefined;
  }, []);

  // Fetch with pagination and client-side date filtering by session_start
  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setErr("");
      try {
        const { fromISO, toISO } = computeWindow();
        const q = buildSearchQ();

        let page = 1;
        const limit = Math.max(1, Math.min(200, Number(limitPerPage) || 100));
        let aggregated = {};

        for (; page <= Math.max(1, Number(maxPages) || 20); page++) {
          const res = await fetchSessionTracking({
            page,
            limit,
            tenant_id,
            sort: "-session_start",
            q,
          });

          const items = Array.isArray(res?.items) ? res.items : [];

          // client-side date filter by session_start (ISO)
          const filtered = items.filter((it) => {
            const ts = it?.session_start || it?.last_updated || it?.created_at;
            if (!ts) return true; // keep if missing timestamp (to not miss counts)
            const t = new Date(ts).getTime();
            if (Number.isNaN(t)) return true;
            if (fromISO && t < new Date(fromISO).getTime()) return false;
            if (toISO && t > new Date(toISO).getTime()) return false;
            return true;
          });

          // aggregate by service_type
          for (const it of filtered) {
            const key = (it?.service_type && String(it.service_type).trim()) || "Unknown";
            aggregated[key] = (aggregated[key] || 0) + 1;
          }

          // stop if we got less than limit -> no more pages
          if (items.length < limit) break;
        }

        if (!mounted) return;

        // shape rows, sort desc, cap to top N
        const shaped = Object.entries(aggregated).map(([service_type, count]) => ({
          service_type,
          count: Number(count || 0),
        }));
        shaped.sort((a, b) => b.count - a.count);

        setRows(shaped.slice(0, Math.max(1, Number(maxBars) || 12)));
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load feature usage");
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [tenant_id, granularity, from, to, limitPerPage, maxPages, maxBars, computeWindow, buildSearchQ]);

  // Chart theming and shaping
  const t = getChartTheme();
  const oc = getOceanColors();
  const gridStroke = t.grid;

  const data = useMemo(() => {
    // map to chart-friendly and assign color
    return rows.map((r, i) => {
      const name = r.service_type || "Unknown";
      const fill = oc?.accent || t.primary;
      return { name, count: r.count, fill };
    });
  }, [rows, t, oc]);

  const totalCount = useMemo(
    () => data.reduce((sum, d) => sum + (Number(d.count) || 0), 0),
    [data]
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = payload[0]?.payload || {};
      const count = d?.count ?? 0;
      const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
      return (
        <div
          role="dialog"
          aria-live="polite"
          style={{
            background: t.tooltip.bg,
            border: `1px solid ${t.tooltip.border}`,
            borderRadius: 8,
            padding: "8px 10px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            color: t.tooltip.text,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
          <div>Count: {count}</div>
          <div>Share: {pct.toFixed(1)}%</div>
        </div>
      );
    }
    return null;
  };

  const valueLabel = (props) => {
    const { x, y, width, height, value } = props;
    const label = String(value ?? "");
    const padding = 6;
    const textX = (x || 0) + (width || 0) + padding;
    const textY = (y || 0) + (height || 0) / 2 + 3;
    return (
      <text
        x={textX}
        y={textY}
        fill="var(--color-text-primary)"
        fontSize={12}
        textAnchor="start"
        aria-hidden="true"
      >
        {label}
      </text>
    );
  };

  return (
    <Card
      title={title}
      subtitle={subtitle}
      className="overview-card"
      ariaLabel="Overall Features chart"
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <span
          style={{
            background: "color-mix(in oklab, var(--color-accent) 12%, transparent)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
            fontSize: 12,
            padding: "6px 8px",
            borderRadius: 999,
          }}
          title={`Total sessions counted across features: ${totalCount}`}
          aria-label={`Total sessions counted across features: ${totalCount}`}
        >
          Total: {totalCount}
        </span>
      </div>
      <div style={{ height: 360 }}>
        {loading ? (
          <div aria-busy="true">
            <div className="skeleton" style={{ height: 16, width: "35%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: "55%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: "48%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: "62%", marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 12, width: "40%" }} />
          </div>
        ) : err ? (
          <div className="error" role="alert">
            {err}
          </div>
        ) : data.length === 0 ? (
          <div className="screen-center">No data</div>
        ) : (
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 40, bottom: 8, left: 80 }}
              barCategoryGap={12}
              aria-label="Horizontal bar chart showing counts by feature"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: t.axisTick }}
                allowDecimals={false}
                label={{
                  value: "Count",
                  position: "insideBottomRight",
                  offset: -4,
                  fill: t.axisTick,
                  fontSize: 12,
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: t.axisTick }}
                width={120}
              />
              <Tooltip
                content={<CustomTooltip />}
                wrapperStyle={{ outline: "none" }}
                contentStyle={{
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                }}
                cursor={{ fill: "transparent" }}
              />
              <Legend
                verticalAlign="top"
                height={24}
                wrapperStyle={{ fontSize: 12, color: t.legend.text }}
                payload={[{ id: "Count", value: "Count", type: "square", color: t.primary }]}
              />
              <Bar dataKey="count" name="Count" fill={t.primary} stroke={t.primaryActive} radius={[4, 4, 4, 4]}>
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
                <LabelList dataKey="count" content={valueLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

OverallFeaturesChart.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  granularity: PropTypes.oneOf(["day", "week", "month", "custom"]),
  from: PropTypes.string,
  to: PropTypes.string,
  tenant_id: PropTypes.string,
  limitPerPage: PropTypes.number,
  maxPages: PropTypes.number,
  maxBars: PropTypes.number,
};
