import { getApiClient } from './baseClient';
import { buildQueryString } from './util';

/**
 * PUBLIC_INTERFACE
 * fetchSessionTrackingAggregates
 * Calls GET /api/session-tracking with interval and optional start/end and returns
 * { interval, start, end, data: [{ date, count }], total }
 * Also logs to console the URL and response for verification.
 */
export async function fetchSessionTrackingAggregates({ interval = 'daily', start, end } = {}) {
  const params = { interval };
  if (start) params.start = start;
  if (end) params.end = end;

  const qs = buildQueryString(params);
  const url = `/api/session-tracking${qs}`;
  // Debug log
  try { console.debug('[SessionsTrend] GET', url); } catch {}

  const res = await getApiClient().get(url);
  const payload = res?.data;
  const dataArray = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const meta = payload?.meta || {};

  // Debug aggregates
  try { console.debug('[SessionsTrend] aggregates:', { meta, data: dataArray }); } catch {}

  return {
    interval: meta.interval || interval,
    start: meta.start || start || null,
    end: meta.end || end || null,
    data: dataArray,
    total: meta.total ?? (Array.isArray(dataArray) ? dataArray.reduce((a, r) => a + (r.count || 0), 0) : 0),
  };
}

/**
 * PUBLIC_INTERFACE
 * fetchSessionTrackingRaw
 * GET /api/session-tracking/raw for verification
 */
export async function fetchSessionTrackingRaw({ start, end } = {}) {
  const qs = buildQueryString({ start, end });
  const url = `/api/session-tracking/raw${qs}`;
  try { console.debug('[SessionsTrend] GET (raw)', url); } catch {}
  const res = await getApiClient().get(url);
  return res?.data;
}
