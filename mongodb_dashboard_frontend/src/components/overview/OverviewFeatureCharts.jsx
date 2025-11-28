import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Card from "../ui/Card.jsx";
import Skeleton from "../ui/Skeleton.jsx";
import ErrorState from "../common/ErrorState.jsx";
import { fetchSessionsByType } from "../../api/sessionsByType";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/**
 * PUBLIC_INTERFACE
 * OverviewFeatureCharts
 * Aggregates session_tracking records by service_type (feature) within the provided date range and renders
 * a responsive chart with a toggle between Bar and Pie modes.
 *
 * Props:
 * - title?: string (defaults to "Overall Feature Charts")
 * - subtitle?: string
 * - from?: ISO string start
 * - to?: ISO string end
 * - organization_id?: string (tenant)
 * - pattern?: string (search pattern applied to backend 'q' param)
 * - defaultView?: 'bar' | 'pie'
 * - className?: string
 *
 * Notes:
 * - Uses existing fetchSessionTracking helper.
 * - Automatically refreshes when from/to/organization_id/pattern change.
 */
export default function OverviewFeatureCharts({
  title = "Overall Feature Charts",
  subtitle = "Counts by feature (service_type)",
  from,
  to,
  organization_id,
  pattern,
  defaultView = "bar",
  className = "",
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [items, setItems] = useState([]);
  const [view, setView] = useState(defaultView === "pie" ? "pie" : "bar");

  // Colors for charts (Ocean Professional palette with extended hues)
  const colors = [
    "#2563EB", // blue primary
    "#F59E0B", // amber secondary
    "#22c55e", // green
    "#0EA5E9", // sky
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#EF4444", // red
    "#14B8A6", // teal
    "#A3A3A3", // gray
    "#F43F5E", // rose
  ];

  // Fetch aggregated sessions-by-type in a single backend call
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const params = {};
        if (organization_id) params.tenant_id = organization_id;
        if (from) params.from = from;
        if (to) params.to = to;

        const { items: aggItems } = await fetchSessionsByType(params);
        if (cancelled) return;
        // Map to existing shape used by charts: { feature, count }
        setItems(Array.isArray(aggItems) ? aggItems : []);
      } catch (e) {
        if (cancelled) return;
        setErr(e);
        setItems([]);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [organization_id, from, to]);

  // Items already aggregated by backend: normalize/sort for chart
  const { chartData, totalCount } = useMemo(() => {
    const data = (items || [])
      .map((row) => ({
        feature: String(row.feature ?? 'Unknown'),
        count: Number(row.count ?? 0),
      }))
      .sort((a, b) => b.count - a.count);
    const total = data.reduce((acc, it) => acc + (it.count || 0), 0);
    return { chartData: data, totalCount: total };
  }, [items]);

  const empty = !loading && (!chartData || chartData.length === 0);

  function renderViewToggle() {
    return (
      <div
        role="group"
        aria-label="Chart view toggle"
        style={{
          display: "inline-flex",
          gap: 0,
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        {[
          { key: "bar", label: "Bar" },
          { key: "pie", label: "Pie" },
        ].map((opt, idx) => {
          const active = view === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setView(opt.key)}
              aria-pressed={active}
              style={{
                padding: "6px 12px",
                border: "none",
                background: active ? "#2563EB" : "transparent",
                color: active ? "#ffffff" : "#111827",
                borderRight: idx === 0 ? "1px solid #E5E7EB" : "none",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderChart() {
    if (loading) {
      return (
        <div style={{ paddingTop: 8 }}>
          <Skeleton height={18} width="30%" style={{ marginBottom: 12 }} />
          <Skeleton height={220} width="100%" />
        </div>
      );
    }
    if (err) {
      return <ErrorState message={err?.message || "Failed to load features overview."} />;
    }
    if (empty) {
      return (
        <div style={{ color: "#6B7280", fontSize: 14, textAlign: "center", padding: "20px 0" }}>
          No feature activity for the selected filters.
        </div>
      );
    }

    if (view === "pie") {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Tooltip
              formatter={(value, name, entry) => [value, "Count"]}
              labelFormatter={(label) => `Feature: ${label}`}
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              wrapperStyle={{ outline: "none" }}
            />
            <Legend />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="feature"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={(d) => `${d.feature} (${Math.round((d.count / Math.max(totalCount, 1)) * 100)}%)`}
              isAnimationActive={false}
            >
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${entry.feature}-${idx}`} fill={colors[idx % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // bar
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
          <XAxis
            dataKey="feature"
            tick={{ fill: "#111827", fontSize: 12 }}
            interval={0}
            height={50}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            angle={-20}
            textAnchor="end"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#111827", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <Tooltip
            cursor={{ fill: "transparent" }}
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            wrapperStyle={{ outline: "none" }}
            formatter={(value) => [value, "Count"]}
            labelFormatter={(label) => `Feature: ${label}`}
          />
          <Legend />
          <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]} fill="url(#gradFeaturePrimary)" isAnimationActive={false} />
          <defs>
            <linearGradient id="gradFeaturePrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <Card
      title={title}
      subtitle={subtitle}
      className={className}
      ariaLabel="Overall Feature Charts"
      style={{ width: "100%" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ color: "#6B7280", fontSize: 13 }}>
          {from && to
            ? `Filtered: ${new Date(from).toLocaleDateString()} — ${new Date(to).toLocaleDateString()}`
            : "All time"}
        </div>
        {renderViewToggle()}
      </div>
      <div className="responsive-chart" style={{ minHeight: 280 }}>{renderChart()}</div>
    </Card>
  );
}

OverviewFeatureCharts.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  from: PropTypes.string,
  to: PropTypes.string,
  organization_id: PropTypes.string,
  pattern: PropTypes.string,
  defaultView: PropTypes.oneOf(["bar", "pie"]),
  className: PropTypes.string,
};
