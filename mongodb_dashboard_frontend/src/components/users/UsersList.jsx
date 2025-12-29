import React, { useEffect, useState } from 'react';
import { listUsers } from '../../api';
import SessionDetailsPanel from './SessionDetailsPanel';

/**
 * PUBLIC_INTERFACE
 * UsersList
 * Renders a simple users list and opens session details on row click.
 */
export default function UsersList() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listUsers({})
      .then(({ items }) => {
        if (!mounted) return;
        setItems(items || []);
      })
      .catch(() => {
        if (!mounted) return;
        setItems([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Users</div>
      {loading ? (
        <div style={{ color: '#6B7280' }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ color: '#6B7280' }}>No users found.</div>
      ) : (
        <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 14 }}>
            <thead style={{ background: '#F3F4F6' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Name/Email</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Tenant</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u, idx) => {
                const userId = String(u?._id || u?.id || u?.user_id || idx);
                const display = u?.email || u?.name || userId;
                const tenant = u?.organization_id || u?.tenant_id || '—';
                const created = u?.created_at || u?.createdAt || '—';
                return (
                  <tr
                    key={userId}
                    onClick={() => setSelected(u)}
                    style={{ cursor: 'pointer', borderTop: '1px solid #E5E7EB' }}
                    title="Click to view session details"
                  >
                    <td style={{ padding: 8 }}>{display}</td>
                    <td style={{ padding: 8 }}>{tenant}</td>
                    <td style={{ padding: 8 }}>{typeof created === 'string' ? created : (created ? new Date(created).toISOString() : '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <SessionDetailsPanel
          user={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
