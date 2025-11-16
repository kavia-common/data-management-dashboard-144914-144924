import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { useDataContext } from '../../context/DataContext.jsx';
import { toTitleCaseName } from '../../utils/stringFormatters.js';
import { formatLabel } from '../../utils/formatLabel';
import { usdToCredits, formatCredits, parseUsdToNumber } from '../../utils/currency.js';
import { formatCurrencyAmount } from '../../utils/formatCurrency';
import { getUserBasic } from '../../api/users';
import './SessionDetailsModal.css';

// New imports for session-tracking integration
import { fetchSessionTracking, findRecordBySessionId, normalizeSessionBreakdown } from '../../api/sessionTracking';
import { formatDateTime } from '../../utils/stringFormatters';

/**
 * PUBLIC_INTERFACE
 * SessionDetailsModal
 * A responsive, accessible modal that presents session details in a clean two-column layout aligned to the Ocean Professional theme.
 *
 * Props:
 * - open: boolean - controls visibility
 * - onClose: function - invoked to close modal
 * - session: object - session data to render
 *
 * Enhancements:
 * - Fetches session_breakdown by Session ID from session-tracking API (via backend proxy)
 * - Displays additional fields: Session Start, Session End, Duration (breakdown), Agent
 * - Robust error handling and loading states for new fields
 */
