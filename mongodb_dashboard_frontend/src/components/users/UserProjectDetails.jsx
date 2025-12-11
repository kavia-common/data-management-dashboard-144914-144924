import React, { useEffect, useMemo, useState } from 'react';
import { fetchUserProjectDetails } from '../../api/userProjects';

export default function UserProjectDetails({ user, organizationId, apiBaseUrl = '' }) {
  // PUBLIC_INTERFACE
  /** Renders a table of {project_id, project_name} for the given user.
   * Props:
   *  - user: object with at least {_id or id}
   *  - organizationId: active tenant id
   *  - apiBaseUrl: optional backend base URL
   */
  const userId = useMemo(() => (user?._id || user?.id || user?.user_id || null), [user]);
  const [state, setState] = useState({ loading: false, error: null, items: [] });

  useEffect(() => {
    if (!userId || !organizationId) {
      setState(s => ({ ...s, loading: false, error: null, items: [] }));
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        setState({ loading: true, error: null, items: [] });
        const data = await fetchUserProjectDetails({
          baseUrl: apiBaseUrl,
          userId,
          organization_id: organizationId,
          signal: ctrl.signal,
        });
        const list = Array.isArray(data?.projects) ? data.projects : [];
        setState({ loading: false, error: null, items: list });
      } catch (err) {
        setState({ loading: false, error: err?.message || 'Failed to load', items: [] });
      }
    })();
    return () => ctrl.abort();
  }, [userId, organizationId, apiBaseUrl]);

  return (
    <section className="section block">
      <header className="sticky-header" style={{ padding: '8px 0', marginBottom: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary, #111827)' }}>
          Project Details
        </h3>
      </header>

      {state.loading ? (
        <div className="muted" style={{ padding: '8px 0' }}>Loading projects…</div>
      ) : state.error ? (
        <div role="alert" style={{ color: 'var(--error, #EF4444)' }}>
          {state.error}
        </div>
      ) : state.items.length === 0 ? (
        <div className="muted" style={{ padding: '8px 0' }}>No projects found</div>
      ) : (
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="dv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Project ID</th>
                <th style={thStyle}>Project Name</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((p) => (
                <tr key={p.project_id}>
                  <td style={tdStyle}><code>{p.project_id}</code></td>
                  <td style={tdStyle}>{p.project_name || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const thStyle = {
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--text-secondary, #374151)',
  borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
  padding: '8px 6px',
};
const tdStyle = {
  fontSize: 13,
  color: 'var(--text-primary, #111827)',
  borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
  padding: '8px 6px',
};
