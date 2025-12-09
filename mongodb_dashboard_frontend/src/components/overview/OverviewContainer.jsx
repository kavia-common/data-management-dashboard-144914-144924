import React from 'react';
import OverviewTimeControls from './OverviewTimeControls';
import OverviewKpiCards from './OverviewKpiCards';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewContainer (simplified)
 * Provides time controls and KPI cards only. Trend charts removed.
 */
export default function OverviewContainer() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <OverviewTimeControls />
      <OverviewKpiCards />
    </div>
  );
}
