import React, { useMemo, useEffect } from 'react';
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
 * Preserves all existing overview sections and charts, adds Ocean theme background utility.
 * Appends T0000-specific chart when organization_id is 'T0000'.
 */
export default function OverviewContainer() {
  // Hooks at top-level
  const { data, loading, error, organization_id, t0000Series: hookSeries } = useProjectsCreatedSummary();

  const effectiveOrg = useMemo(
    () => (organization_id || getOrgIdFromContext() || '').toString(),
    [organization_id]
  );
  const isT0000 = useMemo(() => String(effectiveOrg).toUpperCase() === 'T0000', [effectiveOrg]);

  const t0000Series = useMemo(() => {
    if (!isT0000) return [];
    if (Array.isArray(hookSeries)) return hookSeries;
    return projectCreateT0000Series(data?.buckets || []);
  }, [isT0000, hookSeries, data]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.debug('[OverviewContainer] mount', { org: effectiveOrg || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.debug('[OverviewContainer] state', {
      org: effectiveOrg,
      loading,
      hasError: !!error,
      buckets: Array.isArray(data?.buckets) ? data.buckets.length : 0,
      t0000SeriesLen: Array.isArray(hookSeries) ? hookSeries.length : 0,
    });
  }

  const chartArea = useMemo(() => {
    if (loading) return <OverviewEmptyState message="Loading overview..." />;
    if (error)
      return (
        <>
          {process.env.NODE_ENV !== 'test' && console && console.debug
            ? // eslint-disable-next-line no-console
              console.debug('[OverviewContainer] fetch error', { organization_id: effectiveOrg, error: String(error) })
            : null}
          <OverviewEmptyState message="Failed to load overview." />
        </>
      );

    const tChart = isT0000 ? (
      <div style={{ marginTop: 24 }}>
        {Array.isArray(t0000Series) && t0000Series.length > 0 ? (
          <T0000OrgHorizontalBarChart series={t0000Series} title="Projects Created (T0000)" />
        ) : (
          <div>
            <T0000OrgHorizontalBarChart series={[]} title="Projects Created (T0000)" />
            <OverviewEmptyState message="No data yet" />
          </div>
        )}
      </div>
    ) : null;

    return (
      <>
        <div style={{ marginTop: 16 }}>
          <ProjectsCreatedBarChart />
        </div>
        {tChart}
      </>
    );
  }, [loading, error, effectiveOrg, isT0000, t0000Series]);

  return (
    <div className="overview-container ocean-background">
      <OverviewTimeControls />
      <OverviewKpiCards />
      <OverviewUsersSummarySection />
      {chartArea}
    </div>
  );
}
