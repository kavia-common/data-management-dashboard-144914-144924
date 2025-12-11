import React from 'react';
import PropTypes from 'prop-types';
import '../ui/Card.css';
import './UserProjectsTable.css';

/**
 * Displays a simple table of user projects with project_id and project_name.
 */
export default function UserProjectsTable({ items, loading, error }) {
  if (loading) {
    return (
      <div className="card">
        <div className="card__header">
          <h4>User Project Details</h4>
        </div>
        <div className="card__content">
          <div className="skeleton" style={{ height: 16, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card__header">
          <h4>User Project Details</h4>
        </div>
        <div className="card__content">
          <div className="tag tag--error">Failed to load project details</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>{String(error)}</div>
        </div>
      </div>
    );
  }

  const data = Array.isArray(items) ? items : [];

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card__header">
          <h4>User Project Details</h4>
        </div>
        <div className="card__content">
          <div className="tag">No projects found for this user.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__header">
        <h4>User Project Details</h4>
      </div>
      <div className="card__content">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Project ID</th>
                <th style={{ textAlign: 'left' }}>Project Name</th>
                <th style={{ textAlign: 'left' }}>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.project_id}>
                  <td style={{ fontFamily: 'monospace' }}>{p.project_id}</td>
                  <td>{p.project_name || p.project_id}</td>
                  <td>{p.last_activity ? new Date(p.last_activity).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

UserProjectsTable.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      project_id: PropTypes.string.isRequired,
      project_name: PropTypes.string,
      last_activity: PropTypes.string,
    })
  ),
  loading: PropTypes.bool,
  error: PropTypes.any,
};
