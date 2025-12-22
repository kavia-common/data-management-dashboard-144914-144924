import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * PUBLIC_INTERFACE
 * T0000OrgHorizontalBarChart
 * Simple horizontal bar chart for T0000 series: [{ name, value }]
 * Defensive: accepts empty series and renders a minimal empty pane.
 */
// PUBLIC_INTERFACE
export default function T0000OrgHorizontalBarChart({ series = [], title = 'Organization Projects (T0000)' }) {
  const safeSeries = Array.isArray(series) ? series : [];
  const hasSeries = safeSeries.length > 0;

  const max = useMemo(
    () => Math.max(...safeSeries.map((d) => (Number.isFinite(d.value) ? d.value : 0)), 1),
    [safeSeries]
  );

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.debug('[T0000OrgHorizontalBarChart] render', { items: safeSeries.length });
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="card-header" style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div className="card-body">
        {hasSeries ? (
          safeSeries.map((d) => {
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
          })
        ) : (
          <div style={{ color: '#6b7280', fontSize: 14 }}>No data yet</div>
        )}
      </div>
    </div>
  );
}

T0000OrgHorizontalBarChart.propTypes = {
  series: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      value: PropTypes.number,
    })
  ),
  title: PropTypes.string,
};
