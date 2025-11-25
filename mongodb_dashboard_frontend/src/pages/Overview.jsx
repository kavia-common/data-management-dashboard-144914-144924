import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { fetchSessionsTrend, fetchUsersTrend, fetchCostsTrend } from '../services/overviewApi';

// PUBLIC_INTERFACE
// Overview page that visualizes Sessions Trend, Users Trend, and Costs Trend with filters.
export default function Overview() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [granularity, setGranularity] = useState('day');
  const [sessionStatus, setSessionStatus] = useState('completed|active');
  const [userStatus, setUserStatus] = useState('active');

  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const tenantId = ''; // TODO: integrate with auth/tenant context if available

  const query = useMemo(
    () => ({ from, to, granularity, tenantId }),
    [from, to, granularity, tenantId]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, c] = await Promise.all([
        fetchSessionsTrend({ ...query, status: sessionStatus }),
        fetchUsersTrend({ ...query, status: userStatus }),
        fetchCostsTrend({ ...query }),
      ]);
      setSessions(s.items || []);
      setUsers(u.items || []);
      setCosts(c.items || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Overview load error', e);
    } finally {
      setLoading(false);
    }
  }, [query, sessionStatus, userStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Simple inline charts using SVG for zero-dependency
  const Chart = ({ data, color = '#2563EB', label }) => {
    const width = 600;
    const height = 160;
    const padding = 24;
    const xs = data.map((_, i) => i);
    const ys = data.map((d) => d.total || 0);
    const maxY = Math.max(1, ...ys);
    const points = data.map((d, i) => {
      const x = padding + (i * (width - padding * 2)) / Math.max(1, data.length - 1);
      const y = height - padding - ((d.total || 0) / maxY) * (height - padding * 2);
      return `${x},${y}`;
    });
    return (
      <svg width={width} height={height} role="img" aria-label={label}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          points={points.join(' ')}
        />
        {/* baseline */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
      </svg>
    );
  };

  return (
    <div className="p-4 space-y-8">
      <div className="flex gap-2 items-center flex-wrap">
        <label>
          From:
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 border rounded px-2 py-1" />
        </label>
        <label>
          To:
          <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 border rounded px-2 py-1" />
        </label>
        <label>
          Granularity:
          <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className="ml-1 border rounded px-2 py-1">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label>
          Sessions:
          <select value={sessionStatus} onChange={(e) => setSessionStatus(e.target.value)} className="ml-1 border rounded px-2 py-1">
            <option value="completed|active">Completed+Active</option>
            <option value="completed">Completed</option>
            <option value="active">Active</option>
          </select>
        </label>
        <label>
          Users:
          <select value={userStatus} onChange={(e) => setUserStatus(e.target.value)} className="ml-1 border rounded px-2 py-1">
            <option value="active">Active</option>
            <option value="deleted">Deleted</option>
          </select>
        </label>
        <button onClick={loadData} disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <section>
        <h3 className="font-semibold mb-2">Sessions Trend</h3>
        <Chart data={sessions} color="#2563EB" label="Sessions Trend" />
        <div className="text-xs text-gray-600 mt-1">Points: {sessions.length}</div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Users over time</h3>
        <Chart data={users} color="#10B981" label="Users Trend" />
        <div className="text-xs text-gray-600 mt-1">Points: {users.length}</div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Costs over time</h3>
        <Chart data={costs} color="#F59E0B" label="Costs Trend" />
        <div className="text-xs text-gray-600 mt-1">Points: {costs.length}</div>
      </section>
    </div>
  );
}
