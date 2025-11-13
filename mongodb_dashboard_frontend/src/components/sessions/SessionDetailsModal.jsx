import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import useSessionDetails from '../../hooks/useSessionDetails';
import '../../styles/modal.css';
import '../common/LoadingState.jsx';
import '../common/ErrorState.jsx';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';
import './SessionDetailsModal.css';

/**
 * PUBLIC_INTERFACE
 * SessionDetailsModal displays a user's session list with aggregate totals.
 * Props:
 *  - isOpen: boolean
 *  - onClose: function
 *  - userId: string (required)
 *  - tenantId: string (optional)
 *  - from: ISO string (optional)
 *  - to: ISO string (optional)
 */
export default function SessionDetailsModal({ isOpen, onClose, userId, tenantId, from, to }) {
  const { sessions, totals, loading, error } = useSessionDetails({
    userId,
    tenantId,
    from,
    to,
    enabled: isOpen && !!userId,
  });

  const rows = useMemo(() => {
    return sessions.map((s, idx) => {
      const start = s.session_start ? new Date(s.session_start) : null;
      const end = s.session_end ? new Date(s.session_end) : null;
      const durationSec = Number(s.duration || 0);
      const durationMin = Math.round((durationSec / 60) * 10) / 10;
      return {
        key: idx,
        startLabel: start ? start.toLocaleString() : '—',
        endLabel: end ? end.toLocaleString() : '—',
        durationLabel: `${durationMin} min`,
      };
    });
  }, [sessions]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Session details">
      <div className="modal">
        <div className="modal-header">
          <h3>User Sessions</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          {loading && <LoadingState message="Loading session details..." />}
          {error && !loading && <ErrorState title="Failed to load sessions" description={error.message || 'Unexpected error'} />}

          {!loading && !error && (
            <>
              <div className="session-aggregates">
                <div className="aggregate">
                  <div className="label">Total Sessions</div>
                  <div className="value">{totals.totalSessions}</div>
                </div>
                <div className="aggregate">
                  <div className="label">Total Duration</div>
                  <div className="value">
                    {Math.round((totals.totalDurationSec / 60) * 10) / 10} min
                  </div>
                </div>
              </div>

              <div className="session-list">
                <div className="session-list-header">
                  <div>Start</div>
                  <div>End</div>
                  <div>Duration</div>
                </div>
                <div className="session-list-body">
                  {rows.length === 0 && (
                    <div className="empty">No sessions found for this user.</div>
                  )}
                  {rows.map((r) => (
                    <div className="session-row" key={r.key}>
                      <div>{r.startLabel}</div>
                      <div>{r.endLabel}</div>
                      <div>{r.durationLabel}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

SessionDetailsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  userId: PropTypes.string.isRequired,
  tenantId: PropTypes.string,
  from: PropTypes.string,
  to: PropTypes.string,
};
