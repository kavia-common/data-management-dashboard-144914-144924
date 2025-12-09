import React from 'react';
import '../charts/ActiveUsersTrendChart.css';
import { rangeSelectorClasses } from '../charts';

/**
 * PUBLIC_INTERFACE
 * OverviewChartFilters
 * Simple Daily/Weekly/Monthly chips for charts that don't need custom range.
 * Props:
 *  - range: 'daily'|'weekly'|'monthly'
 *  - onChangeRange: (key) => void
 */
export default function OverviewChartFilters({ range, onChangeRange }) {
  return (
    <div className={rangeSelectorClasses.container}>
      {['daily', 'weekly', 'monthly'].map(key => (
        <button
          key={key}
          type="button"
          className={`${rangeSelectorClasses.chip} ${range === key ? rangeSelectorClasses.chipActive : ''}`}
          onClick={() => onChangeRange?.(key)}
          aria-pressed={range === key}
        >
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </button>
      ))}
    </div>
  );
}
