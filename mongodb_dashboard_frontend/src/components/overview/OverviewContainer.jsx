import React, { useEffect, useMemo, useRef, useState } from 'react';
import OverviewTimeControls from './OverviewTimeControls';
import OverviewKpiCards from './OverviewKpiCards';
import OverviewUsersSummarySection from './OverviewUsersSummarySection';
import ProjectsCreatedBarChart from './ProjectsCreatedBarChart';
import T0000OrgHorizontalBarChart from './T0000OrgHorizontalBarChart';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { fetchProjectCreateSummary } from '../../services/projectCreateSummaryApi';
import { shapeT0000ProjectCreateSeries } from '../../utils/projectCreateT0000Series';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewContainer
 * Provides KPI cards and the Users Created summary section with filters.
 * Adds T0000-specific horizontal bar chart for api/project-create/summary.
 */
export default function OverviewContainer() {
  const organizationId = useCurrentOrgId();

  // Minimal fetch wiring for T0000 horizontal chart
  const [t0000Loading, setT0000Loading] = useState(false);
  const [t0000Error, setT0000Error] = useState('');
  const [t0000Series, setT0000Series] = useState([]);
  const abortRef = useRef(null);

  const isT0000 = useMemo(
    () => String(organizationId || '').toUpperCase() === 'T0000',
    [organizationId]
  );

  useEffect(() => {
    if (!isT0000) return;

    // cancel in-flight
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setT0000Loading(true);
    setT0000Error('');
    // Default: daily range window (matches ProjectsCreatedBarChart defaults)
    fetchProjectCreateSummary(
      { organization_id: organizationId, range: 'daily' },
      { signal: controller.signal }
    )
      .then((resp) => {
        const buckets = resp?.buckets || [];
        const series = shapeT0000ProjectCreateSeries(buckets, organizationId);
        setT0000Series(series);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setT0000Error(err?.message || 'Failed to load project-create summary');
      })
      .finally(() => setT0000Loading(false));

    return () => controller.abort();
  }, [isT0000, organizationId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <OverviewTimeControls />
      <OverviewKpiCards />
      <OverviewUsersSummarySection />

      <div style={{ marginTop: 16 }}>
        {isT0000 ? (
          <T0000OrgHorizontalBarChart
            data={t0000Series}
            loading={t0000Loading}
            error={t0000Error}
            title="Projects Created by Organization"
            height={320}
          />
        ) : (
          <ProjectsCreatedBarChart />
        )}
      </div>
    </div>
  );
}
