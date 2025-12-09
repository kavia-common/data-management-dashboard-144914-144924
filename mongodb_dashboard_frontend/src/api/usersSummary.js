import client from './client';

// PUBLIC_INTERFACE
export async function fetchUsersSummary(params = {}) {
  /**
   * Calls backend /api/users/summary with provided params.
   * Params: { organization_id|tenant_id, range, start_date, end_date }
   */
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      searchParams.append(k, v);
    }
  });
  const qs = searchParams.toString();
  const url = `/api/users/summary${qs ? `?${qs}` : ''}`;
  const res = await client.get(url);
  return res.data;
}
