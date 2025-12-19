import React from 'react';
import PropTypes from 'prop-types';
import './overview.css';
import getOceanColors from '../../theme/colors';

/**
 * PUBLIC_INTERFACE
 * T0000OrgHorizontalBarChart
 * Renders a simple horizontal bar chart using divs to avoid external deps; styled to match theme.
 */
export default function T0000OrgHorizontalBarChart({ series, title = 'Projects Created' }) {
  const colorTokens = getOceanColors() || {};
  const colors = { primary: colorTokens.primary || '#2563EB', secondary: colorTokens.secondary || '#F59E0B' };
  const labels = Array.isArray(series?.labels) ? series.labels : [];
  const data = Array.isArray(series?.datasets?.[0]?.data) ? series.datasets[0].data : [];

  if (!labels.length || !data.length) {
    return (
      <div className="card surface p-3">
        <div className="card-title">{title}</div>
        <div className="muted">No data available</div>
      </div>
    );
  }

  const max = Math.max(...data, 1);

  return (
    <div className="card surface p-3">
      <div className="card-title">{title}</div>
      <div className="t0000-hbar-container">
        {labels.map((label, idx) => {
          const value = Number.isFinite(data[idx]) ? data[idx] : 0;
          const widthPct = Math.max(2, (value / max) * 100);
          return (
            <div key={`${label}-${idx}`} className="t0000-hbar-row">
              <div className="t0000-hbar-label">{label}</div>
              <div className="t0000-hbar-barwrap">
                <div
                  className="t0000-hbar-bar"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: colors.primary,
                  }}
                  aria-label={`${label}: ${value}`}
                  role="img"
                />
              </div>
              <div className="t0000-hbar-value">{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

T0000OrgHorizontalBarChart.propTypes = {
  series: PropTypes.shape({
    labels: PropTypes.arrayOf(PropTypes.string),
    datasets: PropTypes.arrayOf(
      PropTypes.shape({
        data: PropTypes.arrayOf(PropTypes.number),
      })
    ),
  }),
  title: PropTypes.string,
};
