import { useEffect, useMemo, useState } from 'react';
import { fetchProjectCreateSummary } from '../services/projectCreateSummaryApi';
import { adaptProjectCreateSummary } from '../utils/projectCreateSummaryAdapter';
import { getOrgIdFromContext } from '../utils/orgContext';

/**
 * PUBLIC_INTERFACE
 * useProjectsCreatedSummary
 * Fetches projects created summary for current tenant and returns normalized series for charts.
 */
// PUBLIC_INTERFACE
export function useProjectsCreatedSummary(options = {}) {
  const [state, setState] = useState({ loading: true, error: null, data: [], orgId: null });

  const orgId = useMemo(() => options.organization_id || getOrgIdFromContext(), [options.organization_id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const raw = await fetchProjectCreateSummary({
          organization_id: orgId,
          range: options.range,
          start_date: options.start_date,
          end_date: options.end_date,
          project_id: options.project_id,
        });
        if (!mounted) return;
        const series = adaptProjectCreateSummary(raw);
        setState({ loading: false, error: null, data: series, orgId });
      } catch (e) {
        if (!mounted) return;
        setState({ loading: false, error: e, data: [], orgId });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orgId, options.range, options.start_date, options.end_date, options.project_id]);

  return state;
}
