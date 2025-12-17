import React from 'react';

/**
 * PUBLIC_INTERFACE
 * OverviewKpiCountCards
 * Minimal KPI count cards for Users, Sessions with Ocean Professional theme.
 * - data: { totalUsers: number, totalSessions: number }
 * - loading: boolean
 * - error: boolean
 *
 * Renders inline placeholders without reintroducing global LoadingState/ErrorState.
 */
export default function OverviewKpiCountCards({ data, loading = false, error = false }) {
  const activeUsersValue = Number.isFinite(Number(data?.activeUsers))
    ? Number(data?.activeUsers)
    : 0;

  const cards = [
    {
      key: 'active-users',
      label: 'Active Users',
      value: activeUsersValue,
      accent: '#2563EB', // primary accent
      bg: 'linear-gradient(180deg, rgba(37,99,235,0.06) 0%, rgba(249,250,251,1) 100%)',
    },
    {
      key: 'users',
      label: 'Users',
      value: Number(data?.totalUsers ?? 0),
      accent: '#6B7280', // neutral accent
      bg: 'linear-gradient(180deg, rgba(107,114,128,0.06) 0%, rgba(249,250,251,1) 100%)',
    },
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
          className="overview-section sm:col-span-6 md:col-span-4"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 96,
            background: c.bg,
            border: '1px solid rgba(17,24,39,0.10)',
            borderRadius: 12,
            padding: 16,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: c.accent }} />
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
              {loading ? '—' : Number.isFinite(c.value) ? c.value.toLocaleString() : '0'}
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
