import React from 'react';
import PropTypes from 'prop-types';
import { formatCurrency } from '../../utils/formatCurrency';

/**
 * PUBLIC_INTERFACE
 * LlmCostsOrgDetails
 * Renders organization-level users table and nested projects listing.
 * Expects a full LLM cost document from /api/llm-costs with fields:
 * - organization_id (string)
 * - organization_cost (number)
 * - users (array of { user_id, type, user_cost, projects? })
 * - projects (array of { project_id, project_cost })
 */
export default function LlmCostsOrgDetails({ doc }) {
  if (!doc) {
    return null;
  }

  const orgId = doc.organization_id || doc.tenant_id || '—';
  const organizationCost = typeof doc.organization_cost === 'number' ? doc.organization_cost : null;

  const users = Array.isArray(doc.users) ? doc.users : [];
  const projects = Array.isArray(doc.projects) ? doc.projects : [];

  // Compute simple project count safely.
  const projectCount = projects.length;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Organization</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{orgId}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Organization Cost</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {organizationCost !== null ? formatCurrency(organizationCost) : '—'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Projects: {projectCount}</div>
        </div>
      </div>

      {/* Users table */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Users</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '8px 6px' }}>user_id</th>
                <th style={{ padding: '8px 6px' }}>type</th>
                <th style={{ padding: '8px 6px' }}>user_cost</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '8px 6px', color: '#6b7280' }}>No users</td>
                </tr>
              ) : (
                users.map((u, idx) => {
                  const userId = u?.user_id ?? '—';
                  const type = u?.type ?? '—';
                  const userCost = typeof u?.user_cost === 'number' ? formatCurrency(u.user_cost) : '—';
                  return (
                    <tr key={`${userId}-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 6px' }}>{String(userId)}</td>
                      <td style={{ padding: '8px 6px' }}>{String(type)}</td>
                      <td style={{ padding: '8px 6px' }}>{userCost}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nested projects listing */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Projects</div>
        {projects.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No projects</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {projects.map((p, idx) => {
              const projectId = p?.project_id ?? '—';
              const projectCost =
                typeof p?.project_cost === 'number' ? formatCurrency(p.project_cost) : '—';
              return (
                <div key={`${projectId}-${idx}`} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>project_id</div>
                  <div style={{ fontWeight: 600 }}>{String(projectId)}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>project_cost</div>
                  <div style={{ fontWeight: 600 }}>{projectCost}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

LlmCostsOrgDetails.propTypes = {
  doc: PropTypes.object
};
