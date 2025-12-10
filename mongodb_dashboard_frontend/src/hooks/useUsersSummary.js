import { useEffect, useMemo, useState } from 'react';
import useCurrentOrgId from './useCurrentOrgId';
import { fetchUsersSummary } from '../api/usersSummary';
import { format } from 'date-fns';

/**
 * PUBLIC_INTERFACE
 * useUsersSummary
 * Fetches users created summary buckets from /api/users/summary.
 * Params:
 *  - range: 'daily' | 'weekly' | 'monthly' | 'custom' (default 'daily').
 *  - start_date: 'YYYY-MM-DD' (required when range='custom')
 *  - end_date: 'YYYY-MM-DD' (required when range='custom')
 *  - organization_id / tenant_id: inferred from useCurrentOrgId when not provided
 *
 * Returns { loading, data: { buckets: [{ label, start?, end?, count }], range, start_date, end_date, orgBuckets?, isAllOrgs? }, error }
 */
export default function useUsersSummary(params = {}) {
  const orgId = useCurrentOrgId();

  const effectiveParams = useMemo(() => {
    const defaults = { range: 'daily' };
    const merged = { ...defaults, ...params };

    // Prefer organization_id, fall back to tenant_id, infer from context when absent
    if (!merged.organization_id && !merged.tenant_id && orgId) {
      merged.organization_id = orgId;
    }

    // Normalize range value defensively
    const validRanges = new Set(['daily', 'weekly', 'monthly', 'custom']);
    if (!validRanges.has(merged.range)) {
      merged.range = 'daily';
    }

    // For non-custom ranges, ensure we don't pass stray dates
    if (merged.range !== 'custom') {
      delete merged.start_date;
      delete merged.end_date;
    } else {
      // If custom has no dates, default to last 30 days
      if (!merged.start_date || !merged.end_date) {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        merged.start_date = format(start, 'yyyy-MM-dd');
        merged.end_date = format(end, 'yyyy-MM-dd');
      }
    }
    return merged;
  }, [params, orgId]);

  const [state, setState] = useState({
    loading: true,
    data: {
      buckets: [],
      range: effectiveParams.range,
      start_date: effectiveParams.start_date,
      end_date: effectiveParams.end_date,
      orgBuckets: [],
      isAllOrgs: false,
    },
    error: null,
  });

  const isProd = (process.env.REACT_APP_NODE_ENV || process.env.NODE_ENV) === 'production';

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const resp = await fetchUsersSummary(effectiveParams);

        // Log the full raw response shape for diagnostics
        // eslint-disable-next-line no-console
        console.debug('[useUsersSummary] raw response', resp);

        // Some backends may wrap data under { data: { buckets: [...] } }
        const envelope = resp && typeof resp === 'object' ? resp : {};
        const root = envelope && envelope.data && typeof envelope.data === 'object'
          ? envelope.data
          : envelope;

        // Validate and normalize response shape
        const rawBuckets = Array.isArray(root.buckets) ? root.buckets : [];

        // Map to normalized buckets: label, count (number), plus optional key/start/end
        const buckets = rawBuckets.map((b, i) => {
          const label =
            typeof b?.label === 'string' && b.label
              ? b.label
              : typeof b?.key === 'string'
              ? b.key
              : `Bucket ${i + 1}`;
          const countNum = Number(b?.count);
          return {
            label: String(label),
            start: b?.start ?? undefined,
            end: b?.end ?? undefined,
            count: Number.isFinite(countNum) ? countNum : 0,
            key: typeof b?.key === 'string' ? b.key : String(label),
          };
        });

        // Normalize orgBuckets into consistent T0000-friendly shape:
        // orgBuckets: Array<{
        //   organization_id: string,
        //   buckets: Array<{ label: string, count: number }>,
        //   total: number
        // }>
        const rawOrgBuckets = Array.isArray(root.orgBuckets) ? root.orgBuckets : [];
        const normalizedOrgBuckets = rawOrgBuckets.map((entry) => {
          const orgIdStr = entry?.organization_id ?? entry?.tenant_id ?? entry?.orgId ?? 'unknown';
          const orgId = String(orgIdStr);
          const counts = Array.isArray(entry?.buckets) ? entry.buckets : [];
          const safeBuckets = counts.map((d, i) => {
            const lbl = d?.label ?? d?.key ?? buckets[i]?.label ?? `Bucket ${i + 1}`;
            const c = Number(d?.count);
            return {
              label: String(lbl),
              count: Number.isFinite(c) ? c : 0,
            };
          });
          const total = safeBuckets.reduce((acc, b) => acc + (Number.isFinite(b.count) ? b.count : 0), 0);
          return {
            organization_id: orgId,
            buckets: safeBuckets,
            total,
          };
        });
        // Final guard to ensure it's always an array
        const finalOrgBuckets = Array.isArray(normalizedOrgBuckets) ? normalizedOrgBuckets : [];

        // Determine T0000 (all orgs) path using effective params
        const isAllOrgs =
          String(effectiveParams.organization_id || effectiveParams.tenant_id || '')
            .toUpperCase() === 'T0000';

        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.debug('[useUsersSummary] debug', {
            isAllOrgs,
            bucketsLen: buckets.length,
            orgBucketsLen: normalizedOrgBuckets.length,
            orgKeys: normalizedOrgBuckets.map(o => o.organization_id).slice(0, 6),
          });

          // extra instrumentation
          if (!isProd) {
            // eslint-disable-next-line no-console
            console.debug('[useUsersSummary] final state preview', {
              bucketsLen: buckets.length,
              isAllOrgs,
              orgBucketsLen: (finalOrgBuckets || []).length,
              orgBucketsSample: (finalOrgBuckets || []).slice(0, 2),
            });
          }

          setState({
            loading: false,
            data: {
              buckets,
              range: root.range ?? effectiveParams.range,
              start_date: root.start_date ?? effectiveParams.start_date,
              end_date: root.end_date ?? effectiveParams.end_date,
              orgBuckets: finalOrgBuckets,
              isAllOrgs,
            },
            error: null,
          });
        }
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[useUsersSummary] fetch failed', { params: effectiveParams, err });
        setState({
          loading: false,
          data: {
            buckets: [],
            range: effectiveParams.range,
            start_date: effectiveParams.start_date,
            end_date: effectiveParams.end_date,
            orgBuckets: [],
            isAllOrgs: false,
          },
          error: err,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveParams]);

  return state;
}
