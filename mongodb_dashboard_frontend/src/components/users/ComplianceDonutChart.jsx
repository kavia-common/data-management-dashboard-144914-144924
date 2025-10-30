import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import PropTypes from 'prop-types';
import './usersCharts.css';

// PUBLIC_INTERFACE
export default function ComplianceDonutChart({ totals, items, loading, height = 260 }) {
  /** Renders a donut chart for compliance (accepted terms vs not accepted). */
  const primary = '#2563EB';
  const amber = '#F59E0B';
  const gray = '#9CA3AF';

  const data = useMemo(() => {
    if (Array.isArray(items) && items.length) {
      return items.map((it) => ({
        name: it.label,
        value: typeof it.count === 'number' ? it.count : 0,
      }));
    }
    if (totals && typeof totals.accepted === 'number' && typeof totals.totalUsers === 'number') {
      const accepted = totals.accepted;
      const notAccepted = Math.max(0, totals.totalUsers - accepted);
      return [
        { name: 'Accepted', value: accepted },
        { name: 'Not Accepted', value: notAccepted },
      ];
    }
    return [];
  }, [items, totals]);

  const COLORS = [primary, amber, gray];

  return (
    <div className="users-chart-card">
      <div className="users-chart-title">Compliance</div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              cx="50%"
              cy="50%"
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {loading && <div className="users-chart-loading">Loading…</div>}
    </div>
  );
}

ComplianceDonutChart.propTypes = {
  totals: PropTypes.object,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      count: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
  height: PropTypes.number,
};