function SessionDetailsModal({ open, onClose, session }) {
  const headerId = 'session-details-title';
  const contentRef = useRef(null);
  const { users } = useDataContext?.() || { users: [] };

  // User name fetch state (for cases where DataContext doesn't have a match)
  const [fetchedUserName, setFetchedUserName] = useState('');
  const [fetchingUserName, setFetchingUserName] = useState(false);

  // New state for session_breakdown loading and error
  const [breakdown, setBreakdown] = useState({ sessionStart: null, sessionEnd: null, duration: null, agent: null });
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [breakdownError, setBreakdownError] = useState(null);

  // Focus modal content when opened for accessibility
  useEffect(() => {
    if (open && contentRef.current) {
      contentRef.current.focus();
    }
  }, [open]);

  // Helpers
  const fallbackFormat = (val) => {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleString();
    } catch {
      return '—';
    }
  };

  const fmt = (val) => {
    if (!val) return '—';
    try {
      if (typeof formatDateTime === 'function') {
        return formatDateTime(val);
      }
      return fallbackFormat(val);
    } catch {
      return fallbackFormat(val);
    }
  };

  // PUBLIC_INTERFACE
  const computeDuration = (start, end) => {
    /** Compute human-readable duration given start and end timestamps (ms or ISO). */
    if (!start || !end) return '—';
    try {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (isNaN(s) || isNaN(e)) return '—';
      let ms = Math.max(0, e - s);
      const secs = Math.floor(ms / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const sRem = secs % 60;
      const parts = [];
      if (h) parts.push(`${h}h`);
      if (m || h) parts.push(`${m}m`);
      parts.push(`${sRem}s`);
      return parts.join(' ');
    } catch {
      return '—';
    }
  };

  // PUBLIC_INTERFACE
  const resolveUserName = (userRef) => {
    /**
     * Resolve a user-friendly name from user reference:
     * - If an object with name/displayName/fullName/email exists, pick appropriately
     * - If an id, search DataContext users for a matching _id/id/userId and prefer displayName/fullName/name/username/email
     */
    if (!userRef) return 'Unknown User';
    // If already a descriptive string (e.g., username/email)
    if (typeof userRef === 'string') {
      const candidate = users?.find?.(
        (u) => u?._id === userRef || u?.id === userRef || u?.userId === userRef
      );
      if (candidate) {
        return (
          candidate.displayName ||
          candidate.fullName ||
          candidate.name ||
          candidate.username ||
          candidate.email ||
          'Unknown User'
        );
      }
      return userRef || 'Unknown User';
    }
    if (typeof userRef === 'object') {
      // If the object has an id-like, try to match a richer record
      const candidateId = userRef._id || userRef.id || userRef.userId || userRef.user_id;
      if (candidateId) {
        const candidate = users?.find?.(
          (u) => u?._id === candidateId || u?.id === candidateId || u?.userId === candidateId
        );
        if (candidate) {
          return (
            candidate.displayName ||
            candidate.fullName ||
            candidate.name ||
            candidate.username ||
            candidate.email ||
            'Unknown User'
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
        'Unknown User'
      );
    }
    return 'Unknown User';
  };

  // Utility: safely pick the first defined value by probing dot/flat aliases
  const pickFrom = (s, keys) => {
    for (const k of keys) {
      if (k.includes('.')) {
        const parts = k.split('.');
        let cur = s;
        let found = true;
        for (const p of parts) {
          if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
            cur = cur[p];
          } else {
            found = false;
            break;
          }
        }
        if (found && cur != null) return cur;
      } else if (s && s[k] !== undefined && s[k] !== null) {
        return s[k];
      }
    }
    return undefined;
  };

  // Extract normalized references up-front for user and timestamps
  const { userIdRef, displayUserResolved, createdAt, lastUpdatedAt, sessionId, tenantId } = useMemo(() => {
    const s = session || {};
    const createdAtRaw = pickFrom(s, [
      'created_at', 'createdAt', 'startedAt', 'started_at', 'start_time', 'startTime', 'created', 'timestamp', 'session_start', 'sessionStart', 'begin_time', 'beginTime'
    ]);

    const lastUpdatedPrimary = pickFrom(s, ['last_updated']);
    let normalizedLastUpdatedAt = lastUpdatedPrimary;
    if (!normalizedLastUpdatedAt) {
      normalizedLastUpdatedAt = pickFrom(s, [
        'updatedAt', 'updated_at',
        'modifiedAt', 'modified_at',
        'lastModified', 'last_modified',
        'lastActivityAt', 'last_activity_at',
        'finishedAt', 'finished_at',
        'endedAt', 'ended_at'
      ]);
    }

    const normalizedCreatedAt = createdAtRaw || undefined;
    const id = pickFrom(s, ['session_id', 'sessionId', '_id', 'id', 'session_data.session_id', 'session_data.sessionId']);

    // Resolve user ID robustly (may be in different shapes)
    const uId = pickFrom(s, [
      'userId',
      'user_id',
      'user._id',
      'user.id',
      'user',
      'owner_id',
      'owner',
    ]);

    const displayUser = (() => {
      const resolved = resolveUserName(
        pickFrom(s, ['user', 'userId', 'user_id', 'username', 'email', 'owner', 'ownerEmail'])
      );
      const rawName = s?.User_name ?? resolved ?? 'Unknown User';
      return typeof rawName === 'string' ? toTitleCaseName(rawName) : rawName;
    })();

    const tenant = pickFrom(s, ['tenant_id', 'organization_id', 'tenantId', 'organizationId', 'tenant', 'organization']) || 'T0015';

    return {
      userIdRef: uId ? String(uId) : '',
      displayUserResolved: displayUser,
      createdAt: normalizedCreatedAt,
      lastUpdatedAt: normalizedLastUpdatedAt,
      sessionId: id || '',
      tenantId: tenant,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, users]);

  // Fetch a basic user name when DataContext could not resolve a meaningful name
  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!open || !userIdRef) {
        setFetchedUserName('');
        setFetchingUserName(false);
        return;
      }

      // If displayUserResolved is already meaningful (not Unknown User), skip fetch
      if (displayUserResolved && !/^unknown user$/i.test(String(displayUserResolved))) {
        setFetchedUserName('');
        return;
      }

      try {
        setFetchingUserName(true);
        const res = await getUserBasic(userIdRef);
        if (!ignore) {
          setFetchedUserName(res?.name || '');
        }
      } catch {
        if (!ignore) {
          setFetchedUserName('');
        }
      } finally {
        if (!ignore) setFetchingUserName(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [open, userIdRef, displayUserResolved]);

  // New effect: fetch session tracking list and extract session_breakdown by sessionId
  useEffect(() => {
    let cancelled = false;
    async function loadBreakdown() {
      if (!open || !sessionId) {
        setBreakdown({ sessionStart: null, sessionEnd: null, duration: null, agent: null });
        setBreakdownError(null);
        setLoadingBreakdown(false);
        return;
      }
      setLoadingBreakdown(true);
      setBreakdownError(null);
      try {
        const data = await fetchSessionTracking({
          tenantId,
          page: 4,
          limit: 200,
        });
        const rec = findRecordBySessionId(data, sessionId);
        const mapped = normalizeSessionBreakdown(rec);
        if (!cancelled) {
          setBreakdown(mapped);
        }
      } catch (e) {
        if (!cancelled) {
          setBreakdownError('Could not load session breakdown');
          setBreakdown({ sessionStart: null, sessionEnd: null, duration: null, agent: null });
        }
      } finally {
        if (!cancelled) setLoadingBreakdown(false);
      }
    }
    loadBreakdown();
    return () => {
      cancelled = true;
    };
  }, [open, sessionId, tenantId]);

  // Collect required and requested details; preserve previously approved fields.
  const coreDetails = useMemo(() => {
    if (!session || typeof session !== 'object') return {};

    // Compute duration using startedAt (createdAt alias) and the normalized last_updated
    const durationStr = computeDuration(createdAt, lastUpdatedAt);

    // Dev-only diagnostics per instructions
    if (process.env.NODE_ENV !== 'production') {
      try {
        // eslint-disable-next-line no-console
        console.log('[SessionDetailsModal:debug]', {
          user_id: userIdRef,
          last_updated: lastUpdatedAt,
          scope: 'tenant_id',
        });
      } catch {
        // ignore logging errors
      }
    }

    // Determine display name with fetch fallback
    const nameCandidate = (() => {
      if (fetchingUserName) return 'Loading...';
      const fetched = fetchedUserName?.trim();
      if (fetched) return fetched;
      const resolved = String(displayUserResolved || '').trim();
      if (resolved && !/^unknown user$/i.test(resolved)) return resolved;
      return 'Not available';
    })();

    const existingDuration = session?.duration || session?.total_duration || session?.totalDuration || null;
    const durationToShow = existingDuration || breakdown.duration || durationStr || '—';

    const details = {
      'User ID': userIdRef || '—',
      'User Name': nameCandidate,
      'Session ID': sessionId || '—',
      'Project ID': pickFrom(session || {}, ['project_id', 'projectId', 'project', 'projectSlug']) ??
        pickFrom(session || {}, ['projectName', 'project_name', 'projectLabel', 'project_label']) ??
        '—',
      'Service Type': pickFrom(session || {}, ['serviceType', 'service_type', 'provider', 'modelProvider']) ?? '—',
      Tenant: tenantId || '—',
      'Started At': fmt(createdAt),
      'Last Updated At': fmt(lastUpdatedAt),
      Duration: durationToShow,
      // New fields below sourced from session_breakdown
      'Session Start': loadingBreakdown ? 'Loading…' : fmt(breakdown.sessionStart),
      'Session End': loadingBreakdown ? 'Loading…' : fmt(breakdown.sessionEnd),
      'Duration (breakdown)': loadingBreakdown ? 'Loading…' : (breakdown.duration || '—'),
      'Agent': loadingBreakdown ? 'Loading…' : (breakdown.agent || '—'),
    };

    // Enhance: If the session payload includes a user cost field (any casing/spacing),
    // render "User Cost: $X • Credits Used: N" inline without mutating data.
    try {
      const s = session;
      const findUserCostNumber = () => {
        if (!s || typeof s !== 'object') return null;
        for (const [k, v] of Object.entries(s)) {
          const norm = String(k || '')
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
          if (norm === 'user_cost' || norm === 'usercost') {
            if (typeof v === 'number') return Number.isFinite(v) ? v : null;
            const parsed = parseUsdToNumber(v);
            if (parsed != null) return parsed;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          }
        }
        return null;
      };
      const userCostNum = findUserCostNumber();
      if (userCostNum != null) {
        const usdText = formatCurrencyAmount(userCostNum, { currency: 'USD' });
        const creditsText = formatCredits(usdToCredits(userCostNum));
        details['User Cost'] = `${usdText} \u2022 Credits Used: ${creditsText}`;
      }
    } catch {
      // do not block rendering on formatter errors
    }

    return details;
  }, [
    session,
    userIdRef,
    displayUserResolved,
    fetchedUserName,
    fetchingUserName,
    createdAt,
    lastUpdatedAt,
    sessionId,
    tenantId,
    breakdown,
    loadingBreakdown,
  ]);

  // Title must be "Session Details - <sessionId>"
  const title = useMemo(() => {
    const id = sessionId || '';
    return `Session Details - ${id || '—'}`;
  }, [sessionId]);

  return (
    <Modal open={open} onClose={onClose} title={title} className="session-details-modal modal--session modal-card-shell">
      {/* Sticky Header with subtle divider and theme token background */}
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

      {/* Scrollable content area */}
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
            {Object.entries(coreDetails).map(([label, value]) => {
              const isPlaceholder =
                value === '—' || value === 'Unknown User' || value === 'Not available' || value === 'Loading...';
              return (
                <div key={label} className="detail-item" style={{ minWidth: 0 }}>
                  <div
                    className="detail-label"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-tertiary, #64748B)', // align with User modal
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
                      fontWeight: isPlaceholder ? 500 : 600, // normalize to 600 to match User Details modal
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
            {breakdownError && (
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                <div className="detail-label" />
                <div className="detail-value" style={{ color: '#b91c1c', fontWeight: 600 }} role="alert">
                  {breakdownError}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
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
        /* Responsive: single column on small screens */
        @media (max-width: 639px) {
          .details-card [aria-label="Label and value pairs"] {
            grid-template-columns: 1fr !important;
            row-gap: 0 !important;
          }
        }

        /* Section dividers and zebra striping for detail items
           Ensure striping applies by row across two columns: items (1,2), (3,4), ... */
        .details-grid .detail-item {
          padding: 10px 0;
          border-top: 1px solid var(--border-subtle, #E5E7EB);
        }
        .details-grid .detail-item:nth-child(1),
        .details-grid .detail-item:nth-child(2) {
          border-top: none; /* First row (2 columns) has no top border */
        }
        /* Zebra: apply background to pairs (1,2), (5,6), (9,10) ... => 4n+1 and 4n+2 */
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

        /* Improve focus-visible for any buttons/interactive nodes inside modal */
        .details-card .btn:focus-visible,
        .w-100.btn:focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.35) !important; /* Ocean blue */
          outline-offset: 2px !important;
        }
      `}</style>
    </Modal>
  );
}

export default SessionDetailsModal;
