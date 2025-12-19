import React from 'react';
import { useProjectsCreatedSummary } from '../hooks/useProjectsCreatedSummary';
import T0000OrgHorizontalBarChart from '../components/overview/T0000OrgHorizontalBarChart';
import ProjectsCreatedBarChart from '../components/overview/ProjectsCreatedBarChart';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * Overview
 * Conditionally renders T0000 horizontal bar chart when organization_id === 'T0000', else default chart.
 */
// PUBLIC_INTERFACE
export default function Overview() {
  const organization_id = getOrgIdFromContext();
  const { data, loading, error } = useProjectsCreatedSummary({ organization_id });

  if (error) {
    return <div role="alert">Failed to load overview</div>;
  }

  return (
    <div className="overview-page">
      {organization_id === 'T0000' ? (
        <T0000OrgHorizontalBarChart data={data} loading={loading} />
      ) : (
        <ProjectsCreatedBarChart data={data} loading={loading} />
      )}
    </div>
  );
}
