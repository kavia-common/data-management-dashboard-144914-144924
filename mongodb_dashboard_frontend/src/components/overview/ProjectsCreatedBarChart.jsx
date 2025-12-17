import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import apiClient from '../../api/client';

/**
 * PUBLIC_INTERFACE
 * ProjectsCreatedBarChart
 * Fetches project create summary from GET /api/project-create/summary scoped by organizationId
 * and optional range/start_date/end_date. Renders the response buckets as a bar chart.
 *
 * Backend response shape (OpenAPI-aligned):
 * {
 *   range: string,
 *   start_date: string,
 *   end_date: string,
 *   buckets: [{ key: "YYYY-MM-DD", label: "YYYY-MM-DD", count: number }]
 * }
 *
 * Mapping to chart data expected by recharts:
 * - Input buckets[] -> [{ name: label || key, value: count, color }]
 * - Bar dataKey -> "value"
 * - XAxis dataKey -> "name"
 */

// Style guide primary color
const PRIMARY_COLOR = '#2563EB';
const DEFAULT_COLOR = PRIMARY_COLOR;

// Loading and error UI
const LoadingState = () => (
  <div style={{ padding: 16, color: '#6b7280' }}>Loading…</div>
);

const ErrorState = ({ message }) => (
  <div role="alert" style={{ padding: 16, color: '#EF4444' }}>
    {message || 'Failed to load projects summary.'}
  </div>
);

// Custom tooltip showing project name and count, tinted with the same bar color
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const d = payload[0];
    const color = d?.payload?.color || DEFAULT_COLOR;
    const name = d?.payload?.name ?? label;
    const value = d?.payload?.value ?? d?.value;

    return (
      <div
        style={{
          background: '#fff',
          border: `1px solid ${color}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          padding: '8px 10px',
          color: '#111827',
          minWidth: 160,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: color,
              marginRight: 8,
            }}
          />
          <strong style={{ color }}>{name}</strong>
        </div>
        <div style={{ fontSize: 12 }}>
          <div>
            <span style={{ color: '#6B7280' }}>Project: </span>
            <span style={{ color }}>{name}</span>
          </div>
          <div>
            <span style={{ color: '#6B7280' }}>Count: </span>
            <span style={{ color }}>{value}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Hook to fetch and map data
function useProjectsCreatedData(filters) {
  const organizationId = useCurrentOrgId();
  const [state, setState] = useState({ status: 'idle', error: null, data: [] });

  // Build query params from filters and org context
  const queryParams = useMemo(() => {
    const params = { ...(filters || {}) };
    const effectiveOrg =
      organizationId ||
      filters?.organizationId ||
      filters?.organization_id ||
      filters?.tenant_id;

    if (effectiveOrg) {
      params.organization_id = effectiveOrg;
      params.organizationId = effectiveOrg;
      params.tenant_id = effectiveOrg;
    }

    // Normalize any date/range params if present in filters
    if (filters?.range) params.range = filters.range;
    if (filters?.start_date) params.start_date = filters.start_date;
    if (filters?.end_date) params.end_date = filters.end_date;

    return params;
  }, [organizationId, filters]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      // If no tenant available, treat as empty
      if (!queryParams.organization_id && !queryParams.organizationId && !queryParams.tenant_id) {
        setState({ status: 'empty', error: null, data: [] });
        return;
      }

      setState((s) => ({ ...s, status: 'loading', error: null }));

      try {
        // Correct endpoint per request: GET /api/project-create/summary
        const resp = await apiClient.get('/project-create/summary', {
          params: queryParams,
          headers: (organizationId || queryParams.organization_id)
            ? { 'x-organization-id': organizationId || queryParams.organization_id }
            : undefined,
        });

        if (cancelled) return;

        // Expected buckets: [{ key, label, count }]
        const buckets = Array.isArray(resp?.data?.buckets)
          ? resp.data.buckets
          : Array.isArray(resp?.data?.items)
          ? resp.data.items
          : [];

        // Map to recharts data: [{ name, value, color }]
        const data = buckets.map((b) => ({
          name: b?.label || b?.key || '',
          value: typeof b?.count === 'number' ? b.count : Number(b?.count || 0),
          color: b?.color || DEFAULT_COLOR,
        }));

        setState({ status: data.length ? 'success' : 'empty', error: null, data });
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            error: e?.response?.data?.message || e?.message || 'Failed to load projects summary.',
            data: [],
          });
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [queryParams, organizationId]);

  return state;
}

export default function ProjectsCreatedBarChart(props) {
  const {
    title = 'Projects Created',
    height = 280,
    filters = {}, // expected filters include range/start_date/end_date etc.
  } = props;

  const { status, error, data } = useProjectsCreatedData(filters);

  // If any datum doesn't include its own color, we fallback to the style guide primary
  const fallbackBarColor = PRIMARY_COLOR;

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header project_created" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">{title}</h3>
      </div>

      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState message={error} />}
      {status === 'empty' && (
        <div style={{ padding: 16, color: '#6b7280' }}>
          No projects for the selected range.
        </div>
      )}

      {status === 'success' && (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#1f2937' }}
                axisLine={{ stroke: '#9ca3af' }}
                tickLine={{ stroke: '#9ca3af' }}
                interval="preserveEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#1f2937' }}
                axisLine={{ stroke: '#9ca3af' }}
                tickLine={{ stroke: '#9ca3af' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Projects" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || fallbackBarColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
