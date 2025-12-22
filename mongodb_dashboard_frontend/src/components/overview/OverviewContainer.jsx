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
 * Preserves all existing overview sections and charts.
 * Appends a T0000-specific horizontal bar chart panel when organization_id === 'T0000' and data exists.
 * Does not alter styling, props, or behavior of existing charts. Keeps single in-flight request behavior.
 */
export default function OverviewContainer() {
  // Use the existing hook to fetch overview projects summary.
  // This hook is assumed to handle request lifecycles correctly (single in-flight, abort on unmount).
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

  // Build series for T0000 chart only when org is T0000 and source data available.
  const t0000Series = useMemo(() => {
    if (!isT0000 || !hasData) return [];
    return projectCreateT0000Series({
      buckets: data?.buckets || [],
      range: data?.range,
      start_date: data?.start_date,
      end_date: data?.end_date,
    });
  }, [isT0000, hasData, data]);

  return (
    <div className="overview-container">
      {/* Preserve all original panels/sections in the same order */}
      <OverviewTimeControls />
      <OverviewKpiCards />
      <OverviewUsersSummarySection />

      {/* Keep existing projects created chart unchanged for all orgs */}
      {hasData && (
        <div style={{ marginTop: 16 }}>
          <ProjectsCreatedBarChart data={data} />
        </div>
      )}

      {/* Append-only: T0000 horizontal bar chart as its own panel, conditionally rendered */}
      {isT0000 && Array.isArray(t0000Series) && t0000Series.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <T0000OrgHorizontalBarChart series={t0000Series} title="Projects Created (T0000)" />
        </div>
      )}
    </div>
  );
}
