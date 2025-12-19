import React, { useMemo } from 'react';
import OverviewTimeControls from './OverviewTimeControls';
import OverviewKpiCards from './OverviewKpiCards';
import OverviewUsersSummarySection from './OverviewUsersSummarySection';
import ProjectsCreatedBarChart from './ProjectsCreatedBarChart';
import T0000OrgHorizontalBarChart from './T0000OrgHorizontalBarChart';
import OverviewEmptyState from './OverviewEmptyState';
import { useProjectsCreatedSummary } from '../../hooks/useProjectsCreatedSummary';
import { projectCreateT0000Series } from '../../utils/projectCreateT0000Series';
import { getOrgIdFromContext } from '../../utils/orgContext';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewContainer
 * Provides KPI cards and the Users Created summary section with filters.
 * Adds T0000-specific horizontal bar chart for /api/projects/summary.
 */
export default function OverviewContainer() {
  const { data, loading, error, orgId } = useProjectsCreatedSummary();

  const effectiveOrg = useMemo(() => orgId || getOrgIdFromContext() || '', [orgId]);
  const isT0000 = String(effectiveOrg).toUpperCase() === 'T0000';

  if (loading) {
    return <OverviewEmptyState message="Loading overview..." />;
  }
  if (error) {
    return <OverviewEmptyState message="Failed to load overview." />;
  }

  const hasData = Array.isArray(data?.buckets) && data.buckets.length > 0;

  return (
    <div className="overview-container">
      <OverviewTimeControls />
      <OverviewKpiCards />
      <OverviewUsersSummarySection />

      <div style={{ marginTop: 16 }}>
        {isT0000 ? (
          <T0000OrgHorizontalBarChart
            series={projectCreateT0000Series({
              buckets: data?.buckets || [],
              range: data?.range,
              start_date: data?.start_date,
              end_date: data?.end_date,
            })}
            title="Projects Created (T0000)"
          />
        ) : (
          hasData && <ProjectsCreatedBarChart data={data} />
        )}
      </div>
    </div>
  );
}
