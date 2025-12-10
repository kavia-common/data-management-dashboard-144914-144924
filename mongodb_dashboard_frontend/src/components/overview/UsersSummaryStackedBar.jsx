import React, { useMemo } from 'react';
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

/**
 * PUBLIC_INTERFACE
 * UsersSummaryStackedBar
 * - For organization_id === 'T0000' (all orgs), supports:
 *    a) totals layout: rows [{ label, total }] with orgs ['total'] -> horizontal bars
 *    b) stacked layout: rows [{ label, <orgKey>: num, ... }] with orgs [<orgKey>, ...]
 * - For other orgs, renders a single-series vertical chart using { label, count }.
 */
export default function UsersSummaryStackedBar({ rows, orgs, loading, error, height = 280 }) {
  const organizationId = useCurrentOrgId();

  // Safe color palette fallback
  const PALETTE = [
    '#2563EB', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#22C55E', '#06B6D4',
  ];

  const isAllOrgs = String(organizationId || '').toUpperCase() === 'T0000';

  const safeRows = useMemo(() => (Array.isArray(rows) ? rows.filter(Boolean) : []), [rows]);
  const safeOrgs = useMemo(
    () => (Array.isArray(orgs) ? orgs.filter((o) => typeof o === 'string' && o.trim()) : []),
    [orgs]
  );

  // Determine layout mode
  const mode = useMemo(() => {
    if (!isAllOrgs) return 'single';
    // totals mode when orgs exactly ['total'] or when every row has a 'total' key
    const looksLikeTotals =
      (safeOrgs.length === 1 && safeOrgs[0] === 'total') ||
      (safeRows.length > 0 && safeRows.every((r) => typeof r?.total !== 'undefined'));
    return looksLikeTotals ? 'totals' : 'stacked';
  }, [isAllOrgs, safeRows, safeOrgs]);

  // Shape data for chart
  const { chartData, seriesKeys } = useMemo(() => {
    if (safeRows.length === 0) return { chartData: [], seriesKeys: [] };

    if (mode === 'single') {
      // Non-T0000: { label, count }
      const shaped = safeRows.map((r, i) => {
        const label = String(r?.label ?? `Bucket ${i + 1}`);
        const val = Number(r?.count);
        return { label, count: Number.isFinite(val) ? val : 0 };
        });
      return { chartData: shaped, seriesKeys: ['count'] };
    }

    if (mode === 'totals') {
      // Horizontal single series: { label: orgLabel, total }
      const shaped = safeRows.map((r, i) => {
        const label = String(r?.label ?? `Org ${i + 1}`);
        const val = Number(r?.total);
        return { label, total: Number.isFinite(val) ? val : 0 };
      });
      return { chartData: shaped, seriesKeys: ['total'] };
    }

    // mode === 'stacked'
    const keys =
      safeOrgs.length > 0
        ? safeOrgs
        : Array.from(
            safeRows.reduce((acc, r) => {
              Object.keys(r || {}).forEach((k) => {
                if (k !== 'label') acc.add(k);
              });
              return acc;
            }, new Set())
          );
    const shaped = safeRows.map((r, i) => {
      const base = { label: String(r?.label ?? `Bucket ${i + 1}`) };
      for (const k of keys) {
        const v = Number(r?.[k]);
        base[k] = Number.isFinite(v) ? v : 0;
      }
      return base;
    });
    return { chartData: shaped, seriesKeys: keys };
  }, [safeRows, safeOrgs, mode]);

  // Minimal debug (guarded)
  if (typeof window !== 'undefined' && window?.DEBUG?.usersSummary) {
    // eslint-disable-next-line no-console
    console.debug('[UsersSummaryStackedBar] mode', mode, { seriesKeys, sample: chartData?.[0] });
  }

  if (loading) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body">Loading…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body">Failed to load</div>
      </div>
    );
  }
  if (!Array.isArray(chartData) || chartData.length === 0) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body">No data</div>
      </div>
    );
  }

  const renderVerticalSingle = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 18, left: 12 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} domain={[0, 'dataMax']} />
        <Tooltip />
        <Legend />
        <Bar dataKey="count" name="Users" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderHorizontalTotals = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 12, right: 16, bottom: 18, left: 12 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <YAxis type="category" dataKey="label" width={100} />
        <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax']} />
        <Tooltip />
        <Legend />
        <Bar dataKey="total" name="Total" fill="#FF6600" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderHorizontalStacked = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 12, right: 16, bottom: 18, left: 12 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <YAxis type="category" dataKey="label" width={100} />
        <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax']} />
        <Tooltip />
        <Legend />
        {seriesKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="users"
            name={key}
            fill="#FF6600"
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="users-summary-chart" style={{ minHeight: height, height }}>
      <div className="users-summary-chart__body" style={{ width: '100%', height: '100%' }}>
        {mode === 'single' ? renderVerticalSingle() : mode === 'totals' ? renderHorizontalTotals() : renderHorizontalStacked()}
      </div>
    </div>
  );
}

UsersSummaryStackedBar.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object),
  orgs: PropTypes.arrayOf(PropTypes.string),
  loading: PropTypes.bool,
  error: PropTypes.any,
  height: PropTypes.number,
};
