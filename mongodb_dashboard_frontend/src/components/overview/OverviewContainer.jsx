import React from 'react';
import './overview.css';
import {
  OverviewKpiCountCards,
  OverviewUsersSummarySection,
  ProjectsServiceTypeBarChart,
  ProjectsCreatedBarChart,
} from './index';

/**
 * PUBLIC_INTERFACE
 * OverviewContainer
 * Composes the Overview dashboard sections in order:
 * - KPI Count Cards
 * - Users Summary Section
 * - Sessions by Service Type (anchor: className="service_type_created_chart")
 * - Projects Created Bar Chart (exactly once, immediately after the service_type_created_chart)
 */
export default function OverviewContainer() {
  return (
    <div className="overview-container" style={{ width: '100%' }}>
      {/* KPI count cards - relies on internal fetch; backgrounds use default styles */}
      <section aria-label="Overview KPI Totals">
        <OverviewKpiCountCards />
      </section>

      {/* Users summary section */}
      <section aria-label="Users Summary">
        <OverviewUsersSummarySection />
      </section>

      {/* Sessions by Service Type */}
      <section aria-label="Sessions by Service Type" className="service_type_created_chart">
        <ProjectsServiceTypeBarChart />
      </section>

      {/* Exactly one Projects Created Bar Chart below the service_type_created_chart section */}
      <section aria-label="Projects Created" className="projects_created_chart" style={{ marginTop: 16 }}>
        <ProjectsCreatedBarChart />
      </section>
    </div>
  );
}
