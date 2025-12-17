import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { buildOverviewFilterParams } from '../../api/buildOverviewFilterParams';
import apiClient from '../../api/client';
import UsersSummaryBarChart from '../charts/UsersSummaryBarChart';

/**
 * PUBLIC_INTERFACE
 * ProjectCreatedBarChart
 * A bar chart component showing the number of projects created over time.
 * Mirrors the behavior and styling of the existing SessionCreatedBarChart.
 *
 * Props:
 * - range: 'daily' | 'weekly' | 'monthly' | 'custom' (default 'daily')
 * - startDate: string YYYY-MM-DD (required for range='custom')
 * - endDate: string YYYY-MM-DD (required for range='custom')
 * - organizationId: optional explicit tenant override; falls back to context or URL query per hook behavior
 * - className: optional additional className
 */
export default function ProjectCreatedBarChart({
  range = 'daily',
  startDate,
  endDate,
  organizationId,
  className = '',
}) {
  const currentOrgId = useCurrentOrgId(organizationId);

  const queryParams = useMemo(() => {
    const base = {
      range,
    };
    if (range === 'custom') {
      if (startDate) base.start_date = startDate;
      if (endDate) base.end_date = endDate;
    }
    // Consistent tenant param naming: use organization_id like Users summary chart does
    if (currentOrgId) {
      base.organization_id = currentOrgId;
    }
    return base;
  }, [range, startDate, endDate, currentOrgId]);

  const { url, params } = useMemo(() => {
    const u = '/api/project-create/summary';
    const p = buildOverviewFilterParams(queryParams);
    return { url: u, params: p };
  }, [queryParams]);

  // Data fetching via apiClient directly; UsersSummaryBarChart accepts a fetcher that returns { buckets: [...] }
  const fetcher = async () => {
    const response = await apiClient.get(url, { params });
    // Expecting schema: { range, start_date, end_date, buckets: [{ key, label, count }] }
    return response?.data || { buckets: [] };
  };

  // Title and tooltip should mirror the session created chart pattern
  const title = 'Projects Created';
  const tooltipFormatter = (bucket) => `${bucket?.label ?? bucket?.key}: ${bucket?.count ?? 0}`;

  return (
    <UsersSummaryBarChart
      title={title}
      className={className}
      fetcher={fetcher}
      valueKey="count"
      labelKey="label"
      tooltipFormatter={tooltipFormatter}
      emptyMessage="No projects created in the selected period."
      // Forward common controls if the underlying chart supports them
      controls={{
        range,
        startDate,
        endDate,
      }}
      testId="projects-created-bar-chart"
    />
  );
}

ProjectCreatedBarChart.propTypes = {
  range: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  organizationId: PropTypes.string,
  className: PropTypes.string,
};
