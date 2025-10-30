import React from 'react';
import PropTypes from 'prop-types';
import './usersCharts.css';

// PUBLIC_INTERFACE
export default function KpiCards({ kpis = {}, period = 'daily', loading }) {
  /** Renders KPI cards; expects shape similar to users KPIs endpoint. */
  const primary = '#2563EB';
  const amber = '#F59E0B';

  const cards = [
    { key: 'activeUsers', label: `${capitalize(period)} Active Users`, color: primary },
    { key: 'newUsers', label: 'New Users', color: amber },
    { key: 'returningUsers', label: 'Returning Users', color: '#10B981' },
    { key: 'avgSessionsPerUser', label: 'Avg Sessions/User', color: '#8B5CF6' },
  ];

  const totals = kpis?.totals || {};

  return (
    <div className="kpi-grid">
      {cards.map((c) => (
        <div key={c.key} className="kpi-card">
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value" style={{ color: c.color }}>
            {formatValue(totals[c.key])}
          </div>
        </div>
      ))}
      {loading && <div className="users-chart-loading" style={{ gridColumn: '1 / -1' }}>Loading KPIs…</div>}
    </div>
  );
}

function formatValue(val) {
  if (val == null) return '—';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  }
  return String(val);
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

KpiCards.propTypes = {
  kpis: PropTypes.object,
  period: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'summary']),
  loading: PropTypes.bool,
};
