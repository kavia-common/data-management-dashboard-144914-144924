import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { useDataContext } from '../../context/DataContext.jsx';
import { toTitleCaseName, formatDateTime } from '../../utils/stringFormatters.js';
import { getSessionBreakDetails } from '../../api/sessionBreaks';

/**
 * PUBLIC_INTERFACE
 * SessionDetailsModal
 * A responsive, accessible modal that presents session details for a specific sessionId.
 *
 * Props:
 * - open: boolean
 * - onClose: function
 * - sessionId: string
 * - data: array | { items: array, meta?: object }
 *
 * Behavior:
 * - Locates the correct session object by matching sessionId to any of: session_id, id, _id, sessionId and nested session_data.session_id/sessionId
 * - Safely extracts session_breakdown fields and renders: session_start, session_end, duration, and agent
 * - Robust null checks: display '—' only if truly absent
 * - Dev-only console.debug when match fails to log available keys
 */
function SessionDetailsModal({ open, onClose, sessionId, data }) {
  const headerId = 'session-details-title';
  const contentRef = useRef(null);
  const { users } = useDataContext?.() || { users: [] };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(null);

  // Focus modal content when opened for accessibility
  useEffect(() => {
    if (open && contentRef.current) {
      contentRef.current.focus();
    }
  }, [open]);

  // Fetch backend details when modal opens or when a different sessionId is provided
  useEffect(() => {
    let cancelled = false;
    async function loadDetails() {
      setError('');
      setFetched(null);
      if (!open || !sessionId) return;
      setLoading(true);
      try {
        const res = await getSessionBreakDetails(sessionId);
        if (!cancelled) setFetched(res || null);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load session details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  // PUBLIC_INTERFACE
  function recordMatchesSessionId(record, sid) {
    if (!record || !sid) return false;
    const candidates = [
      record.session_id,
      record.sessionId,
      record._id,
      record.id,
      record?.session_identifier,
      record?.sessionIdentifier,
      record?.session_data?.session_id,
      record?.session_data?.sessionId,
    ].filter(Boolean);
    return candidates.some((v) => String(v) === String(sid));
  }

  const list = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }, [data]);

  const session = useMemo(() => {
    if (!open || !sessionId) return null;
    // Prefer freshly fetched server record (tenant-scoped) when available
    const best = fetched && recordMatchesSessionId(fetched, sessionId) ? fetched : null;
    if (best) return best;

    const found = list.find((it) => recordMatchesSessionId(it, sessionId)) || null;
    if (!found && process.env.NODE_ENV !== 'production') {
      try {
        const keys = list.length ? Object.keys(list[0] || {}) : [];
        // eslint-disable-next-line no-console
        console.debug('[SessionDetailsModal] No match for sessionId. First item keys:', keys, 'sessionId:', sessionId);
      } catch {
        // ignore
      }
    }
    return found;
  }, [open, sessionId, list, fetched]);

  // Utility: safely pick the first defined value by probing dot/flat aliases
  const pickFrom = (obj, keys) => {
    if (!obj) return undefined;
    for (const k of keys) {
      if (!k) continue;
      if (k.includes('.')) {
        const parts = k.split('.');
        let cur = obj;
        let ok = true;
        for (const p of parts) {
          if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
            cur = cur[p];
          } else {
            ok = false;
            break;
          }
        }
        if (ok && cur != null) return cur;
      } else if (obj[k] !== undefined && obj[k] !== null) {
        return obj[k];
      }
    }
    return undefined;
  };

  const fmtDate = (val) => {
    if (!val) return '—';
    try {
      if (typeof formatDateTime === 'function') return formatDateTime(val);
      return new Date(val).toLocaleString();
    } catch {
      return '—';
    }
  };

  // PUBLIC_INTERFACE
  function resolveUserName(userRef) {
    if (!userRef) return '—';
    if (typeof userRef === 'string') {
      const cand = users?.find?.((u) => u?._id === userRef || u?.id === userRef || u?.userId === userRef);
      if (cand) {
        return (
          cand.displayName ||
          cand.fullName ||
          cand.name ||
          cand.username ||
          cand.email ||
          '—'
        );
      }
      return userRef || '—';
    }
    if (typeof userRef === 'object') {
      const candidateId = userRef._id || userRef.id || userRef.userId || userRef.user_id;
      if (candidateId) {
        const cand = users?.find?.((u) => u?._id === candidateId || u?.id === candidateId || u?.userId === candidateId);
        if (cand) {
          return (
            cand.displayName ||
            cand.fullName ||
            cand.name ||
            cand.username ||
            cand.email ||
            '—'
          );
        }
      }
      return (
        userRef.displayName ||
        userRef.fullName ||
        userRef.name ||
        userRef.username ||
        userRef.email ||
        userRef.user_name ||
        '—'
      );
    }
    return '—';
  }

  const computed = useMemo(() => {
    const s = session || {};

    // Identify top-level helpful fields
    const sid =
      pickFrom(s, ['session_id', 'sessionId', '_id', 'id']) ??
      pickFrom(s, ['session_data.session_id', 'session_data.sessionId']) ??
      '';

    const tenantId =
      pickFrom(s, ['tenant_id', 'tenantId', 'organization_id', 'organizationId']) || '—';

    const userIdRef =
      pickFrom(s, ['user_id', 'userId', 'user._id', 'user.id', 'owner_id']) || '';

    const displayUser = (() => {
      const resolved = resolveUserName(
        pickFrom(s, ['user', 'userId', 'user_id', 'username', 'email', 'owner'])
      );
      return typeof resolved === 'string' ? toTitleCaseName(resolved) : resolved;
    })();

    // session_breakdown extraction
    const sb = s?.session_breakdown || s?.sessionBreakdown || {};
    const sessionStart =
      sb?.session_start ?? sb?.sessionStart ?? sb?.start ?? sb?.start_time ?? sb?.startTime ?? null;
    const sessionEnd =
      sb?.session_end ?? sb?.sessionEnd ?? sb?.end ?? sb?.end_time ?? sb?.endTime ?? null;
    const duration =
      sb?.duration ??
      sb?.duration_breakdown ??
      sb?.durationReadable ??
      sb?.duration_readable ??
      sb?.total_duration ??
      sb?.totalDuration ??
      null;
    const agent =
      sb?.agent ??
      sb?.agents ??
      sb?.agent_name ??
      sb?.agentName ??
      sb?.model ??
      sb?.model_name ??
      null;

    const breakSegments = Array.isArray(sb?.breaks || sb?.segments) ? (sb.breaks || sb.segments) : null;
    const notes = sb?.notes || s?.notes || s?.session_notes || null;

    const obj = {
      'User ID': userIdRef || '—',
      'User Name': displayUser || '—',
      'Session ID': sid || '—',
      'Tenant': tenantId || '—',
      'Session Start': sessionStart ? sessionStart : '—',
      'Session End': sessionEnd ? sessionEnd : '—',
      'Duration (breakdown)': (duration || duration === 0) ? duration : '—',
      'Agent': Array.isArray(agent)
        ? (agent.length ? agent.join(', ') : '—')
        : (typeof agent === 'string' && agent.trim() ? agent : '—'),
      // Additional context fields (raw)
      'Created At': fmtDate(
        pickFrom(s, [
          'created_at', 'createdAt', 'startedAt', 'started_at', 'start_time', 'startTime',
          'timestamp', 'begin_time', 'beginTime'
        ])
      ),
      'Last Updated': fmtDate(
        pickFrom(s, [
          'last_updated', 'updatedAt', 'updated_at', 'modifiedAt', 'modified_at',
          'lastModified', 'last_modified', 'lastActivityAt', 'last_activity_at',
          'finishedAt', 'finished_at', 'endedAt', 'ended_at'
        ])
      ),
      'Service Type': pickFrom(s, ['service_type', 'serviceType', 'provider', 'modelProvider']) || '—',
      'Project ID': pickFrom(s, ['project_id', 'projectId', 'project', 'projectSlug']) ||
                    pickFrom(s, ['projectName', 'project_name', 'projectLabel', 'project_label']) || '—',
      'Status': pickFrom(s, ['status']) || '—',
    };

    if (breakSegments && breakSegments.length) {
      obj['Break Segments'] = breakSegments.map((seg, idx) => {
        try {
          const start = seg.start || seg.start_time || seg.session_start || null;
          const end = seg.end || seg.end_time || seg.session_end || null;
          const label = seg.label || seg.reason || `Segment ${idx + 1}`;
          return `${label}: ${start || '—'} → ${end || '—'}`;
        } catch {
          return `Segment ${idx + 1}`;
        }
      }).join(' | ');
    }
    if (notes) {
      obj['Notes'] = String(notes);
    }

    return obj;
  }, [session, users]);

  const title = useMemo(() => {
    const id =
      sessionId ||
      pickFrom(session || {}, ['session_id', 'sessionId', '_id', 'id']) ||
      '—';
    return `Session Details - ${id || '—'}`;
  }, [sessionId, session]);

  return (
    <Modal open={open} onClose={onClose} title={title} className="session-details-modal modal--session modal-card-shell">
      <div
        className="sticky-header"
        style={{
          zIndex: 1,
          background: 'var(--bg-surface, #fff)',
          padding: '12px 20px',
          boxShadow: '0 1px 0 var(--border-subtle)',
        }}
      >
        <h2
          id={headerId}
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary, #111827)',
          }}
          title={title}
        >
          {title}
        </h2>
      </div>

      <div
        ref={contentRef}
        tabIndex={-1}
        id={`${headerId}-content`}
        style={{
          padding: 20,
          gap: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          flex: 1,
          minHeight: 0,
          background: 'var(--bg-canvas, #f9fafb)',
        }}
      >
        {loading && (
          <div role="status" aria-live="polite" style={{ padding: 12, color: '#2563EB', fontWeight: 600 }}>
            Loading session details…
          </div>
        )}
        {error && !loading && (
          <div role="alert" style={{ padding: 12, color: '#B91C1C', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <section
          aria-label="Core details"
          className="details-card"
          style={{
            position: 'relative',
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-subtle, #E5E7EB)',
            borderRadius: 12,
            padding: 16,
            boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(16,24,40,0.04))',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <div
            role="group"
            aria-label="Label and value pairs"
            className="details-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              columnGap: 32,
              rowGap: 0,
            }}
          >
            {Object.entries(computed).map(([label, value]) => {
              const isPlaceholder =
                value === '—' || value === 'Unknown User' || value === 'Not available';
              return (
                <div key={label} className="detail-item" style={{ minWidth: 0 }}>
                  <div
                    className="detail-label"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-tertiary, #64748B)',
                      letterSpacing: '0.02em',
                      marginBottom: 6,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    className="detail-value"
                    style={{
                      fontSize: 14,
                      fontWeight: isPlaceholder ? 500 : 600,
                      color: isPlaceholder
                        ? 'var(--text-tertiary, #6B7280)'
                        : 'var(--text-primary, #111827)',
                      lineHeight: '20px',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                    }}
                    title={typeof value === 'string' ? value : undefined}
                  >
                    {String(value)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div
        className="modal-footer"
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle, #E5E7EB)',
          background: 'var(--bg-surface, #ffffff)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="btn-modal-close"
          style={{ width: '100%', height: 46, borderRadius: 12 }}
          aria-label="Close"
          title="Close"
        >
          Close
        </button>
      </div>

      <style>{`
        @media (max-width: 639px) {
          .details-card [aria-label="Label and value pairs"] {
            grid-template-columns: 1fr !important;
            row-gap: 0 !important;
          }
        }
        .details-grid .detail-item {
          padding: 10px 0;
          border-top: 1px solid var(--border-subtle, #E5E7EB);
        }
        .details-grid .detail-item:nth-child(1),
        .details-grid .detail-item:nth-child(2) {
          border-top: none;
        }
        .details-grid .detail-item:nth-child(4n + 1),
        .details-grid .detail-item:nth-child(4n + 2) {
          background: var(
            --zebra-row-bg,
            color-mix(in oklab, var(--bg-canvas, #f9fafb) 92%, var(--bg-surface, #ffffff) 8%)
          );
        }
        .details-grid .detail-item:nth-child(4n + 3),
        .details-grid .detail-item:nth-child(4n + 4) {
          background: transparent;
        }
      `}</style>
    </Modal>
  );
}

export default SessionDetailsModal;
