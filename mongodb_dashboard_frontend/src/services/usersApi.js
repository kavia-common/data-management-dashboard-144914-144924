import { fetchActiveTrend } from "../api/usersAnalytics";

/**
 * PUBLIC_INTERFACE
 * fetchActiveUsersByBucket
 * Convenience wrapper that maps UI bucket to backend granularity and forwards
 * the request to /api/users/active-trend.
 *
 * @param {'daily'|'weekly'|'monthly'} bucket
 * @param {{ from?: string, to?: string, status?: string, tenant_id?: string }} params
 * @returns {Promise<{ items: Array<{ date: string, total: number }>, meta?: any }>}
 */
export async function fetchActiveUsersByBucket(bucket, params = {}) {
  let granularity = "day";
  if (bucket === "weekly") granularity = "week";
  if (bucket === "monthly") granularity = "month";
  // active-trend accepts day|week; if month requested, fall back to week
  const g = granularity === "month" ? "week" : granularity;
  // map from/to aliases if provided
  const mapped = {
    ...params,
    startDate: params.startDate || params.from,
    endDate: params.endDate || params.to,
  };
  return fetchActiveTrend({ ...mapped, granularity: g });
}

export default { fetchActiveUsersByBucket };
