import api from './client'

/**
 * Build query params ensuring start_date and end_date only included for custom.
 * For non-custom ranges, server defaults to the appropriate window (e.g., daily=today).
 */
function buildParams({ organization_id, range, start_date, end_date }) {
  const params = new URLSearchParams()
  if (organization_id) params.set('organization_id', organization_id)
  if (range) params.set('range', range)
  if (range === 'custom') {
    if (start_date) params.set('start_date', start_date)
    if (end_date) params.set('end_date', end_date)
  }
  return params.toString()
}

// PUBLIC_INTERFACE
export async function fetchUsersSummary({ organization_id, range = 'daily', start_date, end_date } = {}) {
  /** Fetches /api/users/summary and returns JSON { range, start_date?, end_date?, buckets: [{key,label,count}, ...] } */
  const qs = buildParams({ organization_id, range, start_date, end_date })
  const url = `/api/users/summary${qs ? `?${qs}` : ''}`
  const res = await api.get(url)
  return res.data
}
