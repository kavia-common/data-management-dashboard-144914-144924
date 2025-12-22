/**
 * PUBLIC_INTERFACE
 * buildOverviewFilterParams
 * Build stable query params for Overview endpoints without side effects.
 * - Pure: no imports from UI state/hooks to avoid circular deps
 * - No recursion; guards against accidental self-calls
 * - Accepts explicit organizationId; does not read from context
 * - Returns a plain object suitable for axios/fetch params
 *
 * @param {Object} args
 * @param {string} [args.organizationId] - Tenant id to inject as organization_id
 * @param {string} [args.range] - 'daily'|'weekly'|'monthly'|'custom'
 * @param {string} [args.start_date] - YYYY-MM-DD (when range=custom)
 * @param {string} [args.end_date] - YYYY-MM-DD (when range=custom)
 * @param {Object} [args.search] - Optional additional search filters to serialize (flat key/values)
 * @returns {Object} Plain params object
 */
export function buildOverviewFilterParams(args = {}) {
  // Guard: if somehow called with its own reference, return minimal safe object
  if (typeof args === 'function') {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[buildOverviewFilterParams] invalid invocation - function provided');
    }
    return {};
  }

  const {
    organizationId,
    range,
    start_date,
    end_date,
    search,
  } = args || {};

  const params = {};

  // Range handling
  if (range) params.range = String(range);
  const isCustom = String(range || '').toLowerCase() === 'custom';
  if (isCustom) {
    if (start_date) params.start_date = String(start_date);
    if (end_date) params.end_date = String(end_date);
  }

  // Inject explicit tenant id only from provided arg
  if (organizationId) {
    params.organization_id = String(organizationId);
    // Some backends accept tenant_id alias as well; harmless to add
    params.tenant_id = String(organizationId);
  }

  // Merge shallow search filters (flat only)
  if (search && typeof search === 'object') {
    for (const [k, v] of Object.entries(search)) {
      if (v == null) continue;
      if (typeof v === 'object') continue; // keep flat to avoid ambiguous serialization
      params[k] = String(v);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[buildOverviewFilterParams] built', {
      organizationId: params.organization_id || null,
      range: params.range || null,
      start_date: params.start_date || null,
      end_date: params.end_date || null,
      extraKeys: Object.keys(params).filter(k => !['organization_id','tenant_id','range','start_date','end_date'].includes(k)),
    });
  }

  return params;
}
