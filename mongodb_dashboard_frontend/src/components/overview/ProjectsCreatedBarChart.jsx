import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';

/**
 * PUBLIC_INTERFACE
 * ProjectsCreatedBarChart
 * Aligned filter UX and logic with other bar chart components:
 * - Range enum: daily | weekly | monthly | custom
 * - When range=custom, show Start Date and End Date (YYYY-MM-DD), bind to start_date/end_date query params
 * - Guard fetching until both custom dates are provided
 * - Show a visible label for the active filter under the chart
 * - Use /api/project-create/summary and send organization_id plus current filters
 * - Stable useEffect deps and AbortController to avoid repeated/canceled calls
 */
const RANGE = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  custom: 'custom',
};

const RANGE_OPTIONS = [
  { label: 'Daily', value: RANGE.daily },
  { label: 'Weekly', value: RANGE.weekly },
  { label: 'Monthly', value: RANGE.monthly },
  { label: 'Custom', value: RANGE.custom },
];

// Style constants for bar and tooltip marker
const BAR_COLOR = '#FF6600';
const BAR_RADIUS = [4, 4, 0, 0];

/**
 * Tooltip that matches the other chart:
 * - white background
 * - subtle gray border and soft shadow
 * - system text color
 * - marker uses the same color as the bars
 */
function ProjectsTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div
        style={{
          background: '#ffffff',
          color: '#111827',
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          fontSize: 12,
        }}
      >
        <div style={{ marginBottom: 4, fontWeight: 600 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: BAR_COLOR,
              flex: '0 0 8px',
            }}
          />
          <span>Projects: {item.value}</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function ProjectsCreatedBarChart() {
  const organizationId = useCurrentOrgId();

  // Aligned range/custom date state
  const [range, setRange] = useState(RANGE.daily);
  const [customStart, setCustomStart] = useState(''); // YYYY-MM-DD
  const [customEnd, setCustomEnd] = useState(''); // YYYY-MM-DD

  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState([]);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);

  // Build query params according to requirements
  const queryParams = useMemo(() => {
    const q = {
      organization_id: organizationId || '',
      range,
    };
    if (range === RANGE.custom) {
      if (customStart) q.start_date = customStart;
      if (customEnd) q.end_date = customEnd;
    }
    return q;
  }, [organizationId, range, customStart, customEnd]);

  // Stable effect + AbortController
  useEffect(() => {
    if (!organizationId) return;

    // Guard: when custom, don't fetch until both dates present
    if (range === RANGE.custom) {
      if (!queryParams.start_date || !queryParams.end_date) return;
    }

    // Abort any in-flight
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const search = new URLSearchParams(queryParams).toString();
    const url = `/api/project-create/summary?${search}`;

    fetch(url, {
      headers: organizationId ? { 'x-organization-id': organizationId } : undefined,
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `Request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        const buckets = data?.buckets || [];
        const shaped = buckets.map((b) => ({
          label: b.label || b.key,
          count: typeof b.count === 'number' ? b.count : Number(b.count || 0),
        }));
        setSeries(shaped);
      })
      .catch((err) => {
        const name = err?.name || err?.code;
        if (name === 'CanceledError' || name === 'AbortError' || name === 'ERR_CANCELED') return;
        setError(err?.message || 'Failed to fetch projects created summary');
      })
      .finally(() => {
        setLoading(false);
      });

    // Cleanup
    return () => {
      controller.abort();
    };
  }, [organizationId, range, queryParams]);

  // Active filter label
  const activeFilterLabel = useMemo(() => {
    if (range !== RANGE.custom) {
      return `Range: ${range}`;
    }
    if (customStart && customEnd) {
      return `Range: custom (${customStart} → ${customEnd})`;
    }
    return 'Range: custom';
  }, [range, customStart, customEnd]);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <label htmlFor="range-select" style={{ fontWeight: 600 }}>Range</label>
        <select
          id="range-select"
          aria-label="Range selector"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {range === RANGE.custom && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="start-date" style={{ fontWeight: 600 }}>Start Date</label>
            <input
              id="start-date"
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
            <label htmlFor="end-date" style={{ fontWeight: 600 }}>End Date</label>
            <input
              id="end-date"
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>
        )}
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{String(error)}</div>}

      {!loading && !error && (
        <>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{activeFilterLabel}</div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip content={<ProjectsTooltip />} />
                <Legend />
                <Bar dataKey="count" name="Projects Created" fill={BAR_COLOR} radius={BAR_RADIUS} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
