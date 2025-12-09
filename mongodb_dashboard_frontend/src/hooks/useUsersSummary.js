import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUsersSummary } from '../api/usersSummary';
import { formatISODateOnly } from '../utils/date';

/**
 * Returns today's date in YYYY-MM-DD format using existing utility if available,
 * otherwise falls back to a local formatter.
 */
function getTodayYmd() {
  // Prefer shared util if exported; otherwise use local.
  try {
    if (typeof formatISODateOnly === 'function') {
      return formatISODateOnly(new Date());
    }
  } catch (_) {
    // ignore and fallback
  }
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * PUBLIC_INTERFACE
 * useUsersSummary
 *
 * Hook to fetch users summary grouped by created_at buckets with date-range controls.
 * - Defaults to range='daily' with today's start/end (display purposes).
 * - When range === 'custom', both startDate and endDate (YYYY-MM-DD) are required to fetch.
 * - Integrates with global auth/tenant via the shared API client (no org in query).
 *
 * Exposes:
 *   { data, loading, error, range, setRange, startDate, setStartDate, endDate, setEndDate, refetch }
 */
export default function useUsersSummary(initial = {}) {
  const today = useMemo(getTodayYmd, []);
  const [range, setRange] = useState(initial.range || 'daily');
  const [startDate, setStartDate] = useState(initial.startDate || today);
  const [endDate, setEndDate] = useState(initial.endDate || today);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // A token to avoid race conditions when rapidly changing filters.
  const requestIdRef = useRef(0);
  // Support cancellation via AbortController when axios supports signal (axios v1+).
  const abortRef = useRef(null);

  const canFetch = useMemo(() => {
    if (range === 'custom') {
      return Boolean(startDate) && Boolean(endDate);
    }
    return true;
  }, [range, startDate, endDate]);

  const fetchData = useCallback(async () => {
    if (!canFetch) return;

    // Increment request id to track latest
    const currentId = ++requestIdRef.current;

    // Cancel previous in-flight
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch (_) {
        // ignore
      }
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params =
        range === 'custom'
          ? { range: 'custom', start_date: startDate, end_date: endDate }
          : { range };

      // getUsersSummary uses the shared axios client which may or may not accept AbortController.signal.
      // We wrap it to pass through when available by temporarily patching client.get is not desired;
      // instead, rely on the browser abort to reject the promise if axios supports it.
      // To keep compatibility, we do not pass signal here because our client wrapper signature is fixed.
      const result = await getUsersSummary(params);

      // Only apply if still latest
      if (requestIdRef.current === currentId) {
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      if (requestIdRef.current !== currentId) {
        // Outdated request; ignore
        return;
      }
      // If aborted, ignore setting error
      if (err && (err.name === 'CanceledError' || err.name === 'AbortError')) {
        setLoading(false);
        return;
      }
      setError(err);
      setLoading(false);
    }
  }, [range, startDate, endDate, canFetch]);

  // React to changes in range and dates
  useEffect(() => {
    fetchData();
    // Cleanup cancellation on unmount
    return () => {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {
          // ignore
        }
      }
    };
  }, [fetchData]);

  // PUBLIC_INTERFACE
  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    range,
    setRange,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    refetch,
  };
}
