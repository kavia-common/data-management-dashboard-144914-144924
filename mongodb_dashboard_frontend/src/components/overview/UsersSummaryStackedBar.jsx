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
 * Renders a users summary bar chart.
 * - For organization_id === 'T0000' (all orgs), renders a horizontal stacked bar chart.
 *   Expects rows shaped as: [{ label: 'YYYY-MM-DD', <orgKey1>: number, <orgKey2>: number, ... }]
 *   and orgs as an array of org keys used in rows.
 * - For non-T0000, renders a standard vertical single-series bar chart expecting data under rows
 *   with shape [{ label, count }]. If provided rows already have per-org keys, we reduce into
 *   single 'count' by summing per-row values to preserve existing behavior.
 *
 * Props:
 *  - rows: array (see above)
 *  - orgs: array of strings (org keys)
 *  - loading: boolean
 *  - error: any
 *  - height: number (explicit container height)
 */
export default function UsersSummaryStackedBar({ rows, orgs, loading, error, height = 280 }) {
  const organizationId = useCurrentOrgId();

  // Safe color palette fallback (no theme dependency)
  const PALETTE = [
    '#2563EB', // blue-600
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#EF4444', // red-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#14B8A6', // teal-500
    '#F97316', // orange-500
    '#22C55E', // green-500
    '#06B6D4', // cyan-500
  ];

  const isAllOrgs = String(organizationId || '').toUpperCase() === 'T0000';

  // Normalize inputs
  const safeRows = useMemo(() => (Array.isArray(rows) ? rows.filter(Boolean) : []), [rows]);
  const safeOrgs = useMemo(
    () => (Array.isArray(orgs) ? orgs.filter((o) => typeof o === 'string' && o.trim()) : []),
    [orgs]
  );

  // Build data and series keys depending on layout
  const { chartData, seriesKeys } = useMemo(() => {
    if (safeRows.length === 0) return { chartData: [], seriesKeys: [] };

    if (isAllOrgs) {
      // Horizontal stacked: rows already shaped with label + per-org numeric keys
      // Determine series keys: prefer provided orgs, else infer from row keys (excluding 'label')
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
      // Coerce numeric values
      const shaped = safeRows.map((r, i) => {
        const base = { label: String(r?.label ?? `Bucket ${i + 1}`) };
        for (const k of keys) {
          const v = Number(r?.[k]);
          base[k] = Number.isFinite(v) ? v : 0;
        }
        return base;
      });
      return { chartData: shaped, seriesKeys: keys };
    }

    // Non-T0000: single-series vertical.
    // Accept either [{label, count}] or rows with per-org keys: reduce to count
    const single = safeRows.map((r, i) => {
      const label = String(r?.label ?? `Bucket ${i + 1}`);
      if (typeof r?.count === 'number') {
        const c = Number(r.count);
        return { label, count: Number.isFinite(c) ? c : 0 };
      }
      // reduce any non-label numeric keys into 'count'
      const count = Object.entries(r || {}).reduce((acc, [k, v]) => {
        if (k === 'label') return acc;
        const n = Number(v);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
      return { label, count };
    });
    return { chartData: single, seriesKeys: ['count'] };
  }, [safeRows, safeOrgs, isAllOrgs]);

  // Minimal guarded debug
  const isProd = (process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV) === 'production';
  if (!isProd && typeof window !== 'undefined' && window?.DEBUG_CHARTS) {
    // eslint-disable-next-line no-console
    console.debug('[UsersSummaryStackedBar] layout', isAllOrgs ? 'horizontal-stacked' : 'vertical-single', {
      seriesKeys,
      sample: chartData.slice(0, 3),
    });
  }

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[UsersSummaryStackedBar] error', error);
  }

  // Early placeholders to keep height/space stable
  if (loading) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body">Loading…</div>
      </div>
    );
  }

  const hasSeries = Array.isArray(seriesKeys) && seriesKeys.length > 0;
  const hasRows = Array.isArray(chartData) && chartData.length > 0;
  if (!hasSeries || !hasRows) {
    return (
      <div className="users-summary-chart" style={{ minHeight: height, height }}>
        <div className="users-summary-chart__body" />
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

  const renderHorizontalStacked = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 12, right: 16, bottom: 18, left: 12 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <YAxis type="category" dataKey="label" width={80} />
        <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax']} />
        <Tooltip />
        <Legend />
        {seriesKeys.map((key, idx) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="users"
            name={key}
            fill={PALETTE[idx % PALETTE.length]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="users-summary-chart" style={{ minHeight: height, height }}>
      <div className="users-summary-chart__body" style={{ width: '100%', height: '100%' }}>
        {isAllOrgs ? renderHorizontalStacked() : renderVerticalSingle()}
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
