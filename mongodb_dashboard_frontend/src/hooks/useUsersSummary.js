import { useEffect, useMemo, useState } from 'react';
import useCurrentOrgId from './useCurrentOrgId';
import { fetchUsersSummary } from '../api/usersSummary';
import { format } from 'date-fns';

/**
 * PUBLIC_INTERFACE
 * useUsersSummary
 * Fetches users created summary buckets and, when all-org data is available, computes per-organization totals.
 * Params:
 *  - range: 'daily' | 'weekly' | 'monthly' | 'custom' (default 'daily').
 *  - start_date: 'YYYY-MM-DD' (required when range='custom')
 *  - end_date: 'YYYY-MM-DD' (required when range='custom')
 *  - organization_id / tenant_id: inferred from useCurrentOrgId when not provided
 *
 * Returns {
 *   loading,
 *   data: {
 *     buckets: [{ label, start?, end?, count }],
 *     range, start_date, end_date,
 *     orgBuckets?: Array<{ organization_id, buckets: Array<{label,count}>, total: number }>,
 *     isAllOrgs?: boolean
 *   },
 *   error,
 *   // convenience computed values:
 *   buckets, orgTotals
 * }
 */
export default function useUsersSummary(params = {}) {
  const orgId = useCurrentOrgId();

  const effectiveParams = useMemo(() => {
    const defaults = { range: 'daily' };
    const merged = { ...defaults, ...params };

    if (!merged.organization_id && !merged.tenant_id && orgId) {
      merged.organization_id = orgId;
    }

    const validRanges = new Set(['daily', 'weekly', 'monthly', 'custom']);
    if (!validRanges.has(merged.range)) merged.range = 'daily';

    if (merged.range !== 'custom') {
      delete merged.start_date;
      delete merged.end_date;
    } else {
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
      // total sessions in selected date window (from backend /api/users/summary)
      total_sessions: null,
    },
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const resp = await fetchUsersSummary(effectiveParams);

        const envelope = resp && typeof resp === 'object' ? resp : {};
        const root = envelope && envelope.data && typeof envelope.data === 'object' ? envelope.data : envelope;

        const rawBuckets = Array.isArray(root.buckets) ? root.buckets : [];
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
            orgBuckets: Array.isArray(b?.orgBuckets) ? b.orgBuckets : undefined,
          };
        });

        // Normalize orgBuckets (either top-level root.orgBuckets or per-bucket orgBuckets shapes)
        let normalizedTop = [];
        if (Array.isArray(root.orgBuckets) && root.orgBuckets.length > 0) {
          normalizedTop = root.orgBuckets
            .filter(Boolean)
            .map((entry) => {
              const orgIdStr = entry?.organization_id ?? entry?.tenant_id ?? entry?.orgId ?? 'unknown';
              const org = String(orgIdStr);
              const counts = Array.isArray(entry?.buckets) ? entry.buckets : [];
              const safeBuckets = counts.map((d, i) => {
                const lbl = d?.label ?? d?.key ?? buckets[i]?.label ?? `Bucket ${i + 1}`;
                const c = Number(d?.count);
                return { label: String(lbl), count: Number.isFinite(c) ? c : 0 };
              });
              const total = safeBuckets.reduce((acc, b) => acc + (Number.isFinite(b.count) ? b.count : 0), 0);
              return { organization_id: org, buckets: safeBuckets, total };
            });
        } else {
          // Fallback: gather from per-bucket orgBuckets if present
          const agg = new Map(); // org -> { organization_id, total, buckets? (optional) }
          for (const b of buckets) {
            const perBucket = Array.isArray(b?.orgBuckets) ? b.orgBuckets : null;
            if (!perBucket) continue;
            for (const ob of perBucket) {
              const org = String(ob?.organization_id ?? ob?.tenant_id ?? ob?.orgId ?? 'unknown');
              const c = Number(ob?.count ?? ob?.total ?? 0);
              const prev = agg.get(org) || { organization_id: org, total: 0 };
              prev.total += Number.isFinite(c) ? c : 0;
              agg.set(org, prev);
            }
          }
          normalizedTop = Array.from(agg.values());
        }

        const isAllOrgs =
          String(effectiveParams.organization_id || effectiveParams.tenant_id || '').toUpperCase() === 'T0000';

        if (!cancelled) {
          const totalSessionsNum = Number(root?.total_sessions);
          setState({
            loading: false,
            data: {
              buckets,
              range: root.range ?? effectiveParams.range,
              start_date: root.start_date ?? effectiveParams.start_date,
              end_date: root.end_date ?? effectiveParams.end_date,
              orgBuckets: Array.isArray(normalizedTop) ? normalizedTop : [],
              isAllOrgs,
              // Backend may omit or return null; keep it nullable for UI.
              total_sessions: Number.isFinite(totalSessionsNum) ? totalSessionsNum : null,
            },
            error: null,
          });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          loading: false,
          data: {
            buckets: [],
            range: effectiveParams.range,
            start_date: effectiveParams.start_date,
            end_date: effectiveParams.end_date,
            orgBuckets: [],
            isAllOrgs: false,
            total_sessions: null,
          },
          error: err,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveParams]);

  const buckets = useMemo(() => (Array.isArray(state?.data?.buckets) ? state.data.buckets : []), [state]);
  // Compute orgTotals from top-level orgBuckets if available; otherwise from per-bucket orgBuckets aggregated above
  const orgTotals = useMemo(() => {
    const isAllOrgs =
      String(state?.data?.isAllOrgs ? 'T0000' : (state?.organization_id || '')).toUpperCase() === 'T0000' ||
      state?.data?.isAllOrgs === true;

    const arr = Array.isArray(state?.data?.orgBuckets) ? state.data.orgBuckets : [];
    const totals = arr
      .map((o) => {
        const id = String(o?.organization_id ?? o?.tenant_id ?? o?.orgId ?? 'unknown');
        const labelRaw =
          o?.organization_name ??
          o?.tenant_name ??
          o?.organization_id ??
          o?.orgId ??
          'unknown';
        const totalNum = Number(o?.total);
        return {
          orgId: id,
          label: String(labelRaw),
          total: Number.isFinite(totalNum) ? totalNum : 0,
        };
      })
      .filter((x) => Number.isFinite(x.total) && x.total >= 0);

    // Sort descending to highlight top orgs
    totals.sort((a, b) => b.total - a.total);

    // Ensure array type for consumers; when T0000, we guarantee [] not undefined
    const safeTotals = Array.isArray(totals) ? totals : [];

    // Minimal guarded debug
    if (typeof window !== 'undefined' && window?.DEBUG?.usersSummary) {
      // eslint-disable-next-line no-console
      console.debug('[useUsersSummary] orgTotals', {
        isAllOrgs,
        len: safeTotals.length,
        sample: safeTotals.slice(0, 2),
      });
    }
    return safeTotals;
  }, [state]);

  return {
    loading: state.loading,
    error: state.error,
    data: state.data,
    buckets,
    orgTotals,
  };
}
