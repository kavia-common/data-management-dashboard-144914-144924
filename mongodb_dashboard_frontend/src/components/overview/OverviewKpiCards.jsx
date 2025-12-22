import React from 'react';
import { useOverviewKpis } from '../../hooks/useOverviewKpis';
import './overview.css';

/**
 * PUBLIC_INTERFACE
 * OverviewKpiCards
 * Renders KPI tiles for Overview. If props.kpis provided, uses them; otherwise loads via useOverviewKpis.
 * Preserves existing display semantics and adds Ocean theme surface accents.
 */
export default function OverviewKpiCards({ kpis: kpisProp, loading: loadingProp }) {
  const { kpis: fetchedKpis, loading: hookLoading, error } = useOverviewKpis();

  // Support legacy usage where a kpis object with keys is passed; otherwise use hook's array.
  // If an object with known keys is given, map it to standard shape.
  const coerceFromObject = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    return [
      { label: 'Total Users', value: Number(obj.totalUsers ?? obj.totalRecords ?? 0) },
      { label: 'Deployed Apps', value: Number(obj.totalDeployedApps ?? 0) },
      // Keep previous custom stats when provided
      ...(Number.isFinite(Number(obj.newInRange)) ? [{ label: 'New in Range', value: Number(obj.newInRange) }] : []),
      ...(Number.isFinite(Number(obj.updatesInRange)) ? [{ label: 'Updates in Range', value: Number(obj.updatesInRange) }] : []),
      ...(Number.isFinite(Number(obj.deletionsInRange)) ? [{ label: 'Deletions in Range', value: Number(obj.deletionsInRange) }] : []),
    ];
  };

  const items = Array.isArray(kpisProp) && kpisProp.length
    ? kpisProp
    : coerceFromObject(kpisProp) || fetchedKpis;

  const loading = loadingProp ?? hookLoading;

  return (
    <div className="overview-kpi-grid ocean-surface">
      {error && (
        <div className="overview-kpi-card error">
          <div className="overview-kpi-label">Failed to load</div>
          <div className="overview-kpi-value">—</div>
        </div>
      )}
      {(loading && (!items || items.length === 0)) && (
        <div className="overview-kpi-card skeleton">
          <div className="overview-kpi-label">Loading...</div>
          <div className="overview-kpi-value">—</div>
        </div>
      )}
      {(items || []).map((it, idx) => (
        <div
          key={idx}
          className="overview-kpi-card ocean-card"
        >
          <div className="overview-kpi-label">{it?.label ?? '—'}</div>
          <div className="overview-kpi-value">
            {Number.isFinite(Number(it?.value)) ? Number(it.value).toLocaleString() : '0'}
          </div>
        </div>
      ))}
    </div>
  );
}
