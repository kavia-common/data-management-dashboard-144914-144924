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
 * Ensures single, debounced API call per filter change.
 * - Always send range; include start/end only for custom.
 * - Debounce user-triggered fetches by 150ms.
 * - Guard initial mount to avoid StrictMode double fetch.
 *
 * Behavior:
 * - For regular orgs: show time-bucketed bar chart (daily/weekly/monthly/custom).
 * - For super org T0000: request tenant grouping and render a horizontal bar chart grouped by tenant.
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

  const theme = getChartTheme();

  // Stable debounced fetch using a ref-held timeout
  const debounceRef = useRef(null);
  const hasMountedRef = useRef(false);

  const isSuperOrg = organizationId === 'T0000';

  const fetchSummary = useCallback(async () => {
    if (!organizationId) return;

    setStatus('loading');
    setError(null);

    const params = { range };
    if (range === 'custom' && appliedStart && appliedEnd) {
      params.start_date = appliedStart;
      params.end_date = appliedEnd;
    }

    // When super org, request tenant grouping (frontend-only; backend remains unchanged)
    if (isSuperOrg) {
      params.group_by = 'tenant';
    }

    try {
      const req = buildOverviewFilterParams({ organizationId, params });
      const res = await getOverviewProjectsSummary(req);
      // Backend parity: orgBuckets present only for all-tenant (T0000) mode.
      // Maintain backward compat by falling back to buckets when orgBuckets not provided.
      const list = Array.isArray(res?.orgBuckets) && res.orgBuckets.length > 0
        ? res.orgBuckets
        : Array.isArray(res?.buckets)
        ? res.buckets
        : [];
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
  }, [organizationId, range, appliedStart, appliedEnd, isSuperOrg]);

  // Centralized debounced effect controlling all fetches
  useEffect(() => {
    // On initial mount, fetch once
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      fetchSummary();
      return;
    }

    // Reset custom when changing away from custom
    if (range !== 'custom') {
      if (appliedStart || appliedEnd) {
        setAppliedStart('');
        setAppliedEnd('');
      }
    } else {
      // For custom, only fetch when both applied dates are set
      if (!(appliedStart && appliedEnd)) {
        return;
      }
    }

    // Debounce subsequent fetches to avoid double calls from fast state transitions
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchSummary();
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [range, appliedStart, appliedEnd, fetchSummary]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      // Setting appliedStart/appliedEnd triggers a single debounced fetch via the effect
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  // For super org, shape into { name: tenant_name_or_id, value: count }
  const tenantData = useMemo(() => {
    if (!isSuperOrg) return [];
    const items = Array.isArray(buckets) ? buckets : [];
    // Backend orgBuckets shape: { organization_id, total, buckets:[{label,count}] }
    const shaped = items.map((b) => ({
      name: b.tenant_name || b.organization_id || b.tenant_id || 'Unknown',
      value: Number(b.total ?? b.count ?? 0),
      tenant_id: b.organization_id || b.tenant_id || b.key || 'unknown',
    }));
    shaped.sort((a, b) => b.value - a.value);
    return shaped;
  }, [buckets, isSuperOrg]);

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
      <div className="overview-users-summary__header project summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Projects Created</h3>
        <div className="overview-users-summary__controls">
          {/* Keep filters intact for both modes */}
          <>
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
          </>

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
        <div style={{ width: '100%', height: isSuperOrg ? 360 : 280 }}>
          <ResponsiveContainer>
            {isSuperOrg ? (
              <BarChart
                data={tenantData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 100, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12, fill: theme.axisTick }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: theme.axisTick }}
                  width={100}
                />
                <Tooltip
                  formatter={(value) => [value, 'Projects']}
                  labelFormatter={(label) => `Tenant: ${label}`}
                  fill={theme.primary}
                  contentStyle={{ background: 'transparent', borderRadius: 8, borderColor: '#e5e7eb' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Bar dataKey="value" name="Projects" fill={theme.primary} radius={[4, 4, 4, 4]} />
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: theme.primary }}
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
                  fill={theme.primary}
                  contentStyle={{ background: 'transparent', borderRadius: 8, borderColor: '#e5e7eb' }}
                />
                <Bar dataKey="count" name="Projects" fill={theme.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
