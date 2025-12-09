import React, { useMemo } from "react";
import PropTypes from "prop-types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/**
 * PUBLIC_INTERFACE
 * UserMiniInsights
 * Shows per-user mini insights: projects count over time and top categories (if available).
 *
 * Props:
 * - userId: string
 * - tenantId: string
 * - from: ISO start
 * - to: ISO end
 */
export default function UserMiniInsights({ userId, tenantId, from, to }) {
  // Projects timeline removed: provide empty data and neutral labels
  const loading = false;
  const error = "";
  const timeline = useMemo(() => [], []);
  const categories = useMemo(() => [], []);

  const palette = ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#6366F1", "#14B8A6", "#F97316", "#84CC16", "#06B6D4", "#A855F7"];

  return (
    <div role="region" aria-label="User insights panel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div className="card" aria-label="Activity over time mini chart">
        <div className="card-header" style={{ paddingBottom: 0 }}>
          <h4 className="card-title">Activity over time</h4>
          <div className="card-subtitle">Per-user</div>
        </div>
        <div className="card-content" style={{ height: 220 }}>
          {loading ? (
            <div aria-busy="true">
              <div className="skeleton" style={{ height: 12, width: "45%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 180, width: "100%" }} />
            </div>
          ) : error ? (
            <div className="error" role="alert">{error}</div>
          ) : timeline.length === 0 ? (
            <div className="screen-center">No timeline data</div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={timeline}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 12 }} />
                <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line dataKey="total" name="Activity" stroke="#2563EB" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" aria-label="Top categories mini chart">
        <div className="card-header" style={{ paddingBottom: 0 }}>
          <h4 className="card-title">Top categories</h4>
          <div className="card-subtitle">If available</div>
        </div>
        <div className="card-content" style={{ height: 220 }}>
          {loading ? (
            <div aria-busy="true">
              <div className="skeleton" style={{ height: 12, width: "45%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 180, width: "100%" }} />
            </div>
          ) : error ? (
            <div className="error" role="alert">{error}</div>
          ) : categories.length === 0 ? (
            <div className="screen-center">No categories</div>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie data={categories} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius="80%" paddingAngle={2}>
                  {categories.map((c, idx) => (
                    <Cell key={c.name} fill={palette[idx % palette.length]} stroke={palette[idx % palette.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

UserMiniInsights.propTypes = {
  userId: PropTypes.string,
  tenantId: PropTypes.string,
  from: PropTypes.string,
  to: PropTypes.string,
};
