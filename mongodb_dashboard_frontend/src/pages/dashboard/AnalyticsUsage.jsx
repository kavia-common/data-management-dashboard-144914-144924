import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import KPIChart from '../../components/charts/KPIChart';
import UsersByTenantBarChart from '../../components/users/UsersByTenantBarChart';
import TimeBucketFilter from '../../components/common/TimeBucketFilter';
import { getGroupByAgents, getGroupByTeams, getUsageByUser, getFeaturesByCredit } from '../../api/analyticsUsage';


/**
 * AnalyticsUsage
 * Dashboard module to visualize usage analytics via new backend endpoints.
 * Honors shared filters: from, to, tenant_id, project_id, status.
 * Layout follows Ocean Professional theme with responsive cards and charts.
 */
const AnalyticsUsage = () => {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    tenant_id: '',
    project_id: '',
    status: '',
  });

  const [loading, setLoading] = useState(false);
  const [agentsData, setAgentsData] = useState([]);
  const [teamsData, setTeamsData] = useState([]);
  const [usageByUser, setUsageByUser] = useState([]);
  const [featuresCredit, setFeaturesCredit] = useState([]);

  const fetchAll = async (activeFilters) => {
    setLoading(true);
    try {
      const [a, t, u, f] = await Promise.all([
        getGroupByAgents(activeFilters),
        getGroupByTeams(activeFilters),
        getUsageByUser(activeFilters),
        getFeaturesByCredit(activeFilters),
      ]);

      const aItems = Array.isArray(a?.data) ? a.data : (Array.isArray(a?.items) ? a.items : (Array.isArray(a) ? a : []));
      const tItems = Array.isArray(t?.data) ? t.data : (Array.isArray(t?.items) ? t.items : (Array.isArray(t) ? t : []));
      const uItems = Array.isArray(u?.data) ? u.data : (Array.isArray(u?.items) ? u.items : (Array.isArray(u) ? u : []));
      let fItems;
      if (Array.isArray(f?.data)) {
        fItems = f.data;
      } else if (f?.data && typeof f.data === 'object' && (Array.isArray(f.data.top) || Array.isArray(f.data.bottom))) {
        fItems = [...(f.data.top || []), ...(f.data.bottom || [])];
      } else if (Array.isArray(f?.items)) {
        fItems = f.items;
      } else if (f?.items && typeof f.items === 'object' && (Array.isArray(f.items.top) || Array.isArray(f.items.bottom))) {
        fItems = [...(f.items.top || []), ...(f.items.bottom || [])];
      } else {
        fItems = Array.isArray(f) ? f : [];
      }
      setAgentsData(aItems);
      setTeamsData(tItems);
      setUsageByUser(uItems);
      setFeaturesCredit(fItems);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load analytics usage datasets', e);
      setAgentsData([]);
      setTeamsData([]);
      setUsageByUser([]);
      setFeaturesCredit([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApplyFilters = (next) => {
    const nextFilters = {
      ...filters,
      ...next,
    };
    setFilters(nextFilters);
    fetchAll(nextFilters);
  };

  // Prepare simple bar-like data for KPIChart (expects { label, value })
  const agentsKpiSeries = useMemo(() => {
    return (agentsData || []).slice(0, 10).map((row) => ({
      label: row.agent || row.name || 'Unknown',
      value: Number(row.total_cost || row.total || row.value || 0),
    }));
  }, [agentsData]);

  const teamsKpiSeries = useMemo(() => {
    return (teamsData || []).slice(0, 10).map((row) => ({
      label: row.team || row.name || 'Unknown',
      value: Number(row.total_cost || row.total || row.value || 0),
    }));
  }, [teamsData]);

  const usersBarData = useMemo(() => {
    // Adapt to UsersByTenantBarChart prop shape: { label, value }
    return (usageByUser || []).slice(0, 12).map((row) => ({
      label: row.user_name || row.user || row.user_id || 'Unknown',
      value: Number(row.total_cost || row.total || row.value || 0),
    }));
  }, [usageByUser]);

  const featuresMost = useMemo(() => {
    const arr = Array.isArray(featuresCredit) ? featuresCredit : [];
    return arr
      .slice()
      .sort((a, b) => Number(b.credits || b.total || 0) - Number(a.credits || a.total || 0))
      .slice(0, 8);
  }, [featuresCredit]);

  const featuresLeast = useMemo(() => {
    const arr = Array.isArray(featuresCredit) ? featuresCredit : [];
    return arr
      .slice()
      .sort((a, b) => Number(a.credits || a.total || 0) - Number(b.credits || b.total || 0))
      .slice(0, 8);
  }, [featuresCredit]);

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Analytics Usage</h1>
        <div className="flex items-center gap-3">
          <TimeBucketFilter
            loading={loading}
            onApply={(range) =>
              onApplyFilters({
                from: range?.from || '',
                to: range?.to || '',
                status: range?.status || '',
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Group by Agents" subtitle="Total cost or usage per agent">
          <div className="h-72">
            <KPIChart data={agentsKpiSeries} loading={loading} />
          </div>
        </Card>

        <Card title="Group by Teams" subtitle="Total cost or usage per team">
          <div className="h-72">
            <KPIChart data={teamsKpiSeries} loading={loading} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Usage by User" subtitle="Top users by consumption">
          <div className="h-80">
            {/* Reuse bar chart style similar to UsersByTenantBarChart */}
            <UsersByTenantBarChart data={usersBarData} loading={loading} />
          </div>
        </Card>

        <Card title="Features by Credit (Most)" subtitle="Features consuming the most credits">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Feature</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Credits</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-500" colSpan={2}>Loading...</td>
                  </tr>
                ) : featuresMost.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-500" colSpan={2}>No data</td>
                  </tr>
                ) : (
                  featuresMost.map((f, idx) => (
                    <tr key={`${f.feature || f.name || 'feature'}-${idx}`}>
                      <td className="px-4 py-2 text-sm text-gray-800">{f.feature || f.name || 'Unknown'}</td>
                      <td className="px-4 py-2 text-sm text-gray-800 text-right">
                        {Number(f.credits || f.total || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1">
        <Card title="Features by Credit (Least)" subtitle="Features consuming the least credits">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Feature</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Credits</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-500" colSpan={2}>Loading...</td>
                  </tr>
                ) : featuresLeast.length === 0 ? (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-500" colSpan={2}>No data</td>
                  </tr>
                ) : (
                  featuresLeast.map((f, idx) => (
                    <tr key={`${f.feature || f.name || 'feature-least'}-${idx}`}>
                      <td className="px-4 py-2 text-sm text-gray-800">{f.feature || f.name || 'Unknown'}</td>
                      <td className="px-4 py-2 text-sm text-gray-800 text-right">
                        {Number(f.credits || f.total || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsUsage;
