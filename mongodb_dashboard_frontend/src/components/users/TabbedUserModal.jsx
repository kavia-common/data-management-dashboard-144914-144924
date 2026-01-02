import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

// Prefer existing UI primitives if available
import Modal from '../ui/Modal.jsx';

// Shared components/utilities
import DataTable from '../DataTable.jsx';

import { listSessions } from '../../api/baseClient';
import { getUserSessionDetails } from '../../api/users';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import { formatUsdUpToSixDecimals } from '../../utils/formatCurrency';
import UsersAnalyticsPanelModal from './UsersAnalyticsPanelModal.jsx';
import ProjectDetails from './ProjectDetails.jsx';

/**
 * Internal presentational view for user details
 * 2x2 responsive grid with Ocean Professional styling and neutral divider.
 * Fields: Name | Email (row 1), Role | Tenant (row 2).
 */
function UserDetailsView({ user }) {
  if (!user) return <div className="text-gray-500">No user selected</div>;

  const name =
    user?.name ||
    user?.full_name ||
    `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() ||
    '';
  const email = user?.email || '';
  const department =
    user?.department ??
    user?.Department ??
    user?.dept ??
    user?.user?.department ??
    '';
  const tenant =
    user?.tenant_id ??
    user?.organization_name ??
    user?.organization ??
    user?.organization_id ??
    '';

  return (
    <section
      aria-label="User details"
      style={{
        background: "var(--bg-surface, #ffffff)",
        border: "1px solid var(--border-subtle, #E6EAF0)",
        borderRadius: 12,
        boxShadow: "var(--shadow, 0 1px 2px rgba(16,24,40,0.04))",
        padding: 24,
        borderLeft: "1px solid var(--border-subtle, #E5E7EB)",
      }}
    >
      <div
        role="group"
        aria-label="Details grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {/* Name */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-tertiary, #64748B)",
              letterSpacing: ".02em",
              marginBottom: 6,
            }}
          >
            Name
          </span>
          <div
            style={{
              margin: 0,
              color: "var(--text-primary, #111827)",
              fontWeight: 600,
              wordBreak: "break-word",
            }}
            title={name || undefined}
          >
            {name || "—"}
          </div>
        </div>

        {/* Email */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-tertiary, #64748B)",
              letterSpacing: ".02em",
              marginBottom: 6,
            }}
          >
            Email
          </span>
          <div
            style={{
              margin: 0,
              color: "var(--text-primary, #111827)",
              fontWeight: 600,
              wordBreak: "break-word",
            }}
            title={email || undefined}
          >
            {email || "—"}
          </div>
        </div>

        {/* Department */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-tertiary, #64748B)",
              letterSpacing: ".02em",
              marginBottom: 6,
            }}
          >
            Department
          </span>
          <div
            style={{
              margin: 0,
              color: "var(--text-primary, #111827)",
              fontWeight: 600,
              wordBreak: "break-word",
            }}
            title={department || undefined}
          >
            {department || "—"}
          </div>
        </div>

        {/* Tenant */}
        <div>
          <span
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-tertiary, #64748B)",
              letterSpacing: ".02em",
              marginBottom: 6,
            }}
          >
            Tenant
          </span>
          <div
            style={{
              margin: 0,
              color: "var(--text-primary, #111827)",
              fontWeight: 600,
              wordBreak: "break-word",
            }}
            title={(tenant && String(tenant)) || undefined}
          >
            {tenant ? String(tenant) : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}

UserDetailsView.propTypes = {
  user: PropTypes.object,
};

/**
 * PUBLIC_INTERFACE
 * TabbedUserModal
 */
export default function TabbedUserModal({
  open,
  onClose,
  user,
  tenantId,
  defaultTab = 'details',
  from,
  to,
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  const userId = useMemo(() => user?._id || user?.id || '', [user]);

  const tabs = useMemo(
    () => [
      { key: 'details', label: 'User Details' },
      { key: 'projects', label: 'Project Details' },
      { key: 'sessions', label: 'Session Details' },
      { key: 'credits', label: 'Credits Consumed' },
      { key: 'analytics', label: 'Analytics' },
    ],
    []
  );

  const title = useMemo(() => user?.name || user?.full_name || user?.email || 'User', [user]);

  function ThemedTabs({ activeKey, onChange }) {
    return (
      <div role="tablist" style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border-subtle)" }}>
        {tabs.map((t) => {
          const isActive = String(activeKey) === String(t.key);
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.key)}
              style={{
                appearance: "none",
                border: "none",
                background: isActive ? "rgba(15,23,42,0.04)" : "transparent",
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: isActive ? 700 : 600,
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }
  ThemedTabs.propTypes = {
    activeKey: PropTypes.string,
    onChange: PropTypes.func.isRequired,
  };

  // Session Details Tab
  function SessionDetailsTab({ userId }) {
    const currentOrgId = useCurrentOrgId();

    const [sessionDetails, setSessionDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function load() {
      if (!userId) return;

      setLoading(true);
      setError('');

      try {
        // Pass organization_id when available (required in some demo/non-JWT contexts)
        const params = currentOrgId ? { organization_id: currentOrgId } : {};
        const data = await getUserSessionDetails(userId, params);
        setSessionDetails(data || null);
      } catch (e) {
        setSessionDetails(null);
        setError(e?.message || 'Failed to load session details.');
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, currentOrgId]);

    const AggregatesPanel = () => {
      if (loading) {
        return (
          <div
            role="status"
            aria-live="polite"
            style={{ minHeight: 120, display: 'grid', placeItems: 'center' }}
          >
            Loading session details...
          </div>
        );
      }

      if (error) {
        return (
          <div>
            <div role="alert" className="error">
              {error}
            </div>
            <button
              type="button"
              onClick={load}
              className="btn btn-ghost"
              style={{ height: 28, padding: '2px 8px' }}
            >
              Retry
            </button>
          </div>
        );
      }

      if (!sessionDetails) {
        return (
          <div
            style={{
              background: 'transparent',
              color: '#ffffff',
              border: 'none',
              boxShadow: 'none',
              textAlign: 'center',
              padding: 12,
              borderRadius: 8,
            }}
          >
            No session details found for this user.
          </div>
        );
      }

      const valueStyle = {
        margin: 0,
        color: 'var(--text-primary, #111827)',
        fontWeight: 600,
        wordBreak: 'break-word',
      };
      const labelStyle = {
        display: 'block',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--text-tertiary, #64748B)',
        letterSpacing: '.02em',
        marginBottom: 6,
      };

      const cardStyle = {
        background: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border-subtle, #e5e7eb)',
        borderRadius: 12,
        boxShadow: 'var(--shadow, 0 1px 2px rgba(16,24,40,0.04))',
        padding: 16,
        marginBottom: 12,
      };

      // Existing fields (kept)
      const totalCount =
        sessionDetails?.total_count ??
        sessionDetails?.totalCount ??
        sessionDetails?.total_sessions;

      const totalDuration =
        sessionDetails?.total_duration ??
        sessionDetails?.totalDuration ??
        sessionDetails?.duration_total;

      // New fields (requested)
      const organizationName =
        sessionDetails?.organization_name ??
        sessionDetails?.organizationName ??
        sessionDetails?.org_name ??
        sessionDetails?.tenant_name ??
        null;

      const rawServiceTypes = sessionDetails?.service_type ?? sessionDetails?.serviceType ?? [];
      const serviceTypesDeduped = Array.from(
        new Set(
          (Array.isArray(rawServiceTypes) ? rawServiceTypes : [rawServiceTypes])
            .filter((v) => v != null && String(v).trim() !== '')
            .map((v) => String(v))
        )
      );

      const totalCost =
        sessionDetails?.total_cost ??
        sessionDetails?.totalCost ??
        sessionDetails?.cost_total ??
        null;

      return (
        <section aria-label="Aggregated session details" style={cardStyle}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <span style={labelStyle}>User name</span>
              <div
                style={valueStyle}
                title={(user?.name || user?.full_name || user?.email) || undefined}
              >
                {(user?.name || user?.full_name || user?.email) ?? '—'}
              </div>
            </div>

            <div>
              <span style={labelStyle}>User ID</span>
              <div style={valueStyle} title={userId || undefined}>
                {userId || '—'}
              </div>
            </div>

            {/* Kept for visual consistency; backend response doesn't provide this in the contract */}
         

            <div>
              <span style={labelStyle}>Service Type</span>
              <div style={valueStyle} title={serviceTypesDeduped.join(', ') || undefined}>
                {serviceTypesDeduped.length ? serviceTypesDeduped.join(', ') : '—'}
              </div>
            </div>

            <div>
              <span style={labelStyle}>Organization</span>
              <div style={valueStyle} title={organizationName ? String(organizationName) : undefined}>
                {organizationName ? String(organizationName) : '—'}
              </div>
            </div>

            <div>
              <span style={labelStyle}>Number of sessions</span>
              <div style={valueStyle}>
                {Number.isFinite(Number(totalCount)) ? Number(totalCount) : '—'}
              </div>
            </div>

            <div>
              <span style={labelStyle}>Total Duration</span>
              <div
                style={valueStyle}
                title={totalDuration != null ? String(totalDuration) : undefined}
              >
                {totalDuration != null && String(totalDuration).trim() !== ''
                  ? String(totalDuration)
                  : '—'}
              </div>
            </div>

            <div>
              <span style={labelStyle}>Total Cost</span>
              <div style={valueStyle} title={totalCost != null ? String(totalCost) : undefined}>
                {totalCost != null && Number.isFinite(Number(totalCost))
                  ? formatUsdUpToSixDecimals(Number(totalCost))
                  : '—'}
              </div>
            </div>
          </div>
        </section>
      );
    };

    return (
      <div data-testid="session-details-tab">
        <AggregatesPanel />
      </div>
    );
  }
  SessionDetailsTab.propTypes = { userId: PropTypes.string };

  // Credits Consumed Tab
  function CreditsConsumedTab({ userId }) {
    /**
     * This tab previously fetched LLM cost records to compute per-user spend.
     * Per request, the LLM costs API call has been removed.
     *
     * We keep the tab functional and stable by rendering a graceful empty state
     * (no spinner, no API error/retry) while preserving the rest of the modal.
     */
    const rows = useMemo(() => [], []);

    // With no backing API call, the total is deterministically 0.
    const totalCost = 0;

    return (
      <div data-testid="credits-consumed-tab">
        {/* Summary header */}
        <div
          className="card"
          style={{
            marginBottom: 12,
            padding: 12,
            background: 'var(--bg-surface, #fff)',
            border: '1px solid var(--border-subtle,#e5e7eb)',
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary,#64748B)',
              fontWeight: 700,
              letterSpacing: '.02em',
            }}
          >
            Total Cost
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {formatUsdUpToSixDecimals(totalCost)}
          </div>
        </div>

        {/* Keep a predictable UI with no dependency on removed LLM costs data */}
        {userId ? (
          <div className="table-empty">
            Credits consumed details are currently unavailable.
          </div>
        ) : (
          <div className="table-empty">No user selected.</div>
        )}

        {/* Preserve DataTable import usage pattern (if future data source is reintroduced) */}
        {Array.isArray(rows) && rows.length > 0 ? (
          <DataTable
            data={rows}
            loading={false}
            pageSize={10}
            initialPage={1}
            paginationTitle="Costs pages"
            maxBodyHeight={360}
            forceHorizontalScroll
          />
        ) : null}
      </div>
    );
  }
  CreditsConsumedTab.propTypes = { userId: PropTypes.string };

  return (
    <Modal title={title} open={open} onClose={onClose} className="tabbed-user-modal">
      <div className="sticky-header" style={{ boxShadow: "0 1px 0 var(--border-subtle)", background: "var(--bg-surface, #fff)" }}>
        <div style={{ padding: "12px 20px" }}>
          <ThemedTabs activeKey={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <div role="region" style={{ flex: 1, overflow: "auto", background: "var(--bg-canvas, #f9fafb)" }}>
        <div style={{ padding: 20 }}>
          {activeTab === 'details' && <UserDetailsView user={user} />}
          {activeTab === 'projects' && <ProjectDetails selectedUser={user || null} />}
          {activeTab === 'sessions' && <SessionDetailsTab userId={userId} />}
          {activeTab === 'credits' && <CreditsConsumedTab userId={userId} />}
          {activeTab === 'analytics' && (
            <UsersAnalyticsPanelModal
              userId={userId}
              tenantId={tenantId}
              from={from}
              to={to}
            />
          )}
        </div>
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface, #fff)" }}>
        <button
          type="button"
          onClick={onClose}
          className="btn-modal-close"
          style={{ width: "100%", borderRadius: 10 }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}

TabbedUserModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.object,
  tenantId: PropTypes.string,
  defaultTab: PropTypes.oneOf(['details', 'sessions', 'credits', 'analytics']),
  from: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  to: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
};
