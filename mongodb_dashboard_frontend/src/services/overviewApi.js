const API_BASE = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_BASE_URL || '';

function toQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  });
  return q.toString();
}

// PUBLIC_INTERFACE
export async function fetchSessionsTrend({ from, to, granularity = 'day', status = 'completed|active', tenantId }) {
  /** Fetch sessions trend by date */
  const qs = toQuery({ from, to, granularity, status, tenant_id: tenantId });
  const res = await fetch(`${API_BASE}/api/overview/sessions-trend?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch sessions trend');
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchUsersTrend({ from, to, granularity = 'day', status = 'active', tenantId }) {
  /** Fetch users trend by date */
  const qs = toQuery({ from, to, granularity, status, tenant_id: tenantId });
  const res = await fetch(`${API_BASE}/api/overview/users-trend?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch users trend');
  return res.json();
}

// PUBLIC_INTERFACE
export async function fetchCostsTrend({ from, to, granularity = 'day', tenantId }) {
  /** Fetch costs trend by date */
  const qs = toQuery({ from, to, granularity, tenant_id: tenantId });
  const res = await fetch(`${API_BASE}/api/overview/costs-trend?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch costs trend');
  return res.json();
}
