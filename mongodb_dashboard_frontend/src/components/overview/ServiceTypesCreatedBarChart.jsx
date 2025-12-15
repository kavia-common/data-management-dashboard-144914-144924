import React, { useEffect, useMemo, useState } from 'react';
import { getServiceTypesSummary } from '../../api/servicesAnalytics';
import { buildOverviewFilterParams } from '../../utils/date'; // follows existing overview charts
import { useCurrentOrgId } from '../../hooks/useCurrentOrgId';

/**
 * PUBLIC_INTERFACE
 * ServiceTypesCreatedBarChart
 * Renders a bar chart of counts grouped by service_type for the selected time range.
 * - Uses same filter UI (daily/weekly/monthly/custom) as other overview charts.
 * - Super admin (T0000) can optionally render grouped view via orgBuckets when showOrgBuckets=true.
 */
export default function ServiceTypesCreatedBarChart({ title = 'Service Types Created', showOrgBuckets = false }) {
  const orgId = useCurrentOrgId();
  const [range, setRange] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState([]);
  const [orgBuckets, setOrgBuckets] = useState([]);

  const params = useMemo(() => buildOverviewFilterParams({ range, start_date: startDate, end_date: endDate, organization_id: orgId }), [range, startDate, endDate, orgId]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await getServiceTypesSummary(params, orgId, showOrgBuckets && orgId === 'T0000');
        if (!mounted) return;
        const items = Array.isArray(data.items) ? data.items : [];
        setSeries(items);
        setOrgBuckets(Array.isArray(data.orgBuckets) ? data.orgBuckets : []);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load service types summary', e);
        if (mounted) {
          setSeries([]);
          setOrgBuckets([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [params, orgId, showOrgBuckets]);

  const isSuper = orgId === 'T0000' && showOrgBuckets && orgBuckets.length > 0;

  return (
    <div className="rounded-lg shadow-sm bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
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
              />
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">Loading…</div>
      ) : (
        <>
          {!isSuper && (
            <BarList data={series} />
          )}
          {isSuper && (
            <GroupedByTenantList data={orgBuckets} />
          )}
        </>
      )}
    </div>
  );
}

function BarList({ data }) {
  // simple vertical bar list; smallest dependency footprint without adding chart libs
  const max = Math.max(1, ...data.map(d => d.count || 0));
  return (
    <div className="space-y-2">
      {data.length === 0 && <div className="text-sm text-gray-500">No data</div>}
      {data.map((d, idx) => {
        const pct = Math.round(((d.count || 0) / max) * 100);
        return (
          <div key={idx}>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span title={d.service_type || 'Unknown'}>{(d.service_type || 'Unknown')}</span>
              <span>{d.count}</span>
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

function GroupedByTenantList({ data }) {
  return (
    <div className="space-y-4">
      {data.length === 0 && <div className="text-sm text-gray-500">No data</div>}
      {data.map((tenant) => (
        <div key={tenant.tenant_id} className="border rounded p-3">
          <div className="text-xs font-medium text-gray-700 mb-2">{tenant.tenant_id} • Total {tenant.total}</div>
          <BarList data={tenant.services || []} />
        </div>
      ))}
    </div>
  );
}
