import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import { getChartTheme } from '../charts/chartTheme';
import { buildOverviewFilterParams } from '../../api/buildOverviewFilterParams';
import { getOverviewProjectsSummary } from '../../api/overviewAnalytics';

/**
 * PUBLIC_INTERFACE
 * ProjectsCreatedBarChart
 * Ensures single, debounced API call per filter change.
 * - Always send range; include start/end only for custom.
 * - Debounce user-triggered fetches by 150ms.
 * - Guard initial mount to avoid StrictMode double fetch.
 * - When organization_id is "T0000" and response.barData exists, render a horizontal bar chart by tenant.
 */
export default function ProjectsCreatedBarChart() {
  const organizationId = useCurrentOrgId();
  const [range, setRange] = useState('daily');
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error
  const [error, setError] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [barData, setBarData] = useState([]); // super-admin horizontal data

  const theme = getChartTheme();

  // Stable debounced fetch using a ref-held timeout
  const debounceRef = useRef(null);
  const hasMountedRef = useRef(false);

  // Tooltip state for custom horizontal bars (T0000)
  const [hovered, setHovered] = useState(null); // { key, x, y }
  const tooltipRef = useRef(null);

  const fetchSummary = useCallback(async () => {
    if (!organizationId) return;

    setStatus('loading');
    setError(null);

    const params = { range };
    if (range === 'custom' && appliedStart && appliedEnd) {
      params.start_date = appliedStart;
      params.end_date = appliedEnd;
    }

    try {
      const req = buildOverviewFilterParams({ organizationId, params });
      const res = await getOverviewProjectsSummary(req);
      // Preserve original buckets rendering for non-T0000 cases
      const list = Array.isArray(res?.buckets) ? res.buckets : [];
      // For T0000 responses, we may receive barData: [{ organization_id, name, count }, ...]
      const incomingBar = Array.isArray(res?.barData) ? res.barData : [];

      // Determine emptiness across both shapes
      const hasAny =
        (list && list.length > 0) || (incomingBar && incomingBar.length > 0);

      if (!hasAny) {
        setBuckets([]);
        setBarData([]);
        setStatus('empty');
      } else {
        setBuckets(list);
        // Sort horizontal bars descending by count for readability
        const sorted = incomingBar
          .slice()
          .sort((a, b) => Number(b?.count || 0) - Number(a?.count || 0));
        setBarData(sorted);
        setStatus('success');
      }
    } catch (e) {
      setError(e?.message || 'Failed to load projects summary.');
      setStatus('error');
    }
  }, [organizationId, range, appliedStart, appliedEnd]);

  // Centralized debounced effect controlling all fetches
  useEffect(() => {
    // On initial mount, fetch once
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      fetchSummary();
      return;
    }

    // Reset custom when changing away from custom
    if (range !== 'custom') {
      if (appliedStart || appliedEnd) {
        setAppliedStart('');
        setAppliedEnd('');
      }
    } else {
      // For custom, only fetch when both applied dates are set
      if (!(appliedStart && appliedEnd)) {
        return;
      }
    }

    // Debounce subsequent fetches to avoid double calls from fast state transitions
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchSummary();
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [range, appliedStart, appliedEnd, fetchSummary]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      // Setting appliedStart/appliedEnd triggers a single debounced fetch via the effect
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  // Time-bucketed chart shape (existing)
  const chartData = useMemo(
    () =>
      (buckets || []).map((b) => ({
        label: b.label || b.key,
        count: Number(b.count || 0),
      })),
    [buckets]
  );

  // Horizontal bar list data for T0000 + barData
  const horizontalData = useMemo(
    () =>
      (barData || []).map((d) => ({
        key: d.organization_id || d.name || '',
        name: d.name || d.organization_id || '',
        count: Number(d.count || 0),
      })),
    [barData]
  );

  const isEmpty = status === 'empty';

  // Render a simple CSS-based horizontal bar list when org is T0000 and barData is present
  const shouldShowHorizontal =
    String(organizationId) === 'T0000' && Array.isArray(barData) && barData.length > 0;

  // Compute scale for widths
  const maxValue = useMemo(() => {
    if (!shouldShowHorizontal) return 0;
    return horizontalData.reduce((m, it) => Math.max(m, it.count || 0), 0);
  }, [shouldShowHorizontal, horizontalData]);

  // Handlers for custom tooltip positioning
  const handleBarMouseEnter = (e, item) => {
    if (!e?.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHovered({
      key: item.key,
      name: item.name,
      count: item.count,
      x: rect.left + rect.width,
      y: rect.top,
    });
  };
  const handleBarMouseMove = (e, item) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHovered((prev) =>
      prev && prev.key === item.key
        ? { ...prev, x: rect.left + rect.width, y: rect.top }
        : prev
    );
  };
  const handleBarMouseLeave = () => setHovered(null);

  const tooltipPortalStyle = {
    position: 'fixed',
    zIndex: 9999,
    pointerEvents: 'none',
    background: '#2b2723',
    color: '#ffffff',
    padding: '6px 8px',
    borderRadius: 8,
    boxShadow: '0 8px 16px rgba(0,0,0,0.25)',
    fontSize: 12,
    lineHeight: 1.2,
    transform: 'translate(-8px, -42px)',
    whiteSpace: 'nowrap',
  };

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header project summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Projects Created</h3>
        <div className="overview-users-summary__controls">
          <label htmlFor="projects-range" className="overview-users-summary__label">
            Range
          </label>
          <select
            id="projects-range"
            className="overview-users-summary__select"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>

          {range === 'custom' && (
            <>
              <label htmlFor="projects-start" className="overview-users-summary__label">
                Start
              </label>
              <input
                id="projects-start"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
              />
              <label htmlFor="projects-end" className="overview-users-summary__label">
                End
              </label>
              <input
                id="projects-end"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingEnd}
                onChange={(e) => setPendingEnd(e.target.value)}
              />
              <button
                onClick={onApplyCustom}
                disabled={!pendingStart || !pendingEnd}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${theme.primary}`,
                  background: theme.primary,
                  color: '#fff',
                  cursor: (!pendingStart || !pendingEnd) ? 'not-allowed' : 'pointer',
                }}
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {status === 'loading' && (
        <div style={{ padding: 16, color: '#6b7280' }}>Loading…</div>
      )}
      {status === 'error' && (
        <div role="alert" style={{ padding: 16, color: '#EF4444' }}>{error}</div>
      )}
      {isEmpty && (
        <div style={{ padding: 16, color: '#6b7280' }}>No projects for the selected range.</div>
      )}

      {status === 'success' && !isEmpty && (
        <>
          {shouldShowHorizontal ? (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 8,
                overflow: 'visible',
              }}
              aria-label="Projects created by tenant"
            >
              {horizontalData.map((item) => {
                const pct = maxValue > 0 ? Math.max(2, Math.round((item.count / maxValue) * 100)) : 0;
                return (
                  <div
                    key={`${item.key}-${item.name}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 4fr auto',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      title={item.name}
                      style={{
                        color: '#ffffff',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                    <div
                      role="img"
                      aria-label={`${item.name}: ${item.count}`}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.06))',
                        borderRadius: 999,
                        height: 14,
                        position: 'relative',
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                        overflow: 'visible',
                      }}
                    >
                      <div
                        tabIndex={0}
                        aria-describedby={`tooltip-${item.key}`}
                        aria-label={`${item.name} projects bar`}
                        onMouseEnter={(e) => handleBarMouseEnter(e, item)}
                        onMouseMove={(e) => handleBarMouseMove(e, item)}
                        onMouseLeave={handleBarMouseLeave}
                        style={{
                          width: `${pct}%`,
                          maxWidth: '100%',
                          height: '100%',
                          background: '#ffffff',
                          borderRadius: 999,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
                          transition: 'width 200ms ease',
                          position: 'relative',
                        }}
                      />
                      {/* Fallback CSS sibling tooltip for hover/focus if fixed portal fails */}
                      <div
                        id={`tooltip-${item.key}`}
                        role="tooltip"
                        style={{
                          position: 'absolute',
                          left: `${Math.min(pct, 95)}%`,
                          top: -42,
                          transform: 'translateX(-50%)',
                          background: '#2b2723',
                          color: '#ffffff',
                          padding: '6px 8px',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.28)',
                          whiteSpace: 'nowrap',
                          fontSize: 12,
                          lineHeight: 1.2,
                          pointerEvents: 'none',
                          opacity: 0,
                          transition: 'opacity 150ms ease, transform 150ms ease',
                          zIndex: 999,
                        }}
                        className="t0000-tooltip"
                      >
                        <span style={{ fontWeight: 700 }}>{item.name}</span>
                        <span style={{ opacity: 0.95 }}> — {item.count}</span>
                        <span
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            bottom: -6,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid #2b2723',
                          }}
                        />
                      </div>
                      <style>{`
                        /* Show tooltip on hover or keyboard focus of the foreground bar */
                        [aria-describedby="tooltip-${item.key}"]:hover ~ #tooltip-${item.key},
                        [aria-describedby="tooltip-${item.key}"]:focus ~ #tooltip-${item.key} {
                          opacity: 1;
                          transform: translateX(-50%) translateY(-2px);
                        }
                      `}</style>
                    </div>
                    <div
                      style={{
                        minWidth: 40,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: '#ffffff',
                        fontSize: 12,
                      }}
                    >
                      {item.count}
                    </div>
                  </div>
                );
              })}
              {/* Absolute/fixed positioned tooltip to avoid clipping and ensure pointer events don't block */}
              {hovered && (
                <div
                  ref={tooltipRef}
                  style={{
                    ...tooltipPortalStyle,
                    left: hovered.x,
                    top: hovered.y,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{hovered.name}</span>
                  <span style={{ opacity: 0.95 }}> — {hovered.count}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: String(organizationId) === 'T0000' ? '#ffffff' : theme.primary }}
                    axisLine={{ stroke: String(organizationId) === 'T0000' ? '#ffffff' : theme.axisTick }}
                    tickLine={{ stroke: String(organizationId) === 'T0000' ? '#ffffff' : theme.axisTick }}
                    interval="preserveEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: String(organizationId) === 'T0000' ? '#ffffff' : theme.axisTick }}
                    axisLine={{ stroke: String(organizationId) === 'T0000' ? '#ffffff' : theme.axisTick }}
                    tickLine={{ stroke: String(organizationId) === 'T0000' ? '#ffffff' : theme.axisTick }}
                  />
                  <Tooltip
                    formatter={(value) => [value, 'Projects']}
                    labelFormatter={(label) => `Date: ${label}`}
                    wrapperStyle={{ zIndex: 9999, pointerEvents: 'auto' }}
                    contentStyle={{ background: '#2b2723', border: 'none', borderRadius: 8 }}
                    itemStyle={{ color: '#ffffff' }}
                    labelStyle={{ color: '#ffffff' }}
                  />
                  <Bar dataKey="count" name="Projects" fill={String(organizationId) === 'T0000' ? '#ffffff' : theme.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
