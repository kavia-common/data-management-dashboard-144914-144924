import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * fetchSessionsTrend
 * Fetches session counts over time from /api/session-tracking, using the aggregate response shape:
 * { success: true, data: [{ date: ISOString, count: Number }], meta: { interval, start, end, total } }
 * Accepts tenant_id and optional interval/start_date/end_date. Uses UTC boundaries.
 *
 * @param {Object} params
 * @param {string} params.tenant_id - Tenant scope (organization id)
 * @param {"daily"|"weekly"|"monthly"|"custom"} [params.interval="daily"]
 * @param {string} [params.start_date] - ISO string boundary (UTC start inclusive)
 * @param {string} [params.end_date] - ISO string boundary (UTC end inclusive)
 * @param {boolean} [params.debug=false] - When true, logs extra info to console
 * @returns {Promise<{ success: boolean, data: Array<{date: string, count: number}>, meta: { interval: string, start?: string, end?: string, total?: number } }>}
 */
export async function fetchSessionsTrend(params = {}) {
  const {
    tenant_id,
    interval = 'daily',
    start_date,
    end_date,
    debug = false,
  } = params;

  const query = {};
  if (tenant_id) query.tenant_id = tenant_id;

  // Server expects simple listing, but for aggregates we assume the backend supports interval & range via sessionTrackingAggregates mapping.
  // To remain compatible with provided response shape, we proxy to /api/session-tracking/aggregates if present,
  // otherwise fall back to /api/session-tracking with client-side aggregation of counts by day.
  // We prefer using /api/session-tracking?interval=...&start=...&end=... if backend supports it (as per task instruction).
  if (interval) query.interval = interval;
  if (start_date) query.start = start_date;
  if (end_date) query.end = end_date;

  const qs = buildQueryString(query);
  const url = `/api/session-tracking${qs}`;
  const res = await getApiClient().get(url);
  const payload = res?.data ?? res;

  // If payload already matches desired shape
  const looksLikeAggregate =
    payload && typeof payload === 'object' && 'data' in payload && Array.isArray(payload.data) &&
    payload.data.length >= 0 && payload.meta;

  if (looksLikeAggregate) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[SessionsTrend] aggregate payload', payload);
    }
    return payload;
  }

  // Fallback: if server returned an array (raw sessions), aggregate by day locally.
  const items = Array.isArray(payload) ? payload : payload?.data ?? [];
  const counts = new Map();
  for (const row of items) {
    const d = new Date(row?.session_start || row?.last_updated || row?.created_at || row?.createdAt || row?.date);
    if (Number.isNaN(d.getTime())) continue;
    // Normalize to UTC midnight for bucketing
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const data = Array.from(counts.entries())
    .map(([date, count]) => ({ date: new Date(`${date}T00:00:00.000Z`).toISOString(), count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const meta = {
    interval: interval || 'daily',
    start: start_date,
    end: end_date,
    total: data.reduce((acc, i) => acc + (Number(i.count) || 0), 0),
  };

  const shaped = { success: true, data, meta };
  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[SessionsTrend] client-aggregated from raw list', shaped);
  }
  return shaped;
}

/* no default export */
