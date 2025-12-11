import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import { getChartTheme } from '../charts/chartTheme';
import { buildOverviewFilterParams } from '../../api/buildOverviewFilterParams';
import { getOverviewProjectsSummary } from '../../api/overviewAnalytics';

/**
 * PUBLIC_INTERFACE
 * ProjectsCreatedBarChart
 * - Filter controls consistent with users summary: range select and custom date pickers with Apply.
 * - API behavior: always send range; send start_date and end_date ONLY when range === 'custom'.
 * - UX: loading skeleton, empty state, concise error message.
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

  const mountedRef = useRef(false);
  const theme = getChartTheme();

  const load = useCallback(async () => {
    if (!organizationId) return;
    setStatus('loading');
    setError(null);

    const params = { range };
    if (range === 'custom' && appliedStart && appliedEnd) {
      params.start_date = appliedStart;
      params.end_date = appliedEnd;
    }

    try {
      const req = buildOverviewFilterParams({ organizationId, params });
      const res = await getOverviewProjectsSummary(req);
      const list = Array.isArray(res?.buckets) ? res.buckets : [];
      if (list.length === 0) {
        setBuckets([]);
        setStatus('empty');
      } else {
        setBuckets(list);
        setStatus('success');
      }
    } catch (e) {
      setError(e?.message || 'Failed to load projects summary.');
      setStatus('error');
    }
  }, [organizationId, range, appliedStart, appliedEnd]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      load();
      return;
    }
    if (range !== 'custom') {
      setAppliedStart('');
      setAppliedEnd('');
      load();
    } else if (range === 'custom' && appliedStart && appliedEnd) {
      load();
    }
  }, [range, appliedStart, appliedEnd, load]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  const chartData = useMemo(
    () =>
      (buckets || []).map((b) => ({
        label: b.label || b.key,
        count: Number(b.count || 0),
      })),
    [buckets]
  );
  const isEmpty = status === 'empty';

  return (
    <Card style={{ marginTop: 16 }}>
      <div className="overview-users-summary__header" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Projects Created</h3>
        <div className="overview-users-summary__controls">
          <label htmlFor="projects-range" className="overview-users-summary__label">
            Range
          </label>
          <select
            id="projects-range"
            className="overview-users-summary__select"
            value={range}
            onChange={(e) => setRange(e.target.value)}
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
                  border: `1px solid ${theme.primary}`,
                  background: theme.primary,
                  color: '#fff',
                  cursor: (!pendingStart || !pendingEnd) ? 'not-allowed' : 'pointer',
                }}
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'loading' && (
        <div style={{ padding: 16, color: '#6b7280' }}>Loading…</div>
      )}
      {status === 'error' && (
        <div role="alert" style={{ padding: 16, color: '#EF4444' }}>{error}</div>
      )}
      {isEmpty && (
        <div style={{ padding: 16, color: '#6b7280' }}>No projects for the selected range.</div>
      )}

      {status === 'success' && !isEmpty && (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: theme.axisTick }}
                axisLine={{ stroke: theme.axisTick }}
                tickLine={{ stroke: theme.axisTick }}
                interval="preserveEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: theme.axisTick }}
                axisLine={{ stroke: theme.axisTick }}
                tickLine={{ stroke: theme.axisTick }}
              />
              <Tooltip
                formatter={(value) => [value, 'Projects']}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb' }}
              />
              <Bar dataKey="count" name="Projects" fill={theme.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
