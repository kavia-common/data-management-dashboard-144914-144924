# User Insights Hooks

These reusable hooks wrap the usersInsights API client and expose a unified interface:
- { data, loading, error, refresh }
- Accept filter parameters and re-fetch on change
- Simple in-memory memoization by parameter set

Available hooks:
- useActiveUsers({ period, from, to, tenantId })
- useUserTrends({ from, to, granularity, tenantId })
- useActiveUsersByDepartment({ from, to, tenantId })
- useActiveUsersByOrganization({ from, to, tenantId })
- useUserCompliance({ tenantId, inactiveDays, requiredFields, includeDetails, from, to })

Example:
import { useUserTrends } from './';

function TrendWidget({ tenantId }) {
  const { data, loading, error, refresh } = useUserTrends({
    from: '2025-09-01T00:00:00.000Z',
    to: '2025-10-01T00:00:00.000Z',
    granularity: 'day',
    tenantId,
  });

  if (loading) return <div>Loading…</div>;
  if (error) return <div>Error: {String(error)}</div>;

  return (
    <div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <button onClick={() => refresh()}>Refresh</button>
    </div>
  );
}
