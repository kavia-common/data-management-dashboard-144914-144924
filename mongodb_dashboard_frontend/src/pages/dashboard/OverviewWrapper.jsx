import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card.jsx';

import { getOverviewTotals } from '../../api/overviewAnalytics';
import { useAuth } from '../../context/AuthContext';
import OverviewContainer from '../../components/overview/OverviewContainer.jsx';
import OverviewKpiCountCards from '../../components/overview/OverviewKpiCountCards.jsx';

/**
 * PUBLIC_INTERFACE
 * OverviewWrapper (restored with lightweight KPI count cards)
 * Shows three KPI totals at top; does not reintroduce removed charts.
 */
export default function OverviewWrapper() {
  const { organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totals, setTotals] = useState(null);

  const tenantsList = useMemo(() => {
    if (!organizationId) return [];
    return [{ id: organizationId, name: organizationId }];
  }, [organizationId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const totalsRes = await getOverviewTotals();
        if (!mounted) return;
        setTotals(totalsRes);
        setError(null);
      } catch (e) {
        if (!mounted) return;
        setError(e);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Map existing totals into KPI Count Cards shape.
  // Fallbacks ensure cards always render a number.
  const kpiData = useMemo(() => {
    const t = totals || {};
    return {
      totalUsers: Number(t.totalUsers ?? t.users ?? 0),
      totalDeployedApps: Number(t.totalDeployedApps ?? t.projects ?? t.deployments ?? 0),
      totalSessions: Number(t.totalSessions ?? t.sessions ?? 0),
    };
  }, [totals]);

  return (
    <OverviewContainer>
      <OverviewKpiCountCards data={kpiData} loading={loading} error={!!error} />
      {/* Keep existing content minimal; no charts reintroduced */}
      <div className="page-container">
        <div className="grid grid-2">
          <Card title="Totals (raw)">
            {loading ? (
              <div role="status" aria-live="polite">Loading overview…</div>
            ) : error ? (
              <div role="alert" style={{ color: '#EF4444' }}>{String(error?.message || error)}</div>
            ) : (
              <pre>{JSON.stringify(totals, null, 2)}</pre>
            )}
          </Card>
        </div>
      </div>
    </OverviewContainer>
  );
}
