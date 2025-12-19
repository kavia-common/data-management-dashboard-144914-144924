import { useEffect, useMemo, useState } from 'react';
import { fetchProjectsSummary } from '../api/projectsSummary.client';
import { adaptProjectCreateSummary } from '../utils/projectCreateSummaryAdapter';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * useProjectsCreatedSummary
 * Fetches projects created summary for current tenant and returns normalized buckets.
 */
export function useProjectsCreatedSummary(options = {}) {
  const [state, setState] = useState({ loading: true, error: null, data: null, orgId: null });

  const orgId = useMemo(() => options.organization_id || getOrgIdFromContext(), [options.organization_id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetchProjectsSummary(
          {
            range: options.range,
            start_date: options.start_date,
            end_date: options.end_date,
          },
          orgId
        );
        if (!mounted) return;
        const adapted = adaptProjectCreateSummary(res.data);
        setState({ loading: false, error: null, data: adapted, orgId: res.orgId });
      } catch (e) {
        if (!mounted) return;
        setState({ loading: false, error: e, data: null, orgId });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orgId, options.range, options.start_date, options.end_date]);

  return state;
}
