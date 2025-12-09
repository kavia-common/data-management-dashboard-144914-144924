import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card.jsx';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import { getOverviewTotals } from '../../api/overviewAnalytics';
import { useAuth } from '../../context/AuthContext';

/**
 * PUBLIC_INTERFACE
 * OverviewWrapper (simplified)
 * Shows totals only; removed charts: Sessions Trend, Users over time, Overall Features.
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

  if (loading) return <LoadingState message="Loading overview..." />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="page-container">
      <div className="grid grid-2">
        <Card title="Totals">
          <pre>{JSON.stringify(totals, null, 2)}</pre>
        </Card>
      </div>
    </div>
  );
}
