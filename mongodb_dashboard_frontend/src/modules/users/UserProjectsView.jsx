import React from 'react';
import PropTypes from 'prop-types';
import { useUserProjects } from './useUserProjects';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';

/**
 * PUBLIC_INTERFACE
 * UserProjectsView
 * A simple, paginated view over a user's projects using the optimized single-call + cancellation hook.
 *
 * Props:
 *  - userId: string (required)
 *  - tenantId: string (required)
 *  - pageSize?: number (default 10)
 *
 * TEMP DEV-ONLY LOGS:
 *  - Guarded with NODE_ENV === 'development'
 *  - Prefixed with [TEMP][Users/UserProjectsView]
 *  - Verifies pagination-driven triggers and render lifecycle
 */
export default function UserProjectsView({ userId, tenantId, pageSize = 10 }) {
  const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';

  // Stabilize incoming identifiers in case parent re-renders change referential identity
  const stableIds = React.useMemo(
    () => ({ userId, tenantId }),
    [userId, tenantId]
  );
  const stableOptions = React.useMemo(
    () => ({ page: 1, limit: pageSize, immediate: true }),
    [pageSize]
  );

  const {
    data,
    loading,
    error,
    page,
    limit,
    total,
    setPage,
    setLimit,
    refresh,
  } = useUserProjects(stableIds.userId, stableIds.tenantId, stableOptions);

  const projects = data?.projects || [];

  const handlePrev = React.useCallback(() => setPage((p) => Math.max(1, p - 1)), [setPage]);
  const handleNext = React.useCallback(() => setPage((p) => p + 1), [setPage]);
  const handlePageSize = React.useCallback((e) => setLimit(Number(e.target.value)), [setLimit]);

  // Trigger fetch when page/limit change only
  React.useEffect(() => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug('[TEMP][Users/UserProjectsView] PAGE/LIMIT change -> refresh()', { page, limit, userId, tenantId });
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  // Render diagnostics
  React.useEffect(() => {
    if (!isDev) return;
    // eslint-disable-next-line no-console
    console.debug('[TEMP][Users/UserProjectsView] RENDER', {
      loading,
      error: error ? String(error.message || error) : null,
      count: projects.length,
      page,
      limit,
    });
  }, [isDev, loading, error, projects.length, page, limit]);

  return (
    <div className="user-projects-view">
      <div className="controls" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <Button onClick={handlePrev} disabled={loading || page <= 1} size="sm" variant="secondary">
          Prev
        </Button>
        <span style={{ fontSize: 12 }}>Page {page}</span>
        <Button onClick={handleNext} disabled={loading} size="sm" variant="secondary">
          Next
        </Button>
        <label style={{ marginLeft: 12, fontSize: 12 }}>
          Page size{' '}
          <select value={limit} onChange={handlePageSize}>
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={refresh} disabled={loading} size="sm">
          Refresh
        </Button>
      </div>

      {loading && (
        <div style={{ display: 'grid', gap: 8 }}>
          {Array.from({ length: Math.min(5, limit) }).map((_, i) => (
            <Skeleton key={i} height={20} />
          ))}
        </div>
      )}

      {error && (
        <div style={{ color: '#EF4444', fontSize: 12 }}>
          Failed to load user projects: {String(error.message || error)}
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gap: 8 }}>
          {projects.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6B7280' }}>No projects found for this user.</div>
          ) : (
            projects.slice(0, limit).map((p) => (
              <div
                key={p.project_id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: 13 }}>{p.project_name || p.project_id}</strong>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>ID: {p.project_id}</span>
                </div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>
                  Last activity: {p.last_activity ? new Date(p.last_activity).toLocaleString() : '—'}
                </div>
              </div>
            ))
          )}
          <div style={{ fontSize: 11, color: '#6B7280' }}>
            Showing {Math.min(limit, projects.length)} of {total}
          </div>
        </div>
      )}
    </div>
  );
}

UserProjectsView.propTypes = {
  userId: PropTypes.string.isRequired,
  tenantId: PropTypes.string.isRequired,
  pageSize: PropTypes.number,
};
