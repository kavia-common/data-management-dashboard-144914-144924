import React from 'react';
import { useTheme } from '../../theme';
import './UsersSummaryBarChart.css';

/**
 * PUBLIC_INTERFACE
 * UsersSummaryBarChart
 * Renders a responsive bar chart for users summary buckets.
 * props:
 *  - buckets: Array<{ key: string, label: string, count: number, start?: string, end?: string }>
 *  - title?: string
 *  - loading?: boolean
 *  - error?: Error|null
 *  - emptyMessage?: string
 */
export default function UsersSummaryBarChart({ buckets = [], title = 'Users Created', loading = false, error = null, emptyMessage = 'No data for selected range.' }) {
  const theme = useTheme?.() || {};
  const primary = theme?.colors?.primary || '#2563EB';
  const secondary = theme?.colors?.secondary || '#F59E0B';
  const textColor = theme?.colors?.text || '#111827';
  const surface = theme?.colors?.surface || '#ffffff';

  if (loading) {
    return (
      <div className="users-summary-chart" style={{ background: surface }}>
        <div className="usc-header">
          <h3>{title}</h3>
        </div>
        <div className="usc-state">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="users-summary-chart" style={{ background: surface }}>
        <div className="usc-header">
          <h3>{title}</h3>
        </div>
        <div className="usc-state usc-error">Error loading data</div>
      </div>
    );
  }

  if (!buckets || buckets.length === 0) {
    return (
      <div className="users-summary-chart" style={{ background: surface }}>
        <div className="usc-header">
          <h3>{title}</h3>
        </div>
        <div className="usc-state">{emptyMessage}</div>
      </div>
    );
  }

  const maxCount = Math.max(...buckets.map(b => b.count || 0), 0);

  return (
    <div className="users-summary-chart" style={{ background: surface }}>
      <div className="usc-header">
        <h3>{title}</h3>
      </div>
      <div className="usc-chart-area">
        {buckets.map((b, idx) => {
          const heightPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
          const toolTip = `${b.label}: ${b.count}${b.start && b.end ? ` (${b.start} – ${b.end})` : ''}`;
          return (
            <div key={b.key || `${b.label}-${idx}`} className="usc-bar">
              <div
                className="usc-bar-inner"
                title={toolTip}
                style={{
                  height: `${heightPct}%`,
                  background: `linear-gradient(180deg, ${primary} 0%, ${secondary} 100%)`,
                }}
                aria-label={toolTip}
                role="img"
              />
              <div className="usc-bar-label" title={b.label} aria-hidden>
                {b.label}
              </div>
              <div className="usc-bar-count" style={{ color: textColor }}>
                {b.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
