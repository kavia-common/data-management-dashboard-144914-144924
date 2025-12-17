import React from 'react';

/**
 * PUBLIC_INTERFACE
 * OverviewKpiCountCards
 * Minimal KPI count cards for Users, Sessions, Deployments with default Card styling.
 * Props:
 * - data: { totalUsers?: number, totalSessions?: number, totalDeployedApps?: number }
 * - loading?: boolean
 * - error?: boolean
 */
export default function OverviewKpiCountCards({ data, loading = false, error = false }) {
  const cards = [
    { key: 'users', label: 'Users', value: Number(data?.totalUsers ?? 0) },
    { key: 'sessions', label: 'Sessions', value: Number(data?.totalSessions ?? 0) },
    { key: 'deployments', label: 'Deployments', value: Number(data?.totalDeployedApps ?? 0) },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: 16,
        width: '100%',
      }}
      aria-label="Overview KPI Totals"
    >
      {cards.map((c) => (
        <div
          key={c.key}
          className="overview-card sm:col-span-6 md:col-span-4"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 96,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 13, color: '#6B7280' }}>{c.label}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: error ? '#EF4444' : '#111827',
                letterSpacing: '-0.02em',
              }}
              aria-live="polite"
              aria-busy={loading ? 'true' : 'false'}
            >
              {loading ? '\u2014' : Number.isFinite(c.value) ? c.value.toLocaleString() : '0'}
            </div>
            {error && (
              <div
                role="note"
                title="Failed to load"
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  color: '#EF4444',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  padding: '2px 6px',
                  borderRadius: 999,
                }}
              >
                error
              </div>
            )}
            {!error && loading && (
              <div
                role="status"
                aria-label="Loading"
                style={{
                  marginLeft: 'auto',
                  width: 48,
                  height: 10,
                  borderRadius: 6,
                  background: 'linear-gradient(90deg, #E5E7EB 0%, #F3F4F6 50%, #E5E7EB 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'kpiPulse 1.2s ease-in-out infinite',
                }}
              />
            )}
          </div>
        </div>
      ))}

      <style>{`
        @keyframes kpiPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
