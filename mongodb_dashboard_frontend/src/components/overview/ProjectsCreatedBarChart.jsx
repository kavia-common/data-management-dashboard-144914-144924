import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { buildOverviewFilterParams } from '../../api/buildOverviewFilterParams';
import apiClient from '../../api/client';
import UsersSummaryBarChart from '../charts/UsersSummaryBarChart';

/**
 * PUBLIC_INTERFACE
 * ProjectsCreatedBarChart
 * Displays count of projects created over time using /api/projects/summary.
 * Props:
 * - range: 'daily' | 'weekly' | 'monthly' | 'custom'
 * - startDate, endDate: YYYY-MM-DD (required for custom)
 * - organizationId: optional override
 * - className: optional
 */
export default function ProjectsCreatedBarChart({
  range = 'daily',
  startDate,
  endDate,
  organizationId,
  className = '',
}) {
  const currentOrgId = useCurrentOrgId(organizationId);

  const queryParams = useMemo(() => {
    const base = { range };
    if (range === 'custom') {
      if (startDate) base.start_date = startDate;
      if (endDate) base.end_date = endDate;
    }
    if (currentOrgId) base.organization_id = currentOrgId;
    return base;
  }, [range, startDate, endDate, currentOrgId]);

  const { url, params } = useMemo(() => {
    const u = '/api/projects/summary';
    const p = buildOverviewFilterParams(queryParams);
    return { url: u, params: p };
  }, [queryParams]);

  const fetcher = async () => {
    const response = await apiClient.get(url, { params });
    return response?.data || { buckets: [] };
  };

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
      controls={{ range, startDate, endDate }}
      testId="projects-created-bar-chart"
    />
  );
}

ProjectsCreatedBarChart.propTypes = {
  range: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  organizationId: PropTypes.string,
  className: PropTypes.string,
};
