import React, { useEffect, useState } from 'react';

/**
 * PUBLIC_INTERFACE
 * SessionDetailsModal
 * Renders a modal showing session breakdown for a given user_id by calling backend API /api/sessions/details.
 *
 * Props:
 * - userId: string (required) - user identifier to fetch sessions for
 * - isOpen: boolean (required) - controls visibility
 * - onClose: function (required) - called when user closes modal
 * - tenantId: string (optional) - tenant scope if needed by backend
 */
export default function SessionDetailsModal({ userId, isOpen, onClose, tenantId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({ sessions: [], total_sessions: 0, total_duration: 0, duration_unit: 'seconds' });

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ user_id: userId });
    if (tenantId) params.set('tenant_id', tenantId);

    fetch(`/api/sessions/details?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Failed to load session details');
        }
        return res.json();
      })
      .then((json) => {
        setData(json || { sessions: [], total_sessions: 0, total_duration: 0, duration_unit: 'seconds' });
      })
      .catch((e) => {
        setError(e.message || 'Failed to load session details');
      })
      .finally(() => setLoading(false));
  }, [isOpen, userId, tenantId]);

  if (!isOpen) return null;

  const formatSeconds = (sec) => {
    if (sec == null) return '0s';
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${r}s`);
    return parts.join(' ');
  };

  const modalStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50
  };
  const panelStyle = {
    background: '#ffffff',
    width: 'min(800px, 92vw)',
    maxHeight: '80vh',
    overflow: 'auto',
    borderRadius: 12,
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    padding: 20
  };
  const headerStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 };
  const titleStyle = { fontWeight: 700, fontSize: 18, color: '#111827' };
  const closeBtnStyle = {
    background: '#f3f4f6',
    border: 'none',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer'
  };
  const listStyle = { width: '100%', borderCollapse: 'separate', borderSpacing: 0 };
  const thtd = { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e5e7eb', fontSize: 14 };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={titleStyle}>Session Details – {userId}</div>
          <button style={closeBtnStyle} onClick={onClose}>Close</button>
        </div>

        {loading && (
          <div style={{ padding: 12, background: '#EFF6FF', borderRadius: 8, color: '#1D4ED8', marginBottom: 12 }}>
            Loading session details...
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: '#FEE2E2', borderRadius: 8, color: '#B91C1C', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Total Sessions</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{data.total_sessions || 0}</div>
              </div>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, flex: 1 }}>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Total Duration</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{formatSeconds(data.total_duration)} ({data.duration_unit})</div>
              </div>
            </div>

            <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <table style={listStyle}>
                <thead style={{ background: '#F3F4F6' }}>
                  <tr>
                    <th style={{ ...thtd, fontWeight: 600 }}>Session Start</th>
                    <th style={{ ...thtd, fontWeight: 600 }}>Session End</th>
                    <th style={{ ...thtd, fontWeight: 600 }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.sessions || []).map((s, idx) => (
                    <tr key={idx}>
                      <td style={thtd}>{s.session_start ? new Date(s.session_start).toLocaleString() : '—'}</td>
                      <td style={thtd}>{s.session_end ? new Date(s.session_end).toLocaleString() : 'Ongoing'}</td>
                      <td style={thtd}>{formatSeconds(s.duration)}</td>
                    </tr>
                  ))}
                  {(!data.sessions || data.sessions.length === 0) && (
                    <tr>
                      <td style={thtd} colSpan={3}>&#8212; No sessions found &#8212;</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
