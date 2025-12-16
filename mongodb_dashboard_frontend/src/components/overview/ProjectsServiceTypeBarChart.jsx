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

/**
 * PUBLIC_INTERFACE
 * ProjectsServiceTypeBarChart
 * Renders a stacked bar chart of sessions grouped by service type across labels (time buckets).
 * Behavior:
 * - Fetches GET /api/service-type/summary with tenant/organization id, range, and optional start/end (custom).
 * - If tenant_id !== 'T0000': render vertical stacked chart with labels as dates and stacks per service type.
 * - If tenant_id === 'T0000': parse API to produce labels = tenant_ids and series = one series per service_type
 *   where each series.data aligns to tenant_ids (horizontal stacked: tenants on Y-axis; service types stacked).
 * - Keep legend, tooltips, loading/empty/error states, and date pickers; no value labels on bars.
 * - Preserve zero-date filtering logic ONLY for non-T0000 flow; for T0000 rely on backend-provided zeros.
 * - Chart is included just after element with class="session_created_chart" by its parent section (already in OverviewUsersSummarySection).
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

  // Primary shape from API
  // Non-T0000: labels = dates, series = [{name: service_type, data: counts per date}]
  // T0000:     labels = tenant_ids, series = [{name: service_type, data: counts per tenant in labels order}]
  const [labels, setLabels] = useState([]); // display labels
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
    // include both aliases; backend will enforce effective tenant and is tolerant of aliases
    params.set('tenant_id', organizationId);
    params.set('organization_id', organizationId);

    try {
      const res = await apiGet(`/service-type/summary?${params.toString()}`, {
        organization_id: organizationId,
      });

      let nextLabels = null;
      let nextSeries = null;

      // Preferred shape (for both flows)
      if (Array.isArray(res?.labels) && Array.isArray(res?.series)) {
        // If server already provided the correct labels/series, accept as-is
        nextLabels = res.labels;
        nextSeries = res.series;
      } else if (isAllTenants && Array.isArray(res?.summaryByTenantAndService)) {
        // For T0000: expected shape: [{ tenant_id, service_type, count }]
        // Build labels = unique tenant_ids; series per service_type with counts per tenant in labels order.
        const rows = res.summaryByTenantAndService;
        const tenants = Array.from(new Set(rows.map((r) => String(r?.tenant_id ?? 'unknown')))).sort();
        const types = Array.from(new Set(rows.map((r) => String(r?.service_type ?? 'Unknown')))).sort();

        const map = new Map(); // key: `${tenant}||${type}` -> count
        rows.forEach((r) => {
          const t = String(r?.tenant_id ?? 'unknown');
          const s = String(r?.service_type ?? 'Unknown');
          const c = Number.isFinite(Number(r?.count)) ? Number(r.count) : 0;
          map.set(`${t}||${s}`, c);
        });

        const builtSeries = types.map((stype) => {
          const data = tenants.map((tenant) => map.get(`${tenant}||${stype}`) ?? 0);
          return { name: stype, data };
        });

        nextLabels = tenants;
        nextSeries = builtSeries;
      } else if (isAllTenants && Array.isArray(res?.items)) {
        // Alternative T0000 fallback: items may be documents with { tenant_id, service_type, count }
        const rows = res.items;
        const tenants = Array.from(new Set(rows.map((r) => String(r?.tenant_id ?? 'unknown')))).sort();
        const types = Array.from(new Set(rows.map((r) => String(r?.service_type ?? 'Unknown')))).sort();

        const map = new Map();
        rows.forEach((r) => {
          const t = String(r?.tenant_id ?? 'unknown');
          const s = String(r?.service_type ?? 'Unknown');
          const c = Number.isFinite(Number(r?.count)) ? Number(r.count) : 0;
          map.set(`${t}||${s}`, c);
        });

        const builtSeries = types.map((stype) => ({
          name: stype,
          data: tenants.map((tenant) => map.get(`${tenant}||${stype}`) ?? 0),
        }));

        nextLabels = tenants;
        nextSeries = builtSeries;
      } else if (!isAllTenants && Array.isArray(res?.summaryByServiceType)) {
        // Non-T0000 fallback: build date labels and service type series
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
      } else if (!isAllTenants && Array.isArray(res?.items)) {
        // Minimal fallback (non-T0000): single "Total" bucket for each service type
        const labelArr = ['Total'];
        const builtSeries = res.items.map((it) => ({
          name: String(it.service_type ?? 'Unknown'),
          data: [Number(it.count || 0)],
        }));
        nextLabels = labelArr;
        nextSeries = builtSeries;
      }

      // Presence validation
      let hasData =
        Array.isArray(nextLabels) &&
        nextLabels.length > 0 &&
        Array.isArray(nextSeries) &&
        nextSeries.length > 0;

      // For non-T0000: filter out zero total labels (date buckets). For T0000 rely on backend alignment and zeros.
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
  // Works for both orientations; for T0000 labels are service types (y-axis in horizontal layout)
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

  // Stable color map per series.name (service_type for non-T0000; tenant_id for T0000)
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

  // Value labels are intentionally disabled for clarity in stacked bars
  const showValueLabels = false;
  void showValueLabels;

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header service-type summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">
          {isAllTenants
            ? 'Sessions by Service Type (Tenants on Y-axis)'
            : 'Sessions by Service Type'}
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
              // Horizontal stacked: service types on Y-axis, tenant stacks on X (counts)
              <BarChart
                data={stackedData}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
                aria-label="Sessions by service type (stacked by tenant)"
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
                  labelFormatter={(lab) => `Service: ${lab}`}
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
                      stackId="total"
                      barSize={18}
                      radius={[0, 4, 4, 0]}
                      label={false}
                    />
                  );
                })}
              </BarChart>
            ) : (
              // Existing vertical stacked: dates on X-axis, service types stacked
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
