import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';

/**
 * PUBLIC_INTERFACE
 * ProjectsCreatedBarChart
 * Fetches project create summary from GET /api/project-create/summary scoped by organizationId
 * and optional range/from/to. Renders the response buckets as a bar chart.
 *
 * Response shape:
 * {
 *   buckets: [{ key: string, label?: string, count: number }]
 * }
 *
 * Mapping to chart data:
 * - Input buckets[] -> [{ name: label || key, value: count, key }]
 * - Bar dataKey -> "value"
 * - XAxis dataKey -> "name"
 *
 * Notes:
 * - Minimal, non-intrusive inline filter UI is provided for range (daily|weekly|monthly)
 *   and optional From/To date fields (YYYY-MM-DD). These are wired directly to the fetch query.
 * - Project ID (key) is clearly visible in tooltip, and x-axis shows key when label is missing.
 * - Keeps the fetch URL '/api/project-create/summary' and preserves stable useEffect deps +
 *   AbortController behavior to avoid repeated or canceled calls.
 */
const PRIMARY_COLOR = '#2563EB';
const DEFAULT_COLOR = PRIMARY_COLOR;

// Loading and error UI
const LoadingState = () => (
  <div style={{ padding: 16, color: '#6b7280' }}>Loading…</div>
);

const ErrorState = ({ message }) => (
  <div role="alert" style={{ padding: 16, color: '#EF4444' }}>
    {message || 'Failed to load projects summary.'}
  </div>
);

// Tooltip showing project label/name, project ID (key), and count
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const d = payload[0];
    const color = d?.payload?.color || DEFAULT_COLOR;
    const name = d?.payload?.name ?? label;
    const value = d?.payload?.value ?? d?.value;
    const key = d?.payload?.key ?? '(unknown)';

    return (
      <div
        style={{
          background: '#fff',
          border: `1px solid ${color}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          padding: '8px 10px',
          color: '#111827',
          minWidth: 200,
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: color,
              marginRight: 8,
            }}
          />
          <strong style={{ color }}>{name}</strong>
        </div>
        <div>
          <div>
            <span style={{ color: '#6B7280' }}>Project: </span>
            <span style={{ color }}>{name}</span>
          </div>
          <div>
            <span style={{ color: '#6B7280' }}>Project ID: </span>
            <span style={{ color }}>{String(key)}</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: '#6B7280' }}>Count: </span>
            <strong style={{ color }}>{value}</strong>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ProjectsCreatedBarChart(props) {
  const {
    title = 'Projects Created',
    height = 300,
    // Optional external filters can still be passed; the local UI will manage minimal range/from/to.
    filters = {},
  } = props;

  const organizationIdFromCtx = useCurrentOrgId();

  // Minimal, non-intrusive filter UI state
  const [range, setRange] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [from, setFrom] = useState(''); // optional YYYY-MM-DD
  const [to, setTo] = useState(''); // optional YYYY-MM-DD

  // Build a stable, primitive-only query string. Avoid inline object creation in deps.
  const queryString = useMemo(() => {
    // Pull tenant/organization from context or external filters
    const effOrg =
      organizationIdFromCtx ||
      filters?.organizationId ||
      filters?.organization_id ||
      filters?.tenant_id ||
      null;

    const p = new URLSearchParams();

    // Required by many endpoints; pass when available
    if (effOrg) p.set('organization_id', effOrg);

    // Requested by the task: use daily|weekly|monthly (range) and optional from/to
    if (range) p.set('range', range);
    if (from) p.set('from', from);
    if (to) p.set('to', to);

    return p.toString();
  }, [
    organizationIdFromCtx,
    filters?.organizationId,
    filters?.organization_id,
    filters?.tenant_id,
    range,
    from,
    to,
  ]);

  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'empty' | 'error'
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  // Map response buckets to chart-friendly data, preserving key so tooltip can show Project ID
  const mapBuckets = useCallback(
    (buckets) =>
      (buckets || []).map((b, idx) => ({
        name: b?.label || b?.key || `#${idx + 1}`,
        value: Number.isFinite(b?.count) ? b.count : Number(b?.count || 0),
        key: b?.key,
        color: DEFAULT_COLOR,
      })),
    []
  );

  // One AbortController per in-flight request, canceled only when a new run supersedes it
  const abortRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    // Supersede any prior in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const baseUrl = '/api/project-create/summary'; // strict URL as required
    const fetchUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;

    const run = async () => {
      if (mounted) {
        setStatus('loading');
        setError(null);
      }

      try {
        const res = await fetch(fetchUrl, {
          // Pass through org header when available to preserve tenant scoping behavior
          headers: (() => {
            const effOrg =
              organizationIdFromCtx ||
              filters?.organizationId ||
              filters?.organization_id ||
              filters?.tenant_id ||
              '';
            return effOrg ? { 'x-organization-id': effOrg } : undefined;
          })(),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (!mounted) return;
          setStatus('error');
          setError(text || `Request failed with status ${res.status}`);
          setData([]);
          return;
        }

        const json = await res.json().catch(() => ({}));
        if (!mounted) return;

        // Map response { buckets: [{ key, label, count }] } to [{ name: label || key, value: count, key }]
        const shaped = mapBuckets(json?.buckets ?? []);
        setData(shaped);
        setStatus(shaped.length ? 'success' : 'empty');
      } catch (err) {
        // Silently ignore aborted fetches
        if (err?.name === 'AbortError') return;
        if (!mounted) return;
        setStatus('error');
        setError(err?.message || 'Failed to fetch');
        setData([]);
      }
    };

    run();

    return () => {
      // Mark unmounted to prevent state updates, then abort to free resources
      mounted = false;
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
    // Only re-run when queryString changes (range/from/to or tenant changes)
  }, [queryString, mapBuckets, organizationIdFromCtx, filters?.organizationId, filters?.organization_id, filters?.tenant_id]);

  // X-axis: include key if label is missing; otherwise keep label minimal
  const xTickFormatter = (tickValue) => {
    const found = data.find((d) => d.name === tickValue);
    if (!found) return tickValue ?? '';
    if (!found.name && found.key) return `${found.key}`;
    // If name equals key, just return it once
    if (found.name && found.key && found.name === found.key) return found.name;
    return found.name ?? found.key ?? '';
  };

  // Minimal, inline filter UI
  const Filters = () => (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 10,
      }}
    >
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
        <span style={{ color: '#374151' }}>Range</span>
        <select
          aria-label="Time range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#fff',
          }}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
        <span style={{ color: '#374151' }}>From</span>
        <input
          aria-label="From date"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#fff',
          }}
        />
      </label>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
        <span style={{ color: '#374151' }}>To</span>
        <input
          aria-label="To date"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#fff',
          }}
        />
      </label>
    </div>
  );

  const fallbackBarColor = PRIMARY_COLOR;

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header project_created" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">{title}</h3>
      </div>

      {/* Minimal filters inline, non-intrusive */}
      <Filters />

      {status === 'loading' && <LoadingState />}
      {status === 'error' && <ErrorState message={error} />}
      {status === 'empty' && (
        <div style={{ padding: 16, color: '#6b7280' }}>
          No projects for the selected range.
        </div>
      )}

      {status === 'success' && (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#1f2937' }}
                axisLine={{ stroke: '#9ca3af' }}
                tickLine={{ stroke: '#9ca3af' }}
                interval="preserveEnd"
                tickFormatter={xTickFormatter}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#1f2937' }}
                axisLine={{ stroke: '#9ca3af' }}
                tickLine={{ stroke: '#9ca3af' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Projects" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || fallbackBarColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
