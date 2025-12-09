import React from 'react';
import '../charts/ActiveUsersTrendChart.css';
import { rangeSelectorClasses } from '../charts';

/**
 * PUBLIC_INTERFACE
 * OverviewTimeControls
 * Themed range selector with optional custom date range.
 * Props:
 *  - range: 'daily'|'weekly'|'monthly'|'custom'
 *  - onChangeRange: (key) => void
 *  - customRange?: { start?: string, end?: string }
 *  - onChangeCustom?: (next) => void
 */
export default function OverviewTimeControls({ range, onChangeRange, customRange, onChangeCustom }) {
  return (
    <div className={rangeSelectorClasses.container} style={{ marginBottom: 8 }}>
      {['daily', 'weekly', 'monthly', 'custom'].map(key => (
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

      {range === 'custom' && (
        <div className="date-picker" role="group" aria-label="Custom date range">
          <input
            type="date"
            value={customRange?.start || ''}
            onChange={(e) => onChangeCustom?.({ ...customRange, start: e.target.value })}
            aria-label="Start date"
          />
          <span style={{ color: 'rgba(17,24,39,0.55)', fontSize: 12 }}>to</span>
          <input
            type="date"
            value={customRange?.end || ''}
            onChange={(e) => onChangeCustom?.({ ...customRange, end: e.target.value })}
            aria-label="End date"
          />
        </div>
      )}
    </div>
  );
}
