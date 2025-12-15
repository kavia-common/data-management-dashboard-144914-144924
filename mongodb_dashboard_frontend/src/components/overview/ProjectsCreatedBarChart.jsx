import React, { useEffect, useMemo, useState } from 'react';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import useProjectsSummary from '../../hooks/useProjectsSummary';
import UsersCreatedBarChart from '../charts/UsersCreatedBarChart';

/**
 * PUBLIC_INTERFACE
 * ProjectsCreatedBarChart
 * Renders Projects Created summary with standard filters (daily/weekly/monthly/custom).
 * - Non-T0000: renders time-bucket bar chart using UsersCreatedBarChart visual (label/count).
 * - T0000: if orgBuckets are returned by backend (via hook normalization), renders grouped lists per tenant.
 * Keeps existing logic and placement unchanged elsewhere.
 */
export default function ProjectsCreatedBarChart({ title = 'Projects Created' }) {
  const orgId = useCurrentOrgId();
  const isAllOrgs = String(orgId || '').toUpperCase() === 'T0000';

  // Filter controls
  const [range, setRange] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch data via hook (debounced inside)
  const { status, error, buckets } = useProjectsSummary({
    organizationId: orgId,
    range,
    start_date: startDate,
    end_date: endDate,
    debounceMs: 150,
  });

  // Normalize loading/error flags
  const loading = status === 'loading' || status === 'idle';

  // For non-T0000, buckets should be an array of { label, count }
  const chartData = useMemo(() => {
    if (!Array.isArray(buckets)) return [];
    // Hook can return either simple bucket array or orgBuckets reshaped.
    // In non-T0000 case, expect flat buckets.
    return buckets.map((b, i) => ({
      label: String(b.label ?? b.key ?? `Bucket ${i + 1}`),
      count: Number.isFinite(Number(b.count)) ? Number(b.count) : Number(b.total || 0) || 0,
    }));
  }, [buckets]);

  // For T0000, the hook reshapes orgBuckets into [{ organization_id, total, buckets: [{label,count}] }]
  // Render a grouped list per tenant with its own bar list (simple div-based bars to avoid new libs)
  const orgBuckets = useMemo(() => {
    if (!isAllOrgs) return [];
    if (!Array.isArray(buckets)) return [];
    // The hook returns arrays either of simple buckets or tenant buckets. Detect via presence of 'buckets'.
    const looksGrouped = buckets.some((x) => Array.isArray(x?.buckets));
    return looksGrouped ? buckets : [];
  }, [buckets, isAllOrgs]);

  // Ensure custom range validity (start <= end)
  useEffect(() => {
    if (range !== 'custom') return;
    if (!startDate || !endDate) return;
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (s > e) {
        setStartDate(endDate);
        setEndDate(startDate);
      }
    } catch {
      // ignore parsing errors; inputs are native date types
    }
  }, [range, startDate, endDate]);

  return (
    <section className="rounded-lg shadow-sm bg-white p-4" aria-label="Projects created summary">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
            aria-label="Time range"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>
          {range === 'custom' && (
            <>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
              />
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="End date"
              />
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {!isAllOrgs && (
        <UsersCreatedBarChart data={chartData} loading={loading} error={error} />
      )}

      {isAllOrgs && (
        <div className="space-y-4">
          {loading && <div className="h-40 flex items-center justify-center text-gray-500 text-sm">Loading…</div>}
          {!loading && orgBuckets.length === 0 && (
            <div className="text-sm text-gray-500">No data</div>
          )}
          {!loading &&
            orgBuckets.map((tenant, idx) => (
              <div key={`${tenant.organization_id || tenant.tenant_id || idx}`} className="border rounded p-3">
                <div className="text-xs font-medium text-gray-700 mb-2">
                  {(tenant.organization_id || tenant.tenant_id || 'Tenant')} • Total {Number(tenant.total || 0)}
                </div>
                <SimpleBarList data={Array.isArray(tenant.buckets) ? tenant.buckets : []} />
              </div>
            ))}
          {error && <div className="text-sm text-red-600 mt-2">{String(error)}</div>}
        </div>
      )}
    </section>
  );
}

function SimpleBarList({ data }) {
  const max = Math.max(1, ...data.map((d) => Number(d.count || 0)));
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="text-sm text-gray-500">No data</div>;
  }
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const label = String(d.label ?? d.key ?? `Bucket ${i + 1}`);
        const count = Number(d.count || 0);
        const pct = Math.round((count / max) * 100);
        return (
          <div key={`${label}-${i}`}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span title={label}>{label}</span>
              <span>{count}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded">
              <div className="bg-blue-500 h-2 rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
