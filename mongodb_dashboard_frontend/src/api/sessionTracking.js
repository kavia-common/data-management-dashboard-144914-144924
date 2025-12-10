import axios from 'axios';

/**
 * PUBLIC_INTERFACE
 * fetchSessionTrackingByService
 * Fetch aggregated session tracking by service_type with date filters.
 * params: { date_filter: 'daily'|'weekly'|'monthly'|'custom', start_date?, end_date? }
 */
export async function fetchSessionTrackingByService(params = {}) {
  const qs = new URLSearchParams();
  if (params.date_filter) qs.set('date_filter', params.date_filter);
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  const url = `/api/session-tracking?${qs.toString()}`;
  const res = await axios.get(url, { withCredentials: true });
  // Normalize to { items, total, date_range }
  return {
    items: res.data?.items || [],
    total: res.data?.total || 0,
    date_range: res.data?.date_range || null,
    meta: res.data?.meta || null,
  };
}

/**
 * Backward-compat alias used in some components/tests.
 * PUBLIC_INTERFACE
 */
export const fetchSessionTracking = fetchSessionTrackingByService;
