import { getApiClient } from './baseClient';

/**
 * PUBLIC_INTERFACE
 * fetchSessionTrackingDistinctTenantIds
 *
 * Purpose:
 * - Fetches ALL distinct tenant_id values from the backend session_tracking collection.
 * - This list is used to populate the Session Tracking "Filter by Tenant ID" dropdown.
 *
 * Contract:
 * - Inputs: none
 * - Output: Promise<string[]> sorted tenant ids (non-empty)
 * - Errors: throws on network/HTTP errors (caller handles UI error state)
 */
export async function fetchSessionTrackingDistinctTenantIds() {
  const res = await getApiClient().get('/api/session-tracking/tenants/distinct');
  const payload = res?.data ?? res;

  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map((t) => (t == null ? '' : String(t).trim()))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
