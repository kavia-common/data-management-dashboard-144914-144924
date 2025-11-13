import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSessionDetails } from '../api/sessionDetails';

/**
 * PUBLIC_INTERFACE
 * React hook to fetch and manage session details for a user.
 */
export default function useSessionDetails({ userId, tenantId, from, to, enabled = true }) {
  const abortRef = useRef();
  const [data, setData] = useState(null); // { sessions, total_sessions, total_duration, duration_unit }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!enabled || !userId) return;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSessionDetails({ userId, tenantId, from, to, signal: controller.signal });
      setData(res);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, userId, tenantId, from, to]);

  useEffect(() => {
    load();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [load]);

  const totals = useMemo(() => {
    if (!data) return { totalSessions: 0, totalDurationSec: 0, durationUnit: 'seconds' };
    return {
      totalSessions: Number(data.total_sessions || 0),
      totalDurationSec: Number(data.total_duration || 0),
      durationUnit: data.duration_unit || 'seconds',
    };
  }, [data]);

  return {
    data,
    sessions: data?.sessions || [],
    totals,
    loading,
    error,
    reload: load,
  };
}
