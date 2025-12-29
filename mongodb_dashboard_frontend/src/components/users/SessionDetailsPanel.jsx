import React, { useEffect, useState } from 'react';
import { fetchUserSessionDetails } from '../../api/users.sessionDetails';

/**
 * PUBLIC_INTERFACE
 * SessionDetailsPanel
 * Props:
 *  - user: { _id?: string, id?: string, user_id?: string, email?: string, name?: string }
 *  - tenantId?: string (optional; defaults from localStorage 'active_tenant')
 *  - onClose?: function
 */
export default function SessionDetailsPanel({ user, tenantId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [error, setError] = useState(null);

  // Derive a stable user id from multiple possible fields
  const derivedUserId =
    user?.user_id ??
    user?._id ??
    user?.id ??
    user?.uid ??
    null;
  const userId = derivedUserId != null ? String(derivedUserId) : '';
  const effectiveTenant = tenantId || window.localStorage.getItem('active_tenant') || null;

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchUserSessionDetails({ userId, tenantId: effectiveTenant, limit: 50, sort: '-last_updated' });
        if (!mounted) return;
        setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
        setMeta(data?.meta || { page: 1, limit: 50, total: 0 });
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'Failed to load session details');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [userId, effectiveTenant]);

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        top: 16,
        bottom: 16,
        width: 420,
        background: '#ffffff',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
        padding: 16,
        overflow: 'auto',
        zIndex: 1000
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', flex: 1 }}>
          Session Details
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              fontSize: 14
            }}
            aria-label="Close session details"
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
        User: <span style={{ color: '#111827' }}>{user?.email || user?.name || userId}</span>
      </div>

      {loading ? (
        <div style={{ color: '#6B7280' }}>Loading...</div>
      ) : error ? (
        <div style={{ color: '#EF4444' }}>{error}</div>
      ) : sessions.length === 0 ? (
        <div style={{ color: '#6B7280' }}>No sessions found.</div>
      ) : (
        <div>
          {sessions.map((s) => (
            <div
              key={s._id || `${s.session_id || 'na'}-${s.start_time || Math.random()}`}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                background: '#F9FAFB'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 600, color: '#111827' }}>
                  {s.session_id || 'Session'}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {s.status || 'unknown'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#374151' }}>
                <div>Project: <strong>{s.project_id || '—'}</strong></div>
                <div>Start: {s.start_time || '—'}</div>
                <div>End: {s.end_time || '—'}</div>
                <div>Last Updated: {s.last_updated || '—'}</div>
                <div>Duration: {typeof s.duration_ms === 'number' ? `${Math.round(s.duration_ms / 1000)}s` : '—'}</div>
                <div>Model: {s.model || '—'}</div>
                <div>Provider: {s.provider || '—'}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
            Showing {Math.min(meta.limit, sessions.length)} of {meta.total} sessions
          </div>
        </div>
      )}
    </div>
  );
}
