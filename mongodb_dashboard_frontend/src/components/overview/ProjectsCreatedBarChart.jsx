import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import apiClient from '../../api/client';

/**
 * PUBLIC_INTERFACE
 * ProjectsCreatedBarChart
 * Fetches project create summary from GET /api/projects/summary scoped by organizationId
 * and optional range/start_date/end_date. Renders the response buckets as a bar chart.
 *
 * Response shape (per backend OpenAPI):
 * {
 *   range: string,
 *   start_date: string,
 *   end_date: string,
 *   buckets: [{ key: "YYYY-MM-DD", label: "YYYY-MM-DD", count: number }]
 * }
 *
 * Mapping to chart data:
 * - XAxis -> label (fallback to key)
 * - Bar value -> count
 */
export default function ProjectsCreatedBarChart() {
  const organizationId = useCurrentOrgId();
  const [range, setRange] = useState('daily');
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error
  const [error, setError] = useState(null);
  const [buckets, setBuckets] = useState([]);

  // Build query params minimally from current selections
  const queryParams = useMemo(() => {
    const params = {};
    if (organizationId) params.organization_id = organizationId;
    if (range) params.range = range;
    if (range === 'custom') {
      if (appliedStart) params.start_date = appliedStart;
      if (appliedEnd) params.end_date = appliedEnd;
    }
    return params;
  }, [organizationId, range, appliedStart, appliedEnd]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      // org required for tenant-scoped results
      if (!organizationId) {
        setBuckets([]);
        setStatus('empty');
        return;
      }
      if (range === 'custom' && (!appliedStart || !appliedEnd)) {
        // wait for both dates when in custom mode
        return;
      }
      setStatus('loading');
      setError(null);
      try {
        // Correct endpoint per OpenAPI: /api/projects/summary
        const resp = await apiClient.get('/api/projects/summary', {
          params: queryParams,
          // Also pass header for demo mode when JWT not present; harmless when JWT is present.
          headers: organizationId ? { 'x-organization-id': organizationId } : undefined,
        });
        if (cancelled) return;

        const incoming = Array.isArray(resp?.data?.buckets) ? resp.data.buckets : [];
        const shaped = incoming.map((b) => ({
          key: b?.key,
          label: b?.label || b?.key || '',
          count: typeof b?.count === 'number' ? b.count : Number(b?.count || 0),
        }));

        setBuckets(shaped);
        setStatus(shaped.length ? 'success' : 'empty');
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.message || e?.message || 'Failed to load projects summary.');
          setStatus('error');
          setBuckets([]);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [organizationId, queryParams, range, appliedStart, appliedEnd]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header project_created" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Projects Created</h3>
        <div className="overview-users-summary__controls">
          <label htmlFor="projects-range" className="overview-users-summary__label">
            Range
          </label>
          <select
            id="projects-range"
            className="overview-users-summary__select"
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              if (e.target.value !== 'custom') {
                setAppliedStart('');
                setAppliedEnd('');
              }
            }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>

          {range === 'custom' && (
            <>
              <label htmlFor="projects-start" className="overview-users-summary__label">
                Start
              </label>
              <input
                id="projects-start"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
              />
              <label htmlFor="projects-end" className="overview-users-summary__label">
                End
              </label>
              <input
                id="projects-end"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingEnd}
                onChange={(e) => setPendingEnd(e.target.value)}
              />
              <button
                onClick={onApplyCustom}
                disabled={!pendingStart || !pendingEnd}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #2563EB',
                  background: '#2563EB',
                  color: '#fff',
                  cursor: !pendingStart || !pendingEnd ? 'not-allowed' : 'pointer',
                }}
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'loading' && <div style={{ padding: 16, color: '#6b7280' }}>Loading…</div>}
      {status === 'error' && (
        <div role="alert" style={{ padding: 16, color: '#EF4444' }}>
          {error}
        </div>
      )}
      {status === 'empty' && (
        <div style={{ padding: 16, color: '#6b7280' }}>
          No projects for the selected range.
        </div>
      )}

      {status === 'success' && (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={buckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
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
              <Tooltip
                formatter={(value) => [value, 'Projects']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Bar dataKey="count" name="Projects" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
