/**
 * PUBLIC_INTERFACE
 * shapeUsersProjectsBatchResponse
 *
 * Normalizes the evolving `POST /api/users/projects` batch response into a stable per-user map:
 *   { [userId]: { projects: Array, total_count: number } }
 *
 * Expected current backend shape (most common):
 *   { success: true, tenant_id, data: { [userId]: { total_count, projects, user_name? } } }
 * where `total_count` is the authoritative sessions count (inclusive date bounds handled server-side).
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

  const toNumber = (v, fallback = 0) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const normalizeEntriesToObject = (maybeEntries) => {
    // Supports array-of-entries format:
    // - [ [userId, payload], ... ]   (Object.entries / Map-like)
    // - [ { key, value }, ... ] or [ { user_id, ... }, ... ] (looser)
    if (!Array.isArray(maybeEntries)) return null;

    const obj = {};
    for (const entry of maybeEntries) {
      if (Array.isArray(entry) && entry.length >= 2) {
        const k = String(entry[0] ?? "");
        if (!k) continue;
        obj[k] = entry[1];
        continue;
      }
      if (entry && typeof entry === "object") {
        const k = String(entry.key ?? entry.user_id ?? entry.id ?? "");
        if (!k) continue;
        obj[k] = entry.value ?? entry;
      }
    }
    return obj;
  };

  /**
   * Detect whether batchResponse.data is an *envelope* (i.e. it contains `data/items/results`)
   * or whether it is already the *data map* itself.
   *
   * This distinction is critical for the latest backend change:
   *   { success, tenant_id, data: { [userId]: { total_count, projects } } }
   */
  const dataEnvelopeCandidate =
    (batchResponse?.data && typeof batchResponse.data === "object" && batchResponse.data) || null;

  const isEnvelopeObject =
    !!dataEnvelopeCandidate &&
    typeof dataEnvelopeCandidate === "object" &&
    !Array.isArray(dataEnvelopeCandidate) &&
    (Object.prototype.hasOwnProperty.call(dataEnvelopeCandidate, "data") ||
      Object.prototype.hasOwnProperty.call(dataEnvelopeCandidate, "items") ||
      Object.prototype.hasOwnProperty.call(dataEnvelopeCandidate, "results"));

  const dataEnvelope = isEnvelopeObject ? dataEnvelopeCandidate : null;

  const dataMapRawCandidate =
    // Wrapped envelope variants
    (dataEnvelope?.data ?? dataEnvelope?.items ?? dataEnvelope?.results) ??
    // Alternate top-level map keys
    batchResponse?.items ??
    batchResponse?.results ??
    // New/common case: batchResponse.data is already the per-user map
    dataEnvelopeCandidate ??
    {};

  const dataMapRaw =
    // Convert array-of-entries formats into an object map
    normalizeEntriesToObject(dataMapRawCandidate) ||
    // Allow plain object map
    (dataMapRawCandidate && typeof dataMapRawCandidate === "object" ? dataMapRawCandidate : {}) ||
    {};

  /**
   * Totals can also be wrapped or nested. Collect candidates in order of preference.
   * NOTE: some variants return totals under `meta.data.totals`.
   */
  const totalsMapCandidate =
    dataEnvelope?.totals ??
    dataEnvelope?.counts ??
    dataEnvelope?.total_count ??
    batchResponse?.totals ??
    batchResponse?.counts ??
    batchResponse?.total_count ??
    batchResponse?.meta?.totals ??
    batchResponse?.meta?.counts ??
    batchResponse?.meta?.total_count ??
    batchResponse?.meta?.data?.totals ??
    batchResponse?.meta?.data?.counts ??
    dataMapRaw?.totals ??
    dataMapRaw?.counts ??
    dataMapRaw?.total_count ??
    {};

  const totalsMap =
    normalizeEntriesToObject(totalsMapCandidate) ||
    (totalsMapCandidate && typeof totalsMapCandidate === "object" ? totalsMapCandidate : {}) ||
    {};

  const out = {};
  for (const uid of ids) {
    const raw = dataMapRaw?.[uid];

    // Important: totals can legitimately be 0; presence is about the key, not truthiness.
    const hasExplicitTotalsEntry =
      totalsMap &&
      typeof totalsMap === "object" &&
      (Object.prototype.hasOwnProperty.call(totalsMap, uid) ||
        Object.prototype.hasOwnProperty.call(totalsMap, String(uid)));

    // Shape B: data[uid] is an object { projects, total_count }
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const projects = Array.isArray(raw?.projects) ? raw.projects : [];

      // Prefer per-user total_count if present, else totals map, else fallback to projects.length.
      const totalCount =
        raw?.total_count != null
          ? toNumber(raw.total_count, projects.length)
          : hasExplicitTotalsEntry
            ? toNumber(totalsMap?.[uid], projects.length)
            : projects.length;

      out[uid] = { ...raw, projects, total_count: totalCount };
      continue;
    }

    // Shape A/C/D: data[uid] is an array of projects + totals stored separately
    const projects = Array.isArray(raw) ? raw : [];

    const totalCount = hasExplicitTotalsEntry ? toNumber(totalsMap?.[uid], projects.length) : projects.length;

    // Always output the exact object shape expected by the chart: { projects: [], total_count: number }
    // This also zero-fills users missing from the response.
    out[uid] = { projects, total_count: totalCount };
  }

  return out;
}
