import React from 'react';
import OverviewTimeControls from './OverviewTimeControls';
import OverviewKpiCards from './OverviewKpiCards';
import OverviewUsersSummarySection from './OverviewUsersSummarySection';
import ProjectsServiceTypeBarChart from './ProjectsServiceTypeBarChart';
import SessionCreatedBarChart from './sessionCreatedBarChart';
import ProjectCreatedBarChart from './projectCreatedBarChart';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewContainer
 * Provides KPI cards and the Users Created summary section with filters.
 */
export default function OverviewContainer() {
  return (
    <div className="overview_container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <OverviewTimeControls />
      <OverviewKpiCards />
      <OverviewUsersSummarySection />

      {/* service type bar chart section */}
      <section className="service_type_created_chart" style={{ marginTop: 16 }}>
        <ProjectsServiceTypeBarChart />
      </section>

      {/* Inserted: ProjectCreatedBarChart immediately after service_type_created_chart */}
      <section className="project_created_chart" style={{ marginTop: 16 }}>
        <ProjectCreatedBarChart />
      </section>

      <section className="session_created_chart" style={{ marginTop: 16 }}>
        <SessionCreatedBarChart />
      </section>
    </div>
  );
}
