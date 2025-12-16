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
} from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import { getChartTheme } from '../charts/chartTheme';
import { apiGet } from '../../utils/api';
import { getCategoryColorMap } from '../../theme/oceanTheme';
import { apiBase } from '../../api/config';

/**
 * PUBLIC_INTERFACE
 * ProjectsServiceTypeBarChart
 * Renders a stacked bar chart of sessions grouped by service type across labels (time buckets).
 * Behavior:
 * - Fetches GET /api/service-type/summary with tenant/organization id, range, and optional start/end (custom).
 * - If tenant_id !== 'T0000': render vertical stacked chart with labels as dates and stacks per service type.
 * - If tenant_id === 'T0000': render horizontal stacked chart with tenants on Y-axis and service type stacks.
 * - Parse API for T0000: labels = tenant_ids; series = one per service_type, data aligned to labels order.
 * - Keep legend and tooltips; do not show numeric labels on bars. Preserve non-T0000 flow unchanged.
 * - Ensure responsive sizing; this component is placed after element with class='session_created_chart' by parent.
 */
export default function ProjectsServiceTypeBarChart({
  organizationId: organizationIdProp,
  defaultRange = 'daily',
}) {
  const derivedOrgId = useCurrentOrgId();
  const organizationId = organizationIdProp || derivedOrgId;
  const isAllTenants = String(organizationId || '').toUpperCase() === 'T0000';

  const [range, setRange] = useState(defaultRange || 'daily');
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error
  const [error, setError] = useState(null);

  // Data model:
  // Non-T0000: labels = date labels, series = [{ name: service_type, data: per-date counts }]
  // T0000: labels = tenant_ids, series = [{ name: service_type, data: per-tenant counts aligned to labels }]
  const [labels, setLabels] = useState([]);
  const [series, setSeries] = useState([]); // [{ name, data: number[] }]

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
    params.set('tenant_id', organizationId);
    params.set('organization_id', organizationId);

    try {
      // Build URL using centralized API base (matches Users Created / Sessions Created charts behavior)
      const url = `${apiBase}/service-type/summary?${params.toString()}`;

      const res = await apiGet(url, {
        // Provide org id so utils/api can inject if missing and set proper auth headers.
        organization_id: organizationId,
      });

      let nextLabels = null;
      let nextSeries = null;

      // Accept pre-shaped response if provided
      if (Array.isArray(res?.labels) && Array.isArray(res?.series)) {
        nextLabels = res.labels;
        nextSeries = res.series;
      } else if (isAllTenants && Array.isArray(res?.summaryByTenantAndService)) {
        // Expected rows: [{ tenant_id, service_type, count }]
        const rows = res.summaryByTenantAndService;
        const tenants = Array.from(new Set(rows.map((r) => String(r?.tenant_id ?? 'unknown')))).sort();
        const svcTypes = Array.from(new Set(rows.map((r) => String(r?.service_type ?? 'Unknown')))).sort();

        const keyMap = new Map();
        rows.forEach((r) => {
          const t = String(r?.tenant_id ?? 'unknown');
          const s = String(r?.service_type ?? 'Unknown');
          const c = Number.isFinite(Number(r?.count)) ? Number(r.count) : 0;
          keyMap.set(`${t}||${s}`, c);
        });

        nextLabels = tenants;
        nextSeries = svcTypes.map((stype) => ({
          name: stype,
          data: tenants.map((t) => keyMap.get(`${t}||${stype}`) ?? 0),
        }));
      } else if (isAllTenants && Array.isArray(res?.items)) {
        // Fallback T0000 shape
        const rows = res.items;
        const tenants = Array.from(new Set(rows.map((r) => String(r?.tenant_id ?? 'unknown')))).sort();
        const svcTypes = Array.from(new Set(rows.map((r) => String(r?.service_type ?? 'Unknown')))).sort();

        const keyMap = new Map();
        rows.forEach((r) => {
          const t = String(r?.tenant_id ?? 'unknown');
          const s = String(r?.service_type ?? 'Unknown');
          const c = Number.isFinite(Number(r?.count)) ? Number(r.count) : 0;
          keyMap.set(`${t}||${s}`, c);
        });

        nextLabels = tenants;
        nextSeries = svcTypes.map((stype) => ({
          name: stype,
          data: tenants.map((t) => keyMap.get(`${t}||${stype}`) ?? 0),
        }));
      } else if (!isAllTenants && Array.isArray(res?.summaryByServiceType)) {
        // Non-T0000: build date labels and series
        const byType = res.summaryByServiceType;
        const labelsSet = new Set();
        byType.forEach((it) => {
          (it?.buckets || []).forEach((b) => {
            if (b?.label != null) labelsSet.add(String(b.label));
          });
        });
        const dateLabels = Array.from(labelsSet).sort();
        const builtSeries = byType.map((it) => ({
          name: String(it?.service_type ?? 'Unknown'),
          data: dateLabels.map((lab) => {
            const m = (it?.buckets || []).find((b) => String(b.label) === lab);
            return Number.isFinite(Number(m?.count)) ? Number(m.count) : 0;
          }),
        }));
        nextLabels = dateLabels;
        nextSeries = builtSeries;
      } else if (!isAllTenants && Array.isArray(res?.items)) {
        // Minimal non-T0000 fallback
        nextLabels = ['Total'];
        nextSeries = res.items.map((it) => ({
          name: String(it?.service_type ?? 'Unknown'),
          data: [Number.isFinite(Number(it?.count)) ? Number(it.count) : 0],
        }));
      }

      // Validate presence
      let hasData =
        Array.isArray(nextLabels) &&
        nextLabels.length > 0 &&
        Array.isArray(nextSeries) &&
        nextSeries.length > 0;

      // Non-T0000: drop all-zero date buckets
      if (hasData && !isAllTenants) {
        const totals = nextLabels.map((_, idx) =>
          nextSeries.reduce((sum, s) => {
            const v =
              Array.isArray(s?.data) && Number.isFinite(Number(s.data[idx]))
                ? Number(s.data[idx])
                : 0;
            return sum + v;
          }, 0)
        );
        const keepIdx = totals.reduce((acc, t, i) => {
          if (t > 0) acc.push(i);
          return acc;
        }, []);
        if (keepIdx.length === 0) {
          hasData = false;
        } else if (keepIdx.length !== nextLabels.length) {
          nextLabels = keepIdx.map((i) => nextLabels[i]);
          nextSeries = nextSeries.map((s) => ({
            name: String(s?.name ?? 'Unknown'),
            data: keepIdx.map((i) =>
              Array.isArray(s?.data) && Number.isFinite(Number(s.data[i]))
                ? Number(s.data[i])
                : 0
            ),
          }));
        }
      }

      setLabels(hasData ? nextLabels : []);
      setSeries(hasData ? nextSeries : []);
      setStatus(hasData ? 'success' : 'empty');
    } catch (e) {
      setError(e?.message || 'Failed to load service type summary.');
      setStatus('error');
    }
  }, [organizationId, range, appliedStart, appliedEnd, isAllTenants]);

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
    } else if (!(appliedStart && appliedEnd)) {
      return;
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

  // Build recharts dataset: each row has label and keys for each series.name
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

  // Stable colors per service_type
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

  // Data labels hidden as requested
  const showValueLabels = false;
  void showValueLabels;

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header service-type summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">
          {isAllTenants ? 'Sessions by Service Type (Tenants on Y-axis)' : 'Sessions by Service Type'}
        </h3>
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
            {isAllTenants ? (
              // Horizontal stacked: tenants on Y-axis (category) and counts on X-axis (number)
              <BarChart
                data={stackedData}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 8, bottom: 24 }}
                aria-label="Sessions by tenant (stacked by service type)"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: theme.label }}
                  axisLine={{ stroke: theme.axisTick }}
                  tickLine={{ stroke: theme.axisTick }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 12, fill: theme.label }}
                  axisLine={{ stroke: theme.axisTick }}
                  tickLine={{ stroke: theme.axisTick }}
                  width={120}
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
                  labelFormatter={(lab) => `Tenant: ${lab}`}
                />
                <Legend wrapperStyle={{ fontSize: 12, bottom: 0 }} verticalAlign="bottom" align="center" />
                {series.map((s, i) => {
                  const seriesName = String(s.name || `Series ${i + 1}`);
                  return (
                    <Bar
                      key={seriesName}
                      dataKey={seriesName}
                      name={seriesName}
                      fill={colorFor(seriesName)}
                      stackId="total"
                      maxBarSize={36}
                      radius={[0, 4, 4, 0]}
                      label={false}
                    />
                  );
                })}
              </BarChart>
            ) : (
              // Non-T0000: vertical stacked (dates on X-axis)
              <BarChart
                data={stackedData}
                margin={{ top: 8, right: 12, left: 8, bottom: 24 }}
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
                <Legend wrapperStyle={{ fontSize: 12, bottom: 0 }} verticalAlign="bottom" align="center" />
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
                      label={false}
                    />
                  );
                })}
              </BarChart>
            )}
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
