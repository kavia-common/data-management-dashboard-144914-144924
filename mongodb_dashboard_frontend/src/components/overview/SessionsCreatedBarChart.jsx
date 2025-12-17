import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import useCurrentOrgId from '../../hooks/useCurrentOrgId';
import Card from '../common/Card';
import './overview.css';
import '../overview/overviewUsersSummary.css';
import { buildOverviewFilterParams } from '../../api/buildOverviewFilterParams';
import apiClient from '../../api/client';

/**
 * PUBLIC_INTERFACE
 * SessionsCreatedBarChart
 * Aligned to fetch from GET /api/project-create/summary using organizationId and filter params.
 */
export default function SessionsCreatedBarChart() {
  const organizationId = useCurrentOrgId();
  const [range, setRange] = useState('daily');
  const [pendingStart, setPendingStart] = useState('');
  const [pendingEnd, setPendingEnd] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [status, setStatus] = useState('idle'); // idle | loading | success | empty | error
  const [error, setError] = useState(null);
  const [buckets, setBuckets] = useState([]);

  // Build query params using existing utility to remain consistent with Overview filters.
  const queryParams = useMemo(() => {
    const base = buildOverviewFilterParams({
      range,
      startDate: appliedStart,
      endDate: appliedEnd,
    });
    if (organizationId) base.organization_id = organizationId;
    return base;
  }, [organizationId, range, appliedStart, appliedEnd]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!organizationId) {
        setBuckets([]);
        setStatus('empty');
        return;
      }
      if (range === 'custom' && (!appliedStart || !appliedEnd)) {
        return;
      }
      setStatus('loading');
      setError(null);
      try {
        const resp = await apiClient.get('/api/project-create/summary', { params: queryParams });
        if (cancelled) return;

        const incoming = Array.isArray(resp?.data?.buckets) ? resp.data.buckets : [];
        const shaped = incoming.map(b => ({
          key: b.key,
          label: b.label || b.key,
          count: typeof b.count === 'number' ? b.count : 0,
        }));
        if (shaped.length === 0) {
          setStatus('empty');
        } else {
          setStatus('success');
        }
        setBuckets(shaped);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load sessions created summary.');
          setStatus('error');
          setBuckets([]);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [organizationId, queryParams, range, appliedStart, appliedEnd]);

  const onApplyCustom = () => {
    if (pendingStart && pendingEnd) {
      setAppliedStart(pendingStart);
      setAppliedEnd(pendingEnd);
    }
  };

  return (
    <Card style={{ marginTop: 16, overflow: 'visible' }}>
      <div className="overview-users-summary__header project summary" style={{ marginBottom: 8 }}>
        <h3 className="overview-users-summary__title">Sessions Created</h3>
        <div className="overview-users-summary__controls">
          <label htmlFor="sessions-range" className="overview-users-summary__label">
            Range
          </label>
          <select
            id="sessions-range"
            className="overview-users-summary__select"
            value={range}
            onChange={(e) => {
              setRange(e.target.value);
              if (e.target.value !== 'custom') {
                setAppliedStart('');
                setAppliedEnd('');
              }
            }}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </select>

          {range === 'custom' && (
            <>
              <label htmlFor="sessions-start" className="overview-users-summary__label">
                Start
              </label>
              <input
                id="sessions-start"
                type="date"
                className="overview-users-summary__date-input"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
              />
              <label htmlFor="sessions-end" className="overview-users-summary__label">
                End
              </label>
              <input
                id="sessions-end"
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
                  border: '1px solid #2563EB',
                  background: '#2563EB',
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
      {status === 'empty' && (
        <div style={{ padding: 16, color: '#6b7280' }}>No sessions for the selected range.</div>
      )}

      {status === 'success' && (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={buckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
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
              <Tooltip />
              <Bar dataKey="count" name="Sessions" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
