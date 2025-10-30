import React from 'react';
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

const COLORS = ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6', '#F43F5E', '#0EA5E9', '#84CC16'];

// PUBLIC_INTERFACE
export default function UsersOrganizationPieChart({ data, loading, height = 260 }) {
  /** Renders a pie chart of active users by organization. */
  const processed = Array.isArray(data)
    ? data.map((d) => ({
        name: d.label || 'Unknown',
        value: typeof d.count === 'number' ? d.count : 0,
      }))
    : [];

  return (
    <div className="users-chart-card">
      <div className="users-chart-title">Users by Organization</div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={processed}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label
            >
              {processed.map((entry, index) => (
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

UsersOrganizationPieChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      count: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
  height: PropTypes.number,
};
