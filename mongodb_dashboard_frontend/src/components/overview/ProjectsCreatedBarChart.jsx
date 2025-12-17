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
 * and optional range/start_date/end_date. Renders the response buckets as a bar chart.
 *
 * Response shape:
 * {
 *   buckets: [{ key: "YYYY-MM-DD", label: "YYYY-MM-DD", count: number }]
 * }
 *
 * Mapping to chart data:
 * - Input buckets[] -> [{ name: label || key, value: count, color }]
 * - Bar dataKey -> "value"
 * - XAxis dataKey -> "name"
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

// Custom tooltip showing project name and count, tinted with the same bar color
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const d = payload[0];
    const color = d?.payload?.color || DEFAULT_COLOR;
    const name = d?.payload?.name ?? label;
    const value = d?.payload?.value ?? d?.value;

    return (
      <div
        style={{
          background: '#fff',
          border: `1px solid ${color}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          padding: '8px 10px',
          color: '#111827',
          minWidth: 160,
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
        <div style={{ fontSize: 12 }}>
          <div>
            <span style={{ color: '#6B7280' }}>Project: </span>
            <span style={{ color }}>{name}</span>
          </div>
          <div>
            <span style={{ color: '#6B7280' }}>Count: </span>
            <span style={{ color }}>{value}</span>
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
    height = 280,
    filters = {}, // expected filters include range/start_date/end_date etc.
  } = props;

  const organizationIdFromCtx = useCurrentOrgId();

  // Build a stable, primitive-only query string. Avoid inline object creation in deps.
  const queryString = useMemo(() => {
    const effOrg =
      organizationIdFromCtx ||
      filters?.organizationId ||
      filters?.organization_id ||
      filters?.tenant_id ||
      null;

    const p = new URLSearchParams();
    if (effOrg) p.set('organization_id', effOrg);
    if (filters?.range) p.set('range', filters.range);
    if (filters?.start_date) p.set('start_date', filters.start_date);
    if (filters?.end_date) p.set('end_date', filters.end_date);
    return p.toString();
  }, [
    organizationIdFromCtx,
    filters?.organizationId,
    filters?.organization_id,
    filters?.tenant_id,
    filters?.range,
    filters?.start_date,
    filters?.end_date,
  ]);

  // Derived effective organization id (primitive) – for header pass-through only.
  const effectiveOrgId = useMemo(() => {
    return (
      organizationIdFromCtx ||
      filters?.organizationId ||
      filters?.organization_id ||
      filters?.tenant_id ||
      ''
    );
  }, [
    organizationIdFromCtx,
    filters?.organizationId,
    filters?.organization_id,
    filters?.tenant_id,
  ]);

  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'empty' | 'error'
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  // Map response buckets to chart-friendly data, memoized to stable identity
  const mapBuckets = useCallback(
    (buckets) =>
      (buckets || []).map((b, idx) => ({
        name: b?.label || b?.key || `#${idx + 1}`,
        value: Number.isFinite(b?.count) ? b.count : Number(b?.count || 0),
        color: b?.color || DEFAULT_COLOR,
      })),
    []
  );

  // One AbortController per in-flight request, canceled only when a new run supersedes it
  const abortRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    // If org is missing, show empty and do not fetch
    if (!effectiveOrgId) {
      setStatus('empty');
      setError(null);
      setData([]);
      return () => {
        mounted = false;
        if (abortRef.current) abortRef.current.abort();
      };
    }

    // Supersede any prior in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const url = '/api/project-create/summary'; // strict URL
    const fetchUrl = queryString ? `${url}?${queryString}` : url;

    const run = async () => {
      if (mounted) {
        setStatus('loading');
        setError(null);
      }

      try {
        const res = await fetch(fetchUrl, {
          headers: effectiveOrgId ? { 'x-organization-id': effectiveOrgId } : undefined,
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
    // Only re-run when queryString or header primitive changes
  }, [queryString, effectiveOrgId, mapBuckets]);

  const fallbackBarColor = PRIMARY_COLOR;

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header project_created" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">{title}</h3>
      </div>

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
