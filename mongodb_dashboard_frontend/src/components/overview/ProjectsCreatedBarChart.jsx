import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from 'recharts';
import { getProjectsSummary } from '../../api/projects';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { formatDateUTC } from '../../utils/date';
import Card from '../common/Card';
import './overview.css'; // keep typography/spacing consistent with overview
import { getChartTheme } from '../charts/chartTheme';

/**
 * Utility: format Date to YYYY-MM-DD
 */
function fmtYmd(d) {
  const year = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${m}-${day}`;
}

/**
 * Get default period for "daily" today
 */
function getDefaultDates(range) {
  const today = new Date();
  const todayStr = fmtYmd(today);
  switch (range) {
    case 'daily':
      return { start_date: todayStr, end_date: todayStr };
    case 'weekly': {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      return { start_date: fmtYmd(start), end_date: fmtYmd(end) };
    }
    case 'monthly': {
      const end = new Date();
      const start = new Date();
      start.setMonth(end.getMonth() - 1);
      return { start_date: fmtYmd(start), end_date: fmtYmd(end) };
    }
    default:
      return { start_date: todayStr, end_date: todayStr };
  }
}

/**
 * PUBLIC_INTERFACE
 */
export default function ProjectsCreatedBarChart() {
  /** Projects created counts over time with range controls. */
  const organizationId = useCurrentOrgId();
  const [range, setRange] = useState('daily');
  const defaults = useMemo(() => getDefaultDates(range), [range]);
  const [startDate, setStartDate] = useState(defaults.start_date);
  const [endDate, setEndDate] = useState(defaults.end_date);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [buckets, setBuckets] = useState([]);

  // Keep custom dates in sync when switching range (but preserve if custom)
  useEffect(() => {
    if (range !== 'custom') {
      const d = getDefaultDates(range);
      setStartDate(d.start_date);
      setEndDate(d.end_date);
    }
  }, [range]);

  const fetchData = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        organization_id: organizationId,
        range,
      };
      // Only include start/end for custom range
      if (range === 'custom') {
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
      }

      const data = await getProjectsSummary(params);
      setBuckets(Array.isArray(data?.buckets) ? data.buckets : []);
    } catch (e) {
      setError(e?.message || 'Failed to load projects summary');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, range]);

  const onApplyCustom = () => {
    if (range === 'custom') {
      fetchData({ force: true });
    }
  };

  const chartData = useMemo(() => {
    return (buckets || []).map((b) => ({
      label: b.label || b.key,
      count: b.count || 0,
    }));
  }, [buckets]);

  const isEmpty = !loading && !error && (!chartData || chartData.length === 0);

  return (
    <Card style={{ marginTop: 16 }}>
      <div className="overview-section-header" style={{ marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Projects Created</h3>
          <p style={{ margin: '4px 0 0', color: '#6b7280' }}>
            Number of projects created over time
          </p>
        </div>

        <div className="overview-time-controls" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            aria-label="Time range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              background: '#fff',
            }}
          >
            <option value="daily">Daily (Today)</option>
            <option value="weekly">Last 7 days</option>
            <option value="monthly">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>

          {range === 'custom' && (
            <>
              <input
                type="date"
                aria-label="Start date"
                value={startDate || ''}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                }}
              />
              <span style={{ color: '#6b7280' }}>to</span>
              <input
                type="date"
                aria-label="End date"
                value={endDate || ''}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                }}
              />
              <button
                onClick={onApplyCustom}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid ' + getChartTheme().primary,
                  background: getChartTheme().primary,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 16, color: '#6b7280' }}>Loading projects summary…</div>
      )}
      {error && (
        <div style={{ padding: 16, color: '#EF4444' }}>Error: {String(error)}</div>
      )}
      {isEmpty && (
        <div style={{ padding: 16, color: '#6b7280' }}>No data available for the selected range.</div>
      )}

      {!loading && !error && !isEmpty && (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={getChartTheme().grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: getChartTheme().axisTick }}
                axisLine={{ stroke: getChartTheme().axisTick }}
                tickLine={{ stroke: getChartTheme().axisTick }}
                interval="preserveEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: getChartTheme().axisTick }}
                axisLine={{ stroke: getChartTheme().axisTick }}
                tickLine={{ stroke: getChartTheme().axisTick }}
              />
              <Tooltip
                formatter={(value) => [value, 'Projects']}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb' }}
              />
              <Bar dataKey="count" name="Projects" fill={getChartTheme().primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ marginTop: 8, color: '#9CA3AF', fontSize: 12 }}>
        Range: {range}
        {range === 'custom'
          ? ` (${startDate || '-'} to ${endDate || '-'})`
          : ` (${formatDateUTC(new Date(startDate))} to ${formatDateUTC(new Date(endDate))})`}
      </div>
    </Card>
  );
}
