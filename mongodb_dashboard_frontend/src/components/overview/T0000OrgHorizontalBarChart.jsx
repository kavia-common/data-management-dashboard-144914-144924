import React from 'react';
import PropTypes from 'prop-types';

/**
 * PUBLIC_INTERFACE
 * T0000OrgHorizontalBarChart
 * Simple horizontal bar chart for T0000 series: [{ name, value }]
 */
// PUBLIC_INTERFACE
export default function T0000OrgHorizontalBarChart({ series, title = 'Organization Projects (T0000)' }) {
  if (!Array.isArray(series) || series.length === 0) return null;

  const max = Math.max(...series.map((d) => (Number.isFinite(d.value) ? d.value : 0)), 1);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-header" style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div className="card-body">
        {series.map((d) => {
          const val = Number.isFinite(d.value) ? d.value : 0;
          const widthPct = Math.min(100, Math.max(4, (val / max) * 100));
          return (
            <div key={d.name} className="bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="label" style={{ minWidth: 140, fontWeight: 600 }}>{d.name}</span>
              <div style={{ flex: 1, background: '#e5e7eb', height: 8, borderRadius: 4, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: 8, borderRadius: 4, width: `${widthPct}%`, background: '#2563EB' }} />
              </div>
              <span className="value" style={{ minWidth: 40, textAlign: 'right' }}>{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

T0000OrgHorizontalBarChart.propTypes = {
  series: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    })
  ),
  title: PropTypes.string,
};
