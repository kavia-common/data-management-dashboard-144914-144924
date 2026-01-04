/**
 * PUBLIC_INTERFACE
 * shapeUsersProjectsBatchResponse
 *
 * Normalizes the evolving `POST /api/users/projects` batch response into a stable per-user map:
 *   { [userId]: { projects: Array, total_count: number } }
 *
 * Why this exists:
 * - The backend envelope for this endpoint has historically varied across versions and environments.
 * - The "Activity by User" chart expects a numeric `total_count` per userId for its Bar `dataKey`.
 * - If totals are hidden under an unexpected envelope, bars render as 0 even when the API returned data.
 *
 * Supported batch response shapes (observed variants):
 *  A) { data: { [userId]: Array<Project> }, totals?: { [userId]: number } }
 *  B) { data: { [userId]: { projects: Array<Project>, total_count: number } } }
 *  C) { data: { [userId]: Array<Project> }, total_count?: { [userId]: number } }
 *  D) { data: { [userId]: Array<Project>, totals: { [userId]: number } } }         <-- totals nested under data
 *  E) { data: { data: { [userId]: ... }, totals?: { ... } }, meta?: {...} }        <-- extra `data` envelope
 *  F) { meta: { totals: { ... } } } OR { meta: { data: { totals: { ... } } } }     <-- totals in meta envelope
 *  G) { items/results: { [userId]: ... } }                                         <-- alternate map key
 *
 * @param {object} params
 * @param {Array<string>} params.userIds - The list of userIds requested.
 * @param {any} params.batchResponse - The raw response returned by getUsersProjectsBatch().
 * @returns {Record<string, {projects: Array, total_count: number}>}
 */
export function shapeUsersProjectsBatchResponse({ userIds, batchResponse }) {
  const ids = Array.isArray(userIds) ? userIds.map(String).filter(Boolean) : [];

  /**
   * Prefer mapping objects under `data`, but accept nested envelope variants:
   * - batchResponse.data.data
   * - batchResponse.data.items / batchResponse.data.results
   * - batchResponse.items / batchResponse.results
   */
  const dataEnvelope =
    (batchResponse?.data && typeof batchResponse.data === "object" && batchResponse.data) || null;

  const dataMapRaw =
    (dataEnvelope?.data && typeof dataEnvelope.data === "object" && dataEnvelope.data) ||
    (dataEnvelope?.items && typeof dataEnvelope.items === "object" && dataEnvelope.items) ||
    (dataEnvelope?.results && typeof dataEnvelope.results === "object" && dataEnvelope.results) ||
    (batchResponse?.items && typeof batchResponse.items === "object" && batchResponse.items) ||
    (batchResponse?.results && typeof batchResponse.results === "object" && batchResponse.results) ||
    (batchResponse?.data && typeof batchResponse.data === "object" && batchResponse.data) ||
    {};

  /**
   * Totals can also be wrapped or nested. Collect candidates in order of preference.
   * NOTE: some variants return totals under `meta.data.totals`.
   */
  const totalsMapCandidate =
    (dataEnvelope?.totals && typeof dataEnvelope.totals === "object" && dataEnvelope.totals) ||
    (dataEnvelope?.counts && typeof dataEnvelope.counts === "object" && dataEnvelope.counts) ||
    (dataEnvelope?.total_count &&
      typeof dataEnvelope.total_count === "object" &&
      dataEnvelope.total_count) ||
    (batchResponse?.totals && typeof batchResponse.totals === "object" && batchResponse.totals) ||
    (batchResponse?.counts && typeof batchResponse.counts === "object" && batchResponse.counts) ||
    (batchResponse?.total_count &&
      typeof batchResponse.total_count === "object" &&
      batchResponse.total_count) ||
    (batchResponse?.meta?.totals &&
      typeof batchResponse.meta.totals === "object" &&
      batchResponse.meta.totals) ||
    (batchResponse?.meta?.counts &&
      typeof batchResponse.meta.counts === "object" &&
      batchResponse.meta.counts) ||
    (batchResponse?.meta?.total_count &&
      typeof batchResponse.meta.total_count === "object" &&
      batchResponse.meta.total_count) ||
    (batchResponse?.meta?.data?.totals &&
      typeof batchResponse.meta.data.totals === "object" &&
      batchResponse.meta.data.totals) ||
    (batchResponse?.meta?.data?.counts &&
      typeof batchResponse.meta.data.counts === "object" &&
      batchResponse.meta.data.counts) ||
    (dataMapRaw?.totals && typeof dataMapRaw.totals === "object" && dataMapRaw.totals) ||
    (dataMapRaw?.counts && typeof dataMapRaw.counts === "object" && dataMapRaw.counts) ||
    (dataMapRaw?.total_count &&
      typeof dataMapRaw.total_count === "object" &&
      dataMapRaw.total_count) ||
    {};

  const totalsMap = totalsMapCandidate && typeof totalsMapCandidate === "object" ? totalsMapCandidate : {};

  const out = {};
  for (const uid of ids) {
    const raw = dataMapRaw?.[uid];

    // Shape B: data[uid] is an object { projects, total_count }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const projects = Array.isArray(raw?.projects) ? raw.projects : [];
      const totalCount =
        typeof raw?.total_count === "number"
          ? raw.total_count
          : Number.isFinite(Number(raw?.total_count))
            ? Number(raw.total_count)
            : Number.isFinite(Number(totalsMap?.[uid]))
              ? Number(totalsMap[uid])
              : 0;

      // Always output the fields the chart relies on, while preserving other keys.
      out[uid] = { ...raw, projects, total_count: totalCount };
      continue;
    }

    // Shape A/C/D: data[uid] is an array of projects + totals stored separately
    const projects = Array.isArray(raw) ? raw : [];
    const totalCount = Number.isFinite(Number(totalsMap?.[uid])) ? Number(totalsMap[uid]) : 0;

    // Always output the exact object shape expected by the chart: { projects: [], total_count: number }
    // This also zero-fills users missing from the response.
    out[uid] = { projects, total_count: totalCount };
  }

  return out;
}
