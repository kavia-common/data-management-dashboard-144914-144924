import React from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

/**
// PUBLIC_INTERFACE
 * OverviewTotalProjectsChart
 * Renders line/area chart of total projects per bucket.
 */
export default function OverviewTotalProjectsChart({ data = [], loading, error, height = 320 }) {
  if (error) {
    return <div role="alert" style={{ color: '#EF4444' }}>Failed to load projects data.</div>;
  }
  if (loading) {
    return <div aria-busy="true" style={{ opacity: 0.7 }}>Loading projects…</div>;
  }
  const safe = Array.isArray(data) ? data : [];
  return (
    <div style={{
      width: '100%',
      height,
      background: '#ffffff',
      borderRadius: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      border: '1px solid #e5e7eb',
      padding: 12
    }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={safe} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35}/>
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb' }}
            formatter={(v) => [v, 'Projects']}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#2563EB"
            fillOpacity={1}
            fill="url(#colorPrimary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

OverviewTotalProjectsChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    count: PropTypes.number
  })),
  loading: PropTypes.bool,
  error: PropTypes.any,
  height: PropTypes.number
};
