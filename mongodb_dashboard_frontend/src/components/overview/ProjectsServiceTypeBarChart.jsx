import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
} from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import { getChartTheme } from '../charts/chartTheme';
import { apiGet } from '../../utils/api';
import { getCategoryColorMap } from '../../theme/oceanTheme';

/**
 * PUBLIC_INTERFACE
 * ProjectsServiceTypeBarChart
 * Renders a stacked bar chart of sessions grouped by service type across labels (time buckets),
 * calling GET /api/service-type/summary with organizationId, range, and optional start/end when range=custom.
 * Accepts optional organizationId prop, otherwise derives from app context.
 * Handles API responses with { labels, series } primarily, and falls back to summaryByServiceType when needed.
 */
export default function ProjectsServiceTypeBarChart({
  organizationId: organizationIdProp,
  defaultRange = 'daily',
}) {
  const derivedOrgId = useCurrentOrgId();
  const organizationId = organizationIdProp || derivedOrgId;

  const [range, setRange] = useState(defaultRange || 'daily');
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error
  const [error, setError] = useState(null);

  // Primary shape from API
  const [labels, setLabels] = useState([]); // ['2025-01-01', ...] or display labels
  const [series, setSeries] = useState([]); // [{ name: 'chat', data: [1,2,3] }, ...]

  const theme = getChartTheme
    ? getChartTheme()
    : {
        primary: '#2563EB',
        grid: '#e5e7eb',
        label: '#374151',
        axisTick: '#9ca3af',
        palette: ['#2563EB', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#F43F5E', '#0EA5E9'],
      };

  const debounceRef = useRef(null);
  const mountedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setStatus('loading');
    setError(null);

    const params = new URLSearchParams();
    params.set('range', range || 'daily');
    if (range === 'custom' && appliedStart && appliedEnd) {
      params.set('start_date', appliedStart);
      params.set('end_date', appliedEnd);
    }
    params.set('organization_id', organizationId);

    try {
      const res = await apiGet(`/service-type/summary?${params.toString()}`, {
        organization_id: organizationId,
      });

      // Preferred: { labels: [...], series: [{ name, data: [...] }] }
      let nextLabels = Array.isArray(res?.labels) ? res.labels : null;
      let nextSeries = Array.isArray(res?.series) ? res.series : null;

      // Fallback: summaryByServiceType [{ service_type, buckets:[{label,count}]}]
      if ((!nextLabels || !nextSeries) && Array.isArray(res?.summaryByServiceType)) {
        const byType = res.summaryByServiceType;
        const allLabelsSet = new Set();
        byType.forEach((it) => {
          if (Array.isArray(it?.buckets)) {
            it.buckets.forEach((b) => {
              if (b?.label != null) allLabelsSet.add(String(b.label));
            });
          }
        });
        const labelArr = Array.from(allLabelsSet).sort();

        const builtSeries = byType.map((it) => {
          const dataPoints = labelArr.map((lab) => {
            const match = (it.buckets || []).find((b) => String(b.label) === lab);
            return Number(match?.count || 0);
          });
          return { name: String(it.service_type ?? 'Unknown'), data: dataPoints };
        });

        if (labelArr.length && builtSeries.length) {
          nextLabels = labelArr;
          nextSeries = builtSeries;
        }
      }

      // Minimal fallback: { items:[{service_type,count}] } => single "Total" bucket
      if ((!nextLabels || !nextSeries) && Array.isArray(res?.items)) {
        const labelArr = ['Total'];
        const builtSeries = res.items.map((it) => ({
          name: String(it.service_type ?? 'Unknown'),
          data: [Number(it.count || 0)],
        }));
        nextLabels = labelArr;
        nextSeries = builtSeries;
      }

      // Validate and filter zero-total buckets (labels) and realign data
      let hasData =
        Array.isArray(nextLabels) &&
        nextLabels.length > 0 &&
        Array.isArray(nextSeries) &&
        nextSeries.length > 0;

      if (hasData) {
        const totals = nextLabels.map((_, idx) =>
          nextSeries.reduce((sum, s) => {
            const v =
              Array.isArray(s?.data) && Number.isFinite(Number(s.data[idx]))
                ? Number(s.data[idx])
                : 0;
            return sum + v;
          }, 0)
        );
        const keepIdx = totals.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0);

        if (keepIdx.length > 0 && keepIdx.length !== nextLabels.length) {
          nextLabels = keepIdx.map((i) => nextLabels[i]);
          nextSeries = nextSeries.map((s) => ({
            name: String(s?.name ?? 'Unknown'),
            data: keepIdx.map((i) =>
              Array.isArray(s?.data) && Number.isFinite(Number(s.data[i]))
                ? Number(s.data[i])
                : 0
            ),
          }));
        } else if (keepIdx.length === 0) {
          hasData = false;
        }
      }

      setLabels(hasData ? nextLabels : []);
      setSeries(hasData ? nextSeries : []);
      setStatus(hasData ? 'success' : 'empty');
    } catch (e) {
      setError(e?.message || 'Failed to load service type summary.');
      setStatus('error');
    }
  }, [organizationId, range, appliedStart, appliedEnd]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      fetchData();
      return;
    }

    if (range !== 'custom') {
      if (appliedStart || appliedEnd) {
        setAppliedStart('');
        setAppliedEnd('');
      }
    } else {
      if (!(appliedStart && appliedEnd)) {
        return;
      }
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData();
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [range, appliedStart, appliedEnd, fetchData]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  // Shape data for stacked bar chart: each label -> object with label + one key per series.name
  const stackedData = useMemo(() => {
    if (!Array.isArray(labels) || !Array.isArray(series)) return [];
    return labels.map((lab, idx) => {
      const row = { label: String(lab) };
      series.forEach((s) => {
        const key = String(s?.name ?? 'Unknown');
        const val =
          Array.isArray(s?.data) && Number.isFinite(Number(s.data[idx]))
            ? Number(s.data[idx])
            : 0;
        row[key] = val;
      });
      return row;
    });
  }, [labels, series]);

  // Stable color map per service type
  const seriesNames = useMemo(
    () => (Array.isArray(series) ? series.map((s) => String(s?.name ?? 'Unknown')) : []),
    [series]
  );
  const colorMap = useMemo(() => getCategoryColorMap(seriesNames), [seriesNames]);

  const colorFor = useCallback(
    (nameOrIndex) => {
      if (typeof nameOrIndex === 'string') {
        return colorMap[nameOrIndex] || theme.primary || '#2563EB';
      }
      const palette = Array.isArray(theme.palette) ? theme.palette : [theme.primary || '#2563EB'];
      return palette[(Number(nameOrIndex) || 0) % palette.length];
    },
    [colorMap, theme]
  );

  // Optional value labels toggle (could be configurable later)
  const showValueLabels = true;

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header service-type summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Sessions by Service Type</h3>
        <div className="overview-users-summary__controls">
          <label htmlFor="service-type-range" className="overview-users-summary__label">
            Range
          </label>
          <select
            id="service-type-range"
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
              <label htmlFor="service-type-start" className="overview-users-summary__label">
                Start
              </label>
              <input
                id="service-type-start"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
              />
              <label htmlFor="service-type-end" className="overview-users-summary__label">
                End
              </label>
              <input
                id="service-type-end"
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
          No sessions found for the selected range.
        </div>
      )}

      {status === 'success' && stackedData.length > 0 && (
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart
              data={stackedData}
              margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
              aria-label="Sessions by service type (stacked)"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: theme.label }}
                axisLine={{ stroke: theme.axisTick }}
                tickLine={{ stroke: theme.axisTick }}
                interval="preserveEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: theme.label }}
                axisLine={{ stroke: theme.axisTick }}
                tickLine={{ stroke: theme.axisTick }}
                width={40}
              />
              <Tooltip
                cursor={{ fill: 'transparent' }}
                contentStyle={{
                  background: '#1F2937',
                  border: 'none',
                  borderRadius: 8,
                  color: '#F9FAFB',
                }}
                wrapperStyle={{ zIndex: 9999 }}
                formatter={(value, name) => [value, name]}
                labelFormatter={(lab) => `Date: ${lab}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((s, i) => {
                const seriesName = String(s.name || `Series ${i + 1}`);
                return (
                  <Bar
                    key={seriesName}
                    dataKey={seriesName}
                    name={seriesName}
                    fill={colorFor(seriesName)}
                    radius={[4, 4, 0, 0]}
                    stackId="total"
                    maxBarSize={48}
                  >
                    {showValueLabels && (
                      <LabelList
                        dataKey={seriesName}
                        position="insideTop"
                        style={{ fill: '#ffffff', fontSize: 11 }}
                        formatter={(val) => (val > 0 ? val : '')}
                      />
                    )}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

ProjectsServiceTypeBarChart.propTypes = {
  // PUBLIC_INTERFACE
  /** Explicit organization/tenant id to use for API calls. If not provided, falls back to app context. */
  organizationId: PropTypes.string,
  /** Default initial range: daily | weekly | monthly | custom (default: daily) */
  defaultRange: PropTypes.oneOf(['daily', 'weekly', 'monthly', 'custom']),
};
