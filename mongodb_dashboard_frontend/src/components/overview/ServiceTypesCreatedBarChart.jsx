import React, { useEffect, useMemo, useState } from 'react';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { getServiceTypesSummary } from '../../api/servicesAnalytics';

/**
 * PUBLIC_INTERFACE
 * ServiceTypesCreatedBarChart
 * Renders a bar list of sessions grouped by service_type for the selected overview filters.
 * - Title corrected to "Sessions by Service Type"
 * - Adds standard overview filters (daily | weekly | monthly | custom with start/end pickers)
 * - Reuses useCurrentOrgId and passes { range, start_date, end_date } to backend client
 */
export default function ServiceTypesCreatedBarChart() {
  const orgId = useCurrentOrgId();

  // Standard overview filter state
  const [range, setRange] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Build params expected by backend: { range, start_date, end_date }
  const filterParams = useMemo(() => {
    const params = { range };
    if (range === 'custom') {
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
    }
    return params;
  }, [range, startDate, endDate]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!orgId) return;
      setLoading(true);
      try {
        const params = { organization_id: orgId, ...filterParams };
        const resp = await getServiceTypesSummary(params, orgId);
        if (!mounted) return;
        setData(Array.isArray(resp?.items) ? resp.items : []);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch service types summary', e);
        if (mounted) setData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [orgId, filterParams]);

  const hasData = data && data.length > 0;

  return (
    <div className="rounded-lg shadow-sm bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Sessions by Service Type</h3>

        {/* Standard overview filter controls */}
        <div className="flex items-center gap-2">
          <button
            className={`px-2 py-1 text-xs rounded border ${range === 'daily' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
            onClick={() => setRange('daily')}
            aria-pressed={range === 'daily'}
          >
            Daily
          </button>
          <button
            className={`px-2 py-1 text-xs rounded border ${range === 'weekly' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
            onClick={() => setRange('weekly')}
            aria-pressed={range === 'weekly'}
          >
            Weekly
          </button>
          <button
            className={`px-2 py-1 text-xs rounded border ${range === 'monthly' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
            onClick={() => setRange('monthly')}
            aria-pressed={range === 'monthly'}
          >
            Monthly
          </button>
          <button
            className={`px-2 py-1 text-xs rounded border ${range === 'custom' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}
            onClick={() => setRange('custom')}
            aria-pressed={range === 'custom'}
          >
            Custom
          </button>

          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="border rounded px-2 py-1 text-xs"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Start date"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="date"
                className="border rounded px-2 py-1 text-xs"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="End date"
              />
            </div>
          )}
        </div>
      </div>

      {loading && <div className="h-40 flex items-center justify-center text-gray-500 text-sm">Loading…</div>}
      {!loading && !hasData && <div className="text-sm text-gray-500">No data</div>}
      {!loading && hasData && (
        <div className="space-y-2">
          <BarList data={data} />
        </div>
      )}
    </div>
  );
}

function BarList({ data }) {
  const max = Math.max(1, ...data.map((d) => d?.count || 0));
  return (
    <>
      {data.map((d, idx) => {
        const count = d?.count || 0;
        const label = d?.service_type || 'Unknown';
        const pct = Math.round((count / max) * 100);
        return (
          <div key={`${label}-${idx}`}>
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
    </>
  );
}
