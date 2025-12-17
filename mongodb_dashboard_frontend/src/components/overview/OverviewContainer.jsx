import React from 'react';
import OverviewTimeControls from './OverviewTimeControls';
import OverviewKpiCards from './OverviewKpiCards';
import OverviewUsersSummarySection from './OverviewUsersSummarySection';
import SessionCreatedBarChart from './sessionCreatedBarChart';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewContainer
 * Provides KPI cards and the Users Created summary section with filters.
 */
export default function OverviewContainer() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <OverviewTimeControls />
      <OverviewKpiCards />
      <OverviewUsersSummarySection />
      <div style={{ marginTop: 16 }}>
        <SessionCreatedBarChart />
      </div>
    </div>
  );
}
